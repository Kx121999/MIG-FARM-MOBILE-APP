import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
async function client() {
  let stored = null, handler;
  const calls = [];
  const exports = {};
  const store = { read: async () => stored, write: async value => { stored = value; }, clear: async () => { stored = null; } };
  runInNewContext(compile(await readFile('src/services/apiClient.ts', 'utf8')), {
    exports, require: name => name.endsWith('/catalog') ? { API_ORIGIN: 'https://api.example.test' } : { sessionStore: store },
    AbortController, setTimeout, clearTimeout, Date, Set, Error,
    fetch: async (url, options) => { calls.push({ url, options }); return handler(url, options); },
  });
  return { ...exports, calls, store, stored: () => stored, handle: value => { handler = value; } };
}
const response = (status, body) => ({ ok: status < 400, status, json: async () => body });
const session = (id = 'A') => ({ user: { id }, accessToken: 'access-' + id, refreshToken: 'refresh-' + id, expiresAt: Date.now() + 60000 });

test('parallel expired requests rotate once and use the rotated bearer', async () => {
  const api = await client();
  api.apiSession.set({ ...session(), expiresAt: 1 });
  api.handle(async (url, options) => url.endsWith('/refresh') ? response(200, session('rotated')) : response(200, { bearer: options.headers.Authorization }));
  const values = await Promise.all([api.apiRequest('/api/me'), api.apiRequest('/api/addresses')]);
  assert.equal(api.calls.filter(call => call.url.endsWith('/refresh')).length, 1);
  assert.ok(values.every(value => value.bearer === 'Bearer access-rotated'));
  assert.equal(api.stored(), 'refresh-rotated');
});
test('invalid refresh clears local session but network outage retains recovery token', async () => {
  const api = await client();
  api.apiSession.set(session()); await api.store.write('refresh-A');
  api.handle(async () => response(503, { error: 'service_unavailable' }));
  await assert.rejects(api.refreshSession());
  assert.equal(api.stored(), 'refresh-A'); assert.equal(api.apiSession.get().user.id, 'A');
  api.handle(async () => response(401, { error: 'unauthorized' }));
  await assert.rejects(api.refreshSession());
  assert.equal(api.stored(), null); assert.equal(api.apiSession.get(), null);
});
test('logout during refresh cannot restore the old account', async () => {
  const api = await client();
  api.apiSession.set(session());
  let finish;
  api.handle(() => new Promise(resolve => { finish = resolve; }));
  const running = api.refreshSession();
  await api.apiSession.clear();
  finish(response(200, session('late')));
  assert.equal(await running, null);
  assert.equal(api.apiSession.get(), null); assert.equal(api.stored(), null);
});
test('old owner responses are rejected after account switch', async () => {
  const api = await client(); api.apiSession.set(session());
  let finish;
  api.handle(() => new Promise(resolve => { finish = resolve; }));
  const running = api.apiRequest('/api/me/orders');
  api.apiSession.set(session('B'));
  finish(response(200, { owner: 'A' }));
  await assert.rejects(running, error => error.code === 'unauthorized');
});
test('401 retries only once; guests remain unauthenticated', async () => {
  const api = await client(); api.apiSession.set(session());
  api.handle(async url => url.endsWith('/refresh') ? response(200, session('rotated')) : response(401, { error: 'unauthorized' }));
  await assert.rejects(api.apiRequest('/api/me'));
  assert.equal(api.calls.length, 3);
  assert.equal(api.apiSession.get(), null);
  await api.apiSession.clear();
  api.handle(async (_url, options) => response(200, { auth: options.headers.Authorization ?? null }));
  assert.equal((await api.apiRequest('/api/checkout/session', { auth: 'optional', method: 'POST', body: {} })).auth, null);
});
test('customer adapter preserves server ownership and normalizes order media', async () => {
  const exports = {}, calls = [];
  const util = {};
  runInNewContext(compile(await readFile('src/utils/orders.ts', 'utf8')), { exports: util, URL, Date, Error });
  runInNewContext(compile(await readFile('src/services/customer.ts', 'utf8')), {
    exports, require: name => name.endsWith('/catalog') ? { API_ORIGIN: 'https://mig-farm-api.onrender.com' }
      : name.endsWith('/orders') ? util : { apiSession: {}, CustomerServiceError: Error, apiRequest: async (path, options) => {
        calls.push({ path, options });
        if (path.includes('/orders/')) return { order: { id: 'MIG-TEST-123', createdAt: new Date().toISOString(), total: 10, subtotal: 10, delivery: 0, status: 'paid', currency: 'AED', shippingAddress: {}, items: [{ productId: 1, variantId: 2, title: 'Seed', image: '/media/seed.webp', quantity: 1, unitPrice: 10, lineTotal: 10 }] } };
        return { favorites: [11], addresses: [] };
      } }, URL, Date, Error,
  });
  await exports.customerService.setFavorite(11, true);
  assert.equal(calls[0].path, '/api/favorites/11'); assert.equal(calls[0].options.method, 'POST');
  await exports.customerService.saveAddress({ id: '', label: 'Home' });
  assert.equal(calls[1].options.method, 'POST');
  const order = await exports.customerService.order('MIG-TEST-123');
  assert.equal(order.items[0].image, 'https://mig-farm-api.onrender.com/media/seed.webp');
  await assert.rejects(exports.authService.requestPhoneCode('+971501234567'));
});
