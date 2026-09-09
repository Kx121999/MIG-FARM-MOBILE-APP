import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { fail } from '../lib/validation.mjs';

const MAX_BYTES = 5 * 1024 * 1024;
const mimeExt = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const purposePrefix = new Map([
  ['offer-banner', 'offers'],
  ['home-banner', 'home'],
  ['avatar', 'avatars'],
]);

export function createMediaStorage(env = process.env, options = {}) {
  const provider = String(env.MEDIA_STORAGE_PROVIDER || '').toLowerCase();
  const configured =
    provider === 'mock' ||
    ((provider === 's3' || provider === 'r2') &&
      env.MEDIA_S3_ENDPOINT &&
      env.MEDIA_S3_REGION &&
      env.MEDIA_S3_BUCKET &&
      env.MEDIA_S3_ACCESS_KEY_ID &&
      env.MEDIA_S3_SECRET_ACCESS_KEY &&
      env.MEDIA_PUBLIC_BASE_URL);

  const status = () => {
    if (!provider) return 'not_configured';
    return configured ? 'configured' : 'setup_required';
  };

  const validate = ({ file, purpose }) => {
    if (!purposePrefix.has(purpose)) throw fail(400, 'invalid_media_purpose');
    if (!file?.buffer?.length) throw fail(400, 'invalid_file');
    if (file.buffer.length > MAX_BYTES) throw fail(413, 'file_too_large');
    if (!mimeExt.has(file.contentType)) throw fail(415, 'unsupported_media_type');
    const ext = String(file.filename || '').split('.').pop()?.toLowerCase();
    if (ext && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) throw fail(415, 'unsupported_media_type');
    return mimeExt.get(file.contentType);
  };

  const objectKey = (purpose, ext) => `mig-farm/${purposePrefix.get(purpose)}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

  return {
    get available() {
      return configured;
    },
    status,
    ownsKey(key = '') {
      return typeof key === 'string' && key.startsWith('mig-farm/') && !key.includes('..') && !key.startsWith('/');
    },
    async upload({ file, purpose }) {
      const ext = validate({ file, purpose });
      if (!configured) throw fail(503, 'media_storage_not_configured');
      const key = objectKey(purpose, ext);
      if (provider === 'mock')
        return { ok: true, key, url: `${String(env.MEDIA_PUBLIC_BASE_URL || 'https://media.example.test').replace(/\/+$/, '')}/${key}`, purpose };
      await s3Put(env, options, key, file.buffer, file.contentType);
      return { ok: true, key, url: `${String(env.MEDIA_PUBLIC_BASE_URL).replace(/\/+$/, '')}/${key}`, purpose };
    },
    async remove({ key }) {
      if (!this.ownsKey(key)) throw fail(400, 'invalid_media_key');
      if (!configured) throw fail(503, 'media_storage_not_configured');
      if (provider === 'mock') return { ok: true };
      await s3Delete(env, options, key);
      return { ok: true };
    },
  };
}

async function s3Put(env, options, key, body, contentType) {
  await sendS3(env, options, new PutObjectCommand({
    Bucket: env.MEDIA_S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

async function s3Delete(env, options, key) {
  await sendS3(env, options, new DeleteObjectCommand({
    Bucket: env.MEDIA_S3_BUCKET,
    Key: key,
  }));
}

async function sendS3(env, options, command) {
  try {
    const client = options.s3Client || new S3Client({
      endpoint: env.MEDIA_S3_ENDPOINT,
      region: env.MEDIA_S3_REGION || 'auto',
      credentials: {
        accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID,
        secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY,
      },
    });
    await client.send(command);
  } catch {
    throw fail(503, 'media_storage_request_failed');
  }
}
