import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
async function moduleFrom(file) {
  const code = ts.transpileModule(await readFile(file, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
  return import(
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  );
}
const domain = await moduleFrom('src/utils/customer.ts');
const orders = await moduleFrom('src/utils/orders.ts');
test('phone normalization: UAE, duplicate trunk prefix, international and Arabic digits', () => {
  for (const value of [
    '0501234567',
    '+971 050 123 4567',
    '00971501234567',
    '971501234567',
    '٠٥٠١٢٣٤٥٦٧',
  ])
    assert.equal(domain.normalizePhone(value), '+971501234567');
  assert.equal(domain.normalizePhone('+44 20 7946 0958'), '+442079460958');
  for (const value of [
    'hello',
    '+971',
    '++971501234567',
    '+0123456789',
    '12345',
  ])
    assert.equal(domain.normalizePhone(value), null);
});
test('email validation accepts plus addresses without allowing obvious invalid email', () => {
  for (const value of ['name+farm@example.ae', 'first.last@sub.example.com'])
    assert.equal(domain.validEmail(value), true);
  for (const value of [
    'name',
    'a@@b.com',
    'a b@example.com',
    'a@b',
    '@example.com',
  ])
    assert.equal(domain.validEmail(value), false);
});
test('avatar reference is HTTPS-only, versioned, and never a data blob', () => {
  const signed = 'https://example.com/avatar.jpg?Signature=abc';
  assert.equal(
    domain.avatarSource({ avatarUrl: signed, avatarUpdatedAt: 'new' }),
    signed,
  );
  assert.equal(
    domain.avatarSource({ avatarUrl: 'data:image/png;base64,test' }),
    undefined,
  );
  assert.equal(
    domain.avatarSource({ avatarUrl: 'http://example.com/photo' }),
    undefined,
  );
  assert.equal(
    new URL(
      domain.avatarSource({
        avatarUrl: 'https://example.com/avatar.jpg',
        avatarUpdatedAt: '2026-09-03',
      }),
    ).searchParams.get('v'),
    '2026-09-03',
  );
});
const address = (id, isDefault = false) => ({
  id,
  label: id,
  emirate: 'Dubai',
  city: 'Dubai',
  addressLine: 'Street',
  isDefault,
});
test('address upsert adds/edits without duplicates and keeps exactly one default', () => {
  const original = [address('a', true)];
  const added = domain.upsertAddress(original, address('b', true));
  assert.equal(added.length, 2);
  assert.deepEqual(
    added.filter((x) => x.isDefault).map((x) => x.id),
    ['b'],
  );
  assert.equal(original[0].isDefault, true);
  const edited = domain.upsertAddress(added, {
    ...address('b', true),
    label: 'Work',
  });
  assert.equal(edited.length, 2);
  assert.equal(edited[1].label, 'Work');
});
test('deleting the default selects a remaining address, deleting last is safe', () => {
  assert.equal(
    domain.withoutAddress([address('a', true), address('b')], 'a')[0].isDefault,
    true,
  );
  assert.deepEqual(domain.withoutAddress([address('a', true)], 'a'), []);
});
test('guest merge is deduplicated and idempotent and does not auto-enable marketing', () => {
  const item = {
    key: '1:2',
    productId: 1,
    variant: { id: 2, price: '25' },
    quantity: 2,
  };
  const local = {
    favorites: [1, 1, 2],
    recentProductIds: [2, 1],
    cart: [item],
    preferences: { notifications: { offers: true } },
  };
  const remote = {
    favorites: [2, 3],
    recentProductIds: [3, 2],
    cart: [{ ...item, quantity: 1 }],
    preferences: { notifications: { offers: false } },
  };
  const merged = domain.mergeGuestSnapshot(local, remote);
  assert.deepEqual(merged.favorites, [1, 2, 3]);
  assert.deepEqual(merged.recentProductIds, [2, 1, 3]);
  assert.equal(merged.cart[0].quantity, 2);
  assert.equal(merged.preferences.notifications.offers, false);
  assert.deepEqual(domain.mergeGuestSnapshot(local, merged), merged);
});
test('legacy marketing defaults do not count as explicit consent', () => {
  const settings = domain.readNotificationPreferences({
    offers: true,
    farmingTips: true,
  });
  assert.equal(settings.offers, false);
  assert.equal(settings.farmingTips, false);
  assert.equal(
    domain.readNotificationPreferences({ offers: true, marketingConsent: true })
      .offers,
    true,
  );
});
test('reorder uses current prices, exact variants, and reports deleted/unavailable products', () => {
  const items = [
    {
      productId: 1,
      variantId: 11,
      title: 'Available',
      quantity: 2,
      unitPrice: 5,
    },
    { productId: 2, variantId: 22, title: 'Unavailable', quantity: 1 },
    { productId: 3, variantId: 33, title: 'Deleted', quantity: 1 },
  ];
  const product = {
    id: 1,
    title: 'Available',
    variants: [{ id: 11, price: '35', available: true }],
  };
  const result = domain.planReorder(items, [
    product,
    { id: 2, variants: [{ id: 22, price: '10', available: false }] },
  ]);
  assert.equal(result.available.length, 1);
  assert.equal(result.available[0].variant.price, '35');
  assert.deepEqual(result.unavailable, ['Unavailable', 'Deleted']);
  assert.equal(
    domain.planReorder([{ ...items[0], variantId: 12 }], [product]).available
      .length,
    0,
  );
});
test('reorder repeated lines consolidate quantities without creating duplicate cart rows', () => {
  const item = { productId: 1, variantId: 11, title: 'Item', quantity: 2 };
  const result = domain.planReorder(
    [item, item],
    [{ id: 1, variants: [{ id: 11, price: '35', available: true }] }],
  );
  assert.equal(result.available.length, 1);
  assert.equal(result.available[0].quantity, 4);
});
test('order DTO does not expose tokens, payment intent or customer contact data', () => {
  const raw = {
    id: 'MIG-TEST-123',
    status: 'paid',
    createdAt: '2026-09-03T00:00:00Z',
    total: 35,
    subtotal: 30,
    delivery: 5,
    currency: 'AED',
    accessToken: 'secret',
    paymentIntentId: 'private',
    customer: { email: 'private@example.com' },
    shippingAddress: { city: 'Dubai', addressLine: 'Street' },
    items: [
      {
        productId: 1,
        variantId: 2,
        quantity: 1,
        unitPrice: 30,
        lineTotal: 30,
        title: 'Item',
        image: '/media/product.jpg',
      },
    ],
  };
  const mapped = orders.mapCustomerOrder(
    raw,
    'https://mig-farm-api.onrender.com',
  );
  assert.equal(mapped.total, 35);
  assert.equal(
    mapped.items[0].image,
    'https://mig-farm-api.onrender.com/media/product.jpg',
  );
  for (const value of ['secret', 'private', 'paymentIntentId', 'accessToken'])
    assert.equal(JSON.stringify(mapped).includes(value), false);
  assert.equal(
    orders.mapCustomerOrder(
      { ...raw, status: 'internal_unrecognized' },
      'https://example.com',
    ).status,
    'unknown',
  );
  assert.equal(orders.orderStatusLabel('paid', true), 'تم الدفع');
  assert.throws(() =>
    orders.mapCustomerOrder(
      { ...raw, total: undefined },
      'https://example.com',
    ),
  );
});
test('provider adapters reject rather than returning mock upload/email success', async () => {
  const { emailDelivery, avatarStorage } = await import('../server/services/adapters.mjs');
  assert.equal(emailDelivery.available, false);
  assert.equal(avatarStorage.available, false);
  await assert.rejects(emailDelivery.sendPasswordReset(), error => error.code === 'email_provider_not_configured');
  await assert.rejects(avatarStorage.upload(), error => error.code === 'avatar_storage_not_configured');
});
test('auth tokens and selected images never use AsyncStorage persistence', async () => {
  const session = await readFile('src/services/sessionStore.ts', 'utf8');
  assert.ok(session.includes('SecureStore.setItemAsync'));
  assert.equal(/AsyncStorage\.(setItem|multiSet)/.test(session), false);
  const picker = await readFile('src/services/avatar.ts', 'utf8');
  assert.ok(/base64:\s*false/.test(picker));
  assert.ok(picker.includes('512'));
  assert.equal(picker.includes('services/ai'), false);
});
