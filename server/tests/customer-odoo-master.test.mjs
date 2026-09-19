import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../db/migrate.mjs';
import { createApp } from '../src/app.mjs';

const password = 'MIG-customer-master-test!42';

test('Neon auth uses Odoo as the linked customer master', async (t) => {
  const engine = new PGlite();
  const wrap = (client) => ({
    query: (sql, values) => values
      ? client.query(sql, values)
      : client.exec(sql).then((results) => results.at(-1)),
  });
  const db = {
    ...wrap(engine),
    transaction: (operation) => engine.transaction((tx) => operation(wrap(tx))),
  };
  t.after(() => engine.close());
  await migrate(db);

  const state = {
    nextPartnerId: 700,
    partners: new Map(),
    partnerByUser: new Map(),
    ensureCalls: [],
    updateCalls: [],
    addressById: new Map(),
    addressCalls: [],
    quoteCalls: [],
    avatarSyncs: [],
    uploaded: [],
    removed: [],
    failCustomerSync: false,
  };
  const catalog = {
    products: [{
      id: 11,
      handle: 'seed',
      title: 'Seed',
      images: [],
      variants: [{ id: 22, title: 'Packet', price: '12.35', available: true }],
    }],
    async ensureCustomerPartner(payload) {
      state.ensureCalls.push(structuredClone(payload));
      if (state.failCustomerSync)
        throw Object.assign(new Error('private upstream detail'), {
          code: 'odoo_unavailable',
          statusCode: 503,
        });
      const existing = state.partnerByUser.get(payload.appUserId);
      if (existing) return { ...state.partners.get(existing) };
      const partner = {
        partnerId: state.nextPartnerId++,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        emirate: payload.emirate || '',
        language: payload.language,
      };
      state.partnerByUser.set(payload.appUserId, partner.partnerId);
      state.partners.set(partner.partnerId, partner);
      return { ...partner };
    },
    async getCustomerProfile(partnerId) {
      const partner = state.partners.get(Number(partnerId));
      if (!partner) throw Object.assign(new Error('missing'), { code: 'odoo_customer_link_invalid' });
      return { ...partner };
    },
    async updateCustomerPartner(partnerId, payload) {
      const id = Number(partnerId);
      const current = state.partners.get(id);
      assert.ok(current);
      state.updateCalls.push({ partnerId: id, payload: structuredClone(payload) });
      const updated = { ...current, ...payload, partnerId: id };
      state.partners.set(id, updated);
      return { ...updated };
    },
    async syncCustomerAvatar(partnerId, file) {
      state.avatarSyncs.push({
        partnerId: Number(partnerId),
        bytes: file?.buffer?.length || 0,
      });
      return { supported: true };
    },
    async upsertDeliveryAddress(payload) {
      state.addressCalls.push(structuredClone(payload));
      let partnerId = state.addressById.get(payload.addressId);
      if (!partnerId) {
        partnerId = state.nextPartnerId++;
        state.addressById.set(payload.addressId, partnerId);
      }
      return { partnerId };
    },
    async deactivateDeliveryAddress({ parentId, partnerId }) {
      assert.ok(state.partners.has(Number(parentId)));
      assert.ok([...state.addressById.values()].includes(Number(partnerId)));
      return { ok: true };
    },
    async prepareQuotation(payload) {
      state.quoteCalls.push(structuredClone(payload));
      return {
        orderId: 900 + state.quoteCalls.length,
        orderName: `S00${900 + state.quoteCalls.length}`,
        state: 'draft',
        subtotal: 12.35,
        tax: 0.62,
        total: 12.97,
        currency: 'AED',
      };
    },
  };
  const avatar = {
    available: true,
    async upload({ file }) {
      assert.ok(file.buffer.length > 3);
      const key = `mig-farm/avatars/${state.uploaded.length + 1}.jpg`;
      const result = { key, url: `https://media.example.test/${key}` };
      state.uploaded.push(result);
      return result;
    },
    async remove({ key }) {
      state.removed.push(key);
      return { ok: true };
    },
  };
  const server = createApp({
    db,
    catalog,
    mediaRoot: fileURLToPath(new URL('../public/', import.meta.url)),
    stripe: { configured: false, verify: () => false },
    authOptions: { avatar, logger: null },
    orderOptions: { orderSecret: 'customer-master-order-secret-at-least-32-characters' },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = 'GET', body, accessToken, headers = {}) {
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
    const response = await fetch(origin + path, {
      method,
      headers: {
        ...(multipart || body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  const register = (email, phone) => request('/api/auth/register', 'POST', {
    name: 'Customer Owner',
    email,
    phone,
    password,
    language: 'en',
  });

  const first = await register('owner@example.test', '+971501111111');
  assert.equal(first.status, 201);
  const owner = first.body;
  const ownerPartnerId = state.partnerByUser.get(owner.user.id);
  assert.ok(ownerPartnerId);
  assert.equal(state.ensureCalls.length, 1);
  assert.equal('password' in state.ensureCalls[0], false);
  assert.equal(JSON.stringify(state.ensureCalls).includes(password), false);
  assert.equal((await register('owner@example.test', '+971501111111')).status, 409);
  assert.equal(state.ensureCalls.length, 1);
  assert.equal(state.partners.size, 1);

  const other = (await register('other@example.test', '+971502222222')).body;
  const otherPartnerId = state.partnerByUser.get(other.user.id);
  assert.notEqual(otherPartnerId, ownerPartnerId);

  state.partners.set(ownerPartnerId, {
    ...state.partners.get(ownerPartnerId),
    name: 'Odoo Customer Name',
    emirate: 'Dubai',
  });
  const login = await request('/api/auth/login', 'POST', {
    email: 'owner@example.test',
    password,
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.name, 'Odoo Customer Name');
  assert.equal(login.body.user.emirate, 'Dubai');

  const updated = await request(
    '/api/me',
    'PATCH',
    {
      userId: other.user.id,
      odooPartnerId: otherPartnerId,
      name: 'Updated Owner',
      email: 'owner@example.test',
      phone: '+971503333333',
      emirate: 'Abu Dhabi',
      language: 'ar',
    },
    login.body.accessToken,
  );
  assert.equal(updated.status, 200);
  assert.equal(state.updateCalls.at(-1).partnerId, ownerPartnerId);
  assert.equal(state.partners.get(otherPartnerId).name, 'Customer Owner');
  assert.equal(updated.body.user.name, 'Updated Owner');

  const form = new FormData();
  form.append(
    'file',
    new Blob([Uint8Array.from([255, 216, 255, 224, 1, 2, 3, 4])], {
      type: 'image/jpeg',
    }),
    'avatar.jpg',
  );
  const uploaded = await request(
    '/api/me/avatar',
    'POST',
    form,
    login.body.accessToken,
  );
  assert.equal(uploaded.status, 200);
  assert.match(uploaded.body.user.avatarUrl, /^https:\/\/media\.example\.test\//);
  assert.equal(state.avatarSyncs.at(-1).partnerId, ownerPartnerId);
  assert.ok(state.avatarSyncs.at(-1).bytes > 3);
  const relogin = await request('/api/auth/login', 'POST', {
    email: 'owner@example.test',
    password,
  });
  assert.equal(relogin.body.user.avatarUrl, uploaded.body.user.avatarUrl);
  const removed = await request(
    '/api/me/avatar',
    'DELETE',
    undefined,
    relogin.body.accessToken,
  );
  assert.equal(removed.body.user.avatarUrl, null);
  assert.equal(state.removed.length, 1);
  assert.equal(state.avatarSyncs.at(-1).bytes, 0);

  const addressInput = {
    label: 'Farm',
    category: 'farm',
    name: 'Updated Owner',
    phone: '+971503333333',
    emirate: 'Dubai',
    city: 'Dubai',
    addressLine: 'Farm Road 1',
    unit: 'Gate 2',
    notes: '',
    isDefault: true,
  };
  const createdAddress = await request(
    '/api/addresses',
    'POST',
    addressInput,
    relogin.body.accessToken,
  );
  assert.equal(createdAddress.status, 201);
  const addressId = createdAddress.body.addresses[0].id;
  const deliveryPartnerId = state.addressById.get(addressId);
  assert.ok(deliveryPartnerId);
  const editedAddress = await request(
    `/api/addresses/${addressId}`,
    'PATCH',
    { ...addressInput, city: 'Jebel Ali' },
    relogin.body.accessToken,
  );
  assert.equal(editedAddress.status, 200);
  assert.equal(state.addressById.get(addressId), deliveryPartnerId);
  assert.equal(state.addressCalls.filter((call) => call.addressId === addressId).length, 2);

  const checkout = {
    items: [{ productId: 11, variantId: 22, quantity: 1 }],
    customer: {
      name: 'Updated Owner',
      email: 'owner@example.test',
      phone: '+971503333333',
    },
    shippingAddress: {
      addressId,
      emirate: 'Dubai',
      city: 'Jebel Ali',
      addressLine: 'Farm Road 1, Gate 2',
      notes: '',
    },
  };
  const prepared = await request(
    '/api/orders/prepare',
    'POST',
    checkout,
    relogin.body.accessToken,
    { 'Idempotency-Key': randomUUID() },
  );
  assert.equal(prepared.status, 200);
  assert.equal(state.quoteCalls.at(-1).partnerId, ownerPartnerId);
  assert.equal(state.quoteCalls.at(-1).deliveryPartnerId, deliveryPartnerId);
  const guestPrepared = await request(
    '/api/orders/prepare',
    'POST',
    { ...checkout, shippingAddress: { ...checkout.shippingAddress, addressId: null } },
    undefined,
    { 'Idempotency-Key': randomUUID() },
  );
  assert.equal(guestPrepared.status, 200);
  assert.equal(state.quoteCalls.at(-1).partnerId, null);

  state.failCustomerSync = true;
  const pending = await register('pending@example.test', '+971504444444');
  assert.equal(pending.status, 201);
  const pendingRow = (
    await db.query('SELECT * FROM mig_farm.users WHERE id=$1', [pending.body.user.id])
  ).rows[0];
  assert.equal(pendingRow.odoo_partner_id, null);
  assert.equal(pendingRow.odoo_sync_status, 'failed');
  assert.equal(pendingRow.odoo_sync_error, 'odoo_unavailable');
});
