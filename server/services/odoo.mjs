import { fail } from '../lib/validation.mjs';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_TTL_MS = 45_000;
const DEFAULT_STALE_TTL_MS = 5 * 60_000;
const DISCOVERY_TTL_MS = 6 * 60 * 60_000;
const DEFAULT_MIN_REQUEST_INTERVAL_MS = 300;
const HEALTH_REFRESH_COOLDOWN_MS = 60_000;
const RETRY_DELAYS_MS = [1000, 2500, 5000];
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRY_AFTER_MS = 60_000;
const PAGE_SIZE = 200;
const MAX_RECORDS = 10_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const BRAND_FIELD_CANDIDATES = [
  'product_brand_id', 'brand_id', 'manufacturer_id', 'manufacturer', 'x_brand_id',
];

const FIELD_CANDIDATES = {
  'product.template': [
    'id', 'name', 'display_name', 'active', 'sale_ok', 'list_price',
    'description_sale', 'description', 'categ_id', 'public_categ_ids',
    'is_published', 'website_published', 'website_url', 'default_code',
    'create_date', 'write_date', 'image_1920', 'image_1024', 'image_512',
    'image_256', 'image_128', ...BRAND_FIELD_CANDIDATES,
  ],
  'product.product': [
    'id', 'name', 'display_name', 'active', 'sale_ok', 'product_tmpl_id',
    'lst_price', 'list_price', 'default_code', 'free_qty', 'qty_available',
    'product_template_attribute_value_ids',
    'product_template_variant_value_ids', 'write_date', 'image_1920',
    'image_1024', 'image_512', 'image_256', 'image_128',
    ...BRAND_FIELD_CANDIDATES,
  ],
  'product.category': ['id', 'name', 'complete_name', 'write_date'],
  'product.public.category': [
    'id', 'name', 'parent_id', 'sequence', 'write_date', 'image_1920',
    'image_1024', 'image_512', 'image_256', 'image_128',
  ],
  'product.template.attribute.value': [
    'id', 'name', 'attribute_id', 'product_attribute_value_id',
  ],
  'res.partner': [
    'id', 'name', 'phone', 'mobile', 'email', 'street', 'street2', 'city',
    'country_id', 'active', 'type', 'parent_id', 'lang', 'customer_rank',
    'ref', 'image_1920',
  ],
  'res.country': ['id', 'name', 'code'],
  'sale.order': [
    'id', 'name', 'state', 'partner_id', 'partner_shipping_id',
    'client_order_ref', 'order_line',
    'amount_untaxed', 'amount_tax', 'amount_total', 'currency_id',
  ],
  'sale.order.line': [
    'id', 'order_id', 'product_id', 'product_uom_qty',
  ],
};

const IMAGE_FIELDS = ['image_512', 'image_1024', 'image_256', 'image_1920', 'image_128'];
const OPTIONAL_MODELS = new Set([
  'product.public.category',
  'product.template.attribute.value',
  'res.country',
]);
const hasOwn = (value, key) =>
  Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
const number = (value) => {
  if (
    typeof value !== 'number' &&
    (typeof value !== 'string' || value.trim() === '')
  ) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const relationId = (value) => {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
const relationIds = (value) =>
  Array.isArray(value)
    ? value.map(relationId).filter((id) => id !== null)
    : [];
const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');
const relationName = (value) => Array.isArray(value) ? cleanText(value[1]) : '';
const normalizedEmail = (value) => cleanText(value).toLowerCase();
const normalizedPhone = (value) => {
  let digits = cleanText(value)
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length >= 9) digits = `971${digits.slice(1)}`;
  if (digits.startsWith('9710')) digits = `971${digits.slice(4)}`;
  return digits;
};
const uniqueNumbers = (values) => [...new Set(values.filter(Number.isSafeInteger))];
const slugify = (value) =>
  cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'product';
const isoOrUndefined = (value) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
};
const errorCode = (error) =>
  typeof error?.code === 'string' ? error.code : 'odoo_unavailable';
const cacheAge = (cache, now) =>
  cache ? Math.max(0, now() - cache.loadedAt) : Number.POSITIVE_INFINITY;

const localizedValue = (record, field, fallback = '') => {
  const value = cleanText(record?.[field]);
  return value && value !== cleanText(fallback) ? value : null;
};

const brandFromRecords = (records, fields) => {
  for (const field of BRAND_FIELD_CANDIDATES) {
    if (!fields.includes(field)) continue;
    for (const record of records) {
      const value = record?.[field];
      const name = relationName(value) || cleanText(value);
      if (!name) continue;
      return { id: relationId(value), name, sourceField: field };
    }
  }
  return null;
};

export function categoryAuditRecord(product, categories) {
  const byId = new Map(categories.map((category) => [Number(category.id), category]));
  return (product.categories || []).map((assigned) => {
    const lineage = [];
    const visited = new Set();
    let current = byId.get(Number(assigned.id));
    while (current && !visited.has(Number(current.id))) {
      visited.add(Number(current.id));
      lineage.unshift({ id: Number(current.id), name: cleanText(current.name) });
      current = current.parentId ? byId.get(Number(current.parentId)) : null;
    }
    return { categoryId: Number(assigned.id), lineage };
  });
}

export function odooConfiguration(env = process.env) {
  const rawBaseUrl = cleanText(env.ODOO_BASE_URL);
  const apiKey = cleanText(env.ODOO_API_KEY);
  if (!rawBaseUrl && !apiKey)
    return { configured: false, status: 'not_configured' };
  if (!rawBaseUrl || !apiKey)
    return { configured: false, status: 'incomplete' };
  try {
    const url = new URL(rawBaseUrl);
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('protocol');
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:' && !local)
      return { configured: false, status: 'invalid' };
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return {
      configured: true,
      status: 'configured',
      baseUrl: url.toString().replace(/\/$/, ''),
      apiKey,
    };
  } catch {
    return { configured: false, status: 'invalid' };
  }
}

function upstreamFailure(status) {
  if (status === 401 || status === 403) return 'odoo_auth_failed';
  if (status === 429) return 'odoo_rate_limited';
  if (status >= 500) return 'odoo_unavailable';
  return 'odoo_request_failed';
}

function safeFailure(code, upstreamStatus) {
  const error = fail(503, code);
  if (upstreamStatus) error.upstreamStatus = upstreamStatus;
  return error;
}

function retryAfterMs(value, currentTime) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(MAX_RETRY_AFTER_MS, Math.ceil(seconds * 1000));
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, date - currentTime));
}

function contentType(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return 'image/jpeg';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';
  return null;
}

function websiteSlug(value) {
  if (!value) return null;
  try {
    const url = new URL(value, 'https://odoo.invalid');
    const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '');
    const slug = slugify(last);
    return slug.length >= 2 ? slug : null;
  } catch {
    return null;
  }
}

function stockFrom(record, fieldNames) {
  const freeQuantity = fieldNames.includes('free_qty')
    ? number(record.free_qty)
    : null;
  const quantity = freeQuantity ?? (fieldNames.includes('qty_available')
    ? number(record.qty_available)
    : null);
  if (quantity === null) return { stock_state: 'unknown', stock_quantity: null };
  return quantity > 0
    ? { stock_state: 'in_stock', stock_quantity: quantity, available: true }
    : { stock_state: 'out_of_stock', stock_quantity: quantity, available: false };
}

function visibleTemplate(record, fields) {
  // MIG FARM exposes only records confirmed active/sellable when those core
  // fields exist. Publication requires is_published, or website_published as
  // its fallback. If neither website field exists, no publish state is invented.
  if (fields.includes('active') && record.active !== true) return false;
  if (fields.includes('sale_ok') && record.sale_ok !== true) return false;
  if (fields.includes('is_published')) return record.is_published === true;
  if (fields.includes('website_published')) return record.website_published === true;
  return true;
}

function visibleVariant(record, fields) {
  if (fields.includes('active') && record.active !== true) return false;
  if (fields.includes('sale_ok') && record.sale_ok !== true) return false;
  return true;
}

export function createOdooCatalog({
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = Number(env.ODOO_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  ttlMs = Number(env.ODOO_CATALOG_TTL_MS) || DEFAULT_TTL_MS,
  staleTtlMs = Number(env.ODOO_CATALOG_STALE_TTL_MS) || DEFAULT_STALE_TTL_MS,
  minRequestIntervalMs = env.ODOO_MIN_REQUEST_INTERVAL_MS === undefined
    ? DEFAULT_MIN_REQUEST_INTERVAL_MS
    : Number(env.ODOO_MIN_REQUEST_INTERVAL_MS),
  now = Date.now,
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  random = Math.random,
  logger = console,
} = {}) {
  const config = odooConfiguration(env);
  const requestInterval = Number.isFinite(minRequestIntervalMs)
    ? Math.max(0, minRequestIntervalMs)
    : DEFAULT_MIN_REQUEST_INTERVAL_MS;
  let cache = null;
  let inflight = null;
  let lastError = null;
  let discoveredAt = null;
  let lastHealthRefreshAt = null;
  let lastRequestAt = null;
  let requestQueue = Promise.resolve();
  const fieldCache = new Map();
  const fieldInflight = new Map();
  const imageCache = new Map();
  const customerInflight = new Map();

  const ensureConfigured = () => {
    if (!config.configured) throw safeFailure('odoo_not_configured');
    if (typeof fetchImpl !== 'function') throw safeFailure('odoo_unavailable');
  };

  function enqueue(operation) {
    const queued = requestQueue.then(operation, operation);
    requestQueue = queued.then(() => undefined, () => undefined);
    return queued;
  }

  async function waitForRequestSlot() {
    if (lastRequestAt !== null) {
      const remaining = requestInterval - Math.max(0, now() - lastRequestAt);
      if (remaining > 0) await sleep(remaining);
    }
    lastRequestAt = now();
  }

  function retryDelay(response, attempt) {
    const fromHeader = retryAfterMs(response.headers?.get?.('retry-after'), now());
    const base = fromHeader ?? RETRY_DELAYS_MS[attempt];
    const randomValue = Number(random());
    const jitter = Math.floor(
      Math.max(0, Math.min(1, Number.isFinite(randomValue) ? randomValue : 0)) * 250,
    );
    return Math.max(0, base + jitter);
  }

  async function call(model, method, body = {}) {
    ensureConfigured();
    return enqueue(async () => {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        await waitForRequestSlot();
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          Math.max(100, timeoutMs),
        );
        let response;
        try {
          response = await fetchImpl(
            `${config.baseUrl}/json/2/${encodeURIComponent(model)}/${encodeURIComponent(method)}`,
            {
              method: 'POST',
              headers: {
                Authorization: `bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'User-Agent': 'MIG-FARM-APP',
              },
              body: JSON.stringify(body),
              signal: controller.signal,
            },
          );
        } catch (error) {
          if (error?.name === 'AbortError') throw safeFailure('odoo_timeout');
          if (error?.code && error?.statusCode) throw error;
          throw safeFailure('odoo_unavailable');
        } finally {
          clearTimeout(timeout);
        }
        if (!response.ok) {
          if (
            RETRYABLE_STATUSES.has(response.status) &&
            attempt < RETRY_DELAYS_MS.length
          ) {
            const delay = retryDelay(response, attempt);
            logger?.warn?.('Odoo request retry', {
              upstreamStatus: response.status,
              attempt: attempt + 1,
              retryDelayMs: delay,
              model,
              method,
            });
            if (delay > 0) await sleep(delay);
            continue;
          }
          throw safeFailure(upstreamFailure(response.status), response.status);
        }
        let data;
        try {
          data = await response.json();
        } catch {
          throw safeFailure('odoo_invalid_response');
        }
        if (data && typeof data === 'object' && hasOwn(data, 'error'))
          throw safeFailure('odoo_request_failed');
        return data && typeof data === 'object' && hasOwn(data, 'result')
          ? data.result
          : data;
      }
      throw safeFailure('odoo_unavailable');
    });
  }

  async function fieldsFor(model) {
    if (discoveredAt === null || now() - discoveredAt > DISCOVERY_TTL_MS) {
      fieldCache.clear();
      fieldInflight.clear();
      discoveredAt = now();
    }
    if (fieldCache.has(model)) return fieldCache.get(model);
    if (fieldInflight.has(model)) return fieldInflight.get(model);
    const discovery = (async () => {
      try {
        const result = await call(model, 'fields_get', {
          attributes: ['type'],
        });
        const available =
          result && typeof result === 'object' ? Object.keys(result) : [];
        const selected = FIELD_CANDIDATES[model].filter((field) =>
          available.includes(field),
        );
        fieldCache.set(model, selected);
        return selected;
      } catch (error) {
        if (
          OPTIONAL_MODELS.has(model) &&
          [400, 404].includes(error?.upstreamStatus)
        ) {
          fieldCache.set(model, []);
          return [];
        }
        throw error;
      } finally {
        fieldInflight.delete(model);
      }
    })();
    fieldInflight.set(model, discovery);
    return discovery;
  }

  async function searchRead(model, domain, fields, order = 'id asc', context) {
    const records = [];
    for (let offset = 0; offset < MAX_RECORDS; offset += PAGE_SIZE) {
      const page = await call(model, 'search_read', {
        domain,
        fields,
        limit: PAGE_SIZE,
        offset,
        order,
        ...(context ? { context } : {}),
      });
      if (!Array.isArray(page)) throw safeFailure('odoo_invalid_response');
      records.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return records.slice(0, MAX_RECORDS);
  }

  async function translatedRecords(model, ids, fields, lang) {
    if (!ids.length || !fields.length) return new Map();
    try {
      const records = await searchRead(
        model,
        [['id', 'in', ids]],
        ['id', ...fields.filter((field) => field !== 'id')],
        'id asc',
        { lang },
      );
      return new Map(records.map((record) => [Number(record.id), record]));
    } catch (error) {
      logger?.warn?.('Odoo catalog translation read failed', {
        upstreamStatus: error?.upstreamStatus || null,
        model,
        method: 'search_read',
        language: lang,
      });
      return new Map();
    }
  }

  async function namedRecords(model, ids, fields) {
    if (!ids.length || !fields.length) return new Map();
    const records = await searchRead(model, [['id', 'in', ids]], fields);
    return new Map(records.map((record) => [Number(record.id), record]));
  }

  async function limitedSearchRead(model, domain, fields, limit = 2) {
    const records = await call(model, 'search_read', {
      domain,
      fields,
      limit,
      offset: 0,
      order: 'id asc',
    });
    if (!Array.isArray(records)) throw safeFailure('odoo_invalid_response');
    return records;
  }

  async function readOne(model, id, fields) {
    const records = await call(model, 'read', { ids: [id], fields });
    const record = Array.isArray(records) ? records[0] : null;
    if (!record || relationId(record.id) !== id)
      throw safeFailure('odoo_invalid_response');
    return record;
  }

  function requiredFields(model, fields, required) {
    if (required.some((field) => !fields.includes(field)))
      throw safeFailure(`odoo_${model.replaceAll('.', '_')}_fields_unavailable`);
  }

  function createdRecordId(result) {
    if (Array.isArray(result)) return relationId(result[0]);
    if (result && typeof result === 'object')
      return relationId(result.id ?? result.ids?.[0]);
    return relationId(result);
  }

  async function createRecord(model, values) {
    const result = await call(model, 'create', { vals_list: [values] });
    const id = createdRecordId(result);
    if (!id) throw safeFailure('odoo_invalid_response');
    return id;
  }

  async function updateRecord(model, id, values) {
    const result = await call(model, 'write', { ids: [id], vals: values });
    if (result !== true && result !== 1) throw safeFailure('odoo_invalid_response');
  }

  const partnerReadFields = (fields) => fields.filter((field) => [
    'id', 'name', 'phone', 'mobile', 'email', 'street', 'street2', 'city',
    'country_id', 'active', 'type', 'parent_id', 'lang', 'customer_rank', 'ref',
  ].includes(field));

  function customerProfile(record) {
    return {
      partnerId: relationId(record.id),
      name: cleanText(record.name),
      email: normalizedEmail(record.email),
      phone: cleanText(record.phone || record.mobile),
      language: cleanText(record.lang).toLowerCase().startsWith('ar') ? 'ar' : 'en',
      emirate: cleanText(record.street2),
    };
  }

  async function findPartnerByReference(reference, fields) {
    if (!reference || !fields.includes('ref')) return null;
    const records = await limitedSearchRead(
      'res.partner',
      [['ref', '=', reference]],
      partnerReadFields(fields),
      2,
    );
    if (records.length > 1) throw safeFailure('odoo_partner_ambiguous');
    return records[0] || null;
  }

  async function partnerValues(input, fields, reference, type = 'contact') {
    const values = { name: cleanText(input.name) };
    if (!values.name) throw safeFailure('odoo_invalid_customer');
    if (fields.includes('email') && input.email)
      values.email = normalizedEmail(input.email);
    const phoneField = fields.includes('phone') ? 'phone' : fields.includes('mobile') ? 'mobile' : null;
    if (phoneField && input.phone) values[phoneField] = cleanText(input.phone);
    if (fields.includes('lang'))
      values.lang = input.language === 'ar'
        ? cleanText(env.ODOO_LANG_AR) || 'ar_001'
        : cleanText(env.ODOO_LANG_EN) || 'en_US';
    if (fields.includes('customer_rank') && type === 'contact') values.customer_rank = 1;
    if (fields.includes('type')) values.type = type;
    if (fields.includes('active')) values.active = true;
    if (fields.includes('ref') && reference) values.ref = reference;
    if (fields.includes('street') && input.addressLine) values.street = cleanText(input.addressLine);
    if (fields.includes('street2')) {
      const secondary = [input.unit, input.emirate].map(cleanText).filter(Boolean).join(' - ');
      if (secondary) values.street2 = secondary;
    }
    if (fields.includes('city') && input.city) values.city = cleanText(input.city);
    if (fields.includes('country_id')) {
      const countryId = await uaeCountryId();
      if (countryId) values.country_id = countryId;
    }
    return values;
  }

  async function readCustomerPartner(partnerId, fields = null) {
    const id = Number(partnerId);
    if (!Number.isSafeInteger(id) || id <= 0)
      throw safeFailure('odoo_customer_link_invalid');
    const available = fields || await fieldsFor('res.partner');
    requiredFields('res.partner', available, ['id', 'name']);
    const record = await readOne('res.partner', id, partnerReadFields(available));
    if (available.includes('active') && record.active === false)
      throw safeFailure('odoo_customer_inactive');
    return record;
  }

  async function ensureCustomerPartner(input) {
    const key = cleanText(input?.appUserId);
    if (!key) throw safeFailure('odoo_invalid_customer');
    if (customerInflight.has(key)) return customerInflight.get(key);
    const operation = (async () => {
      const fields = await fieldsFor('res.partner');
      requiredFields('res.partner', fields, ['id', 'name']);
      if (input.partnerId) {
        const linked = await readCustomerPartner(input.partnerId, fields);
        return customerProfile(linked);
      }
      const reference = `MIGAPP:${key}`.slice(0, 120);
      const existing = await findPartnerByReference(reference, fields);
      if (existing) return customerProfile(existing);
      const values = await partnerValues(input, fields, reference);
      let createdId;
      try {
        createdId = await createRecord('res.partner', values);
      } catch (error) {
        if (!['odoo_timeout', 'odoo_unavailable', 'odoo_rate_limited'].includes(errorCode(error)))
          throw error;
        const recovered = await findPartnerByReference(reference, fields).catch(() => null);
        if (!recovered) throw error;
        return customerProfile(recovered);
      }
      return customerProfile(await readCustomerPartner(createdId, fields));
    })().finally(() => customerInflight.delete(key));
    customerInflight.set(key, operation);
    return operation;
  }

  async function getCustomerProfile(partnerId) {
    return customerProfile(await readCustomerPartner(partnerId));
  }

  async function updateCustomerPartner(partnerId, input) {
    const fields = await fieldsFor('res.partner');
    await readCustomerPartner(partnerId, fields);
    const current = await partnerValues(input, fields, null);
    const values = Object.fromEntries(
      Object.entries(current).filter(([field]) => !['customer_rank', 'type', 'active'].includes(field)),
    );
    await updateRecord('res.partner', Number(partnerId), values);
    return getCustomerProfile(partnerId);
  }

  async function syncCustomerAvatar(partnerId, file) {
    const fields = await fieldsFor('res.partner');
    await readCustomerPartner(partnerId, fields);
    if (!fields.includes('image_1920'))
      return { supported: false };
    const value = file?.buffer?.length ? file.buffer.toString('base64') : false;
    await updateRecord('res.partner', Number(partnerId), { image_1920: value });
    return { supported: true };
  }

  async function upsertDeliveryAddress({ parentId, addressId, partnerId, address }) {
    const fields = await fieldsFor('res.partner');
    requiredFields('res.partner', fields, ['id', 'name', 'parent_id', 'type']);
    const parent = await readCustomerPartner(parentId, fields);
    const reference = `MIGADDR:${cleanText(addressId)}`.slice(0, 120);
    let record = partnerId
      ? await readCustomerPartner(partnerId, fields)
      : await findPartnerByReference(reference, fields);
    if (record) {
      if (relationId(record.parent_id) !== relationId(parent.id) || cleanText(record.type) !== 'delivery')
        throw safeFailure('odoo_address_ownership_mismatch');
    }
    const values = await partnerValues(
      {
        ...address,
        name: cleanText(address.name) || cleanText(address.label) || parent.name,
      },
      fields,
      reference,
      'delivery',
    );
    values.parent_id = relationId(parent.id);
    if (record) {
      await updateRecord('res.partner', relationId(record.id), values);
      return { partnerId: relationId(record.id) };
    }
    return { partnerId: await createRecord('res.partner', values) };
  }

  async function deactivateDeliveryAddress({ parentId, partnerId }) {
    const fields = await fieldsFor('res.partner');
    requiredFields('res.partner', fields, ['id', 'parent_id', 'type', 'active']);
    const record = await readCustomerPartner(partnerId, fields);
    if (relationId(record.parent_id) !== Number(parentId) || cleanText(record.type) !== 'delivery')
      throw safeFailure('odoo_address_ownership_mismatch');
    await updateRecord('res.partner', Number(partnerId), { active: false });
    return { ok: true };
  }

  async function findExactPartner(customer, fields) {
    const outputFields = fields.filter((field) =>
      ['id', 'name', 'phone', 'mobile', 'email'].includes(field));
    const phoneFields = ['phone', 'mobile'].filter((field) => fields.includes(field));
    const expectedPhone = normalizedPhone(customer.phone);
    if (expectedPhone && phoneFields.length) {
      const needle = expectedPhone.slice(-8);
      const domain = phoneFields.length === 2
        ? ['|', ['phone', 'ilike', needle], ['mobile', 'ilike', needle]]
        : [[phoneFields[0], 'ilike', needle]];
      const candidates = await searchRead('res.partner', domain, outputFields);
      const matches = candidates.filter((record) => phoneFields.some((field) =>
        normalizedPhone(record[field]) === expectedPhone));
      if (matches.length > 1) throw safeFailure('odoo_partner_ambiguous');
      if (matches.length === 1)
        return { id: relationId(matches[0].id), matchedBy: 'phone' };
    }
    const expectedEmail = normalizedEmail(customer.email);
    if (expectedEmail && fields.includes('email')) {
      const candidates = await searchRead(
        'res.partner',
        [['email', '=ilike', expectedEmail]],
        outputFields,
      );
      const matches = candidates.filter((record) =>
        normalizedEmail(record.email) === expectedEmail);
      if (matches.length > 1) throw safeFailure('odoo_partner_ambiguous');
      if (matches.length === 1)
        return { id: relationId(matches[0].id), matchedBy: 'email' };
    }
    return null;
  }

  async function uaeCountryId() {
    const fields = await fieldsFor('res.country');
    if (!fields.includes('id') || !fields.includes('code')) return null;
    const matches = await limitedSearchRead(
      'res.country',
      [['code', '=', 'AE']],
      fields.filter((field) => ['id', 'code', 'name'].includes(field)),
      2,
    );
    return matches.length === 1 ? relationId(matches[0].id) : null;
  }

  async function resolvePartner(customer, shippingAddress) {
    const fields = await fieldsFor('res.partner');
    requiredFields('res.partner', fields, ['id', 'name']);
    if (!fields.includes('phone') && !fields.includes('mobile'))
      throw safeFailure('odoo_res_partner_fields_unavailable');
    const existing = await findExactPartner(customer, fields);
    if (existing?.id) return existing;
    const values = { name: customer.name };
    const phoneField = fields.includes('phone') ? 'phone' : 'mobile';
    values[phoneField] = customer.phone;
    if (fields.includes('email') && customer.email) values.email = customer.email;
    if (fields.includes('street')) values.street = shippingAddress.addressLine;
    if (fields.includes('street2') && shippingAddress.emirate)
      values.street2 = shippingAddress.emirate;
    if (fields.includes('city')) values.city = shippingAddress.city;
    if (fields.includes('country_id')) {
      const countryId = await uaeCountryId();
      if (countryId) values.country_id = countryId;
    }
    return {
      id: await createRecord('res.partner', values),
      matchedBy: 'created',
    };
  }

  function quotationResult(record, partner) {
    const id = relationId(record.id);
    const subtotal = number(record.amount_untaxed);
    const tax = number(record.amount_tax);
    const total = number(record.amount_total);
    const currency = Array.isArray(record.currency_id)
      ? cleanText(record.currency_id[1])
      : cleanText(record.currency_id?.name || record.currency_id);
    if (!id || [subtotal, tax, total].some((value) => value === null) || !currency)
      throw safeFailure('odoo_invalid_response');
    return {
      orderId: id,
      orderName: cleanText(record.name),
      state: cleanText(record.state),
      subtotal,
      tax,
      total,
      currency: currency.toUpperCase(),
      partnerId: partner?.id || relationId(record.partner_id),
      partnerMatch: partner?.matchedBy || 'existing_order',
    };
  }

  async function findQuotationByReference(reference, fields) {
    const records = await limitedSearchRead(
      'sale.order',
      [['client_order_ref', '=', reference]],
      fields,
      2,
    );
    if (records.length > 1) throw safeFailure('odoo_order_ambiguous');
    return records[0] || null;
  }

  async function prepareQuotation({
    orderId,
    customer,
    shippingAddress,
    items,
    partnerId = null,
    deliveryPartnerId = null,
  }) {
    const saleFields = await fieldsFor('sale.order');
    const lineFields = await fieldsFor('sale.order.line');
    const productFields = await fieldsFor('product.product');
    requiredFields('sale.order', saleFields, [
      'id', 'name', 'state', 'partner_id', 'client_order_ref', 'order_line',
      'amount_untaxed', 'amount_tax', 'amount_total', 'currency_id',
    ]);
    requiredFields('sale.order.line', lineFields, ['product_id', 'product_uom_qty']);
    requiredFields('product.product', productFields, ['id']);
    const orderReadFields = saleFields.filter((field) => [
      'id', 'name', 'state', 'partner_id', 'client_order_ref', 'amount_untaxed',
      'amount_tax', 'amount_total', 'currency_id',
    ].includes(field));
    const existing = await findQuotationByReference(orderId, orderReadFields);
    if (existing) return quotationResult(existing);

    const variantIds = uniqueNumbers(items.map((item) => Number(item.variantId)));
    if (variantIds.length !== items.length) throw safeFailure('odoo_invalid_order_lines');
    const productReadFields = productFields.filter((field) => [
      'id', 'active', 'sale_ok', 'free_qty', 'qty_available',
    ].includes(field));
    const variants = await limitedSearchRead(
      'product.product',
      [['id', 'in', variantIds]],
      productReadFields,
      Math.min(200, variantIds.length + 1),
    );
    if (variants.length !== variantIds.length)
      throw safeFailure('odoo_variant_unavailable');
    for (const variant of variants) {
      if (!visibleVariant(variant, productFields))
        throw safeFailure('odoo_variant_unavailable');
      if (stockFrom(variant, productFields).stock_state === 'out_of_stock')
        throw safeFailure('odoo_variant_out_of_stock');
    }

    const partner = partnerId
      ? { id: relationId((await readCustomerPartner(partnerId)).id), matchedBy: 'linked_app_user' }
      : await resolvePartner(customer, shippingAddress);
    const values = {
      partner_id: partner.id,
      client_order_ref: orderId,
      order_line: items.map((item) => [0, 0, {
        product_id: Number(item.variantId),
        product_uom_qty: Number(item.quantity),
      }]),
    };
    if (deliveryPartnerId && saleFields.includes('partner_shipping_id')) {
      const delivery = await readCustomerPartner(deliveryPartnerId);
      if (
        relationId(delivery.parent_id) !== partner.id ||
        cleanText(delivery.type) !== 'delivery'
      ) throw safeFailure('odoo_address_ownership_mismatch');
      values.partner_shipping_id = relationId(delivery.id);
    }
    try {
      const createdId = await createRecord('sale.order', values);
      return quotationResult(await readOne('sale.order', createdId, orderReadFields), partner);
    } catch (error) {
      if (!['odoo_timeout', 'odoo_unavailable'].includes(errorCode(error))) throw error;
      try {
        const recovered = await findQuotationByReference(orderId, orderReadFields);
        if (recovered) return quotationResult(recovered, partner);
      } catch (recoveryError) {
        if (errorCode(recoveryError) === 'odoo_order_ambiguous') throw recoveryError;
      }
      throw error;
    }
  }

  async function confirmQuotation({
    orderId,
    orderReference,
    expectedTotal,
    expectedCurrency,
  }) {
    const numericOrderId = Number(orderId);
    if (!Number.isSafeInteger(numericOrderId) || numericOrderId <= 0)
      throw safeFailure('odoo_invalid_order');
    const reference = cleanText(orderReference);
    if (!reference) throw safeFailure('odoo_invalid_order');
    const saleFields = await fieldsFor('sale.order');
    requiredFields('sale.order', saleFields, [
      'id', 'name', 'state', 'client_order_ref', 'amount_untaxed',
      'amount_tax', 'amount_total', 'currency_id',
    ]);
    const orderReadFields = saleFields.filter((field) => [
      'id', 'name', 'state', 'partner_id', 'client_order_ref', 'amount_untaxed',
      'amount_tax', 'amount_total', 'currency_id',
    ].includes(field));
    let record = await readOne('sale.order', numericOrderId, orderReadFields);
    if (cleanText(record.client_order_ref) !== reference)
      throw safeFailure('odoo_order_mapping_conflict');
    const current = quotationResult(record);
    if (
      number(expectedTotal) === null ||
      Math.round(current.total * 100) !== Math.round(number(expectedTotal) * 100) ||
      current.currency !== cleanText(expectedCurrency).toUpperCase()
    ) throw safeFailure('odoo_order_totals_changed');
    if (['sale', 'done'].includes(cleanText(record.state)))
      return current;
    if (cleanText(record.state) !== 'draft')
      throw safeFailure('odoo_order_state_conflict');
    await call('sale.order', 'action_confirm', { ids: [numericOrderId] });
    record = await readOne('sale.order', numericOrderId, orderReadFields);
    if (
      cleanText(record.client_order_ref) !== reference ||
      !['sale', 'done'].includes(cleanText(record.state))
    ) throw safeFailure('odoo_order_confirmation_failed');
    const confirmed = quotationResult(record);
    if (
      Math.round(confirmed.total * 100) !== Math.round(number(expectedTotal) * 100) ||
      confirmed.currency !== cleanText(expectedCurrency).toUpperCase()
    ) throw safeFailure('odoo_order_totals_changed');
    return confirmed;
  }

  async function loadCatalog() {
    const templateFields = await fieldsFor('product.template');
    const variantFields = await fieldsFor('product.product');
    const categoryFields = await fieldsFor('product.category');
    const publicCategoryFields = await fieldsFor('product.public.category');
    const attributeFields = await fieldsFor('product.template.attribute.value');
    for (const [model, fields, required] of [
      ['product.template', templateFields, ['id', 'name']],
      ['product.product', variantFields, ['id', 'product_tmpl_id']],
    ]) {
      if (required.some((field) => !fields.includes(field)))
        throw safeFailure(`odoo_${model.replace('.', '_')}_fields_unavailable`);
    }
    if (
      !templateFields.includes('list_price') &&
      !variantFields.includes('lst_price') &&
      !variantFields.includes('list_price')
    ) throw safeFailure('odoo_price_field_unavailable');

    const templatePayloadFields = templateFields.filter((field) => !IMAGE_FIELDS.includes(field));
    const variantPayloadFields = variantFields.filter((field) => !IMAGE_FIELDS.includes(field));
    const templateDomain = [];
    if (templateFields.includes('active')) templateDomain.push(['active', '=', true]);
    if (templateFields.includes('sale_ok')) templateDomain.push(['sale_ok', '=', true]);
    if (templateFields.includes('is_published'))
      templateDomain.push(['is_published', '=', true]);
    else if (templateFields.includes('website_published'))
      templateDomain.push(['website_published', '=', true]);
    const templates = (await searchRead('product.template', templateDomain, templatePayloadFields))
      .filter((record) => visibleTemplate(record, templateFields));
    const templateIds = templates.map((record) => Number(record.id));
    const templateTranslationFields = ['name', 'description_sale']
      .filter((field) => templateFields.includes(field));
    const templateAr = await translatedRecords(
      'product.template', templateIds, templateTranslationFields, 'ar_001',
    );
    const templateEn = await translatedRecords(
      'product.template', templateIds, templateTranslationFields, 'en_US',
    );
    const variants = templateIds.length
      ? (await searchRead(
          'product.product',
          [
            ['product_tmpl_id', 'in', templateIds],
            ...(variantFields.includes('active') ? [['active', '=', true]] : []),
            ...(variantFields.includes('sale_ok') ? [['sale_ok', '=', true]] : []),
          ],
          variantPayloadFields,
        )).filter((record) => visibleVariant(record, variantFields))
      : [];

    const categoryIds = uniqueNumbers(templates.map((record) => relationId(record.categ_id)));
    const attributeIds = uniqueNumbers(
      variants.flatMap((record) =>
        [
          ...relationIds(record.product_template_attribute_value_ids),
          ...relationIds(record.product_template_variant_value_ids),
        ],
      ),
    );
    const internalCategories = await namedRecords(
      'product.category',
      categoryIds,
      categoryFields,
    );
    const publicCategoryPayloadFields = publicCategoryFields
      .filter((field) => !IMAGE_FIELDS.includes(field));
    const publicCategoryRecords = publicCategoryPayloadFields.length
      ? await searchRead(
          'product.public.category',
          [],
          publicCategoryPayloadFields,
          publicCategoryFields.includes('sequence') ? 'sequence asc,id asc' : 'id asc',
        )
      : [];
    const publicCategoryIds = publicCategoryRecords.map((record) => Number(record.id));
    const publicCategoryAr = await translatedRecords(
      'product.public.category', publicCategoryIds, ['name'], 'ar_001',
    );
    const publicCategoryEn = await translatedRecords(
      'product.public.category', publicCategoryIds, ['name'], 'en_US',
    );
    const storefrontCategories = publicCategoryRecords
      .map((record) => {
        const id = relationId(record.id);
        const name = cleanText(record.name);
        if (!id || !name) return null;
        const sequence = number(record.sequence);
        const imageVersion = encodeURIComponent(cleanText(record.write_date) || '0');
        const image = IMAGE_FIELDS.some((field) => publicCategoryFields.includes(field))
          ? `/api/odoo/product-image/product.public.category/${id}?v=${imageVersion}`
          : null;
        return {
          id,
          name,
          name_ar: localizedValue(publicCategoryAr.get(id), 'name', name),
          name_en: cleanText(publicCategoryEn.get(id)?.name) || name,
          parentId: relationId(record.parent_id),
          image,
          ...(sequence === null ? {} : { sequence }),
          ...(isoOrUndefined(record.write_date)
            ? { updatedAt: isoOrUndefined(record.write_date) }
            : {}),
        };
      })
      .filter(Boolean);
    const normalizedPublicCategories = new Map(
      storefrontCategories.map((category) => [category.id, category]),
    );
    const attributes = await namedRecords(
      'product.template.attribute.value',
      attributeIds,
      attributeFields,
    );

    const variantsByTemplate = new Map();
    for (const record of variants) {
      const templateId = relationId(record.product_tmpl_id);
      if (!templateId) continue;
      const list = variantsByTemplate.get(templateId) || [];
      list.push(record);
      variantsByTemplate.set(templateId, list);
    }

    const websiteSlugs = templates.map((record) => websiteSlug(record.website_url));
    const slugCounts = new Map();
    for (const slug of websiteSlugs)
      if (slug) slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1);

    const products = [];
    for (const [index, template] of templates.entries()) {
      const templateId = Number(template.id);
      if (!Number.isSafeInteger(templateId) || templateId <= 0) continue;
      const name = cleanText(template.name || template.display_name) || `Product ${templateId}`;
      const translatedAr = templateAr.get(templateId);
      const translatedEn = templateEn.get(templateId);
      const sourceVariants = variantsByTemplate.get(templateId) || [];
      if (!sourceVariants.length) continue;
      const mappedVariants = sourceVariants.map((record) => {
        const variantId = Number(record.id);
        const options = uniqueNumbers([
          ...relationIds(record.product_template_attribute_value_ids),
          ...relationIds(record.product_template_variant_value_ids),
        ])
          .map((templateValueId) => {
            const option = attributes.get(templateValueId);
            const attributeId = relationId(option?.attribute_id);
            const attributeName = relationName(option?.attribute_id);
            const valueId = relationId(option?.product_attribute_value_id) || templateValueId;
            const value = relationName(option?.product_attribute_value_id) || cleanText(option?.name);
            if (!attributeId || !attributeName || !valueId || !value) return null;
            return { templateValueId, attributeId, attributeName, valueId, value };
          })
          .filter(Boolean);
        const attributeNames = options.map((option) => option.value);
        const variantName = attributeNames.join(' / ') ||
          cleanText(record.display_name || record.name) || 'Default';
        const currentPrice = number(record.lst_price) ??
          number(record.list_price) ??
          number(template.list_price);
        const stock = stockFrom(record, variantFields);
        const imageVersion = encodeURIComponent(cleanText(record.write_date) || '0');
        const featuredImage = IMAGE_FIELDS.some((field) => variantFields.includes(field))
          ? {
              id: variantId,
              src: `/api/odoo/product-image/product.product/${variantId}?v=${imageVersion}`,
              alt: name,
            }
          : null;
        return {
          id: variantId,
          odoo_variant_id: variantId,
          title: variantName,
          title_ar: null,
          title_en: variantName,
          price: currentPrice === null ? '' : currentPrice.toFixed(2),
          compare_at_price: null,
          sku: cleanText(record.default_code) || cleanText(template.default_code) || null,
          option1: attributeNames[0] || null,
          option2: attributeNames[1] || null,
          option3: attributeNames[2] || null,
          options,
          featured_image: featuredImage,
          ...stock,
        };
      });
      const assignedCategories = relationIds(template.public_categ_ids)
        .map((id) => normalizedPublicCategories.get(id))
        .filter(Boolean)
        .filter((category) => category.name);
      const internalCategoryId = relationId(template.categ_id);
      const internalCategoryRecord = internalCategories.get(internalCategoryId);
      const categoryName = assignedCategories[0]?.name ||
        cleanText(internalCategoryRecord?.complete_name || internalCategoryRecord?.name);
      const stockStates = mappedVariants.map((variant) => variant.stock_state);
      const productStock = stockStates.includes('in_stock')
        ? 'in_stock'
        : stockStates.every((state) => state === 'out_of_stock')
          ? 'out_of_stock'
          : 'unknown';
      const preferredSlug = websiteSlugs[index];
      const handle = preferredSlug && slugCounts.get(preferredSlug) === 1
        ? preferredSlug
        : `${slugify(name)}-${templateId}`;
      const imageVersion = encodeURIComponent(cleanText(template.write_date) || '0');
      const images = IMAGE_FIELDS.some((field) => templateFields.includes(field))
        ? [{
            id: templateId,
            src: `/api/odoo/product-image/product.template/${templateId}?v=${imageVersion}`,
            alt: name,
          }]
        : [];
      const updatedAt = isoOrUndefined(template.write_date);
      const publishedAt = isoOrUndefined(template.create_date) || updatedAt;
      const brand = brandFromRecords(
        [template, ...sourceVariants],
        [...new Set([...templateFields, ...variantFields])],
      );
      const product = {
        id: templateId,
        odoo_template_id: templateId,
        catalog_source: 'odoo',
        handle,
        title: name,
        title_ar: localizedValue(translatedAr, 'name', name),
        title_en: cleanText(translatedEn?.name) || name,
        body_html: cleanText(template.description_sale || template.description),
        body_html_ar: localizedValue(
          translatedAr,
          'description_sale',
          template.description_sale || template.description,
        ),
        body_html_en: cleanText(translatedEn?.description_sale) ||
          cleanText(template.description_sale || template.description),
        vendor: brand?.name || '',
        brand,
        product_type: categoryName,
        product_type_ar: assignedCategories[0]?.name_ar || null,
        product_type_en: assignedCategories[0]?.name_en || categoryName,
        categories: assignedCategories,
        category: assignedCategories[0] || null,
        internal_category: internalCategoryId
          ? {
              id: internalCategoryId,
              name: cleanText(
                internalCategoryRecord?.complete_name || internalCategoryRecord?.name,
              ),
            }
          : null,
        tags: [categoryName, cleanText(template.default_code)].filter(Boolean),
        images,
        variants: mappedVariants,
        stock_state: productStock,
        ...(productStock === 'in_stock'
          ? { available: true }
          : productStock === 'out_of_stock'
            ? { available: false }
            : {}),
        published_at: publishedAt,
        updated_at: updatedAt,
      };
      product.category_paths = categoryAuditRecord(product, storefrontCategories);
      products.push(product);
    }

    const latestWrite = [
      ...products.map((product) => product.updated_at || ''),
      ...storefrontCategories.map((category) => category.updatedAt || ''),
    ]
      .sort()
      .at(-1) || 'unknown';
    const loadedAt = now();
    return {
      products,
      categories: storefrontCategories,
      version: `odoo:${latestWrite}:${products.length}:${storefrontCategories.length}`,
      updatedAt: new Date(loadedAt).toISOString(),
      metadata: {
        brandFields: [...new Set([...templateFields, ...variantFields])]
          .filter((field) => BRAND_FIELD_CANDIDATES.includes(field)),
        translations: { arabic: 'ar_001', english: 'en_US' },
      },
      loadedAt,
    };
  }

  function refreshCatalog() {
    if (!inflight) {
      inflight = loadCatalog()
        .then((next) => {
          cache = next;
          lastError = null;
          return next;
        })
        .catch((error) => {
          lastError = errorCode(error);
          throw error;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  }

  async function list({ force = false, allowStale = true } = {}) {
    const age = cacheAge(cache, now);
    if (!force && cache && age <= Math.max(0, ttlMs))
      return {
        ...cache,
        catalogMeta: {
          source: 'odoo',
          cache: 'fresh',
          stale: false,
          ageSeconds: Math.floor(age / 1000),
        },
      };
    try {
      const next = await refreshCatalog();
      return {
        ...next,
        catalogMeta: {
          source: 'odoo',
          cache: 'refreshed',
          stale: false,
          ageSeconds: 0,
        },
      };
    } catch (error) {
      const staleAge = cacheAge(cache, now);
      if (allowStale && cache && staleAge <= Math.max(ttlMs, staleTtlMs)) {
        logger?.warn?.('Odoo catalog refresh failed', {
          upstreamStatus: error?.upstreamStatus || null,
          errorCode: lastError,
        });
        return {
          ...cache,
          catalogMeta: {
            source: 'odoo',
            cache: 'stale',
            stale: true,
            ageSeconds: Math.floor(staleAge / 1000),
            error: lastError,
          },
        };
      }
      throw error;
    }
  }

  async function getByHandle(handle, options) {
    const current = await list(options);
    return current.products.find((product) => product.handle === handle) || null;
  }

  async function filterExistingProductIds(values) {
    const requested = uniqueNumbers(values.map(Number));
    if (!requested.length) return [];
    const current = await list();
    const existing = new Set(current.products.map((product) => Number(product.id)));
    return requested.filter((id) => existing.has(id));
  }

  async function productImage(model, id, { version = '' } = {}) {
    if (!['product.template', 'product.product', 'product.public.category'].includes(model))
      throw fail(404, 'image_not_found');
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId <= 0)
      throw fail(404, 'image_not_found');
    const key = `${model}:${numericId}:${cleanText(version).slice(0, 100)}`;
    if (imageCache.has(key)) return imageCache.get(key);
    const fields = await fieldsFor(model);
    const imageField = IMAGE_FIELDS.find((field) => fields.includes(field));
    if (!imageField) throw fail(404, 'image_not_found');
    const records = await call(model, 'read', { ids: [numericId], fields: [imageField] });
    const encoded = Array.isArray(records) ? records[0]?.[imageField] : null;
    if (typeof encoded !== 'string' || !encoded) throw fail(404, 'image_not_found');
    let body;
    try {
      body = Buffer.from(encoded.replace(/^data:[^;]+;base64,/, ''), 'base64');
    } catch {
      throw fail(404, 'image_not_found');
    }
    if (!body.length || body.length > MAX_IMAGE_BYTES)
      throw fail(404, 'image_not_found');
    const type = contentType(body);
    if (!type) throw fail(404, 'image_not_found');
    const result = { body, contentType: type };
    imageCache.set(key, result);
    if (imageCache.size > 200) imageCache.delete(imageCache.keys().next().value);
    return result;
  }

  async function health() {
    if (!config.configured)
      return {
        source: 'odoo', configured: config.status, reachable: false,
        products: cache?.products.length || 0,
        cacheAgeSeconds: Number.isFinite(cacheAge(cache, now))
          ? Math.floor(cacheAge(cache, now) / 1000) : null,
        lastError: 'odoo_not_configured',
      };
    if (!cache && inflight) {
      await inflight.catch(() => undefined);
    } else if (
      !cache &&
      (lastHealthRefreshAt === null ||
        now() - lastHealthRefreshAt >= HEALTH_REFRESH_COOLDOWN_MS)
    ) {
      lastHealthRefreshAt = now();
      await refreshCatalog().catch(() => undefined);
    }
    const age = cacheAge(cache, now);
    return {
      source: 'odoo',
      configured: 'configured',
      reachable: Boolean(cache) && !lastError,
      products: cache?.products.length || 0,
      version: cache?.version,
      cacheAgeSeconds: Number.isFinite(age) ? Math.floor(age / 1000) : null,
      stale: Boolean(cache && (age > Math.max(0, ttlMs) || lastError)),
      lastError,
    };
  }

  return {
    source: 'odoo', configured: config.configured, list, getByHandle,
    filterExistingProductIds, productImage, prepareQuotation, confirmQuotation,
    ensureCustomerPartner, getCustomerProfile, updateCustomerPartner,
    syncCustomerAvatar, upsertDeliveryAddress, deactivateDeliveryAddress,
    health,
  };
}

export function createStaticCatalog(input = {}) {
  const data = Array.isArray(input) ? { products: input } : input;
  const products = Array.isArray(data?.products) ? data.products : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const snapshot = {
    products,
    categories,
    version: data?.version || 'fixture',
    updatedAt: data?.migratedAt || data?.updatedAt,
  };
  return {
    source: 'fixture', configured: true,
    async list() {
      return {
        ...snapshot,
        catalogMeta: { source: 'fixture', cache: 'fixture', stale: false, ageSeconds: 0 },
      };
    },
    async getByHandle(handle) {
      return products.find((product) => product.handle === handle) || null;
    },
    async filterExistingProductIds(values) {
      const existing = new Set(products.map((product) => Number(product.id)));
      return uniqueNumbers(values.map(Number)).filter((id) => existing.has(id));
    },
    async productImage() {
      throw fail(404, 'image_not_found');
    },
    async prepareQuotation(payload) {
      if (typeof data?.prepareQuotation === 'function')
        return data.prepareQuotation(payload);
      throw safeFailure('odoo_not_configured');
    },
    async confirmQuotation(payload) {
      if (typeof data?.confirmQuotation === 'function')
        return data.confirmQuotation(payload);
      throw safeFailure('odoo_not_configured');
    },
    async ensureCustomerPartner(payload) {
      if (typeof data?.ensureCustomerPartner === 'function')
        return data.ensureCustomerPartner(payload);
      throw safeFailure('odoo_not_configured');
    },
    async getCustomerProfile(partnerId) {
      if (typeof data?.getCustomerProfile === 'function')
        return data.getCustomerProfile(partnerId);
      throw safeFailure('odoo_not_configured');
    },
    async updateCustomerPartner(partnerId, payload) {
      if (typeof data?.updateCustomerPartner === 'function')
        return data.updateCustomerPartner(partnerId, payload);
      throw safeFailure('odoo_not_configured');
    },
    async syncCustomerAvatar(partnerId, file) {
      if (typeof data?.syncCustomerAvatar === 'function')
        return data.syncCustomerAvatar(partnerId, file);
      return { supported: false };
    },
    async upsertDeliveryAddress(payload) {
      if (typeof data?.upsertDeliveryAddress === 'function')
        return data.upsertDeliveryAddress(payload);
      throw safeFailure('odoo_not_configured');
    },
    async deactivateDeliveryAddress(payload) {
      if (typeof data?.deactivateDeliveryAddress === 'function')
        return data.deactivateDeliveryAddress(payload);
      throw safeFailure('odoo_not_configured');
    },
    async health() {
      return {
        source: 'fixture', configured: 'configured', reachable: true,
        products: products.length, version: snapshot.version,
        cacheAgeSeconds: 0, stale: false, lastError: null,
      };
    },
  };
}

export function asCatalogService(value) {
  if (value && typeof value.list === 'function') return value;
  return createStaticCatalog(value);
}
