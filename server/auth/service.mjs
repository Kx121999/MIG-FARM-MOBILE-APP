import { randomUUID } from 'node:crypto';
import { fail, text, email, phone, password } from '../lib/validation.mjs';
import {
  token,
  hashToken,
  hashPassword,
  verifyPassword,
  bearer,
} from './security.mjs';
import { emailDelivery, avatarStorage } from '../services/adapters.mjs';
export const profile = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  emirate: row.emirate,
  language: row.language,
  avatarUrl: row.avatar_url,
  avatarUpdatedAt: row.avatar_updated_at,
  createdAt: row.created_at,
});
export function createAuth(db, options = {}) {
  const emailAdapter = options.emailAdapter || emailDelivery,
    avatar = options.avatar || avatarStorage,
    customerMaster = options.customerMaster,
    logger = options.logger === undefined ? console : options.logger;
  const accessTTL = Number(
    options.accessTTL || process.env.AUTH_ACCESS_TTL || 900,
  );
  const refreshTTL = Number(
    options.refreshTTL || process.env.AUTH_REFRESH_TTL || 2592000,
  );
  if (
    !Number.isInteger(accessTTL) ||
    accessTTL < 60 ||
    accessTTL > 3600 ||
    !Number.isInteger(refreshTTL) ||
    refreshTTL < 3600 ||
    refreshTTL > 7776000
  )
    throw fail(500, 'invalid_auth_configuration');
  const requireDb = () => {
    if (!db) throw fail(503, 'database_not_configured');
  };
  async function issue(
    client,
    user,
    family = randomUUID(),
    refreshDeadline = null,
    businessProfile = null,
  ) {
    const accessToken = token(),
      refreshToken = token(),
      now = Date.now();
    const expiresAt = now + accessTTL * 1000,
      refreshExpiresAt = refreshDeadline || new Date(now + refreshTTL * 1000);
    await client.query(
      'INSERT INTO mig_farm.sessions(id,user_id,family_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        randomUUID(),
        user.id,
        family,
        hashToken(accessToken),
        hashToken(refreshToken),
        new Date(expiresAt),
        refreshExpiresAt,
      ],
    );
    return {
      user: businessProfile
        ? {
            ...profile(user),
            name: businessProfile.name,
            email: businessProfile.email,
            phone: businessProfile.phone,
            emirate: businessProfile.emirate,
            language: businessProfile.language,
          }
        : profile(user),
      accessToken,
      refreshToken,
      expiresAt,
    };
  }
  async function authenticate(request, optional = false) {
    const value = bearer(request);
    if (!value && optional) return null;
    if (!value) throw fail(401, 'unauthorized');
    requireDb();
    const row = (
      await db.query(
        'SELECT u.*,s.id AS session_id,s.family_id FROM mig_farm.sessions s JOIN mig_farm.users u ON u.id=s.user_id WHERE s.access_hash=$1 AND s.revoked_at IS NULL AND s.access_expires_at>now() AND u.deleted_at IS NULL',
        [hashToken(value)],
      )
    ).rows[0];
    if (!row) throw fail(401, 'unauthorized');
    return row;
  }
  async function rate(key, limit = 15, seconds = 900) {
    requireDb();
    const result = await db.query(
      "INSERT INTO mig_farm.rate_limits(key_hash,hits,expires_at) VALUES($1,1,now()+($2*interval '1 second')) ON CONFLICT(key_hash) DO UPDATE SET hits=CASE WHEN mig_farm.rate_limits.expires_at<=now() THEN 1 ELSE mig_farm.rate_limits.hits+1 END,expires_at=CASE WHEN mig_farm.rate_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE mig_farm.rate_limits.expires_at END RETURNING hits",
      [hashToken(key), seconds],
    );
    if (result.rows[0].hits > limit) throw fail(429, 'rate_limited');
  }
  const syncCode = (error) =>
    typeof error?.code === 'string' && /^odoo_[a-z0-9_]{1,80}$/.test(error.code)
      ? error.code
      : 'odoo_sync_failed';
  const customerPayload = (user) => ({
    appUserId: user.id,
    partnerId: user.odoo_partner_id ? Number(user.odoo_partner_id) : null,
    name: user.name,
    email: user.email,
    phone: user.phone,
    emirate: user.emirate,
    language: user.language,
  });
  async function syncCustomer(user, throwOnFailure = false) {
    if (!customerMaster?.ensureCustomerPartner) return null;
    try {
      const business = user.odoo_partner_id
        ? await customerMaster.getCustomerProfile(Number(user.odoo_partner_id))
        : await customerMaster.ensureCustomerPartner(customerPayload(user));
      if (!Number.isSafeInteger(Number(business?.partnerId)))
        throw fail(503, 'odoo_invalid_response');
      const row = (
        await db.query(
          "UPDATE mig_farm.users SET odoo_partner_id=$2,odoo_sync_status='synced',odoo_sync_error=NULL,odoo_synced_at=now(),name=$3,email=$4,phone=$5,emirate=$6,language=$7,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *",
          [
            user.id,
            Number(business.partnerId),
            business.name,
            business.email,
            business.phone,
            business.emirate,
            business.language,
          ],
        )
      ).rows[0];
      return row ? { row, business } : null;
    } catch (error) {
      const code = syncCode(error);
      await db.query(
        "UPDATE mig_farm.users SET odoo_sync_status='failed',odoo_sync_error=$2,updated_at=now() WHERE id=$1 AND deleted_at IS NULL",
        [user.id, code],
      );
      logger?.warn?.('Odoo customer sync failed', { code, userId: user.id });
      if (throwOnFailure) throw fail(error?.statusCode || 503, code);
      return null;
    }
  }
  async function getProfile(user) {
    const synced = await syncCustomer(user, false);
    return synced ? profile(synced.row) : profile(user);
  }
  async function register(body) {
    requireDb();
    const name = text(body.name, 120, true),
      address = email(body.email),
      number = phone(body.phone || ''),
      secret = await hashPassword(password(body.password));
    const language = body.language === 'ar' ? 'ar' : 'en';
    let user;
    try {
      user = await db.transaction(async (client) => {
        const created = (
          await client.query(
            'INSERT INTO mig_farm.users(id,name,email,phone,password_hash,language) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
            [randomUUID(), name, address, number, secret, language],
          )
        ).rows[0];
        await client.query(
          'INSERT INTO mig_farm.notification_preferences(user_id) VALUES($1)',
          [created.id],
        );
        return created;
      });
    } catch (error) {
      if (error.code === '23505') throw fail(409, 'registration_unavailable');
      throw error;
    }
    const synced = await syncCustomer(user, false);
    const current = synced?.row || user;
    return db.transaction((client) =>
      issue(client, current, randomUUID(), null, synced?.business || null),
    );
  }
  async function login(body) {
    requireDb();
    const address = email(body.email);
    const user = (
      await db.query(
        'SELECT * FROM mig_farm.users WHERE email=$1 AND deleted_at IS NULL',
        [address],
      )
    ).rows[0];
    if (!(await verifyPassword(body.password, user?.password_hash)) || !user)
      throw fail(401, 'invalid_credentials');
    const synced = await syncCustomer(user, false);
    return db.transaction(async (client) => {
      const current = (
        await client.query(
          'SELECT * FROM mig_farm.users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',
          [user.id],
        )
      ).rows[0];
      if (!current || current.password_hash !== user.password_hash)
        throw fail(401, 'invalid_credentials');
      return issue(client, current, randomUUID(), null, synced?.business || null);
    });
  }
  async function refresh(value) {
    requireDb();
    text(value, 256, true);
    const result = await db.transaction(async (client) => {
      const candidate = (
        await client.query(
          'SELECT user_id FROM mig_farm.sessions WHERE refresh_hash=$1',
          [hashToken(value)],
        )
      ).rows[0];
      if (!candidate) return null;
      const user = (
        await client.query(
          'SELECT * FROM mig_farm.users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',
          [candidate.user_id],
        )
      ).rows[0];
      if (!user) return null;
      const row = (
        await client.query(
          'SELECT * FROM mig_farm.sessions WHERE refresh_hash=$1 FOR UPDATE',
          [hashToken(value)],
        )
      ).rows[0];
      if (!row) return null;
      if (row.revoked_at || new Date(row.refresh_expires_at) <= new Date()) {
        await client.query(
          'UPDATE mig_farm.sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE family_id=$1',
          [row.family_id],
        );
        return null;
      }
      await client.query(
        'UPDATE mig_farm.sessions SET revoked_at=now() WHERE id=$1',
        [row.id],
      );
      return issue(client, user, row.family_id, row.refresh_expires_at);
    });
    if (!result) throw fail(401, 'unauthorized');
    return result;
  }
  async function logout(refreshToken) {
    requireDb();
    text(refreshToken, 256, true);
    await db.transaction(async (client) => {
      const row = (
        await client.query(
          'SELECT user_id FROM mig_farm.sessions WHERE refresh_hash=$1',
          [hashToken(refreshToken)],
        )
      ).rows[0];
      if (!row) return;
      await client.query(
        'SELECT id FROM mig_farm.users WHERE id=$1 FOR UPDATE',
        [row.user_id],
      );
      await client.query(
        'UPDATE mig_farm.sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE family_id IN (SELECT family_id FROM mig_farm.sessions WHERE refresh_hash=$1)',
        [hashToken(refreshToken)],
      );
    });
  }
  async function logoutAll(user) {
    await db.transaction(async (client) => {
      await client.query(
        'SELECT id FROM mig_farm.users WHERE id=$1 FOR UPDATE',
        [user.id],
      );
      await client.query(
        'UPDATE mig_farm.sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1',
        [user.id],
      );
    });
  }
  async function forgot(body) {
    requireDb();
    const address = email(body.email);
    if (!emailAdapter.available)
      throw fail(503, 'email_provider_not_configured');
    const base = options.resetBaseUrl || process.env.PASSWORD_RESET_BASE_URL;
    if (!base || new URL(base).protocol !== 'https:')
      throw fail(503, 'email_provider_not_configured');
    const user = (
      await db.query(
        'SELECT id FROM mig_farm.users WHERE email=$1 AND deleted_at IS NULL',
        [address],
      )
    ).rows[0];
    if (user) {
      const raw = token(),
        id = randomUUID();
      await db.query(
        "INSERT INTO mig_farm.password_reset_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",
        [id, user.id, hashToken(raw)],
      );
      const url = new URL(base);
      url.hash = new URLSearchParams({ token: raw }).toString();
      try {
        await emailAdapter.sendPasswordReset({
          email: address,
          url: url.toString(),
        });
      } catch {
        await db.query(
          'UPDATE mig_farm.password_reset_tokens SET used_at=now() WHERE id=$1',
          [id],
        );
        console.error('password_reset_delivery_failed');
      }
    }
    return { accepted: true };
  }
  async function reset(body) {
    requireDb();
    text(body.token, 256, true);
    const encoded = await hashPassword(password(body.password));
    await db.transaction(async (client) => {
      const candidate = (
        await client.query(
          'SELECT user_id FROM mig_farm.password_reset_tokens WHERE token_hash=$1',
          [hashToken(body.token)],
        )
      ).rows[0];
      if (!candidate) throw fail(400, 'invalid_reset_token');
      await client.query(
        'SELECT id FROM mig_farm.users WHERE id=$1 FOR UPDATE',
        [candidate.user_id],
      );
      const row = (
        await client.query(
          'SELECT * FROM mig_farm.password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',
          [hashToken(body.token)],
        )
      ).rows[0];
      if (!row) throw fail(400, 'invalid_reset_token');
      const updated = await client.query(
        'UPDATE mig_farm.users SET password_hash=$2,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id',
        [row.user_id, encoded],
      );
      if (!updated.rows.length) throw fail(400, 'invalid_reset_token');
      await client.query(
        'UPDATE mig_farm.password_reset_tokens SET used_at=now() WHERE user_id=$1',
        [row.user_id],
      );
      await client.query(
        'UPDATE mig_farm.sessions SET revoked_at=now() WHERE user_id=$1',
        [row.user_id],
      );
    });
  }
  async function changePassword(user, body) {
    if (!(await verifyPassword(body.currentPassword, user.password_hash)))
      throw fail(401, 'invalid_credentials');
    const encoded = await hashPassword(password(body.newPassword));
    await db.transaction(async (client) => {
      const result = await client.query(
        'UPDATE mig_farm.users SET password_hash=$2,updated_at=now() WHERE id=$1 AND password_hash=$3 AND deleted_at IS NULL RETURNING id',
        [user.id, encoded, user.password_hash],
      );
      if (!result.rows.length) throw fail(401, 'unauthorized');
      await client.query(
        'UPDATE mig_farm.sessions SET revoked_at=now() WHERE user_id=$1',
        [user.id],
      );
    });
  }
  async function updateProfile(user, body) {
    if (body.email !== undefined && email(body.email) !== user.email)
      throw fail(400, 'email_change_requires_verification');
    const base = (await syncCustomer(user, false))?.row || user;
    const current = {
      name: body.name === undefined ? base.name : text(body.name, 120, true),
      phone: body.phone === undefined ? base.phone : phone(body.phone),
      emirate:
        body.emirate === undefined ? base.emirate : text(body.emirate, 60),
      language: body.language === undefined ? base.language : body.language,
      email: base.email,
    };
    if (!['ar', 'en'].includes(current.language))
      throw fail(400, 'invalid_input');
    const linked = base.odoo_partner_id
      ? { row: base }
      : await syncCustomer(base, true);
    const business = await customerMaster.updateCustomerPartner(
      Number(linked.row.odoo_partner_id),
      current,
    ).catch(async (error) => {
      const code = syncCode(error);
      await db.query(
        "UPDATE mig_farm.users SET odoo_sync_status='failed',odoo_sync_error=$2,updated_at=now() WHERE id=$1",
        [user.id, code],
      );
      throw fail(error?.statusCode || 503, code);
    });
    const row = (
      await db.query(
        "UPDATE mig_farm.users SET name=$2,phone=$3,emirate=$4,language=$5,email=$6,odoo_sync_status='synced',odoo_sync_error=NULL,odoo_synced_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *",
        [
          user.id,
          business.name,
          business.phone,
          business.emirate,
          business.language,
          business.email,
        ],
      )
    ).rows[0];
    if (!row) throw fail(401, 'unauthorized');
    return profile(row);
  }
  async function uploadAvatar(user, file) {
    if (!avatar.available) throw fail(503, 'avatar_storage_not_configured');
    const uploaded = await avatar.upload({ userId: user.id, file });
    let row;
    try {
      row = (
        await db.query(
          'UPDATE mig_farm.users SET avatar_url=$2,avatar_key=$3,avatar_updated_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *',
          [user.id, uploaded.url, uploaded.key],
        )
      ).rows[0];
      if (!row) throw fail(401, 'unauthorized');
    } catch (error) {
      await avatar.remove({ key: uploaded.key }).catch(() => undefined);
      throw error;
    }
    if (user.avatar_key && user.avatar_key !== uploaded.key)
      await avatar.remove({ key: user.avatar_key }).catch(() => undefined);
    if (row.odoo_partner_id && customerMaster?.syncCustomerAvatar)
      await customerMaster
        .syncCustomerAvatar(Number(row.odoo_partner_id), file)
        .catch((error) => logger?.warn?.('Odoo avatar sync failed', {
          code: syncCode(error),
          userId: user.id,
        }));
    return profile(row);
  }
  async function removeAvatar(user) {
    if (user.avatar_key) await avatar.remove({ userId: user.id, key: user.avatar_key });
    const row = (
      await db.query(
        'UPDATE mig_farm.users SET avatar_url=NULL,avatar_key=NULL,avatar_updated_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *',
        [user.id],
      )
    ).rows[0];
    if (!row) throw fail(401, 'unauthorized');
    if (row.odoo_partner_id && customerMaster?.syncCustomerAvatar)
      await customerMaster
        .syncCustomerAvatar(Number(row.odoo_partner_id), null)
        .catch((error) => logger?.warn?.('Odoo avatar removal sync failed', {
          code: syncCode(error),
          userId: user.id,
        }));
    return profile(row);
  }
  async function deleteAccount(user, body) {
    if (!(await verifyPassword(body.password, user.password_hash)))
      throw fail(401, 'invalid_credentials');
    if (user.avatar_key)
      await avatar.remove({ userId: user.id, key: user.avatar_key });
    await db.transaction(async (client) => {
      const result = await client.query(
        "UPDATE mig_farm.users SET name='Deleted customer',email=$2,phone='',password_hash=NULL,emirate='',avatar_url=NULL,avatar_key=NULL,avatar_updated_at=NULL,email_verified_at=NULL,phone_verified_at=NULL,deleted_at=now(),updated_at=now() WHERE id=$1 AND password_hash=$3 AND deleted_at IS NULL RETURNING id",
        [user.id, user.id + '@deleted.invalid', user.password_hash],
      );
      if (!result.rows.length) throw fail(401, 'unauthorized');
      for (const table of [
        'sessions',
        'password_reset_tokens',
        'user_addresses',
        'user_favorites',
        'notifications',
        'notification_preferences',
        'push_tokens',
        'recently_viewed',
        'user_cart_items',
        'guest_farm_snapshots',
      ])
        await client.query(
          'DELETE FROM mig_farm.' + table + ' WHERE user_id=$1',
          [user.id],
        );
      await client.query(
        'UPDATE mig_farm.orders SET customer_id=NULL WHERE customer_id=$1',
        [user.id],
      );
    });
  }
  return {
    authenticate,
    getProfile,
    rate,
    register,
    login,
    refresh,
    logout,
    logoutAll,
    forgot,
    reset,
    updateProfile,
    changePassword,
    deleteAccount,
    uploadAvatar,
    removeAvatar,
    avatar,
  };
}
