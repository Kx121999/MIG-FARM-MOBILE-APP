import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createMediaStorage } from '../services/media-storage.mjs';

const env = {
  MEDIA_STORAGE_PROVIDER: 'r2',
  MEDIA_S3_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
  MEDIA_S3_REGION: 'auto',
  MEDIA_S3_BUCKET: 'mig-farm-media',
  MEDIA_S3_ACCESS_KEY_ID: 'test-access-key',
  MEDIA_S3_SECRET_ACCESS_KEY: 'test-secret-key',
  MEDIA_PUBLIC_BASE_URL: 'https://media.migfarm.test',
};

test('R2 upload and delete use AWS SDK S3 commands', async () => {
  const commands = [];
  const storage = createMediaStorage(env, {
    s3Client: {
      send: async (command) => {
        commands.push(command);
        return {};
      },
    },
  });
  const uploaded = await storage.upload({
    purpose: 'offer-banner',
    file: {
      filename: 'banner.webp',
      contentType: 'image/webp',
      buffer: Buffer.from([1, 2, 3, 4]),
    },
  });
  assert.equal(uploaded.ok, true);
  assert.match(uploaded.url, /^https:\/\/media\.migfarm\.test\/mig-farm\/offers\//);
  assert.ok(commands[0] instanceof PutObjectCommand);
  assert.equal(commands[0].input.Bucket, 'mig-farm-media');
  assert.equal(commands[0].input.Key, uploaded.key);
  assert.equal(commands[0].input.ContentType, 'image/webp');
  assert.equal(commands[0].input.Body.byteLength, 4);
  await storage.remove({ key: uploaded.key });
  assert.ok(commands[1] instanceof DeleteObjectCommand);
  assert.deepEqual(commands[1].input, {
    Bucket: 'mig-farm-media',
    Key: uploaded.key,
  });
});

test('R2 SDK failures return a safe media storage error', async () => {
  const storage = createMediaStorage(env, {
    s3Client: {
      send: async () => {
        throw new Error('provider secret details');
      },
    },
  });
  await assert.rejects(
    storage.upload({
      purpose: 'home-banner',
      file: {
        filename: 'hero.png',
        contentType: 'image/png',
        buffer: Buffer.from([1]),
      },
    }),
    (error) => error.statusCode === 503 && error.code === 'media_storage_request_failed',
  );
});
