import { createHmac, randomUUID, randomBytes } from 'node:crypto';
import { fail, text, email, phone, pageResult } from '../lib/validation.mjs';
import { hashToken } from '../auth/security.mjs';
import { lockCustomer } from './customers.mjs';
export function priceCheckout(body, products, deliveryValue = '0') {
  if (
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > 100
  )
    throw fail(400, 'cart_is_empty');
  const merged = new Map();
  for (const item of body.items) {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
      throw fail(400, 'invalid_cart_item');
    const p = products.find((p) => String(p.id) === String(item.productId)),
      v = p?.variants.find((v) => String(v.id) === String(item.variantId));
    if (!p || !v || v.available === false) throw fail(400, 'invalid_cart_item');
    const minor = Math.round(Number(v.price) * 100);
    if (!Number.isSafeInteger(minor) || minor < 0)
      throw fail(500, 'invalid_catalog_price');
    const key = p.id + ':' + v.id,
      old = merged.get(key),
      count = (old?.quantity || 0) + quantity;
    if (count > 99) throw fail(400, 'invalid_cart_item');
    merged.set(key, {
      productId: p.id,
      variantId: v.id,
      handle: p.handle,
      title: p.title,
      variantTitle: v.title || '',
      image: p.images?.[0]?.src || null,
      quantity: count,
      unitPrice: minor / 100,
      lineTotal: (minor * count) / 100,
    });
  }
  const items = [...merged.values()],
    subtotalMinor = items.reduce(
      (sum, item) => sum + Math.round(item.lineTotal * 100),
      0,
    ),
    deliveryMinor = Math.round(Number(deliveryValue) * 100);
  if (
    !Number.isSafeInteger(deliveryMinor) ||
    deliveryMinor < 0 ||
    subtotalMinor + deliveryMinor > 999999999999
  )
    throw fail(500, 'invalid_delivery_fee');
  const customer = {
    name: text(body.customer?.name, 120, true),
    email: email(body.customer?.email),
    phone: phone(body.customer?.phone),
  };
  if (!customer.phone) throw fail(400, 'invalid_customer');
  const shipping = body.shippingAddress || {};
  const shippingAddress = {
    emirate: text(shipping.emirate, 60, true),
    city: text(shipping.city, 100, true),
    addressLine: text(shipping.addressLine, 220, true),
    notes: text(shipping.notes || '', 300),
  };
  return {
    items,
    subtotal: subtotalMinor / 100,
    delivery: deliveryMinor / 100,
    total: (subtotalMinor + deliveryMinor) / 100,
    currency: 'AED',
    customer,
    shippingAddress,
  };
}
export function createOrders(db, products, stripe, options = {}) {
  const secret = options.orderSecret || process.env.ORDER_TOKEN_SECRET;
  const requireDb = () => {
    if (!db) throw fail(503, 'database_not_configured');
  };
  const accessToken = (row) =>
    createHmac('sha256', secret)
      .update(row.id + ':' + row.token_nonce)
      .digest('base64url');
  async function insert(
    client,
    order,
    userId,
    checkoutKey,
    requestHash,
    rawToken,
    nonce,
  ) {
    const result = await client.query(
      'INSERT INTO mig_farm.orders(id,customer_id,status,currency,subtotal,delivery,total,customer_snapshot,shipping_snapshot,access_hash,checkout_key,request_hash,token_nonce,payment_intent_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT DO NOTHING RETURNING *',
      [
        order.id,
        userId,
        order.status || 'awaiting_payment',
        order.currency,
        order.subtotal,
        order.delivery,
        order.total,
        JSON.stringify(order.customer),
        JSON.stringify(order.shippingAddress),
        hashToken(rawToken),
        checkoutKey,
        requestHash,
        nonce,
        order.paymentIntentId || null,
        order.createdAt || new Date(),
        order.updatedAt || new Date(),
      ],
    );
    if (!result.rows.length) return null;
    for (const [position, item] of order.items.entries())
      await client.query(
        'INSERT INTO mig_farm.order_items(id,order_id,position,product_id,variant_id,handle,title,variant_title,image,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [
          randomUUID(),
          order.id,
          position,
          item.productId,
          item.variantId,
          item.handle,
          item.title,
          item.variantTitle || '',
          item.image || null,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
        ],
      );
    return result.rows[0];
  }
  async function checkout(body, user, idempotency) {
    requireDb();
    if (!stripe.configured) throw fail(503, 'payment_provider_not_configured');
    if (!secret || secret.length < 32)
      throw fail(503, 'order_security_not_configured');
    if (
      idempotency !== undefined &&
      (typeof idempotency !== 'string' ||
        !/^[a-zA-Z0-9_-]{20,128}$/.test(idempotency))
    )
      throw fail(400, 'invalid_idempotency_key');
    const priced = priceCheckout(
      body,
      products,
      options.delivery ?? process.env.DELIVERY_FEE_AED ?? '0',
    );
    const checkoutKey = hashToken(
      (user?.id || 'guest') + ':' + (idempotency || randomUUID()),
    );
    const requestHash = hashToken(
      JSON.stringify({
        items: priced.items.map((i) => [i.productId, i.variantId, i.quantity]),
        customer: priced.customer,
        address: priced.shippingAddress,
      }),
    );
    const row = await db.transaction(async (client) => {
      if (user) await lockCustomer(client, user.id);
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [checkoutKey],
      );
      const previous = (
        await client.query(
          'SELECT * FROM mig_farm.orders WHERE checkout_key=$1',
          [checkoutKey],
        )
      ).rows[0];
      if (previous) {
        if (previous.request_hash !== requestHash)
          throw fail(409, 'idempotency_conflict');
        return previous;
      }
      const id =
          'MIG-' +
          Date.now().toString(36).toUpperCase() +
          '-' +
          randomBytes(6).toString('hex').toUpperCase(),
        nonce = randomBytes(16).toString('hex');
      return insert(
        client,
        { ...priced, id },
        user?.id || null,
        checkoutKey,
        requestHash,
        accessToken({ id, token_nonce: nonce }),
        nonce,
      );
    });
    if (!row) throw fail(503, 'checkout_conflict');
    if (row.status === 'paid' || row.status === 'canceled')
      throw fail(409, 'order_already_completed');
    const intent = await stripe.intent(row);
    if (
      intent.metadata?.order_id !== row.id ||
      intent.amount !== Math.round(Number(row.total) * 100) ||
      intent.currency !== 'aed'
    )
      throw fail(502, 'payment_provider_error');
    await db.query(
      'UPDATE mig_farm.orders SET payment_intent_id=$2,updated_at=now() WHERE id=$1 AND (payment_intent_id IS NULL OR payment_intent_id=$2)',
      [row.id, intent.id],
    );
    return {
      orderId: row.id,
      orderToken: accessToken(row),
      clientSecret: intent.client_secret,
      publishableKey: stripe.publishableKey,
      amount: Number(row.total),
      currency: row.currency,
    };
  }
  async function dto(row) {
    const items = (
      await db.query(
        'SELECT * FROM mig_farm.order_items WHERE order_id=$1 ORDER BY position',
        [row.id],
      )
    ).rows;
    return {
      id: row.id,
      status: row.status,
      currency: row.currency,
      subtotal: Number(row.subtotal),
      delivery: Number(row.delivery),
      total: Number(row.total),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      shippingAddress: row.shipping_snapshot,
      paymentStatus: row.payment_status,
      items: items.map((i) => ({
        productId: Number(i.product_id),
        variantId: Number(i.variant_id),
        handle: i.handle,
        title: i.title,
        variantTitle: i.variant_title,
        image: i.image,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        lineTotal: Number(i.line_total),
      })),
    };
  }
  async function guest(id, rawToken) {
    requireDb();
    if (typeof rawToken !== 'string' || rawToken.length > 256)
      throw fail(404, 'order_not_found');
    const row = (
      await db.query(
        'SELECT * FROM mig_farm.orders WHERE id=$1 AND access_hash=$2',
        [id, hashToken(rawToken)],
      )
    ).rows[0];
    if (!row) throw fail(404, 'order_not_found');
    return dto(row);
  }
  async function detail(user, id) {
    const row = (
      await db.query(
        'SELECT * FROM mig_farm.orders WHERE id=$1 AND customer_id=$2',
        [id, user.id],
      )
    ).rows[0];
    if (!row) throw fail(404, 'order_not_found');
    return dto(row);
  }
  async function history(user, pagination) {
    const rows = (
      await db.query(
        'SELECT * FROM mig_farm.orders WHERE customer_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3',
        [user.id, pagination.limit + 1, pagination.offset],
      )
    ).rows;
    const result = pageResult(rows, pagination);
    return { ...result, items: await Promise.all(result.items.map(dto)) };
  }
  async function webhook(event) {
    requireDb();
    const statuses = {
      'payment_intent.succeeded': 'paid',
      'payment_intent.payment_failed': 'payment_failed',
      'payment_intent.canceled': 'canceled',
    };
    if (!statuses[event.type]) return;
    if (typeof event.id !== 'string' || event.id.length > 200)
      throw fail(400, 'invalid_event');
    const intent = event.data?.object,
      id = intent?.metadata?.order_id;
    if (!id) return;
    await db.transaction(async (client) => {
      const candidate = (
        await client.query(
          'SELECT customer_id FROM mig_farm.orders WHERE id=$1',
          [id],
        )
      ).rows[0];
      if (candidate?.customer_id)
        await client.query(
          'SELECT id FROM mig_farm.users WHERE id=$1 FOR UPDATE',
          [candidate.customer_id],
        );
      const row = (
        await client.query(
          'SELECT * FROM mig_farm.orders WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!row) return;
      if (
        (row.payment_intent_id && row.payment_intent_id !== intent.id) ||
        intent.amount !== Math.round(Number(row.total) * 100) ||
        intent.currency !== 'aed'
      )
        throw fail(400, 'invalid_event');
      const receipt = await client.query(
        'INSERT INTO mig_farm.stripe_events(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id',
        [event.id],
      );
      if (!receipt.rows.length) return;
      if (row.status === 'paid' || row.status === 'canceled') return;
      const status = statuses[event.type];
      await client.query(
        'UPDATE mig_farm.orders SET status=$2,payment_status=$2,payment_intent_id=$3,updated_at=now() WHERE id=$1',
        [id, status, intent.id],
      );
      if (row.customer_id) {
        const pref = (
          await client.query(
            'SELECT order_updates FROM mig_farm.notification_preferences WHERE user_id=$1',
            [row.customer_id],
          )
        ).rows[0];
        if (pref?.order_updates && row.status !== status)
          await client.query(
            "INSERT INTO mig_farm.notifications(id,user_id,type,title,body,data_json) VALUES($1,$2,'order',$3,$4,$5)",
            [
              randomUUID(),
              row.customer_id,
              'Order update',
              id,
              JSON.stringify({
                orderId: id,
                status,
                titleAr: 'تحديث الطلب',
                bodyAr: id,
              }),
            ],
          );
      }
    });
  }
  async function importLegacy(order) {
    requireDb();
    if (
      !/^MIG-[A-Z0-9-]+$/i.test(order.id) ||
      !order.accessToken ||
      !Array.isArray(order.items) ||
      !order.customer ||
      !order.shippingAddress ||
      !Number.isFinite(Date.parse(order.createdAt))
    )
      throw fail(400, 'invalid_legacy_order');
    return db.transaction(async (client) => {
      const row = await insert(
        client,
        order,
        null,
        null,
        null,
        order.accessToken,
        null,
      );
      if (row)
        await client.query(
          'UPDATE mig_farm.orders SET payment_status=$2 WHERE id=$1',
          [row.id, row.status === 'awaiting_payment' ? 'pending' : row.status],
        );
      return row;
    });
  }
  return { checkout, guest, detail, history, webhook, importLegacy };
}
