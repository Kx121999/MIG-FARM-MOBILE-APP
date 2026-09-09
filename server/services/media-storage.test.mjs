import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMediaStorage } from '../services/media-storage.mjs';

test('R2 upload signs requests with SigV4 and delete sends no body', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok: true };
  };
  try {
    const storage = createMediaStorage({
      MEDIA_STORAGE_PROVIDER: 'r2',
      MEDIA_S3_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
      MEDIA_S3_REGION: 'auto',
      MEDIA_S3_BUCKET: 'mig-farm-media',
      MEDIA_S3_ACCESS_KEY_ID: 'test-access-key',
      MEDIA_S3_SECRET_ACCESS_KEY: 'test-secret-key',
      MEDIA_PUBLIC_BASE_URL: 'https://media.migfarm.test',
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
    assert.match(calls[0].init.headers.Authorization, /Credential=test-access-key\/\d{8}\/auto\/s3\/aws4_request/);
    assert.match(calls[0].init.headers.Authorization, /Signature=[a-f0-9]{64}$/);
    assert.equal(calls[0].init.body.byteLength, 4);
    await storage.remove({ key: uploaded.key });
    assert.equal(calls[1].init.method, 'DELETE');
    assert.equal(Object.hasOwn(calls[1].init, 'body'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
