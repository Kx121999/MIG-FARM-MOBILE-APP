import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../db/migrate.mjs';
import { createApp } from '../src/app.mjs';
import { createOrders } from '../services/orders.mjs';
import { createOdooCatalog } from '../services/odoo.mjs';

const ODOO_ENV = {
  NODE_ENV: 'production',
  ODOO_BASE_URL: 'https://odoo-order-bridge.example.test',
  ODOO_API_KEY: 'odoo-order-test-secret',
  ODOO_MIN_REQUEST_INTERVAL_MS: '0',
};

const ORDER_FIELDS = {
  'product.product': [
    'id', 'active', 'sale_ok', 'free_qty', 'qty_available',
  ],
  'res.partner': [
    'id', 'name', 'phone', 'mobile', 'email', 'street', 'street2', 'city',
    'country_id',
  ],
  'res.country': ['id', 'name', 'code'],
  'sale.order': [
    'id', 'name', 'state', 'partner_id', 'client_order_ref', 'order_line',
    'amount_untaxed', 'amount_tax', 'amount_total', 'currency_id',
  ],
  'sale.order.line': ['id', 'order_id', 'product_id', 'product_uom_qty'],
};

function mockOrderOdoo({ partners = [], timeoutAfterCreate = false } = {}) {
  const state = {
    partners: partners.map((partner) => ({ ...partner })),
    orders: [],
    calls: [],
    timeoutAfterCreate,
  };
  const fetchImpl = async (url, options = {}) => {
    const match = /\/json\/2\/([^/]+)\/([^/?]+)/.exec(String(url));
    const model = decodeURIComponent(match?.[1] || '');
    const method = decodeURIComponent(match?.[2] || '');
    const body = JSON.parse(options.body || '{}');
    state.calls.push({ model, method, body });
    if (method === 'fields_get') return Response.json(
      Object.fromEntries((ORDER_FIELDS[model] || []).map((field) => [field, { type: 'char' }])),
    );
    if (method === 'search_read' && model === 'product.product')
      return Response.json([{ id: 22, active: true, sale_ok: true, free_qty: 8 }]);
    if (method === 'search_read' && model === 'res.partner')
      return Response.json(state.partners);
    if (method === 'search_read' && model === 'res.country')
      return Response.json([{ id: 1, code: 'AE', name: 'United Arab Emirates' }]);
    if (method === 'search_read' && model === 'sale.order') {
      const reference = body.domain?.find((term) => Array.isArray(term) && term[0] === 'client_order_ref')?.[2];
      return Response.json(state.orders.filter((order) => order.client_order_ref === reference));
    }
    if (method === 'create' && model === 'res.partner') {
      const record = { id: 100 + state.partners.length, ...body.vals_list[0] };
      state.partners.push(record);
      return Response.json([record.id]);
    }
    if (method === 'create' && model === 'sale.order') {
      const values = body.vals_list[0];
      const record = {
        id: 501 + state.orders.length,
        name: `S00${501 + state.orders.length}`,
        state: 'draft',
        partner_id: [values.partner_id, 'Customer'],
        client_order_ref: values.client_order_ref,
        order_line: values.order_line,
        amount_untaxed: 23.5,
        amount_tax: 1.18,
        amount_total: 24.68,
        currency_id: [1, 'AED'],
      };
      state.orders.push(record);
      if (state.timeoutAfterCreate) {
        state.timeoutAfterCreate = false;
        throw Object.assign(new Error('simulated timeout after create'), { name: 'AbortError' });
      }
      return Response.json([record.id]);
    }
    if (method === 'read' && model === 'sale.order')
      return Response.json(state.orders.filter((order) => body.ids.includes(order.id)));
    return new Response(JSON.stringify({ error: 'unexpected_mock_call' }), { status: 400 });
  };
  return { state, fetchImpl };
}

const quotationPayload = (overrides = {}) => ({
  orderId: overrides.orderId || 'MIG-ORDER-BRIDGE-1',
  customer: {
    name: 'MIG Test Buyer',
    phone: overrides.phone || '+971501234567',
    email: overrides.email || 'buyer@example.test',
  },
  shippingAddress: {
    emirate: 'Dubai',
    city: 'Dubai',
    addressLine: 'Farm 1',
  },
  items: [{ productId: 11, variantId: 22, quantity: 2 }],
});

test('Odoo order bridge matches partners safely and creates draft variant lines', async (t) => {
  await t.test('exact normalized phone wins and real product.product ID is used', async () => {
    const mock = mockOrderOdoo({
      partners: [{ id: 7, name: 'Phone buyer', phone: '050 123 4567', email: 'other@example.test' }],
    });
    const catalog = createOdooCatalog({ env: ODOO_ENV, fetchImpl: mock.fetchImpl, logger: null });
    const quote = await catalog.prepareQuotation(quotationPayload());
    assert.equal(quote.partnerId, 7);
    assert.equal(quote.partnerMatch, 'phone');
    assert.equal(quote.state, 'draft');
    assert.equal(quote.tax, 1.18);
    const create = mock.state.calls.find((call) => call.model === 'sale.order' && call.method === 'create');
    assert.equal(create.body.vals_list[0].partner_id, 7);
    assert.equal(create.body.vals_list[0].client_order_ref, 'MIG-ORDER-BRIDGE-1');
    assert.deepEqual(create.body.vals_list[0].order_line, [
      [0, 0, { product_id: 22, product_uom_qty: 2 }],
    ]);
    assert.equal(mock.state.calls.some((call) => call.method === 'action_confirm'), false);
  });

  await t.test('email is used only when no exact phone exists', async () => {
    const mock = mockOrderOdoo({
      partners: [{ id: 8, name: 'Email buyer', phone: '+971509999999', email: 'BUYER@example.test' }],
    });
    const quote = await createOdooCatalog({
      env: ODOO_ENV,
      fetchImpl: mock.fetchImpl,
      logger: null,
    }).prepareQuotation(quotationPayload());
    assert.equal(quote.partnerId, 8);
    assert.equal(quote.partnerMatch, 'email');
  });

  await t.test('a validated UAE partner is created when no exact match exists', async () => {
    const mock = mockOrderOdoo();
    const quote = await createOdooCatalog({
      env: ODOO_ENV,
      fetchImpl: mock.fetchImpl,
      logger: null,
    }).prepareQuotation(quotationPayload());
    assert.equal(quote.partnerMatch, 'created');
    const create = mock.state.calls.find((call) => call.model === 'res.partner' && call.method === 'create');
    assert.deepEqual(create.body.vals_list[0], {
      name: 'MIG Test Buyer',
      phone: '+971501234567',
      email: 'buyer@example.test',
      street: 'Farm 1',
      street2: 'Dubai',
      city: 'Dubai',
      country_id: 1,
    });
  });

  await t.test('duplicate exact partners are never merged or guessed', async () => {
    const mock = mockOrderOdoo({
      partners: [
        { id: 9, name: 'Duplicate A', phone: '+971501234567' },
        { id: 10, name: 'Duplicate B', mobile: '0501234567' },
      ],
    });
    const catalog = createOdooCatalog({ env: ODOO_ENV, fetchImpl: mock.fetchImpl, logger: null });
    await assert.rejects(
      () => catalog.prepareQuotation(quotationPayload()),
      (error) => error.code === 'odoo_partner_ambiguous',
    );
    assert.equal(mock.state.calls.some((call) => call.model === 'res.partner' && call.method === 'create'), false);
    assert.equal(mock.state.orders.length, 0);
  });

  await t.test('timeout after create recovers by client_order_ref without a duplicate', async () => {
    const mock = mockOrderOdoo({ timeoutAfterCreate: true });
    const catalog = createOdooCatalog({ env: ODOO_ENV, fetchImpl: mock.fetchImpl, logger: null });
    const quote = await catalog.prepareQuotation(quotationPayload({ orderId: 'MIG-TIMEOUT-1' }));
    assert.equal(quote.orderId, 501);
    assert.equal(mock.state.orders.length, 1);
    assert.equal(
      mock.state.calls.filter((call) => call.model === 'sale.order' && call.method === 'create').length,
      1,
    );
  });
});

test('prepare order API persists Odoo totals and remains independent from Stripe', async (t) => {
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

  let productAvailable = true;
  let failSync = false;
  const listCalls = [];
  const quoteCalls = [];
  const product = {
    id: 11,
    handle: 'seed',
    title: 'Seed',
    images: [],
    variants: [{ id: 22, title: 'Packet', price: '12.35', available: true }],
  };
  const catalog = {
    source: 'odoo',
    configured: true,
    async list(options) {
      listCalls.push(options);
      return {
        products: [{
          ...product,
          variants: product.variants.map((variant) => ({
            ...variant,
            available: productAvailable,
          })),
        }],
        version: 'odoo:test',
      };
    },
    async prepareQuotation(payload) {
      quoteCalls.push(payload);
      if (failSync)
        throw Object.assign(new Error('upstream details must remain private'), {
          code: 'odoo_rate_limited',
          statusCode: 503,
        });
      return {
        orderId: 900 + quoteCalls.length,
        orderName: `S00${900 + quoteCalls.length}`,
        state: 'draft',
        subtotal: 23.5,
        tax: 1.18,
        total: 24.68,
        currency: 'AED',
      };
    },
    async filterExistingProductIds(values) { return values; },
    async health() { return { source: 'odoo', configured: 'configured', reachable: true, products: 1 }; },
  };
  const orderSecret = 'order-bridge-test-secret-at-least-32-characters';
  const server = createApp({
    db,
    catalogService: catalog,
    mediaRoot: fileURLToPath(new URL('../public/', import.meta.url)),
    stripe: { configured: false, verify: () => false },
    orderOptions: { orderSecret },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, method = 'GET', body, token, headers = {}) => {
    const response = await fetch(origin + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const body = {
    items: [{ productId: 11, variantId: 22, quantity: 2, price: 0.01 }],
    subtotal: 0.02,
    tax: 0,
    total: 0.02,
    customer: {
      name: 'MIG Test Buyer',
      email: 'buyer@example.test',
      phone: '+971501234567',
      odooPartnerId: 999999,
    },
    shippingAddress: {
      emirate: 'Dubai',
      city: 'Dubai',
      addressLine: 'Farm 1',
      notes: '',
    },
  };

  await t.test('guest prepare requires idempotency and succeeds without Stripe', async () => {
    assert.equal((await request('/api/orders/prepare', 'POST', body)).status, 400);
    const key = randomUUID();
    const first = await request(
      '/api/orders/prepare',
      'POST',
      body,
      undefined,
      { 'Idempotency-Key': key },
    );
    assert.equal(first.status, 200);
    assert.equal(first.body.status, 'awaiting_payment');
    assert.equal(first.body.subtotal, 23.5);
    assert.equal(first.body.tax, 1.18);
    assert.equal(first.body.total, 24.68);
    assert.equal(first.body.odoo.state, 'draft');
    assert.equal(first.body.clientSecret, undefined);
    assert.equal(JSON.stringify(first.body).includes(ODOO_ENV.ODOO_API_KEY), false);
    assert.deepEqual(listCalls[0], { force: true, allowStale: false });
    assert.deepEqual(quoteCalls[0].items.map((item) => item.variantId), [22]);
    assert.equal(quoteCalls[0].customer.odooPartnerId, undefined);

    const repeat = await request(
      '/api/orders/prepare',
      'POST',
      body,
      undefined,
      { 'Idempotency-Key': key },
    );
    assert.equal(repeat.status, 200);
    assert.equal(repeat.body.orderId, first.body.orderId);
    assert.equal(repeat.body.odoo.orderId, first.body.odoo.orderId);
    assert.equal(quoteCalls.length, 1);
    const stored = (await db.query('SELECT * FROM mig_farm.orders WHERE id=$1', [first.body.orderId])).rows[0];
    assert.equal(Number(stored.tax), 1.18);
    assert.equal(Number(stored.total), 24.68);
    assert.equal(stored.odoo_sync_status, 'synced');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM mig_farm.orders')).rows[0].count, 1);
  });

  await t.test('confirmed out-of-stock is rejected before quotation creation', async () => {
    productAvailable = false;
    const response = await request(
      '/api/orders/prepare',
      'POST',
      body,
      undefined,
      { 'Idempotency-Key': randomUUID() },
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'invalid_cart_item');
    assert.equal(quoteCalls.length, 1);
    productAvailable = true;
  });

  let failedOrderId;
  await t.test('Odoo failure preserves the order with a safe retry state', async () => {
    failSync = true;
    const response = await request(
      '/api/orders/prepare',
      'POST',
      body,
      undefined,
      { 'Idempotency-Key': randomUUID() },
    );
    assert.equal(response.status, 503);
    assert.deepEqual(response.body, { error: 'odoo_rate_limited' });
    const failed = (
      await db.query("SELECT * FROM mig_farm.orders WHERE odoo_sync_status='failed' ORDER BY created_at DESC LIMIT 1")
    ).rows[0];
    failedOrderId = failed.id;
    assert.equal(failed.odoo_sync_error, 'odoo_rate_limited');
    assert.equal(failed.odoo_order_id, null);
  });

  await t.test('only an admin can retry and the admin detail exposes sync state', async () => {
    const password = 'MIG-farm-order-test!42';
    const normal = (await request('/api/auth/register', 'POST', {
      name: 'Normal user',
      email: 'normal-order@example.test',
      password,
      phone: '+971502222222',
      language: 'en',
    })).body;
    const adminRegistration = (await request('/api/auth/register', 'POST', {
      name: 'Admin user',
      email: 'admin-order@example.test',
      password,
      phone: '+971503333333',
      language: 'en',
    })).body;
    assert.equal((await request(
      `/api/admin/orders/${failedOrderId}/odoo-sync`,
      'POST',
      undefined,
      normal.accessToken,
    )).status, 403);
    await db.query("UPDATE mig_farm.users SET role='admin' WHERE id=$1", [adminRegistration.user.id]);
    const admin = (await request('/api/auth/login', 'POST', {
      email: 'admin-order@example.test',
      password,
    })).body;
    failSync = false;
    const retry = await request(
      `/api/admin/orders/${failedOrderId}/odoo-sync`,
      'POST',
      undefined,
      admin.accessToken,
    );
    assert.equal(retry.status, 200);
    assert.equal(retry.body.order.odooSyncStatus, 'synced');
    assert.match(retry.body.order.odooOrderName, /^S00/);
    assert.equal(retry.body.order.odooState, 'draft');
    assert.ok(retry.body.order.odooSyncedAt);
  });

  await t.test('the existing Stripe checkout path remains usable', async () => {
    const stripeOrders = createOrders(
      db,
      catalog,
      {
        configured: true,
        publishableKey: 'pk_test_order_bridge',
        async intent(row) {
          return {
            id: `pi_${row.id}`,
            client_secret: 'stripe-test-client-secret',
            amount: Math.round(Number(row.total) * 100),
            currency: 'aed',
            metadata: { order_id: row.id },
          };
        },
      },
      { orderSecret, delivery: '0' },
    );
    const checkout = await stripeOrders.checkout(body, null, randomUUID());
    assert.equal(checkout.clientSecret, 'stripe-test-client-secret');
    assert.equal(checkout.amount, 24.7);
  });
});
