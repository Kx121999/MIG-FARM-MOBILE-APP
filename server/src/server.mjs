import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const projectRoot = resolve(serverRoot, '..');
await loadEnv(join(projectRoot, '.env'));

const port = Number(process.env.PORT || 8787);
const mediaRoot = resolve(serverRoot, 'public');
const ordersRoot = resolve(serverRoot, 'data', 'orders');
const catalog = JSON.parse(await readFile(join(serverRoot, 'data', 'products.json'), 'utf8'));
const products = Array.isArray(catalog.products) ? catalog.products : [];
const productByHandle = new Map(products.map((product) => [product.handle, product]));
const allowedOrigin = process.env.CORS_ORIGIN || '*';
await mkdir(ordersRoot, { recursive: true });

const server = createServer(async (request, response) => {
  setCors(response, request.headers.origin);
  if (request.method === 'OPTIONS') return sendEmpty(response, 204);

  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, { ok: true, service: 'mig-farm-api', products: products.length, catalogVersion: catalog.version });
    }
    if (request.method === 'GET' && url.pathname === '/api/products') {
      return sendJson(response, 200, { products, version: catalog.version, updatedAt: catalog.migratedAt });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/products/')) {
      const handle = decodeURIComponent(url.pathname.slice('/api/products/'.length));
      const product = productByHandle.get(handle);
      return product ? sendJson(response, 200, { product }) : sendJson(response, 404, { error: 'product_not_found' });
    }
    if (request.method === 'POST' && url.pathname === '/api/checkout/session') {
      const payload = await readJsonBody(request);
      const order = await createOrder(buildCheckout(payload), payload);
      if (!process.env.STRIPE_SECRET_KEY || !process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
        return sendJson(response, 503, { error: 'payment_provider_not_configured', orderId: order.id });
      }
      const paymentIntent = await createStripePaymentIntent(order);
      order.paymentIntentId = paymentIntent.id;
      order.updatedAt = new Date().toISOString();
      await saveOrder(order);
      return sendJson(response, 200, {
        orderId: order.id,
        orderToken: order.accessToken,
        clientSecret: paymentIntent.client_secret,
        publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        amount: order.total,
        currency: order.currency,
      });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/orders/')) {
      const orderId = decodeURIComponent(url.pathname.slice('/api/orders/'.length));
      const order = await readOrder(orderId);
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || url.searchParams.get('token');
      if (!order || !token || !constantTimeEqual(token, order.accessToken)) return sendJson(response, 404, { error: 'order_not_found' });
      const { accessToken, ...publicOrder } = order;
      return sendJson(response, 200, { order: publicOrder });
    }
    if (request.method === 'POST' && url.pathname === '/api/stripe/webhook') {
      const rawBody = await readBody(request);
      if (!verifyStripeSignature(rawBody, request.headers['stripe-signature'])) return sendJson(response, 400, { error: 'invalid_signature' });
      await applyStripeEvent(JSON.parse(rawBody.toString('utf8')));
      return sendJson(response, 200, { received: true });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/media/')) return serveMedia(response, url.pathname);
    return sendJson(response, 404, { error: 'not_found' });
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    return sendJson(response, status, { error: status >= 500 ? 'server_error' : error.message });
  }
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`MIG FARM API listening on http://127.0.0.1:${port} with ${products.length} products\n`);
});

function buildCheckout(payload) {
  if (!Array.isArray(payload?.items) || !payload.items.length) throw httpError(400, 'cart_is_empty');
  const items = payload.items.map((requested) => {
    const product = products.find((item) => String(item.id) === String(requested.productId));
    const variant = product?.variants?.find((item) => String(item.id) === String(requested.variantId));
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(requested.quantity || 1))));
    if (!product || !variant || variant.available === false) throw httpError(400, 'invalid_cart_item');
    const unitPrice = Number(variant.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw httpError(500, 'invalid_catalog_price');
    return {
      productId: product.id,
      variantId: variant.id,
      handle: product.handle,
      title: product.title,
      variantTitle: variant.title,
      image: product.images?.[0]?.src || null,
      quantity,
      unitPrice,
      lineTotal: roundMoney(unitPrice * quantity),
    };
  });
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const delivery = roundMoney(Number(process.env.DELIVERY_FEE_AED || 0));
  return { items, subtotal, delivery, total: roundMoney(subtotal + delivery), currency: 'AED' };
}

async function createOrder(checkout, payload) {
  const now = new Date().toISOString();
  const order = {
    id: `MIG-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
    accessToken: randomBytes(24).toString('hex'),
    status: 'awaiting_payment',
    createdAt: now,
    updatedAt: now,
    ...checkout,
    customer: sanitizeCustomer(payload.customer),
    shippingAddress: sanitizeAddress(payload.shippingAddress),
  };
  await saveOrder(order);
  return order;
}

function sanitizeCustomer(value = {}) {
  const customer = { name: cleanText(value.name, 120), email: cleanText(value.email, 160).toLowerCase(), phone: cleanText(value.phone, 30) };
  if (!customer.name || !customer.email.includes('@') || !customer.phone) throw httpError(400, 'invalid_customer');
  return customer;
}

function sanitizeAddress(value = {}) {
  const address = {
    emirate: cleanText(value.emirate, 60),
    city: cleanText(value.city, 100),
    addressLine: cleanText(value.addressLine, 220),
    notes: cleanText(value.notes, 300),
  };
  if (!address.emirate || !address.city || !address.addressLine) throw httpError(400, 'invalid_shipping_address');
  return address;
}

async function createStripePaymentIntent(order) {
  const form = new URLSearchParams();
  form.set('amount', String(Math.round(order.total * 100)));
  form.set('currency', 'aed');
  form.set('automatic_payment_methods[enabled]', 'true');
  form.set('receipt_email', order.customer.email);
  form.set('description', `MIG FARM order ${order.id}`);
  form.set('metadata[order_id]', order.id);
  const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': order.id,
    },
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  const paymentIntent = await stripeResponse.json();
  if (!stripeResponse.ok || !paymentIntent.client_secret) throw httpError(502, 'payment_provider_error');
  return paymentIntent;
}

async function applyStripeEvent(event) {
  if (!['payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled'].includes(event.type)) return;
  const intent = event.data?.object;
  const order = intent?.metadata?.order_id ? await readOrder(intent.metadata.order_id) : null;
  if (!order) return;
  order.status = event.type === 'payment_intent.succeeded' ? 'paid' : event.type === 'payment_intent.canceled' ? 'canceled' : 'payment_failed';
  order.updatedAt = new Date().toISOString();
  order.paymentIntentId = intent.id;
  await saveOrder(order);
}

function verifyStripeSignature(rawBody, header) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || typeof header !== 'string') return false;
  const fields = Object.fromEntries(header.split(',').map((part) => part.split('=')));
  const timestamp = Number(fields.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${fields.t}.${rawBody.toString('utf8')}`).digest('hex');
  return constantTimeEqual(expected, fields.v1 || '');
}

async function saveOrder(order) {
  await writeFile(join(ordersRoot, `${safeOrderId(order.id)}.json`), `${JSON.stringify(order)}\n`, 'utf8');
}

async function readOrder(orderId) {
  try { return JSON.parse(await readFile(join(ordersRoot, `${safeOrderId(orderId)}.json`), 'utf8')); } catch { return null; }
}

async function serveMedia(response, pathname) {
  const filePath = resolve(mediaRoot, pathname.replace(/^\/+/, ''));
  if (!filePath.startsWith(`${mediaRoot}${sep}`)) return sendJson(response, 403, { error: 'forbidden' });
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeType(filePath), 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Length': body.length });
    response.end(body);
  } catch { sendJson(response, 404, { error: 'media_not_found' }); }
}

function setCors(response, requestOrigin) {
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin === '*' ? '*' : requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Stripe-Signature');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Vary', 'Origin');
}

function sendJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  response.end(body);
}

function sendEmpty(response, status) { response.writeHead(status); response.end(); }
function readJsonBody(request) { return readBody(request).then((body) => JSON.parse(body.toString('utf8') || '{}')); }
function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) { rejectBody(httpError(413, 'payload_too_large')); request.destroy(); } else chunks.push(chunk);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks)));
    request.on('error', rejectBody);
  });
}

async function loadEnv(filePath) {
  try {
    const text = await readFile(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* Hosting platforms can provide environment variables directly. */ }
}

function cleanText(value, maxLength) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength); }
function safeOrderId(value) {
  const cleaned = String(value || '').replace(/[^A-Z0-9-]/gi, '');
  if (!cleaned) throw httpError(400, 'invalid_order_id');
  return cleaned;
}
function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
function roundMoney(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function httpError(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }
function mimeType(filePath) { return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' })[extname(filePath).toLowerCase()] || 'application/octet-stream'; }
