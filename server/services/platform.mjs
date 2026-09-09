import { randomUUID, createHash } from 'node:crypto';
import { fail, pageResult, text } from '../lib/validation.mjs';
import { emailDelivery, avatarStorage, bannerStorage, pushDelivery } from './adapters.mjs';

const role = (user) => {
  if (user.role !== 'admin') throw fail(403, 'forbidden');
};

const hash = (value) => createHash('sha256').update(String(value)).digest('hex');

const safeLink = (value = '') => {
  const link = text(value || '', 300);
  if (link && !/^\/|^migfarm:\/\//.test(link)) throw fail(400, 'invalid_input');
  return link;
};

const ids = (value) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 100) throw fail(400, 'invalid_input');
  return [...new Set(value.map(Number))].filter((id) => Number.isSafeInteger(id) && id > 0);
};

const activeWindow = "visible=true AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now())";
const asNumber = (value) => value == null ? null : Number(value);
const iso = (value) => value ? new Date(value).toISOString() : null;
const dateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw fail(400, 'invalid_input');
  return date.toISOString();
};
const intValue = (value, fallback, min = 0, max = 100000) => {
  const next = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(next) || next < min || next > max) throw fail(400, 'invalid_input');
  return next;
};

export function createPlatform(db, products) {
  const productIds = new Set(products.map((p) => Number(p.id)));
  const existingIds = (value) => ids(value).filter((id) => productIds.has(id));

  async function publicHome() {
    const rows = db
      ? (await db.query(
          `SELECT * FROM mig_farm.home_content WHERE ${activeWindow} ORDER BY sort_order,created_at DESC LIMIT 40`,
        )).rows
      : [];
    return {
      sections: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        titleAr: row.title_ar,
        titleEn: row.title_en,
        bodyAr: row.body_ar,
        bodyEn: row.body_en,
        imageUrl: row.image_url,
        deepLink: row.deep_link,
        productIds: row.product_ids || [],
      })),
    };
  }

  async function publicOffers() {
    const rows = db
      ? (await db.query(
          "SELECT * FROM mig_farm.offers WHERE status='active' AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now()) ORDER BY COALESCE(starts_at,created_at) DESC LIMIT 40",
        )).rows
      : [];
    return {
      offers: rows.map((row) => ({
        id: row.id,
        titleAr: row.title_ar,
        titleEn: row.title_en,
        descriptionAr: row.description_ar,
        descriptionEn: row.description_en,
        bannerUrl: row.banner_url,
        discount: row.discount,
        ctaAr: row.cta_ar,
        ctaEn: row.cta_en,
        deepLink: row.deep_link,
        productIds: row.product_ids || [],
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      })),
    };
  }

  async function saveRecent(user, body) {
    const productId = Number(body.productId);
    if (!productIds.has(productId)) throw fail(404, 'product_not_found');
    await db.query(
      'INSERT INTO mig_farm.recently_viewed(user_id,product_id,viewed_at) VALUES($1,$2,now()) ON CONFLICT(user_id,product_id) DO UPDATE SET viewed_at=now()',
      [user.id, productId],
    );
    await db.query(
      'DELETE FROM mig_farm.recently_viewed WHERE user_id=$1 AND product_id NOT IN (SELECT product_id FROM mig_farm.recently_viewed WHERE user_id=$1 ORDER BY viewed_at DESC LIMIT 60)',
      [user.id],
    );
    return { ok: true };
  }

  async function recent(user) {
    return {
      productIds: (await db.query(
        'SELECT product_id FROM mig_farm.recently_viewed WHERE user_id=$1 ORDER BY viewed_at DESC LIMIT 24',
        [user.id],
      )).rows.map((row) => Number(row.product_id)),
    };
  }

  async function savePushToken(user, body) {
    const tokenValue = text(body.token, 512, true),
      platform = ['ios', 'android', 'web'].includes(body.platform) ? body.platform : 'unknown',
      locale = body.locale === 'ar' ? 'ar' : 'en',
      deviceId = text(body.deviceId || '', 180);
    await db.query(
      'INSERT INTO mig_farm.push_tokens(id,user_id,token_hash,token_value,platform,device_id,locale,enabled,last_seen_at,invalidated_at) VALUES($1,$2,$3,$4,$5,$6,$7,true,now(),NULL) ON CONFLICT(token_hash) DO UPDATE SET user_id=$2,token_value=$4,platform=$5,device_id=$6,locale=$7,enabled=true,last_seen_at=now(),invalidated_at=NULL',
      [randomUUID(), user.id, hash(tokenValue), tokenValue, platform, deviceId, locale],
    );
    return { ok: true };
  }

  async function removePushToken(user, body) {
    const tokenValue = text(body.token, 512, true);
    await db.query(
      'UPDATE mig_farm.push_tokens SET enabled=false,invalidated_at=now() WHERE user_id=$1 AND token_hash=$2',
      [user.id, hash(tokenValue)],
    );
    return { ok: true };
  }

  async function mergeGuest(user, body) {
    const clientUpdatedAt = body.clientUpdatedAt ? new Date(body.clientUpdatedAt) : new Date();
    if (Number.isNaN(clientUpdatedAt.getTime())) throw fail(400, 'invalid_input');
    const cart = Array.isArray(body.cart) ? body.cart.slice(0, 200) : [];
    const recentProductIds = existingIds(body.recentProductIds || []);
    const favoriteIds = existingIds(body.favorites || []);
    const farmSnapshot =
      body.myFarm && typeof body.myFarm === 'object' && !Array.isArray(body.myFarm)
        ? body.myFarm
        : null;
    await db.transaction(async (client) => {
      await client.query('SELECT id FROM mig_farm.users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [user.id]);
      for (const productId of favoriteIds)
        await client.query(
          'INSERT INTO mig_farm.user_favorites(user_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [user.id, productId],
        );
      for (const productId of recentProductIds)
        await client.query(
          'INSERT INTO mig_farm.recently_viewed(user_id,product_id,viewed_at) VALUES($1,$2,$3) ON CONFLICT(user_id,product_id) DO UPDATE SET viewed_at=GREATEST(mig_farm.recently_viewed.viewed_at,EXCLUDED.viewed_at)',
          [user.id, productId, clientUpdatedAt],
        );
      for (const item of cart) {
        const productId = Number(item.productId),
          variantId = Number(item.variant?.id || item.variantId),
          quantity = Math.max(1, Math.min(99, Number(item.quantity || 1))),
          key = text(String(item.key || `${productId}:${variantId}`), 160, true);
        if (!productIds.has(productId) || !Number.isSafeInteger(variantId) || variantId <= 0) continue;
        await client.query(
          'INSERT INTO mig_farm.user_cart_items(user_id,item_key,product_id,variant_id,quantity,payload_json,guest_updated_at,server_updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(user_id,item_key) DO UPDATE SET quantity=LEAST(99,GREATEST(mig_farm.user_cart_items.quantity,EXCLUDED.quantity)),payload_json=CASE WHEN mig_farm.user_cart_items.guest_updated_at<=EXCLUDED.guest_updated_at THEN EXCLUDED.payload_json ELSE mig_farm.user_cart_items.payload_json END,guest_updated_at=GREATEST(mig_farm.user_cart_items.guest_updated_at,EXCLUDED.guest_updated_at),server_updated_at=now()',
          [user.id, key, productId, variantId, quantity, JSON.stringify(item), clientUpdatedAt],
        );
      }
      if (farmSnapshot)
        await client.query(
          'INSERT INTO mig_farm.guest_farm_snapshots(user_id,snapshot_json,guest_updated_at,synced_at) VALUES($1,$2,$3,now()) ON CONFLICT(user_id) DO UPDATE SET snapshot_json=CASE WHEN mig_farm.guest_farm_snapshots.guest_updated_at<=EXCLUDED.guest_updated_at THEN EXCLUDED.snapshot_json ELSE mig_farm.guest_farm_snapshots.snapshot_json END,guest_updated_at=GREATEST(mig_farm.guest_farm_snapshots.guest_updated_at,EXCLUDED.guest_updated_at),synced_at=now()',
          [user.id, JSON.stringify(farmSnapshot), clientUpdatedAt],
        );
    });
    return { ok: true, syncedAt: new Date().toISOString() };
  }

  async function adminSummary(user) {
    role(user);
    const [customers, orders, pending, offers, notifications, newCustomers, recentOrders, recentCustomers, statusRows, pushRows] = await Promise.all([
      db.query("SELECT count(*)::int AS total FROM mig_farm.users WHERE role='customer' AND deleted_at IS NULL"),
      db.query('SELECT count(*)::int AS total, COALESCE(sum(total),0)::numeric AS revenue, COALESCE(avg(total),0)::numeric AS average FROM mig_farm.orders'),
      db.query("SELECT count(*)::int AS total FROM mig_farm.orders WHERE delivery_status IN ('new','processing','ready')"),
      db.query("SELECT count(*)::int AS total FROM mig_farm.offers WHERE deleted_at IS NULL AND status='active' AND (ends_at IS NULL OR ends_at>now())"),
      db.query('SELECT count(*)::int AS total FROM mig_farm.push_campaigns'),
      db.query("SELECT count(*)::int AS total FROM mig_farm.users WHERE role='customer' AND deleted_at IS NULL AND created_at>=now()-interval '30 days'"),
      db.query('SELECT id,status,payment_status,delivery_status,total,currency,created_at FROM mig_farm.orders ORDER BY created_at DESC LIMIT 8'),
      db.query("SELECT id,name,email,phone,language,status,created_at FROM mig_farm.users WHERE role='customer' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 8"),
      db.query('SELECT delivery_status,count(*)::int AS total FROM mig_farm.orders GROUP BY delivery_status ORDER BY delivery_status'),
      db.query('SELECT id,title_en,target,status,scheduled_at,sent_at,created_at FROM mig_farm.push_campaigns ORDER BY created_at DESC LIMIT 8'),
    ]);
    return {
      customers: customers.rows[0].total,
      orders: orders.rows[0].total,
      revenue: Number(orders.rows[0].revenue || 0),
      averageOrderValue: Number(orders.rows[0].average || 0),
      pendingOrders: pending.rows[0].total,
      activeOffers: offers.rows[0].total,
      pushCampaigns: notifications.rows[0].total,
      notifications: notifications.rows[0].total,
      newCustomers: newCustomers.rows[0].total,
      recentOrders: recentOrders.rows,
      recentCustomers: recentCustomers.rows.map(customerDTO),
      orderStatusBreakdown: statusRows.rows.map((row) => ({ status: row.delivery_status, total: row.total })),
      recentPushCampaigns: pushRows.rows,
      system: {
        api: 'online',
        database: db ? 'configured' : 'not_configured',
        productCount: products.length,
        pushProvider: pushDelivery.available ? 'configured' : 'not_configured',
        storageProvider: avatarStorage.available || bannerStorage.available ? 'configured' : 'not_configured',
        emailProvider: emailDelivery.available ? 'configured' : 'not_configured',
      },
    };
  }

  async function adminCustomers(user, pagination, url = null) {
    role(user);
    const where = ["role='customer'", 'deleted_at IS NULL'],
      values = [];
    const search = url?.searchParams.get('q')?.trim();
    if (search) {
      values.push('%' + search.replace(/[%_\\]/g, '\\$&') + '%');
      where.push(`(name ILIKE $${values.length} ESCAPE '\\' OR email ILIKE $${values.length} ESCAPE '\\' OR phone ILIKE $${values.length} ESCAPE '\\')`);
    }
    for (const [param, column, allowed] of [
      ['language', 'language', ['ar', 'en']],
      ['status', 'status', ['active', 'suspended', 'deleted']],
    ]) {
      const value = url?.searchParams.get(param);
      if (value) {
        if (!allowed.includes(value)) throw fail(400, 'invalid_input');
        values.push(value);
        where.push(`${column}=$${values.length}`);
      }
    }
    const emirate = url?.searchParams.get('emirate');
    if (emirate) {
      values.push(emirate);
      where.push(`emirate=$${values.length}`);
    }
    values.push(pagination.limit + 1, pagination.offset);
    const rows = (await db.query(
      `SELECT u.id,u.name,u.email,u.phone,u.language,u.emirate,u.status,u.created_at,count(o.id)::int AS order_count,COALESCE(sum(o.total),0)::numeric AS total_spent FROM mig_farm.users u LEFT JOIN mig_farm.orders o ON o.customer_id=u.id WHERE ${where.join(' AND ')} GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    )).rows;
    return pageResult(rows.map(customerDTO), pagination);
  }

  async function adminCustomerDetail(user, id) {
    role(user);
    const customer = (await db.query(
      "SELECT u.id,u.name,u.email,u.phone,u.language,u.emirate,u.status,u.created_at,count(o.id)::int AS order_count,COALESCE(sum(o.total),0)::numeric AS total_spent FROM mig_farm.users u LEFT JOIN mig_farm.orders o ON o.customer_id=u.id WHERE u.id=$1 AND u.role='customer' AND u.deleted_at IS NULL GROUP BY u.id",
      [id],
    )).rows[0];
    if (!customer) throw fail(404, 'not_found');
    const [addresses, orders, favorites, recent, farms] = await Promise.all([
      db.query('SELECT id,label,category,name,phone,emirate,city,address_line,is_default,created_at FROM mig_farm.user_addresses WHERE user_id=$1 ORDER BY is_default DESC,created_at DESC LIMIT 20', [id]),
      db.query('SELECT id,status,payment_status,delivery_status,total,currency,created_at FROM mig_farm.orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 20', [id]),
      db.query('SELECT product_id,created_at FROM mig_farm.user_favorites WHERE user_id=$1 ORDER BY created_at DESC LIMIT 40', [id]),
      db.query('SELECT product_id,viewed_at FROM mig_farm.recently_viewed WHERE user_id=$1 ORDER BY viewed_at DESC LIMIT 40', [id]),
      db.query(`SELECT count(*)::int AS farms,(SELECT count(*)::int FROM mig_farm.crop_cycles c JOIN mig_farm.farms f ON f.id=c.farm_id WHERE f.user_id=$1 AND f.deleted_at IS NULL AND c.deleted_at IS NULL) AS crops,(SELECT count(*)::int FROM mig_farm.farm_tasks WHERE user_id=$1 AND deleted_at IS NULL) AS tasks,(SELECT count(*)::int FROM mig_farm.farm_problems WHERE user_id=$1 AND deleted_at IS NULL) AS problems FROM mig_farm.farms WHERE user_id=$1 AND deleted_at IS NULL`, [id]),
    ]);
    return {
      customer: customerDTO(customer),
      addresses: addresses.rows,
      orders: orders.rows,
      favorites: favorites.rows,
      recentlyViewed: recent.rows,
      myFarm: farms.rows[0],
    };
  }

  async function setCustomerStatus(user, id, body) {
    role(user);
    const status = ['active', 'suspended'].includes(body.status) ? body.status : null;
    if (!status) throw fail(400, 'invalid_input');
    const row = (await db.query(
      "UPDATE mig_farm.users SET status=$2,updated_at=now() WHERE id=$1 AND role='customer' AND deleted_at IS NULL RETURNING id,name,email,phone,language,emirate,status,created_at",
      [id, status],
    )).rows[0];
    if (!row) throw fail(404, 'not_found');
    return { customer: customerDTO(row) };
  }

  async function adminOrders(user, pagination, url = null) {
    role(user);
    const where = [],
      values = [];
    const search = url?.searchParams.get('q')?.trim();
    if (search) {
      values.push('%' + search.replace(/[%_\\]/g, '\\$&') + '%');
      where.push(`(o.id ILIKE $${values.length} ESCAPE '\\' OR u.email ILIKE $${values.length} ESCAPE '\\' OR u.name ILIKE $${values.length} ESCAPE '\\')`);
    }
    for (const [param, column, allowed] of [
      ['status', 'o.delivery_status', ['new','processing','ready','shipped','delivered','cancelled']],
      ['payment', 'o.payment_status', ['pending','paid','failed','requires_payment_method','processing','canceled']],
    ]) {
      const value = url?.searchParams.get(param);
      if (value) {
        if (!allowed.includes(value)) throw fail(400, 'invalid_input');
        values.push(value);
        where.push(`${column}=$${values.length}`);
      }
    }
    const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : '';
    values.push(pagination.limit + 1, pagination.offset);
    const rows = (await db.query(
      `SELECT o.id,o.customer_id,u.name AS customer_name,u.email AS customer_email,o.status,o.payment_status,o.delivery_status,o.total,o.currency,o.shipping_snapshot,o.created_at FROM mig_farm.orders o LEFT JOIN mig_farm.users u ON u.id=o.customer_id ${sqlWhere} ORDER BY o.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    )).rows;
    return pageResult(rows.map(orderDTO), pagination);
  }

  async function adminOrderDetail(user, id) {
    role(user);
    const order = (await db.query(
      'SELECT o.*,u.name AS customer_name,u.email AS customer_email,u.phone AS customer_phone FROM mig_farm.orders o LEFT JOIN mig_farm.users u ON u.id=o.customer_id WHERE o.id=$1',
      [id],
    )).rows[0];
    if (!order) throw fail(404, 'not_found');
    const items = (await db.query(
      'SELECT product_id,variant_id,handle,title,variant_title,image,quantity,unit_price,line_total FROM mig_farm.order_items WHERE order_id=$1 ORDER BY position',
      [id],
    )).rows.map((row) => ({ ...row, unit_price: asNumber(row.unit_price), line_total: asNumber(row.line_total) }));
    return { order: { ...orderDTO(order), subtotal: asNumber(order.subtotal), delivery: asNumber(order.delivery), items, shippingAddress: order.shipping_snapshot, customer: { id: order.customer_id, name: order.customer_name || order.customer_snapshot?.name, email: order.customer_email || order.customer_snapshot?.email, phone: order.customer_phone || order.customer_snapshot?.phone } } };
  }

  async function setOrderDeliveryStatus(user, id, body) {
    role(user);
    const status = ['new','processing','ready','shipped','delivered','cancelled'].includes(body.deliveryStatus) ? body.deliveryStatus : null;
    if (!status) throw fail(400, 'invalid_input');
    const row = (await db.query(
      'UPDATE mig_farm.orders SET delivery_status=$2,updated_at=now() WHERE id=$1 RETURNING id,customer_id,status,payment_status,delivery_status,total,currency,shipping_snapshot,created_at',
      [id, status],
    )).rows[0];
    if (!row) throw fail(404, 'not_found');
    return { order: orderDTO(row) };
  }

  function customerDTO(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      language: row.language,
      emirate: row.emirate,
      status: row.status,
      createdAt: row.created_at,
      orderCount: Number(row.order_count || 0),
      totalSpent: Number(row.total_spent || 0),
    };
  }

  function orderDTO(row) {
    const shipping = row.shipping_snapshot || {};
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name || null,
      customerEmail: row.customer_email || null,
      status: row.status,
      paymentStatus: row.payment_status,
      deliveryStatus: row.delivery_status,
      total: Number(row.total),
      currency: row.currency,
      emirate: shipping.emirate || '',
      createdAt: row.created_at,
    };
  }

  async function saveOffer(user, body, id = randomUUID()) {
    role(user);
    const discountType = ['percentage', 'fixed'].includes(body.discountType) ? body.discountType : 'percentage';
    const discountValue = body.discountValue === undefined || body.discountValue === '' ? null : Number(body.discountValue);
    if (discountValue !== null && (!Number.isFinite(discountValue) || discountValue < 0 || (discountType === 'percentage' && discountValue > 100)))
      throw fail(400, 'invalid_input');
    const target = ['all_products', 'category', 'product'].includes(body.target) ? body.target : 'all_products';
    const payload = {
      titleAr: text(body.titleAr, 160, true),
      titleEn: text(body.titleEn, 160, true),
      descriptionAr: text(body.descriptionAr || '', 500),
      descriptionEn: text(body.descriptionEn || '', 500),
      bannerUrl: text(body.bannerUrl || '', 500),
      discount: text(body.discount || '', 80),
      ctaAr: text(body.ctaAr || '', 80),
      ctaEn: text(body.ctaEn || '', 80),
      deepLink: safeLink(body.deepLink || ''),
      productIds: existingIds(body.productIds),
      status: ['draft', 'active', 'inactive', 'scheduled'].includes(body.status) ? body.status : 'draft',
      startsAt: dateValue(body.startsAt),
      endsAt: dateValue(body.endsAt),
    };
    if (payload.startsAt && payload.endsAt && payload.startsAt > payload.endsAt) throw fail(400, 'invalid_input');
    const row = (await db.query(
      'INSERT INTO mig_farm.offers(id,title_ar,title_en,description_ar,description_en,banner_url,discount,cta_ar,cta_en,deep_link,product_ids,status,starts_at,ends_at,discount_type,discount_value,target,target_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT(id) DO UPDATE SET title_ar=$2,title_en=$3,description_ar=$4,description_en=$5,banner_url=$6,discount=$7,cta_ar=$8,cta_en=$9,deep_link=$10,product_ids=$11,status=$12,starts_at=$13,ends_at=$14,discount_type=$15,discount_value=$16,target=$17,target_ref=$18,updated_at=now() RETURNING *',
      [id, payload.titleAr, payload.titleEn, payload.descriptionAr, payload.descriptionEn, payload.bannerUrl, payload.discount, payload.ctaAr, payload.ctaEn, payload.deepLink, payload.productIds, payload.status, payload.startsAt, payload.endsAt, discountType, discountValue, target, text(body.targetRef || '', 160)],
    )).rows[0];
    return { offer: row };
  }

  async function deleteOffer(user, id) {
    role(user);
    const row = (await db.query(
      'UPDATE mig_farm.offers SET deleted_at=now(),status=$2,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id',
      [id, 'inactive'],
    )).rows[0];
    if (!row) throw fail(404, 'not_found');
    return { ok: true };
  }

  async function saveHomeContent(user, body, id = randomUUID()) {
    role(user);
    const kind = ['hero','announcement','promo','featured','new_arrivals','popular','recommended'].includes(body.kind) ? body.kind : 'promo';
    const startsAt = dateValue(body.startsAt);
    const endsAt = dateValue(body.endsAt);
    if (startsAt && endsAt && startsAt > endsAt) throw fail(400, 'invalid_input');
    const row = (await db.query(
      'INSERT INTO mig_farm.home_content(id,kind,title_ar,title_en,body_ar,body_en,image_url,deep_link,product_ids,sort_order,visible,starts_at,ends_at,cta_ar,cta_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(id) DO UPDATE SET kind=$2,title_ar=$3,title_en=$4,body_ar=$5,body_en=$6,image_url=$7,deep_link=$8,product_ids=$9,sort_order=$10,visible=$11,starts_at=$12,ends_at=$13,cta_ar=$14,cta_en=$15,updated_at=now() RETURNING *',
      [id, kind, text(body.titleAr || '', 160), text(body.titleEn || '', 160), text(body.bodyAr || '', 500), text(body.bodyEn || '', 500), text(body.imageUrl || '', 500), safeLink(body.deepLink || ''), existingIds(body.productIds), intValue(body.sortOrder, 100, 0, 10000), body.visible !== false && body.visible !== 'false', startsAt, endsAt, text(body.ctaAr || '', 80), text(body.ctaEn || '', 80)],
    )).rows[0];
    return { section: row };
  }

  async function deleteHomeContent(user, id) {
    role(user);
    const row = (await db.query(
      'UPDATE mig_farm.home_content SET deleted_at=now(),visible=false,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id',
      [id],
    )).rows[0];
    if (!row) throw fail(404, 'not_found');
    return { ok: true };
  }

  async function savePushCampaign(user, body, id = randomUUID()) {
    role(user);
    const target = ['all', 'ar', 'en', 'customers'].includes(body.target) ? body.target : 'all';
    const scheduledAt = dateValue(body.scheduledAt);
    const status = scheduledAt ? 'scheduled' : 'ready';
    const row = (await db.query(
      'INSERT INTO mig_farm.push_campaigns(id,title_ar,title_en,body_ar,body_en,target,deep_link,scheduled_at,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET title_ar=$2,title_en=$3,body_ar=$4,body_en=$5,target=$6,deep_link=$7,scheduled_at=$8,status=$9,updated_at=now() RETURNING *',
      [id, text(body.titleAr, 120, true), text(body.titleEn, 120, true), text(body.bodyAr, 280, true), text(body.bodyEn, 280, true), target, safeLink(body.deepLink || ''), scheduledAt, status, user.id],
    )).rows[0];
    return { campaign: row, delivery: 'queued_for_push_provider' };
  }

  async function adminList(user, table, pagination, url = null) {
    role(user);
    const allowed = { offers: 'offers', home: 'home_content', push: 'push_campaigns' }[table];
    if (!allowed) throw fail(404, 'not_found');
    const where = [],
      values = [];
    if (allowed === 'offers' || allowed === 'home_content') where.push('deleted_at IS NULL');
    const status = url?.searchParams.get('status');
    if (status && allowed !== 'home_content') {
      values.push(status);
      where.push(`status=$${values.length}`);
    }
    const target = url?.searchParams.get('target');
    if (target && allowed === 'push_campaigns') {
      values.push(target);
      where.push(`target=$${values.length}`);
    }
    const search = url?.searchParams.get('q')?.trim();
    if (search) {
      values.push('%' + search.replace(/[%_\\]/g, '\\$&') + '%');
      if (allowed === 'home_content') where.push(`(title_en ILIKE $${values.length} ESCAPE '\\' OR title_ar ILIKE $${values.length} ESCAPE '\\')`);
      else where.push(`(title_en ILIKE $${values.length} ESCAPE '\\' OR title_ar ILIKE $${values.length} ESCAPE '\\')`);
    }
    const rows = (await db.query(
      `SELECT * FROM mig_farm.${allowed} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${allowed === 'home_content' ? 'sort_order ASC,' : ''} created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pagination.limit + 1, pagination.offset],
    )).rows;
    return pageResult(rows, pagination);
  }

  async function systemStatus(user) {
    role(user);
    return {
      api: 'online',
      database: db ? 'configured' : 'not_configured',
      products: products.length,
      emailProvider: emailDelivery.available ? 'configured' : 'not_configured',
      avatarStorage: avatarStorage.available ? 'configured' : 'not_configured',
      bannerStorage: bannerStorage.available ? 'configured' : 'not_configured',
      pushProvider: pushDelivery.available ? 'configured' : 'not_configured',
    };
  }

  return {
    publicHome,
    publicOffers,
    saveRecent,
    recent,
    savePushToken,
    removePushToken,
    mergeGuest,
    adminSummary,
    adminCustomers,
    adminCustomerDetail,
    setCustomerStatus,
    adminOrders,
    adminOrderDetail,
    setOrderDeliveryStatus,
    saveOffer,
    deleteOffer,
    saveHomeContent,
    deleteHomeContent,
    savePushCampaign,
    adminList,
    systemStatus,
  };
}
