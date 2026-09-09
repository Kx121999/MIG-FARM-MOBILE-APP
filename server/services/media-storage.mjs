import { createHash, createHmac, randomUUID } from 'node:crypto';
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

export function createMediaStorage(env = process.env) {
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
      await s3Request(env, 'PUT', key, file.buffer, file.contentType);
      return { ok: true, key, url: `${String(env.MEDIA_PUBLIC_BASE_URL).replace(/\/+$/, '')}/${key}`, purpose };
    },
    async remove({ key }) {
      if (!this.ownsKey(key)) throw fail(400, 'invalid_media_key');
      if (!configured) throw fail(503, 'media_storage_not_configured');
      if (provider === 'mock') return { ok: true };
      await s3Request(env, 'DELETE', key);
      return { ok: true };
    },
  };
}

async function s3Request(env, method, key, body, contentType = '') {
  const endpoint = String(env.MEDIA_S3_ENDPOINT).replace(/\/+$/, '');
  const region = String(env.MEDIA_S3_REGION);
  const bucket = String(env.MEDIA_S3_BUCKET);
  const access = String(env.MEDIA_S3_ACCESS_KEY_ID);
  const secret = String(env.MEDIA_S3_SECRET_ACCESS_KEY);
  const url = new URL(`${endpoint}/${bucket}/${encodeURI(key).replace(/%2F/g, '/')}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256(body || '');
  const headers = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(contentType ? { 'content-type': contentType } : {}),
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name]}\n`).join('');
  const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const signature = hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), 's3'), 'aws4_request', stringToSign, 'hex');
  const response = await fetch(url, {
    method,
    headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` },
    body,
  });
  if (!response.ok) throw fail(503, 'media_storage_request_failed');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding);
}
