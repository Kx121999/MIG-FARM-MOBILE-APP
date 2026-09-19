import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.mjs';
import { createOrders } from '../services/orders.mjs';
import {
  createOdooCatalog,
  odooConfiguration,
} from '../services/odoo.mjs';

const ENV = {
  NODE_ENV: 'production',
  ODOO_BASE_URL: 'https://odoo.example.test/',
  ODOO_API_KEY: 'odoo-test-secret',
  ODOO_MIN_REQUEST_INTERVAL_MS: '0',
};

const modelFields = {
  'product.template': [
    'id', 'name', 'active', 'sale_ok', 'list_price', 'description_sale',
    'categ_id', 'public_categ_ids', 'is_published', 'website_url',
    'default_code', 'create_date', 'write_date', 'image_512',
  ],
  'product.product': [
    'id', 'name', 'display_name', 'active', 'sale_ok', 'product_tmpl_id',
    'lst_price', 'default_code', 'free_qty',
    'product_template_attribute_value_ids', 'write_date', 'image_512',
  ],
  'product.category': ['id', 'name', 'complete_name', 'write_date'],
  'product.public.category': ['id', 'name', 'write_date'],
  'product.template.attribute.value': [
    'id', 'name', 'attribute_id', 'product_attribute_value_id',
  ],
};

function fixtureState() {
  return {
    status: 200,
    templates: [
      {
        id: 1,
        name: 'Premium Seeds',
        active: true,
        sale_ok: true,
        list_price: 18,
        description_sale: '<p>Selected seeds</p>',
        categ_id: [5, 'Agriculture'],
        public_categ_ids: [7],
        is_published: true,
        website_url: '/shop/premium-seeds',
        default_code: 'SEED-1',
        create_date: '2026-01-01 10:00:00',
        write_date: '2026-09-01 10:00:00',
      },
      {
        id: 2,
        name: 'Private Product',
        active: true,
        sale_ok: true,
        list_price: 9,
        is_published: false,
        write_date: '2026-09-01 10:00:00',
      },
      {
        id: 3,
        name: 'Archived Product',
        active: false,
        sale_ok: true,
        list_price: 9,
        is_published: true,
        write_date: '2026-09-01 10:00:00',
      },
      {
        id: 4,
        name: 'Irrigation Tool',
        active: true,
        sale_ok: true,
        list_price: 30,
        categ_id: [5, 'Agriculture'],
        public_categ_ids: [],
        is_published: true,
        website_url: false,
        write_date: '2026-09-02 10:00:00',
      },
      {
        id: 5,
        name: 'Soil Meter',
        active: true,
        sale_ok: true,
        list_price: 42,
        categ_id: [5, 'Agriculture'],
        public_categ_ids: [],
        is_published: true,
        website_url: false,
        write_date: '2026-09-03 10:00:00',
      },
    ],
    variants: [
      {
        id: 11,
        name: 'Premium Seeds',
        display_name: 'Premium Seeds (Packet)',
        active: true,
        sale_ok: true,
        product_tmpl_id: [1, 'Premium Seeds'],
        lst_price: 19.75,
        default_code: 'SEED-1-P',
        free_qty: 8,
        product_template_attribute_value_ids: [101],
        write_date: '2026-09-01 10:00:00',
      },
      {
        id: 41,
        name: 'Irrigation Tool',
        active: true,
        sale_ok: true,
        product_tmpl_id: [4, 'Irrigation Tool'],
        lst_price: 31,
        free_qty: 0,
        product_template_attribute_value_ids: [],
        write_date: '2026-09-02 10:00:00',
      },
      {
        id: 51,
        name: 'Soil Meter',
        active: true,
        sale_ok: true,
        product_tmpl_id: [5, 'Soil Meter'],
        lst_price: 43,
        product_template_attribute_value_ids: [],
        write_date: '2026-09-03 10:00:00',
      },
    ],
    categories: [{ id: 5, name: 'Agriculture', complete_name: 'Farm / Agriculture' }],
    publicCategories: [{ id: 7, name: 'Seeds' }],
    attributes: [{ id: 101, name: 'Packet', attribute_id: [9, 'Size'], product_attribute_value_id: [201, 'Packet'] }],
  };
}

function mockOdoo(state = fixtureState()) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (state.status !== 200)
      return new Response(JSON.stringify({ error: 'hidden' }), { status: state.status });
    const match = /\/json\/2\/([^/]+)\/([^/?]+)/.exec(String(url));
    const model = decodeURIComponent(match?.[1] || '');
    const method = decodeURIComponent(match?.[2] || '');
    const body = JSON.parse(options.body || '{}');
    if (method === 'fields_get') {
      const fields = state.fields && Object.prototype.hasOwnProperty.call(state.fields, model)
        ? state.fields[model]
        : modelFields[model];
      if (!fields) return new Response('{}', { status: 404 });
      return Response.json(Object.fromEntries(fields.map((field) => [field, { type: 'mock' }])));
    }
    if (method === 'read') {
      const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
      return Response.json([{ id: body.ids[0], [body.fields[0]]: png.toString('base64') }]);
    }
    let rows = {
      'product.template': state.templates,
      'product.product': state.variants,
      'product.category': state.categories,
      'product.public.category': state.publicCategories,
      'product.template.attribute.value': state.attributes,
    }[model] || [];
    const idsDomain = body.domain?.find((part) => Array.isArray(part) && part[0] === 'id' && part[1] === 'in');
    if (idsDomain) rows = rows.filter((row) => idsDomain[2].includes(row.id));
    const templatesDomain = body.domain?.find((part) => Array.isArray(part) && part[0] === 'product_tmpl_id' && part[1] === 'in');
    if (templatesDomain)
      rows = rows.filter((row) => templatesDomain[2].includes(Array.isArray(row.product_tmpl_id) ? row.product_tmpl_id[0] : row.product_tmpl_id));
    return Response.json(rows.slice(body.offset || 0, (body.offset || 0) + (body.limit || 200)));
  };
  return { state, calls, fetchImpl };
}

test('Odoo configuration is backend-only, complete, and production-safe', () => {
  assert.deepEqual(odooConfiguration({}), { configured: false, status: 'not_configured' });
  assert.equal(odooConfiguration({ ODOO_BASE_URL: ENV.ODOO_BASE_URL }).status, 'incomplete');
  assert.equal(odooConfiguration({ ...ENV, ODOO_BASE_URL: 'http://odoo.example.test' }).status, 'invalid');
  const configured = odooConfiguration(ENV);
  assert.equal(configured.configured, true);
  assert.equal(configured.baseUrl, 'https://odoo.example.test');
});

test('initial field discovery and dependent lookups never overlap', async () => {
  const mock = mockOdoo();
  let active = 0;
  let maxActive = 0;
  const fetchImpl = async (...args) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    try {
      return await mock.fetchImpl(...args);
    } finally {
      active -= 1;
    }
  };
  const catalog = createOdooCatalog({
    env: ENV,
    fetchImpl,
    logger: null,
  });
  await catalog.list();
  assert.equal(maxActive, 1);
  const discoveries = mock.calls
    .filter((call) => call.url.endsWith('/fields_get'))
    .map((call) => decodeURIComponent(
      /\/json\/2\/([^/]+)\/fields_get$/.exec(call.url)[1],
    ));
  assert.deepEqual(discoveries, [
    'product.template',
    'product.product',
    'product.category',
    'product.public.category',
    'product.template.attribute.value',
  ]);
});

test('429 honors Retry-After, logs safe diagnostics, and stops after three retries', async () => {
  const delays = [];
  const logs = [];
  let calls = 0;
  const catalog = createOdooCatalog({
    env: ENV,
    minRequestIntervalMs: 0,
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}', {
        status: 429,
        headers: { 'Retry-After': '2' },
      });
    },
    sleep: async (delay) => delays.push(delay),
    random: () => 0,
    logger: { warn: (message, details) => logs.push({ message, details }) },
  });
  await assert.rejects(
    () => catalog.list(),
    (error) => error.code === 'odoo_rate_limited',
  );
  assert.equal(calls, 4);
  assert.deepEqual(delays, [2000, 2000, 2000]);
  assert.equal(logs.length, 3);
  assert.deepEqual(
    logs.map(({ details }) => ({
      status: details.upstreamStatus,
      attempt: details.attempt,
      delay: details.retryDelayMs,
      model: details.model,
      method: details.method,
    })),
    [1, 2, 3].map((attempt) => ({
      status: 429,
      attempt,
      delay: 2000,
      model: 'product.template',
      method: 'fields_get',
    })),
  );
  assert.equal(JSON.stringify(logs).includes(ENV.ODOO_API_KEY), false);
});

test('429 without Retry-After uses bounded exponential fallback', async () => {
  const delays = [];
  let calls = 0;
  const catalog = createOdooCatalog({
    env: ENV,
    minRequestIntervalMs: 0,
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}', { status: 429 });
    },
    sleep: async (delay) => delays.push(delay),
    random: () => 0,
    logger: null,
  });
  await assert.rejects(
    () => catalog.list(),
    (error) => error.code === 'odoo_rate_limited',
  );
  assert.equal(calls, 4);
  assert.deepEqual(delays, [1000, 2500, 5000]);
});

test('catalog refresh is single-flight across concurrent callers', async () => {
  const mock = mockOdoo();
  const fetchImpl = async (...args) => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    return mock.fetchImpl(...args);
  };
  const catalog = createOdooCatalog({ env: ENV, fetchImpl, logger: null });
  const results = await Promise.all([
    catalog.list({ force: true }),
    catalog.list({ force: true }),
    catalog.list({ force: true }),
  ]);
  assert.ok(results.every((result) => result.products.length === 3));
  assert.equal(
    mock.calls.filter((call) =>
      call.url.endsWith('/product.template/search_read'),
    ).length,
    1,
  );
  assert.equal(
    mock.calls.filter((call) =>
      call.url.endsWith('/product.template/fields_get'),
    ).length,
    1,
  );
});

test('all Odoo calls share the configured minimum request spacing', async () => {
  const mock = mockOdoo();
  const startedAt = [];
  const waits = [];
  let clock = 0;
  const catalog = createOdooCatalog({
    env: ENV,
    fetchImpl: async (...args) => {
      startedAt.push(clock);
      return mock.fetchImpl(...args);
    },
    minRequestIntervalMs: 300,
    now: () => clock,
    sleep: async (delay) => {
      waits.push(delay);
      clock += delay;
    },
    random: () => 0,
    logger: null,
  });
  await catalog.list();
  assert.ok(startedAt.length > 5);
  assert.ok(
    startedAt.slice(1).every((value, index) =>
      value - startedAt[index] >= 300,
    ),
  );
  assert.ok(waits.every((delay) => delay === 300));
});

test('field discovery remains cached for six hours', async () => {
  let clock = 1000;
  const mock = mockOdoo();
  const catalog = createOdooCatalog({
    env: ENV,
    fetchImpl: mock.fetchImpl,
    now: () => clock,
    logger: null,
  });
  await catalog.list();
  const discoveries = () =>
    mock.calls.filter((call) => call.url.endsWith('/fields_get')).length;
  assert.equal(discoveries(), 5);
  clock += 60 * 60_000;
  await catalog.list({ force: true });
  assert.equal(discoveries(), 5);
  clock += 6 * 60 * 60_000 + 1;
  await catalog.list({ force: true });
  assert.equal(discoveries(), 10);
});

test('Odoo templates and variants normalize with visibility, prices, stock, categories, and stable handles', async () => {
  const mock = mockOdoo();
  const catalog = createOdooCatalog({ env: ENV, fetchImpl: mock.fetchImpl, logger: null });
  const first = await catalog.list();
  assert.deepEqual(first.products.map((product) => product.id), [1, 4, 5]);
  const seeds = first.products[0];
  assert.equal(seeds.handle, 'premium-seeds');
  assert.equal(seeds.product_type, 'Seeds');
  assert.equal(seeds.variants[0].id, 11);
  assert.equal(seeds.variants[0].title, 'Packet');
  assert.equal(seeds.variants[0].price, '19.75');
  assert.deepEqual(seeds.variants[0].options, [{
    templateValueId: 101,
    attributeId: 9,
    attributeName: 'Size',
    valueId: 201,
    value: 'Packet',
  }]);
  assert.equal(seeds.variants[0].sku, 'SEED-1-P');
  assert.equal(seeds.variants[0].stock_state, 'in_stock');
  assert.equal(seeds.variants[0].available, true);
  assert.equal(first.products[1].handle, 'irrigation-tool-4');
  assert.equal(first.products[1].variants[0].stock_state, 'out_of_stock');
  assert.equal(first.products[1].variants[0].available, false);
  assert.equal(first.products[2].variants[0].stock_state, 'unknown');
  assert.equal(Object.prototype.hasOwnProperty.call(first.products[2].variants[0], 'available'), false);
  const second = await catalog.list({ force: true });
  assert.deepEqual(
    second.products.map((product) => product.handle),
    first.products.map((product) => product.handle),
  );
  assert.ok(mock.calls.every((call) => !call.url.includes(ENV.ODOO_API_KEY)));
  assert.ok(mock.calls.every((call) => call.options.headers.Authorization === `bearer ${ENV.ODOO_API_KEY}`));
  assert.ok(mock.calls.every((call) => call.options.headers['User-Agent'] === 'MIG-FARM-APP'));
  assert.equal(mock.calls.filter((call) => call.url.endsWith('/product.template.attribute.value/search_read')).length, 2);
});

test('runtime field discovery omits unavailable stock fields instead of fabricating availability', async () => {
  const state = fixtureState();
  state.fields = {
    ...modelFields,
    'product.product': modelFields['product.product'].filter(
      (field) => !['free_qty', 'qty_available'].includes(field),
    ),
  };
  const mock = mockOdoo(state);
  const catalog = createOdooCatalog({ env: ENV, fetchImpl: mock.fetchImpl, logger: null });
  const result = await catalog.list();
  assert.ok(result.products.every((product) => product.stock_state === 'unknown'));
  assert.ok(result.products.every((product) =>
    product.variants.every((variant) =>
      variant.stock_state === 'unknown' &&
      !Object.prototype.hasOwnProperty.call(variant, 'available'),
    ),
  ));
  const variantSearch = mock.calls.find((call) =>
    call.url.endsWith('/product.product/search_read'),
  );
  const requestedFields = JSON.parse(variantSearch.options.body).fields;
  assert.equal(requestedFields.includes('free_qty'), false);
  assert.equal(requestedFields.includes('qty_available'), false);
});

test('catalog cache supports fresh hits, forced refresh, new products, and bounded stale fallback', async () => {
  let clock = 10_000;
  const mock = mockOdoo();
  const catalog = createOdooCatalog({
    env: ENV,
    fetchImpl: mock.fetchImpl,
    now: () => clock,
    ttlMs: 50,
    staleTtlMs: 200,
    sleep: async () => {},
    random: () => 0,
    logger: null,
  });
  const first = await catalog.list();
  mock.state.templates.push({
    id: 6, name: 'New Odoo Product', active: true, sale_ok: true,
    list_price: 15, is_published: true, write_date: '2026-09-04 10:00:00',
  });
  mock.state.variants.push({
    id: 61, name: 'New Odoo Product', active: true, sale_ok: true,
    product_tmpl_id: [6, 'New Odoo Product'], lst_price: 15, free_qty: 1,
    product_template_attribute_value_ids: [], write_date: '2026-09-04 10:00:00',
  });
  mock.state.variants.find((variant) => variant.id === 11).lst_price = 21.5;
  assert.equal((await catalog.list()).products.length, first.products.length);
  const refreshed = await catalog.list({ force: true });
  assert.equal(refreshed.products.some((product) => product.id === 6), true);
  assert.equal(refreshed.products.find((product) => product.id === 1).variants[0].price, '21.50');
  clock += 60;
  mock.state.status = 503;
  const stale = await catalog.list({ force: true });
  assert.equal(stale.catalogMeta.stale, true);
  await assert.rejects(
    () => catalog.list({ force: true, allowStale: false }),
    (error) => error.code === 'odoo_unavailable',
  );
  clock += 500;
  await assert.rejects(
    () => catalog.list({ force: true }),
    (error) => error.code === 'odoo_unavailable',
  );
});

test('Odoo auth, rate, 5xx, and timeout failures are safe', async () => {
  for (const [status, code] of [
    [401, 'odoo_auth_failed'],
    [403, 'odoo_auth_failed'],
    [429, 'odoo_rate_limited'],
    [503, 'odoo_unavailable'],
  ]) {
    const mock = mockOdoo({ ...fixtureState(), status });
    const catalog = createOdooCatalog({
      env: ENV,
      fetchImpl: mock.fetchImpl,
      sleep: async () => {},
      random: () => 0,
      logger: null,
    });
    await assert.rejects(() => catalog.list(), (error) => error.code === code && error.statusCode === 503);
    assert.equal(mock.calls.length, [401, 403].includes(status) ? 1 : 4);
  }
  const timeoutFetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  const catalog = createOdooCatalog({ env: ENV, fetchImpl: timeoutFetch, timeoutMs: 100, logger: null });
  await assert.rejects(() => catalog.list(), (error) => error.code === 'odoo_timeout');
});

test('/health shares an initial refresh and applies a cooldown after failure', async (t) => {
  let clock = 1000;
  let calls = 0;
  const catalog = createOdooCatalog({
    env: ENV,
    minRequestIntervalMs: 0,
    now: () => clock,
    fetchImpl: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response('{}', { status: 401 });
    },
    logger: null,
  });
  const server = createApp({
    db: null,
    catalogService: catalog,
    mediaRoot: process.cwd(),
    stripe: { configured: false, verify: () => false },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const responses = await Promise.all([
    fetch(origin + '/health'),
    fetch(origin + '/health'),
    fetch(origin + '/health'),
  ]);
  const payloads = await Promise.all(responses.map((response) => response.json()));
  assert.equal(calls, 1);
  assert.ok(payloads.every((payload) =>
    payload.catalogSource === 'odoo' &&
    payload.odoo === 'configured' &&
    payload.odooReachable === false &&
    payload.products === 0 &&
    payload.catalogLastError === 'odoo_auth_failed',
  ));
  await fetch(origin + '/health');
  assert.equal(calls, 1);
  clock += 60_000;
  await fetch(origin + '/health');
  assert.equal(calls, 2);
});

test('image proxy returns normal image bytes and health never exposes the Odoo key', async (t) => {
  const mock = mockOdoo();
  const catalog = createOdooCatalog({ env: ENV, fetchImpl: mock.fetchImpl, logger: null });
  const products = await catalog.list();
  assert.match(products.products[0].images[0].src, /^\/api\/odoo\/product-image\//);
  assert.doesNotMatch(products.products[0].images[0].src, /odoo-test-secret/);
  const server = createApp({
    db: null,
    catalogService: catalog,
    mediaRoot: process.cwd(),
    stripe: { configured: false, verify: () => false },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const healthResponse = await fetch(origin + '/health');
  const healthText = await healthResponse.text();
  assert.equal(healthResponse.status, 200);
  assert.equal(healthText.includes(ENV.ODOO_API_KEY), false);
  const health = JSON.parse(healthText);
  assert.equal(health.catalogSource, 'odoo');
  assert.equal(health.products, 3);
  const imageResponse = await fetch(origin + products.products[0].images[0].src);
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get('content-type'), 'image/png');
  assert.ok((await imageResponse.arrayBuffer()).byteLength > 8);
  const readCall = mock.calls.find((call) => call.url.endsWith('/product.template/read'));
  assert.equal(readCall.options.headers.Authorization, `bearer ${ENV.ODOO_API_KEY}`);
});

function fakeCheckoutDb() {
  const query = async (sql, values = []) => {
    if (sql.startsWith('INSERT INTO mig_farm.orders'))
      return {
        rows: [{
          id: values[0], status: values[2], currency: values[3],
          subtotal: values[4], delivery: values[5], total: values[6],
          token_nonce: values[12],
        }],
      };
    return { rows: [] };
  };
  return {
    query,
    transaction: async (operation) => operation({ query }),
  };
}

test('checkout force-reloads Odoo, reprices server-side, and rejects missing or confirmed unavailable variants', async () => {
  const calls = [];
  let products = [{
    id: 1,
    handle: 'premium-seeds',
    title: 'Premium Seeds',
    images: [],
    variants: [{ id: 11, title: 'Packet', price: '19.75', available: true }],
  }];
  const catalog = {
    list: async (options) => {
      calls.push(options);
      return { products };
    },
  };
  const stripe = {
    configured: true,
    publishableKey: 'pk_test',
    intent: async (row) => ({
      id: 'pi_test', client_secret: 'secret',
      amount: Math.round(Number(row.total) * 100), currency: 'aed',
      metadata: { order_id: row.id },
    }),
  };
  const orders = createOrders(fakeCheckoutDb(), catalog, stripe, {
    orderSecret: 'test-order-secret-at-least-32-characters',
    delivery: '0',
  });
  const body = {
    items: [{ productId: 1, variantId: 11, quantity: 2, price: 0.01 }],
    total: 0.02,
    customer: { name: 'Buyer', email: 'buyer@example.test', phone: '+971501234567' },
    shippingAddress: { emirate: 'Dubai', city: 'Dubai', addressLine: 'Farm 1' },
  };
  const result = await orders.checkout(body, null, 'a'.repeat(20));
  assert.equal(result.amount, 39.5);
  assert.deepEqual(calls[0], { force: true, allowStale: false });

  products = [{ ...products[0], variants: [] }];
  await assert.rejects(() => orders.checkout(body, null, 'b'.repeat(20)), (error) => error.code === 'invalid_cart_item');
  products = [{ ...products[0], variants: [{ id: 11, title: 'Packet', price: '19.75', available: false }] }];
  await assert.rejects(() => orders.checkout(body, null, 'c'.repeat(20)), (error) => error.code === 'invalid_cart_item');
});
