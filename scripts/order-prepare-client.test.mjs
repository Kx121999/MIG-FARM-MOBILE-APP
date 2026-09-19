import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadPreparationModule() {
  const source = await readFile(new URL('../src/services/orderPreparation.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const cart = [{ productId: 11, variant: { id: 22 }, quantity: 2, price: 0.01 }];
const customer = { name: 'Buyer', email: 'buyer@example.test', phone: '+971501234567' };
const shippingAddress = { emirate: 'Dubai', city: 'Dubai', addressLine: 'Farm 1', notes: '' };

test('mobile order preparation is gated off by default without any request', async () => {
  const module = await loadPreparationModule();
  assert.equal(module.orderPrepareFeatureEnabled(undefined), false);
  assert.equal(module.orderPrepareFeatureEnabled('false'), false);
  let requests = 0;
  let keys = 0;
  const prepare = module.createPrepareOrderClient({
    enabled: false,
    idempotencyKey: async () => { keys += 1; return 'unused'; },
    request: async () => { requests += 1; return {}; },
  });
  await assert.rejects(() => prepare(cart, customer, shippingAddress), (error) =>
    error.code === 'order_prepare_disabled');
  assert.equal(keys, 0);
  assert.equal(requests, 0);
});

test('enabled mobile prepare sends the safe shape and maps authoritative response', async () => {
  const module = await loadPreparationModule();
  const calls = [];
  const prepare = module.createPrepareOrderClient({
    enabled: module.orderPrepareFeatureEnabled('true'),
    idempotencyKey: async () => 'idempotency-key-1234567890',
    request: async (path, options) => {
      calls.push({ path, options });
      return {
        orderId: 'MIG-1',
        orderToken: 'order-token',
        status: 'awaiting_payment',
        currency: 'AED',
        subtotal: 20,
        tax: 1,
        delivery: 0,
        total: 21,
        odoo: { orderId: 501, orderName: 'S00501', state: 'draft' },
      };
    },
  });
  const result = await prepare(cart, customer, shippingAddress);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/orders/prepare');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.auth, 'optional');
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'idempotency-key-1234567890');
  assert.deepEqual(calls[0].options.body, {
    items: [{ productId: 11, variantId: 22, quantity: 2 }],
    customer,
    shippingAddress,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0].options.body.items[0], 'price'), false);
  assert.equal(result.status, 'awaiting_payment');
  assert.equal(result.currency, 'AED');
  assert.equal(result.subtotal, 20);
  assert.equal(result.tax, 1);
  assert.equal(result.delivery, 0);
  assert.equal(result.total, 21);
  assert.equal(result.odoo.state, 'draft');

  const checkout = await readFile(new URL('../app/checkout.tsx', import.meta.url), 'utf8');
  const payments = await readFile(new URL('../src/services/payments.ts', import.meta.url), 'utf8');
  assert.match(checkout, /ORDER_PREPARE_ENABLED/);
  assert.doesNotMatch(`${checkout}\n${payments}`, /action_confirm|stock\.quant|qty_available\s*=|free_qty\s*=/);
});

test('parallel prepare taps share one request and malformed quantities never reach the API', async () => {
  const module = await loadPreparationModule();
  let requests = 0;
  let release;
  const response = new Promise((resolve) => { release = resolve; });
  const prepare = module.createPrepareOrderClient({
    enabled: true,
    idempotencyKey: async () => 'parallel-idempotency-key-123456',
    request: async () => {
      requests += 1;
      return response;
    },
  });
  const first = prepare(cart, customer, shippingAddress);
  const second = prepare(cart, customer, shippingAddress);
  assert.equal(requests, 0);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests, 1);
  release({
    orderId: 'MIG-2',
    orderToken: 'order-token-2',
    status: 'awaiting_payment',
    currency: 'AED',
    subtotal: 20,
    tax: 1,
    delivery: 0,
    total: 21,
    odoo: { orderId: 502, orderName: 'S00502', state: 'draft' },
  });
  assert.deepEqual(await first, await second);
  assert.equal(requests, 1);

  for (const quantity of [0, -1, 1.5, 100]) {
    assert.throws(
      () => module.prepareOrderBody([{ productId: 11, variant: { id: 22 }, quantity }], customer, shippingAddress),
      /invalid_cart_item/,
    );
  }
});
