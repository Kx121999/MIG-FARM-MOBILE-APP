import { randomUUID, createHash } from 'node:crypto';
import { fail, pageResult, text } from '../lib/validation.mjs';

const role = (user) => {
  if (!['admin', 'support'].includes(user.role)) throw fail(403, 'forbidden');
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
    const [customers, orders, offers, notifications, recentOrders] = await Promise.all([
      db.query("SELECT count(*)::int AS total FROM mig_farm.users WHERE role='customer' AND deleted_at IS NULL"),
      db.query('SELECT count(*)::int AS total, COALESCE(sum(total),0)::numeric AS revenue FROM mig_farm.orders'),
      db.query("SELECT count(*)::int AS total FROM mig_farm.offers WHERE status='active' AND (ends_at IS NULL OR ends_at>now())"),
      db.query('SELECT count(*)::int AS total FROM mig_farm.push_campaigns'),
      db.query('SELECT id,status,total,currency,created_at FROM mig_farm.orders ORDER BY created_at DESC LIMIT 8'),
    ]);
    return {
      customers: customers.rows[0].total,
      orders: orders.rows[0].total,
      revenue: Number(orders.rows[0].revenue || 0),
      activeOffers: offers.rows[0].total,
      notifications: notifications.rows[0].total,
      recentOrders: recentOrders.rows,
    };
  }

  async function adminCustomers(user, pagination) {
    role(user);
    const rows = (await db.query(
      "SELECT id,name,email,phone,language,status,created_at FROM mig_farm.users WHERE role='customer' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [pagination.limit + 1, pagination.offset],
    )).rows;
    return pageResult(rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      language: row.language,
      status: row.status,
      createdAt: row.created_at,
    })), pagination);
  }

  async function adminOrders(user, pagination) {
    role(user);
    const rows = (await db.query(
      'SELECT id,customer_id,status,payment_status,total,currency,created_at FROM mig_farm.orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [pagination.limit + 1, pagination.offset],
    )).rows;
    return pageResult(rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      status: row.status,
      paymentStatus: row.payment_status,
      total: Number(row.total),
      currency: row.currency,
      createdAt: row.created_at,
    })), pagination);
  }

  async function saveOffer(user, body, id = randomUUID()) {
    role(user);
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
      startsAt: body.startsAt || null,
      endsAt: body.endsAt || null,
    };
    const row = (await db.query(
      'INSERT INTO mig_farm.offers(id,title_ar,title_en,description_ar,description_en,banner_url,discount,cta_ar,cta_en,deep_link,product_ids,status,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(id) DO UPDATE SET title_ar=$2,title_en=$3,description_ar=$4,description_en=$5,banner_url=$6,discount=$7,cta_ar=$8,cta_en=$9,deep_link=$10,product_ids=$11,status=$12,starts_at=$13,ends_at=$14,updated_at=now() RETURNING *',
      [id, payload.titleAr, payload.titleEn, payload.descriptionAr, payload.descriptionEn, payload.bannerUrl, payload.discount, payload.ctaAr, payload.ctaEn, payload.deepLink, payload.productIds, payload.status, payload.startsAt, payload.endsAt],
    )).rows[0];
    return { offer: row };
  }

  async function saveHomeContent(user, body, id = randomUUID()) {
    role(user);
    const kind = ['hero','announcement','promo','featured','new_arrivals','popular','recommended'].includes(body.kind) ? body.kind : 'promo';
    const row = (await db.query(
      'INSERT INTO mig_farm.home_content(id,kind,title_ar,title_en,body_ar,body_en,image_url,deep_link,product_ids,sort_order,visible,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO UPDATE SET kind=$2,title_ar=$3,title_en=$4,body_ar=$5,body_en=$6,image_url=$7,deep_link=$8,product_ids=$9,sort_order=$10,visible=$11,starts_at=$12,ends_at=$13,updated_at=now() RETURNING *',
      [id, kind, text(body.titleAr || '', 160), text(body.titleEn || '', 160), text(body.bodyAr || '', 500), text(body.bodyEn || '', 500), text(body.imageUrl || '', 500), safeLink(body.deepLink || ''), existingIds(body.productIds), Number.isInteger(body.sortOrder) ? body.sortOrder : 100, body.visible !== false, body.startsAt || null, body.endsAt || null],
    )).rows[0];
    return { section: row };
  }

  async function savePushCampaign(user, body, id = randomUUID()) {
    role(user);
    const target = ['all', 'ar', 'en', 'customers'].includes(body.target) ? body.target : 'all';
    const scheduledAt = body.scheduledAt || null;
    const status = scheduledAt ? 'scheduled' : 'ready';
    const row = (await db.query(
      'INSERT INTO mig_farm.push_campaigns(id,title_ar,title_en,body_ar,body_en,target,deep_link,scheduled_at,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET title_ar=$2,title_en=$3,body_ar=$4,body_en=$5,target=$6,deep_link=$7,scheduled_at=$8,status=$9,updated_at=now() RETURNING *',
      [id, text(body.titleAr, 120, true), text(body.titleEn, 120, true), text(body.bodyAr, 280, true), text(body.bodyEn, 280, true), target, safeLink(body.deepLink || ''), scheduledAt, status, user.id],
    )).rows[0];
    return { campaign: row, delivery: 'queued_for_push_provider' };
  }

  async function adminList(user, table, pagination) {
    role(user);
    const allowed = { offers: 'offers', home: 'home_content', push: 'push_campaigns' }[table];
    if (!allowed) throw fail(404, 'not_found');
    const rows = (await db.query(
      `SELECT * FROM mig_farm.${allowed} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [pagination.limit + 1, pagination.offset],
    )).rows;
    return pageResult(rows, pagination);
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
    adminOrders,
    saveOffer,
    saveHomeContent,
    savePushCampaign,
    adminList,
  };
}
