import { randomUUID } from 'node:crypto';
import { address, fail, uuid, pageResult } from '../lib/validation.mjs';
const addressDTO = (row) => ({
  id: row.id,
  label: row.label,
  category: row.category,
  name: row.name,
  phone: row.phone,
  emirate: row.emirate,
  city: row.city,
  addressLine: row.address_line,
  unit: row.unit,
  notes: row.delivery_notes,
  isDefault: row.is_default,
});
const prefDTO = (row) => ({
  orderUpdates: row.order_updates,
  offers: row.offers,
  newProducts: row.new_products,
  availability: row.availability,
  farmingTips: false,
  marketingConsent: row.marketing_consent,
});
export async function lockCustomer(client, id) {
  if (
    !(
      await client.query(
        'SELECT id FROM mig_farm.users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',
        [id],
      )
    ).rows.length
  )
    throw fail(401, 'unauthorized');
}
export function createCustomers(db, products) {
  const productIds = new Set(products.map((p) => Number(p.id)));
  const addresses = async (user) =>
    (
      await db.query(
        'SELECT * FROM mig_farm.user_addresses WHERE user_id=$1 ORDER BY is_default DESC,created_at,id',
        [user.id],
      )
    ).rows.map(addressDTO);
  async function saveAddress(user, value, id = null) {
    const next = address(value);
    if (id) uuid(id);
    await db.transaction(async (client) => {
      await lockCustomer(client, user.id);
      const existing = (
        await client.query(
          'SELECT * FROM mig_farm.user_addresses WHERE user_id=$1 ORDER BY created_at,id',
          [user.id],
        )
      ).rows;
      if (id && !existing.some((row) => row.id === id))
        throw fail(404, 'not_found');
      if (!id && existing.length >= 50) throw fail(400, 'address_limit');
      const isDefault =
        next.isDefault ||
        existing.length === 0 ||
        (id && existing.find((row) => row.id === id)?.is_default);
      if (isDefault)
        await client.query(
          'UPDATE mig_farm.user_addresses SET is_default=false WHERE user_id=$1',
          [user.id],
        );
      const params = [
        id || randomUUID(),
        user.id,
        next.label,
        next.category,
        next.name,
        next.phone,
        next.emirate,
        next.city,
        next.addressLine,
        next.unit,
        next.notes,
        !!isDefault,
      ];
      if (id)
        await client.query(
          'UPDATE mig_farm.user_addresses SET label=$3,category=$4,name=$5,phone=$6,emirate=$7,city=$8,address_line=$9,unit=$10,delivery_notes=$11,is_default=$12,updated_at=now() WHERE id=$1 AND user_id=$2',
          params,
        );
      else
        await client.query(
          'INSERT INTO mig_farm.user_addresses(id,user_id,label,category,name,phone,emirate,city,address_line,unit,delivery_notes,is_default) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          params,
        );
    });
    return addresses(user);
  }
  async function deleteAddress(user, id) {
    uuid(id);
    await db.transaction(async (client) => {
      await lockCustomer(client, user.id);
      const result = await client.query(
        'DELETE FROM mig_farm.user_addresses WHERE id=$1 AND user_id=$2 RETURNING is_default',
        [id, user.id],
      );
      if (!result.rows.length) throw fail(404, 'not_found');
      if (result.rows[0].is_default)
        await client.query(
          'UPDATE mig_farm.user_addresses SET is_default=true WHERE id=(SELECT id FROM mig_farm.user_addresses WHERE user_id=$1 ORDER BY created_at,id LIMIT 1)',
          [user.id],
        );
    });
    return addresses(user);
  }
  async function defaultAddress(user, id) {
    uuid(id);
    await db.transaction(async (client) => {
      await lockCustomer(client, user.id);
      if (
        !(
          await client.query(
            'SELECT id FROM mig_farm.user_addresses WHERE id=$1 AND user_id=$2',
            [id, user.id],
          )
        ).rows.length
      )
        throw fail(404, 'not_found');
      await client.query(
        'UPDATE mig_farm.user_addresses SET is_default=false WHERE user_id=$1',
        [user.id],
      );
      await client.query(
        'UPDATE mig_farm.user_addresses SET is_default=true,updated_at=now() WHERE id=$1 AND user_id=$2',
        [id, user.id],
      );
    });
    return addresses(user);
  }
  const favorites = async (user) =>
    (
      await db.query(
        'SELECT product_id FROM mig_farm.user_favorites WHERE user_id=$1 ORDER BY created_at DESC,product_id LIMIT 500',
        [user.id],
      )
    ).rows.map((row) => Number(row.product_id));
  async function mergeFavorites(user, ids) {
    if (
      !Array.isArray(ids) ||
      ids.length > 500 ||
      ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
    )
      throw fail(400, 'invalid_input');
    const selected = [...new Set(ids)].filter((id) => productIds.has(id));
    await db.transaction(async (client) => {
      await lockCustomer(client, user.id);
      const existing = new Set(
        (
          await client.query(
            'SELECT product_id FROM mig_farm.user_favorites WHERE user_id=$1',
            [user.id],
          )
        ).rows.map((row) => Number(row.product_id)),
      );
      for (const id of selected
        .filter((id) => !existing.has(id))
        .slice(0, Math.max(0, 500 - existing.size)))
        await client.query(
          'INSERT INTO mig_farm.user_favorites(user_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [user.id, id],
        );
    });
    return favorites(user);
  }
  async function favorite(user, id, add) {
    id = Number(id);
    if (!Number.isSafeInteger(id) || id <= 0)
      throw fail(400, 'invalid_product');
    if (add) {
      if (!productIds.has(id)) throw fail(404, 'product_not_found');
      return mergeFavorites(user, [id]);
    }
    await db.query(
      'DELETE FROM mig_farm.user_favorites WHERE user_id=$1 AND product_id=$2',
      [user.id, id],
    );
    return favorites(user);
  }
  const preferences = async (user) => {
    const row = (
      await db.query(
        'SELECT * FROM mig_farm.notification_preferences WHERE user_id=$1',
        [user.id],
      )
    ).rows[0];
    return row
      ? prefDTO(row)
      : {
          orderUpdates: true,
          offers: false,
          newProducts: false,
          availability: false,
          farmingTips: false,
          marketingConsent: false,
        };
  };
  async function savePreferences(user, body) {
    const current = await preferences(user),
      next = { ...current };
    for (const name of [
      'orderUpdates',
      'offers',
      'newProducts',
      'availability',
      'marketingConsent',
    ])
      if (body[name] !== undefined) {
        if (typeof body[name] !== 'boolean') throw fail(400, 'invalid_input');
        next[name] = body[name];
      }
    if ((next.offers || next.newProducts) && !next.marketingConsent)
      throw fail(400, 'marketing_consent_required');
    await db.transaction(async (client) => {
      await lockCustomer(client, user.id);
      await client.query(
        'INSERT INTO mig_farm.notification_preferences(user_id,order_updates,offers,new_products,availability,marketing_consent) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id) DO UPDATE SET order_updates=$2,offers=$3,new_products=$4,availability=$5,marketing_consent=$6,updated_at=now()',
        [
          user.id,
          next.orderUpdates,
          next.offers,
          next.newProducts,
          next.availability,
          next.marketingConsent,
        ],
      );
    });
    return next;
  }
  async function notifications(user, pagination) {
    const rows = (
      await db.query(
        'SELECT * FROM mig_farm.notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3',
        [user.id, pagination.limit + 1, pagination.offset],
      )
    ).rows;
    return pageResult(
      rows.map((row) => ({
        id: row.id,
        category: {
          order: 'orders',
          offer: 'offers',
          stock: 'availability',
          product: 'newProducts',
          system: 'important',
        }[row.type],
        title:
          user.language === 'ar'
            ? row.data_json.titleAr || row.title
            : row.title,
        body:
          user.language === 'ar' ? row.data_json.bodyAr || row.body : row.body,
        createdAt: row.created_at,
        read: !!row.read_at,
        orderId: row.data_json.orderId,
      })),
      pagination,
    );
  }
  async function readNotification(user, id) {
    uuid(id);
    const result = await db.query(
      'UPDATE mig_farm.notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id',
      [id, user.id],
    );
    if (!result.rows.length) throw fail(404, 'not_found');
  }
  const readAll = (user) =>
    db.query(
      'UPDATE mig_farm.notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL',
      [user.id],
    );
  return {
    addresses,
    saveAddress,
    deleteAddress,
    defaultAddress,
    favorites,
    mergeFavorites,
    favorite,
    preferences,
    savePreferences,
    notifications,
    readNotification,
    readAll,
  };
}
