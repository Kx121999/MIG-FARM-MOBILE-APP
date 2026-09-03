import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { createAuth, profile } from '../auth/service.mjs';
import { createCustomers } from '../services/customers.mjs';
import { createOrders } from '../services/orders.mjs';
import { stripeGateway } from '../services/stripe.mjs';
import { fail, page } from '../lib/validation.mjs';
export function createApp({
  db,
  catalog,
  mediaRoot,
  env = process.env,
  stripe = stripeGateway(env),
  authOptions = {},
  orderOptions = {},
}) {
  const products = catalog.products || [],
    auth = createAuth(db, authOptions),
    customers = createCustomers(db, products),
    orders = createOrders(db, products, stripe, orderOptions);
  const allowed = (env.CORS_ORIGIN || '*')
    .split(',')
    .map((value) => value.trim());
  const send = (response, status, data) => {
    response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(JSON.stringify(data));
  };
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (allowed.includes('*'))
      response.setHeader('Access-Control-Allow-Origin', '*');
    else if (origin && allowed.includes(origin))
      response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Stripe-Signature, Idempotency-Key',
    );
    response.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS',
    );
    response.setHeader('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    const method = request.method;
    try {
      const url = new URL(request.url || '/', 'http://request.invalid'),
        path = url.pathname;
      if (method === 'GET' && path === '/health')
        return send(response, 200, {
          ok: true,
          service: 'mig-farm-api',
          products: products.length,
          catalogVersion: catalog.version,
          database: db ? 'configured' : 'not_configured',
        });
      if (method === 'GET' && path === '/api/products')
        return send(response, 200, {
          products,
          version: catalog.version,
          updatedAt: catalog.migratedAt,
        });
      if (method === 'GET' && path.startsWith('/api/products/')) {
        const product = products.find(
          (p) => p.handle === decodeURIComponent(path.slice(14)),
        );
        return send(
          response,
          product ? 200 : 404,
          product ? { product } : { error: 'product_not_found' },
        );
      }
      if (method === 'GET' && path.startsWith('/media/')) {
        const file = resolve(
          mediaRoot,
          decodeURIComponent(path).replace(/^\/+/, ''),
        );
        if (!file.startsWith(resolve(mediaRoot) + sep))
          throw fail(403, 'forbidden');
        try {
          const body = await readFile(file);
          response.writeHead(200, {
            'Content-Type':
              {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
              }[extname(file)] || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          response.end(body);
          return;
        } catch {
          throw fail(404, 'media_not_found');
        }
      }
      if (method === 'POST' && path === '/api/stripe/webhook') {
        const raw = await readBody(request, 1024 * 1024);
        if (!stripe.verify(raw, request.headers['stripe-signature']))
          throw fail(400, 'invalid_signature');
        await orders.webhook(parseJson(raw));
        return send(response, 200, { received: true });
      }
      if (method === 'GET' && path.startsWith('/api/orders/')) {
        const token =
          request.headers.authorization?.replace(/^Bearer\s+/i, '') ||
          url.searchParams.get('token');
        return send(response, 200, {
          order: await orders.guest(decodeURIComponent(path.slice(12)), token),
        });
      }
      if (method === 'POST' && path === '/api/checkout/session') {
        const user = await auth.authenticate(request, true);
        await auth.rate('checkout:' + clientIP(request, env), 60, 900);
        return send(
          response,
          200,
          await orders.checkout(
            await jsonBody(request),
            user,
            request.headers['idempotency-key'],
          ),
        );
      }
      if (path.startsWith('/api/auth/')) {
        if (method !== 'POST') throw fail(404, 'not_found');
        const body = await jsonBody(request),
          action = path.slice('/api/auth/'.length);
        if (
          ![
            'register',
            'login',
            'refresh',
            'logout',
            'logout-all',
            'forgot-password',
            'reset-password',
            'change-password',
          ].includes(action)
        )
          throw fail(404, 'not_found');
        await auth.rate(
          action + ':' + clientIP(request, env),
          ['refresh', 'logout', 'logout-all'].includes(action) ? 120 : 15,
          900,
        );
        if (action === 'register')
          return send(response, 201, await auth.register(body));
        if (action === 'login')
          return send(response, 200, await auth.login(body));
        if (action === 'refresh')
          return send(response, 200, await auth.refresh(body.refreshToken));
        if (action === 'logout') {
          await auth.logout(body.refreshToken);
          return send(response, 200, { ok: true });
        }
        if (action === 'forgot-password')
          return send(response, 202, await auth.forgot(body));
        if (action === 'reset-password') {
          await auth.reset(body);
          return send(response, 200, { ok: true });
        }
        const user = await auth.authenticate(request);
        if (action === 'logout-all') await auth.logoutAll(user);
        else await auth.changePassword(user, body);
        return send(response, 200, { ok: true });
      }
      if (
        !/^\/api\/(me(?:\/|$)|addresses(?:\/|$)|favorites(?:\/|$)|notifications(?:\/|$)|notification-preferences$)/.test(
          path,
        )
      )
        throw fail(404, 'not_found');
      const user = await auth.authenticate(request);
      if (path === '/api/me') {
        if (method === 'GET')
          return send(response, 200, { user: profile(user) });
        if (method === 'PATCH')
          return send(response, 200, {
            user: await auth.updateProfile(user, await jsonBody(request)),
          });
        if (method === 'DELETE') {
          await auth.rate('delete:' + user.id, 5, 900);
          await auth.deleteAccount(user, await jsonBody(request));
          return send(response, 200, { ok: true });
        }
      }
      if (path === '/api/me/avatar') {
        if (method === 'POST') {
          await auth.avatar.upload();
          throw fail(503, 'avatar_storage_not_configured');
        }
        if (method === 'DELETE')
          return send(response, 200, { user: await auth.removeAvatar(user) });
      }
      if (method === 'GET' && path === '/api/me/orders')
        return send(response, 200, await orders.history(user, page(url)));
      if (method === 'GET' && path.startsWith('/api/me/orders/'))
        return send(response, 200, {
          order: await orders.detail(user, decodeURIComponent(path.slice(15))),
        });
      if (path === '/api/addresses') {
        if (method === 'GET')
          return send(response, 200, {
            addresses: await customers.addresses(user),
          });
        if (method === 'POST')
          return send(response, 201, {
            addresses: await customers.saveAddress(
              user,
              await jsonBody(request),
            ),
          });
      }
      const addr = /^\/api\/addresses\/([^/]+)(\/default)?$/.exec(path);
      if (addr) {
        if (method === 'POST' && addr[2])
          return send(response, 200, {
            addresses: await customers.defaultAddress(user, addr[1]),
          });
        if (method === 'PATCH' && !addr[2])
          return send(response, 200, {
            addresses: await customers.saveAddress(
              user,
              await jsonBody(request),
              addr[1],
            ),
          });
        if (method === 'DELETE' && !addr[2])
          return send(response, 200, {
            addresses: await customers.deleteAddress(user, addr[1]),
          });
      }
      if (method === 'GET' && path === '/api/favorites')
        return send(response, 200, {
          favorites: await customers.favorites(user),
        });
      if (method === 'POST' && path === '/api/favorites/merge')
        return send(response, 200, {
          favorites: await customers.mergeFavorites(
            user,
            (await jsonBody(request)).productIds,
          ),
        });
      const fav = /^\/api\/favorites\/(\d+)$/.exec(path);
      if (fav && ['POST', 'DELETE'].includes(method))
        return send(response, 200, {
          favorites: await customers.favorite(user, fav[1], method === 'POST'),
        });
      if (method === 'GET' && path === '/api/notifications')
        return send(
          response,
          200,
          await customers.notifications(user, page(url)),
        );
      if (method === 'POST' && path === '/api/notifications/read-all') {
        await customers.readAll(user);
        return send(response, 200, { ok: true });
      }
      const notification = /^\/api\/notifications\/([^/]+)\/read$/.exec(path);
      if (method === 'PATCH' && notification) {
        await customers.readNotification(user, notification[1]);
        return send(response, 200, { ok: true });
      }
      if (path === '/api/notification-preferences') {
        if (method === 'GET')
          return send(response, 200, {
            preferences: await customers.preferences(user),
          });
        if (method === 'PATCH')
          return send(response, 200, {
            preferences: await customers.savePreferences(
              user,
              await jsonBody(request),
            ),
          });
      }
      throw fail(404, 'not_found');
    } catch (error) {
      const status = Number.isInteger(error.statusCode)
        ? error.statusCode
        : 503;
      if (status === 429) response.setHeader('Retry-After', '900');
      if (!error.statusCode) console.error('request_failed');
      return send(response, status, {
        error: error.statusCode ? error.code : 'service_unavailable',
      });
    }
  });
}
function clientIP(request, env) {
  const hops = Number(env.TRUST_PROXY_HOPS || 0),
    chain = String(request.headers['x-forwarded-for'] || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  chain.push(request.socket.remoteAddress || 'unknown');
  return Number.isInteger(hops) && hops >= 0 && hops <= 5
    ? chain[Math.max(0, chain.length - 1 - hops)]
    : chain.at(-1);
}
function readBody(request, limit = 32768) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0,
      tooLarge = false;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        reject(fail(413, 'payload_too_large'));
      } else if (!tooLarge) chunks.push(chunk);
    });
    request.on('end', () => {
      if (!tooLarge) resolve(Buffer.concat(chunks));
    });
    request.on('error', () => reject(fail(400, 'invalid_request')));
  });
}
function parseJson(raw) {
  try {
    const value = JSON.parse(raw.toString('utf8') || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw Error();
    return value;
  } catch {
    throw fail(400, 'invalid_json');
  }
}
const jsonBody = async (request) => parseJson(await readBody(request));
