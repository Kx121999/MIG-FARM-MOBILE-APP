import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadCartModule() {
  const source = await readFile(new URL('../src/services/cart.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const product = {
  id: 11,
  handle: 'odoo-template-11',
  title: 'Odoo product',
  title_ar: null,
  title_en: null,
};
const variant22 = { id: 22, title: 'Small', price: '12.35', featured_image: null };
const variant23 = { id: 23, title: 'Large', price: '18.50', featured_image: null };

test('cart identity merges the same real Odoo variant and separates different variants', async () => {
  const cart = await loadCartModule();
  let lines = cart.mergeCartLine([], product, variant22, 2, 'small.webp');
  lines = cart.mergeCartLine(lines, product, variant22, 3, 'small.webp');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].key, '11:22');
  assert.equal(lines[0].variant.id, 22);
  assert.equal(lines[0].quantity, 5);

  lines = cart.mergeCartLine(lines, product, variant23, 1, 'large.webp');
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((line) => line.variant.id), [22, 23]);
  assert.deepEqual(lines.map((line) => line.key), ['11:22', '11:23']);
  assert.equal(cart.clampCartQuantity(0), 1);
  assert.equal(cart.clampCartQuantity(100), 99);
});

test('checkout pays only the prepared authoritative Odoo order and keeps the cart until verification', async () => {
  const checkout = await readFile(new URL('../app/checkout.tsx', import.meta.url), 'utf8');
  const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(checkout, /prepareOrder\(cart, customer, address/);
  assert.match(checkout, /preparedOrder\.subtotal/);
  assert.match(checkout, /preparedOrder\.tax/);
  assert.match(checkout, /preparedOrder\.delivery/);
  assert.match(checkout, /preparedOrder\.total/);
  assert.match(checkout, /preparedOrder\.currency/);
  assert.match(checkout, /preparedOrder\.odoo\.orderName/);
  assert.match(checkout, /ORDER_PREPARE_ENABLED/);
  assert.match(checkout, /PAYMENT_ENABLED/);
  assert.match(checkout, /createPaymentSession\(preparedOrder\)/);
  assert.match(checkout, /CheckoutPayment/);
  assert.match(env, /^EXPO_PUBLIC_ORDER_PREPARE_ENABLED=false$/m);
  assert.match(env, /^EXPO_PUBLIC_PAYMENT_ENABLED=false$/m);
  assert.doesNotMatch(checkout, /createCheckoutSession|completeCheckoutAttempt|clearCart|confirmPayment/);
  assert.doesNotMatch(checkout, /action_confirm|stock\.quant|qty_available\s*=|free_qty\s*=/);
});

test('My Farm is hidden from release UI while routes redirect and backend data remains', async () => {
  const tabs = await readFile(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  const account = await readFile(new URL('../app/(tabs)/account.tsx', import.meta.url), 'utf8');
  const tabRedirect = await readFile(new URL('../app/(tabs)/my-farm.tsx', import.meta.url), 'utf8');
  const routeRedirect = await readFile(new URL('../app/my-farm/_layout.tsx', import.meta.url), 'utf8');
  const root = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  const server = await readFile(new URL('../server/src/app.mjs', import.meta.url), 'utf8');

  const destinations = [...tabs.matchAll(/\{ name: '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(destinations, ['index', 'catalog', 'cart', 'account']);
  assert.match(tabs, /name="my-farm" options=\{\{ href: null \}\}/);
  assert.doesNotMatch(home, /router\.push\([^\n]*my-farm|useFarm|useFarmIntelligence|farmDashboard/);
  assert.doesNotMatch(account, /router\.push\([^\n]*my-farm|\(tabs\)\/my-farm/);
  assert.match(tabRedirect, /Redirect href="\/\(tabs\)"/);
  assert.match(routeRedirect, /Redirect href="\/\(tabs\)"/);
  assert.match(root, /FarmProvider/);
  assert.match(server, /api\/my-farm/);
  await Promise.all([
    access(new URL('../server/services/farms.mjs', import.meta.url)),
    access(new URL('../server/db/migrations/002_my_farm_os.sql', import.meta.url)),
    access(new URL('../server/db/migrations/006_smart_farm_knowledge.sql', import.meta.url)),
    access(new URL('../server/db/migrations/007_farm_command_center.sql', import.meta.url)),
    access(new URL('../server/db/migrations/008_verified_farm_intelligence.sql', import.meta.url)),
  ]);
});
