import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHmac } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../db/migrate.mjs';
import { createApp } from '../src/app.mjs';
import { createAuth } from '../auth/service.mjs';
import { createOrders } from '../services/orders.mjs';
import { stripeGateway } from '../services/stripe.mjs';

test('customer API foundation on PostgreSQL', async (t) => {
  const engine = new PGlite();
  const wrap = (client) => ({
    query: (sql, values) =>
      values
        ? client.query(sql, values)
        : client.exec(sql).then((results) => results.at(-1)),
  });
  const db = {
    ...wrap(engine),
    transaction: (operation) => engine.transaction((tx) => operation(wrap(tx))),
  };
  t.after(() => engine.close());
  await migrate(db);
  await migrate(db);
  const products = [
    {
      id: 11,
      handle: 'seed',
      title: 'Seed',
      images: [],
      variants: [{ id: 22, title: 'Packet', price: '12.35', available: true }],
    },
  ];
  const intents = new Map();
  const webhookSecret = 'test-webhook-secret';
  const verify = stripeGateway({ STRIPE_WEBHOOK_SECRET: webhookSecret }).verify;
  const stripe = {
    configured: true,
    publishableKey: 'pk_test_fixture',
    verify,
    intent: async (row) => {
      if (!intents.has(row.id))
        intents.set(row.id, {
          id: 'pi_' + row.id,
          client_secret: 'test-only',
          amount: Math.round(Number(row.total) * 100),
          currency: 'aed',
          metadata: { order_id: row.id },
        });
      return intents.get(row.id);
    },
  };
  const options = {
    orderSecret: 'test-only-order-secret-at-least-32-characters',
    delivery: '2.50',
  };
  const server = createApp({
    db,
    catalog: { products },
    mediaRoot: fileURLToPath(new URL('../public/', import.meta.url)),
    stripe,
    orderOptions: options,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const request = async (
    path,
    method = 'GET',
    body,
    accessToken,
    headers = {},
  ) => {
    const response = await fetch(origin + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const secret = 'MIG-farm-test-only!42';
  const register = (email) =>
    request('/api/auth/register', 'POST', {
      name: 'Test customer',
      email,
      password: secret,
      phone: '+9710501234567',
      language: 'ar',
    });
  let a, b, order;
  await t.test(
    'public catalog remains public and auth has safe errors',
    async () => {
      assert.equal((await request('/health')).status, 200);
      assert.equal((await request('/api/products')).body.products.length, 1);
      assert.equal((await request('/api/products/seed')).body.product.id, 11);
      const catalog = JSON.parse(
        await readFile(
          new URL('../data/products.json', import.meta.url),
          'utf8',
        ),
      );
      const image = catalog.products.find((product) =>
        product.images?.[0]?.src?.startsWith('/media/'),
      ).images[0].src;
      const media = await fetch(origin + image);
      assert.equal(media.status, 200);
      assert.match(media.headers.get('content-type'), /^image\//);
      assert.ok((await media.arrayBuffer()).byteLength > 100);
      assert.equal((await request('/api/me')).status, 401);
      assert.equal(
        (await request('/api/me', 'GET', undefined, 'invalid')).status,
        401,
      );
    },
  );
  await t.test(
    'registration, normalization, unique email, password hashing, safe profile',
    async () => {
      const first = await register(' A@example.test ');
      assert.equal(first.status, 201);
      a = first.body;
      b = (await register('b@example.test')).body;
      assert.equal(a.user.email, 'a@example.test');
      assert.equal(a.user.phone, '+971501234567');
      assert.equal((await register('a@example.test')).status, 409);
      assert.equal(a.user.password_hash, undefined);
      const stored = (
        await db.query('SELECT * FROM mig_farm.users WHERE id=$1', [a.user.id])
      ).rows[0];
      assert.ok(stored.password_hash.startsWith('scrypt1$'));
      assert.ok(!stored.password_hash.includes(secret));
      const sessions = (
        await db.query('SELECT * FROM mig_farm.sessions WHERE user_id=$1', [
          a.user.id,
        ])
      ).rows;
      assert.ok(!JSON.stringify(sessions).includes(a.refreshToken));
      assert.ok(!JSON.stringify(sessions).includes(a.accessToken));
      assert.equal(
        (
          await request('/api/auth/login', 'POST', {
            email: 'a@example.test',
            password: 'wrong',
          })
        ).body.error,
        'invalid_credentials',
      );
      assert.equal(
        (
          await request(
            '/api/me',
            'PATCH',
            { userId: b.user.id, name: 'Changed A', password_hash: 'unsafe' },
            a.accessToken,
          )
        ).body.user.id,
        a.user.id,
      );
      assert.equal(
        (await request('/api/me', 'GET', undefined, b.accessToken)).body.user
          .name,
        'Test customer',
      );
      assert.equal(
        (
          await request(
            '/api/me',
            'PATCH',
            { email: 'other@example.test' },
            a.accessToken,
          )
        ).status,
        400,
      );
      assert.equal(
        (await request('/api/me/avatar', 'POST', {}, a.accessToken)).body.error,
        'avatar_storage_not_configured',
      );
      assert.equal(
        (
          await request('/api/auth/forgot-password', 'POST', {
            email: 'a@example.test',
          })
        ).body.error,
        'email_provider_not_configured',
      );
    },
  );
  await t.test('address CRUD, single default, owner isolation', async () => {
    assert.deepEqual(
      (await request('/api/addresses', 'GET', undefined, a.accessToken)).body
        .addresses,
      [],
    );
    const input = {
      label: 'Home',
      category: 'home',
      name: 'Test',
      phone: '+971501234567',
      emirate: 'Dubai',
      city: 'Dubai',
      addressLine: 'Test address',
      isDefault: true,
    };
    let result = await request('/api/addresses', 'POST', input, a.accessToken);
    assert.equal(result.status, 201);
    const id = result.body.addresses[0].id;
    assert.equal(
      (await request('/api/addresses/' + id, 'PATCH', input, b.accessToken))
        .status,
      404,
    );
    assert.equal(
      (
        await request(
          '/api/addresses/' + id,
          'DELETE',
          undefined,
          b.accessToken,
        )
      ).status,
      404,
    );
    result = await request(
      '/api/addresses',
      'POST',
      { ...input, label: 'Farm' },
      a.accessToken,
    );
    assert.equal(result.body.addresses.filter((x) => x.isDefault).length, 1);
    assert.equal(
      (
        await request(
          '/api/addresses/' + id + '/default',
          'POST',
          {},
          a.accessToken,
        )
      ).body.addresses.find((x) => x.id === id).isDefault,
      true,
    );
    const rest = await request(
      '/api/addresses/' + id,
      'DELETE',
      undefined,
      a.accessToken,
    );
    assert.equal(rest.body.addresses.length, 1);
    assert.equal(rest.body.addresses[0].isDefault, true);
  });
  await t.test(
    'favorites validate catalog, deduplicate, merge and isolate',
    async () => {
      assert.equal(
        (await request('/api/favorites/99', 'POST', {}, a.accessToken)).status,
        404,
      );
      assert.deepEqual(
        (
          await request(
            '/api/favorites/merge',
            'POST',
            { productIds: [11, 11, 99] },
            a.accessToken,
          )
        ).body.favorites,
        [11],
      );
      assert.deepEqual(
        (await request('/api/favorites/11', 'POST', {}, a.accessToken)).body
          .favorites,
        [11],
      );
      await request(
        '/api/favorites/11',
        'DELETE',
        { userId: a.user.id },
        b.accessToken,
      );
      assert.deepEqual(
        (await request('/api/favorites', 'GET', undefined, a.accessToken)).body
          .favorites,
        [11],
      );
      assert.deepEqual(
        (await request('/api/favorites/11', 'DELETE', {}, a.accessToken)).body
          .favorites,
        [],
      );
    },
  );
  const checkout = {
    items: [{ productId: 11, variantId: 22, quantity: 2, price: 0 }],
    total: 0,
    customer: {
      name: 'Test buyer',
      email: 'buyer@example.test',
      phone: '+971501234567',
    },
    shippingAddress: {
      emirate: 'Dubai',
      city: 'Dubai',
      addressLine: 'Test address',
      notes: '',
    },
  };
  await t.test(
    'durable guest checkout, authoritative money, retry idempotency and token lookup',
    async () => {
      const key = randomUUID();
      const first = await request(
        '/api/checkout/session',
        'POST',
        checkout,
        undefined,
        { 'Idempotency-Key': key },
      );
      assert.equal(first.status, 200);
      assert.equal(first.body.amount, 27.2);
      const repeat = await request(
        '/api/checkout/session',
        'POST',
        checkout,
        undefined,
        { 'Idempotency-Key': key },
      );
      assert.equal(repeat.body.orderId, first.body.orderId);
      assert.equal(repeat.body.orderToken, first.body.orderToken);
      assert.equal(
        (
          await request(
            '/api/checkout/session',
            'POST',
            {
              ...checkout,
              items: [{ productId: 11, variantId: 22, quantity: 1 }],
            },
            undefined,
            { 'Idempotency-Key': key },
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            '/api/orders/' + first.body.orderId,
            'GET',
            undefined,
            first.body.orderToken,
          )
        ).body.order.items[0].lineTotal,
        24.7,
      );
      assert.equal(
        (
          await request(
            '/api/orders/' + first.body.orderId,
            'GET',
            undefined,
            'bad-token',
          )
        ).status,
        404,
      );
      const stored = (
        await db.query('SELECT * FROM mig_farm.orders WHERE id=$1', [
          first.body.orderId,
        ])
      ).rows[0];
      assert.equal(stored.customer_id, null);
      assert.ok(!JSON.stringify(stored).includes(first.body.orderToken));
    },
  );
  await t.test(
    'authenticated checkout, paginated history and order isolation',
    async () => {
      order = (
        await request(
          '/api/checkout/session',
          'POST',
          checkout,
          a.accessToken,
          { 'Idempotency-Key': randomUUID() },
        )
      ).body;
      const result = await request(
        '/api/me/orders?limit=1',
        'GET',
        undefined,
        a.accessToken,
      );
      assert.equal(result.body.items[0].id, order.orderId);
      assert.equal(
        (
          await request(
            '/api/me/orders/' + order.orderId,
            'GET',
            undefined,
            b.accessToken,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            '/api/me/orders/' + order.orderId,
            'GET',
            undefined,
            a.accessToken,
          )
        ).status,
        200,
      );
    },
  );
  await t.test(
    'signed webhook, deduplication, no paid downgrade and private notifications',
    async () => {
      const event = {
        id: 'evt_paid_test',
        type: 'payment_intent.succeeded',
        data: { object: intents.get(order.orderId) },
      };
      const post = async (value) => {
        const timestamp = Math.floor(Date.now() / 1000),
          raw = JSON.stringify(value);
        const signature = createHmac('sha256', webhookSecret)
          .update(timestamp + '.' + raw)
          .digest('hex');
        return request('/api/stripe/webhook', 'POST', value, undefined, {
          'Stripe-Signature': `t=${timestamp},v1=${signature}`,
        });
      };
      assert.equal(
        (await request('/api/stripe/webhook', 'POST', event)).status,
        400,
      );
      assert.equal((await post(event)).status, 200);
      assert.equal((await post(event)).status, 200);
      assert.equal(
        (
          await post({
            ...event,
            id: 'evt_late',
            type: 'payment_intent.payment_failed',
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            '/api/me/orders/' + order.orderId,
            'GET',
            undefined,
            a.accessToken,
          )
        ).body.order.status,
        'paid',
      );
      const notifications = (
        await request(
          '/api/notifications?limit=1',
          'GET',
          undefined,
          a.accessToken,
        )
      ).body;
      assert.equal(notifications.items.length, 1);
      const id = notifications.items[0].id;
      assert.equal(
        (
          await request(
            '/api/notifications/' + id + '/read',
            'PATCH',
            {},
            b.accessToken,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            '/api/notifications/' + id + '/read',
            'PATCH',
            {},
            a.accessToken,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            '/api/notifications/read-all',
            'POST',
            {},
            a.accessToken,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            '/api/notification-preferences',
            'PATCH',
            { offers: true },
            a.accessToken,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/api/notification-preferences',
            'PATCH',
            { offers: true, marketingConsent: true },
            a.accessToken,
          )
        ).body.preferences.offers,
        true,
      );
      assert.equal(
        (
          await request(
            '/api/notification-preferences',
            'GET',
            undefined,
            b.accessToken,
          )
        ).body.preferences.offers,
        false,
      );
    },
  );
  await t.test(
    'expiry, rotation, reuse revokes family, logout and logout-all',
    async () => {
      await db.query(
        "UPDATE mig_farm.sessions SET access_expires_at=now()-interval '1 second' WHERE user_id=$1",
        [b.user.id],
      );
      assert.equal(
        (await request('/api/me', 'GET', undefined, b.accessToken)).status,
        401,
      );
      const rotated = await request('/api/auth/refresh', 'POST', {
        refreshToken: b.refreshToken,
      });
      assert.equal(rotated.status, 200);
      assert.equal(
        (
          await request('/api/auth/refresh', 'POST', {
            refreshToken: b.refreshToken,
          })
        ).status,
        401,
      );
      assert.equal(
        (await request('/api/me', 'GET', undefined, rotated.body.accessToken))
          .status,
        401,
      );
      b = (
        await request('/api/auth/login', 'POST', {
          email: 'b@example.test',
          password: secret,
        })
      ).body;
      assert.equal(
        (
          await request('/api/auth/logout', 'POST', {
            refreshToken: b.refreshToken,
          })
        ).status,
        200,
      );
      assert.equal(
        (await request('/api/me', 'GET', undefined, b.accessToken)).status,
        401,
      );
      b = (
        await request('/api/auth/login', 'POST', {
          email: 'b@example.test',
          password: secret,
        })
      ).body;
      assert.equal(
        (await request('/api/auth/logout-all', 'POST', {}, b.accessToken))
          .status,
        200,
      );
      assert.equal(
        (
          await request('/api/auth/refresh', 'POST', {
            refreshToken: b.refreshToken,
          })
        ).status,
        401,
      );
    },
  );
  await t.test(
    'order and notification pagination does not expose another user',
    async () => {
      await request('/api/checkout/session', 'POST', checkout, a.accessToken, {
        'Idempotency-Key': randomUUID(),
      });
      const first = (
        await request('/api/me/orders?limit=1', 'GET', undefined, a.accessToken)
      ).body;
      assert.equal(first.items.length, 1);
      assert.equal(first.nextCursor, '1');
      const second = (
        await request(
          '/api/me/orders?limit=1&cursor=1',
          'GET',
          undefined,
          a.accessToken,
        )
      ).body;
      assert.equal(second.items.length, 1);
      assert.notEqual(first.items[0].id, second.items[0].id);
      await db.query(
        "INSERT INTO mig_farm.notifications(id,user_id,type,title,body) VALUES($1,$2,'system','Test','Test')",
        [randomUUID(), a.user.id],
      );
      const page = (
        await request(
          '/api/notifications?limit=1',
          'GET',
          undefined,
          a.accessToken,
        )
      ).body;
      assert.equal(page.nextCursor, '1');
      assert.equal(
        (
          await request(
            '/api/notifications?limit=1&cursor=1',
            'GET',
            undefined,
            a.accessToken,
          )
        ).body.items.length,
        1,
      );
    },
  );
  await t.test(
    'reset adapter creates expiring single-use hashed token and revokes sessions',
    async () => {
      let delivery;
      const auth = createAuth(db, {
        emailAdapter: {
          available: true,
          sendPasswordReset: async (value) => {
            delivery = value;
          },
        },
        resetBaseUrl: 'https://example.test/auth/reset-password',
      });
      await auth.forgot({ email: 'b@example.test' });
      const token = new URLSearchParams(
        new URL(delivery.url).hash.slice(1),
      ).get('token');
      assert.ok(token);
      assert.ok(
        !JSON.stringify(
          (await db.query('SELECT * FROM mig_farm.password_reset_tokens')).rows,
        ).includes(token),
      );
      await auth.reset({ token, password: 'Another-strong-test!42' });
      await assert.rejects(
        auth.reset({ token, password: 'Another-strong-test!42' }),
        (error) => error.code === 'invalid_reset_token',
      );
      assert.equal(
        (
          await request('/api/auth/login', 'POST', {
            email: 'b@example.test',
            password: secret,
          })
        ).status,
        401,
      );
      const result = await request('/api/auth/login', 'POST', {
        email: 'b@example.test',
        password: 'Another-strong-test!42',
      });
      assert.equal(result.status, 200);
      b = result.body;
    },
  );
  await t.test(
    'password change revokes every session, expired refresh cannot be reused',
    async () => {
      assert.equal(
        (
          await request(
            '/api/auth/change-password',
            'POST',
            {
              currentPassword: 'Another-strong-test!42',
              newPassword: 'New-production-test!42',
            },
            b.accessToken,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request('/api/me', 'GET', undefined, b.accessToken)).status,
        401,
      );
      assert.equal(
        (
          await request('/api/auth/refresh', 'POST', {
            refreshToken: b.refreshToken,
          })
        ).status,
        401,
      );
      b = (
        await request('/api/auth/login', 'POST', {
          email: 'b@example.test',
          password: 'New-production-test!42',
        })
      ).body;
      await db.query(
        "UPDATE mig_farm.sessions SET refresh_expires_at=now()-interval '1 second' WHERE user_id=$1",
        [b.user.id],
      );
      assert.equal(
        (
          await request('/api/auth/refresh', 'POST', {
            refreshToken: b.refreshToken,
          })
        ).status,
        401,
      );
    },
  );
  await t.test(
    'account deletion requires password, removes private resources and retains order snapshot',
    async () => {
      assert.equal(
        (
          await request(
            '/api/me',
            'DELETE',
            { password: 'wrong' },
            a.accessToken,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await request(
            '/api/me',
            'DELETE',
            { password: secret },
            a.accessToken,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request('/api/me', 'GET', undefined, a.accessToken)).status,
        401,
      );
      assert.equal(
        (
          await request('/api/auth/login', 'POST', {
            email: 'a@example.test',
            password: secret,
          })
        ).status,
        401,
      );
      for (const table of [
        'sessions',
        'user_addresses',
        'user_favorites',
        'notifications',
        'notification_preferences',
      ])
        assert.equal(
          (
            await db.query(
              'SELECT count(*) FROM mig_farm.' + table + ' WHERE user_id=$1',
              [a.user.id],
            )
          ).rows[0].count,
          0,
        );
      const row = (
        await db.query('SELECT * FROM mig_farm.orders WHERE id=$1', [
          order.orderId,
        ])
      ).rows[0];
      assert.equal(row.customer_id, null);
      assert.equal(row.customer_snapshot.name, 'Test buyer');
      assert.equal(row.status, 'paid');
    },
  );
  await t.test('rate limits expire and return safe retry error', async () => {
    const auth = createAuth(db);
    await auth.rate('test-rate', 1, 1);
    await assert.rejects(
      auth.rate('test-rate', 1, 1),
      (error) => error.statusCode === 429,
    );
    await db.query(
      "UPDATE mig_farm.rate_limits SET expires_at=now()-interval '1 second'",
    );
    await auth.rate('test-rate', 1, 1);
  });
  await t.test('legacy guest token import is repeat-safe', async () => {
    const orders = createOrders(db, products, stripe, options);
    const legacy = {
      id: 'MIG-OLD-123',
      accessToken: 'legacy-secret-fixture',
      status: 'paid',
      currency: 'AED',
      subtotal: 12.35,
      delivery: 0,
      total: 12.35,
      createdAt: new Date().toISOString(),
      customer: checkout.customer,
      shippingAddress: checkout.shippingAddress,
      items: [
        {
          productId: 11,
          variantId: 22,
          handle: 'seed',
          title: 'Seed',
          quantity: 1,
          unitPrice: 12.35,
          lineTotal: 12.35,
        },
      ],
    };
    await orders.importLegacy(legacy);
    await orders.importLegacy(legacy);
    assert.equal(
      (await orders.guest(legacy.id, legacy.accessToken)).total,
      12.35,
    );
  });
});
