import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('production checkout uses the prepared order and keeps payment server-authoritative', async () => {
  const [orders, app, payments, checkout] = await Promise.all([
    read('server/services/orders.mjs'),
    read('server/src/app.mjs'),
    read('src/services/payments.ts'),
    read('app/checkout.tsx'),
  ]);
  assert.match(app, /const orderPayment = [^\n]+payment-session/);
  assert.match(app, /X-Order-Token/);
  assert.match(orders, /row\.odoo_order_id/);
  assert.match(orders, /intent\.amount !== expectedAmount/);
  assert.match(orders, /intent\.metadata\?\.order_id !== row\.id/);
  assert.match(orders, /intent\.metadata\?\.odoo_order_id/);
  assert.match(orders, /payment_intent\.succeeded/);
  assert.match(orders, /await confirmPaidOrder\(result\.orderId\)/);
  assert.match(orders, /odoo_sync_status='needs_retry'/);
  assert.match(payments, /createPaymentSession/);
  assert.match(payments, /X-Order-Token/);
  assert.match(checkout, /CheckoutPayment/);
  assert.doesNotMatch(checkout, /clearCart\(/);
});

test('Stripe secrets remain server-only and test mode is gated off by default', async () => {
  const [stripe, env, serverEnv, app, src, appConfig, eas] = await Promise.all([
    read('server/services/stripe.mjs'),
    read('.env.example'),
    read('server/.env.example'),
    read('app/checkout.tsx'),
    read('src/services/payments.ts'),
    read('app.json'),
    read('eas.json'),
  ]);
  assert.match(stripe, /STRIPE_WEBHOOK_SECRET/);
  assert.match(stripe, /timingSafeEqual/);
  assert.match(stripe, /credential_mode_mismatch/);
  assert.match(env, /^STRIPE_MODE=test$/m);
  assert.match(serverEnv, /^STRIPE_MODE=test$/m);
  assert.match(env, /^EXPO_PUBLIC_PAYMENT_ENABLED=false$/m);
  assert.match(env, /^EXPO_PUBLIC_ORDER_PREPARE_ENABLED=false$/m);
  for (const clientSource of [app, src, appConfig, eas]) {
    assert.doesNotMatch(clientSource, /sk_(?:test|live)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/);
  }
});

test('release preserves legal/account lifecycle, hidden My Farm, and inventory safety', async () => {
  const [account, settings, customer, tabs, home, farmRedirect, farmService, odoo] = await Promise.all([
    read('app/(tabs)/account.tsx'),
    read('app/settings.tsx'),
    read('server/src/app.mjs'),
    read('app/(tabs)/_layout.tsx'),
    read('app/(tabs)/index.tsx'),
    read('app/my-farm/_layout.tsx'),
    read('server/services/farms.mjs'),
    read('server/services/odoo.mjs'),
  ]);
  assert.match(account, /document: 'privacy'/);
  assert.match(account, /document: 'terms'/);
  assert.match(account, /router\.push\('\/support'\)/);
  assert.match(settings, /deleteAccount/);
  assert.match(customer, /auth\.deleteAccount/);
  assert.match(tabs, /name="my-farm" options=\{\{ href: null \}\}/);
  assert.doesNotMatch(home, /router\.push\([^\n]*my-farm/);
  assert.match(farmRedirect, /Redirect href="\/\(tabs\)"/);
  assert.ok(farmService.length > 1000);
  assert.doesNotMatch(odoo, /stock\.quant|inventory adjustment|qty_available\s*=|free_qty\s*=/i);
  const prepare = odoo.slice(
    odoo.indexOf('async function prepareQuotation'),
    odoo.indexOf('async function confirmQuotation'),
  );
  assert.doesNotMatch(prepare, /action_confirm/);
});
