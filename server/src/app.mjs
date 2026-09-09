import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { createAuth, profile } from '../auth/service.mjs';
import { createCustomers } from '../services/customers.mjs';
import { createOrders } from '../services/orders.mjs';
import { createFarmOS } from '../services/farms.mjs';
import { createPlatform } from '../services/platform.mjs';
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
    orders = createOrders(db, products, stripe, orderOptions),
    farmOS = createFarmOS(db),
    platform = createPlatform(db, products);
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
      if (method === 'GET' && path === '/api/app/home')
        return send(response, 200, await platform.publicHome());
      if (method === 'GET' && path === '/api/offers')
        return send(response, 200, await platform.publicOffers());
      if (method === 'GET' && path === '/admin')
        return serveAdmin(response, mediaRoot);
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
        /^\/api\/(?:my-farm|farms|zones|crops|farm-tasks|irrigation-records|farm-operations|farm-problems|farm-media|harvest-records|farm-notes|farm-inventory|farm-analyses|diagnosis-sessions)(?:\/|$)/.test(path)
      ) {
        const user = await auth.authenticate(request);
        const body = () => jsonBody(request);
        const mutate = async (status, operation) => {
          const payload = await body();
          return send(
            response,
            status,
            await rememberedFarmMutation(
              db,
              user,
              request.headers['idempotency-key'],
              method,
              path,
              () => operation(payload),
            ),
          );
        };
        if (method === 'GET' && path === '/api/my-farm/dashboard')
          return send(response, 200, await farmOS.dashboard(user));
        if (method === 'GET' && path === '/api/my-farm/search')
          return send(response, 200, await farmOS.search(user, url.searchParams.get('q')));
        if (method === 'GET' && path === '/api/my-farm/report')
          return send(response, 200, await farmOS.report(user, url));
        if (path === '/api/farms') {
          if (method === 'GET') return send(response, 200, { farms: await farmOS.listFarms(user) });
          if (method === 'POST') return send(response, 201, { farm: await farmOS.createFarm(user, await body()) });
        }
        const farm = /^\/api\/farms\/([^/]+)$/.exec(path);
        if (farm) {
          if (method === 'GET') return send(response, 200, { farm: await farmOS.getFarm(user, farm[1]) });
          if (method === 'PATCH') return send(response, 200, { farm: await farmOS.updateFarm(user, farm[1], await body()) });
          if (method === 'DELETE') { await farmOS.deleteFarm(user, farm[1]); return send(response, 200, { ok: true }); }
        }
        const zones = /^\/api\/farms\/([^/]+)\/zones$/.exec(path);
        if (zones) {
          if (method === 'GET') return send(response, 200, { zones: await farmOS.listZones(user, zones[1]) });
          if (method === 'POST') return send(response, 201, { zone: await farmOS.createZone(user, zones[1], await body()) });
        }
        const zone = /^\/api\/zones\/([^/]+)$/.exec(path);
        if (zone) {
          if (method === 'PATCH') return send(response, 200, { zone: await farmOS.updateZone(user, zone[1], await body()) });
          if (method === 'DELETE') { await farmOS.deleteZone(user, zone[1]); return send(response, 200, { ok: true }); }
        }
        const crops = /^\/api\/farms\/([^/]+)\/crops$/.exec(path);
        if (method === 'GET' && crops) return send(response, 200, { crops: await farmOS.listCrops(user, crops[1]) });
        if (method === 'POST' && path === '/api/crops') return send(response, 201, { crop: await farmOS.createCrop(user, await body()) });
        const cropTimeline = /^\/api\/crops\/([^/]+)\/timeline$/.exec(path);
        if (method === 'GET' && cropTimeline) return send(response, 200, { timeline: await farmOS.cropTimeline(user, cropTimeline[1]) });
        const cropHarvests = /^\/api\/crops\/([^/]+)\/harvests$/.exec(path);
        if (method === 'GET' && cropHarvests) return send(response, 200, { harvests: await farmOS.listHarvests(user, cropHarvests[1]) });
        const cropComplete = /^\/api\/crops\/([^/]+)\/complete$/.exec(path);
        if (method === 'POST' && cropComplete) return send(response, 200, { crop: await farmOS.completeCrop(user, cropComplete[1], await body()) });
        const crop = /^\/api\/crops\/([^/]+)$/.exec(path);
        if (crop) {
          if (method === 'GET') return send(response, 200, { crop: await farmOS.getCrop(user, crop[1]) });
          if (method === 'PATCH') return send(response, 200, { crop: await farmOS.updateCrop(user, crop[1], await body()) });
        }
        if (path === '/api/farm-tasks') {
          if (method === 'GET') return send(response, 200, await farmOS.listTasks(user, url));
          if (method === 'POST') return await mutate(201, async (payload) => ({ task: await farmOS.createTask(user, payload) }));
        }
        const taskComplete = /^\/api\/farm-tasks\/([^/]+)\/complete$/.exec(path);
        if (method === 'POST' && taskComplete) return await mutate(200, async (payload) => ({ task: await farmOS.completeTask(user, taskComplete[1], payload) }));
        const task = /^\/api\/farm-tasks\/([^/]+)$/.exec(path);
        if (task) {
          if (method === 'PATCH') return send(response, 200, { task: await farmOS.updateTask(user, task[1], await body()) });
          if (method === 'DELETE') { await farmOS.deleteTask(user, task[1]); return send(response, 200, { ok: true }); }
        }
        if (path === '/api/irrigation-records') {
          if (method === 'GET') return send(response, 200, { records: await farmOS.listIrrigation(user, url) });
          if (method === 'POST') return await mutate(201, async (payload) => ({ record: await farmOS.createIrrigation(user, payload) }));
        }
        const irrigation = /^\/api\/irrigation-records\/([^/]+)$/.exec(path);
        if (method === 'PATCH' && irrigation) return send(response, 200, { record: await farmOS.updateIrrigation(user, irrigation[1], await body()) });
        if (path === '/api/farm-operations') {
          if (method === 'GET') return send(response, 200, { operations: await farmOS.listOperations(user, url) });
          if (method === 'POST') return await mutate(201, async (payload) => ({ operation: await farmOS.createOperation(user, payload) }));
        }
        if (path === '/api/farm-problems') {
          if (method === 'GET') return send(response, 200, { problems: await farmOS.listProblems(user, url) });
          if (method === 'POST') return await mutate(201, async (payload) => ({ problem: await farmOS.createProblem(user, payload) }));
        }
        const followUp = /^\/api\/farm-problems\/([^/]+)\/follow-up$/.exec(path);
        if (method === 'POST' && followUp) return send(response, 200, await farmOS.followUp(user, followUp[1], await body()));
        const problemState = /^\/api\/farm-problems\/([^/]+)\/(resolve|reopen)$/.exec(path);
        if (method === 'POST' && problemState) return send(response, 200, { problem: await farmOS.setProblemState(user, problemState[1], problemState[2] === 'resolve' ? 'resolved' : 'reopened', await body()) });
        const problem = /^\/api\/farm-problems\/([^/]+)$/.exec(path);
        if (problem) {
          if (method === 'GET') return send(response, 200, await farmOS.problemDetail(user, problem[1]));
          if (method === 'PATCH') return send(response, 200, { problem: await farmOS.updateProblem(user, problem[1], await body()) });
        }
        if (method === 'POST' && path === '/api/farm-media') return send(response, 201, { media: await farmOS.uploadMedia(user, await body()) });
        const media = /^\/api\/farm-media\/([^/]+)$/.exec(path);
        if (method === 'DELETE' && media) { await farmOS.deleteMedia(user, media[1]); return send(response, 200, { ok: true }); }
        if (method === 'POST' && path === '/api/harvest-records') return await mutate(201, async (payload) => ({ harvest: await farmOS.createHarvest(user, payload) }));
        if (method === 'POST' && path === '/api/farm-notes') return await mutate(201, async (payload) => ({ note: await farmOS.createNote(user, payload) }));
        if (path === '/api/farm-inventory') {
          if (method === 'GET') return send(response, 200, { items: await farmOS.listInventory(user, url.searchParams.get('farmId')) });
          if (method === 'POST') return await mutate(201, async (payload) => ({ item: await farmOS.createInventory(user, payload) }));
        }
        const inventory = /^\/api\/farm-inventory\/([^/]+)$/.exec(path);
        if (inventory) {
          if (method === 'PATCH') return send(response, 200, { item: await farmOS.updateInventory(user, inventory[1], await body()) });
          if (method === 'DELETE') { await farmOS.deleteInventory(user, inventory[1]); return send(response, 200, { ok:true }); }
        }
        if (path === '/api/farm-analyses') {
          if (method === 'GET') return send(response, 200, { analyses: await farmOS.listAnalyses(user, url.searchParams.get('farmId')) });
          if (method === 'POST') return await mutate(201, async (payload) => ({ analysis: await farmOS.createAnalysis(user, payload) }));
        }
        const diagnoses = /^\/api\/farm-problems\/([^/]+)\/diagnoses$/.exec(path);
        if (method === 'GET' && diagnoses) return send(response, 200, { sessions: await farmOS.listDiagnoses(user, diagnoses[1]) });
        if (method === 'POST' && path === '/api/diagnosis-sessions') return await mutate(201, async (payload) => ({ session: await farmOS.createDiagnosis(user, payload) }));
        throw fail(404, 'not_found');
      }
      if (path.startsWith('/api/admin/')) {
        const user = await auth.authenticate(request);
        const action = path.slice('/api/admin/'.length);
        if (method === 'GET' && action === 'me')
          return send(response, 200, { user: profile(user) });
        if (method === 'GET' && action === 'system')
          return send(response, 200, await platform.systemStatus(user));
        if (method === 'GET' && action === 'summary')
          return send(response, 200, await platform.adminSummary(user));
        if (method === 'GET' && action === 'customers')
          return send(response, 200, await platform.adminCustomers(user, page(url), url));
        const customer = /^customers\/([^/]+)$/.exec(action);
        if (customer) {
          if (method === 'GET')
            return send(response, 200, await platform.adminCustomerDetail(user, decodeURIComponent(customer[1])));
          if (method === 'PATCH')
            return send(response, 200, await platform.setCustomerStatus(user, decodeURIComponent(customer[1]), await jsonBody(request)));
        }
        if (method === 'GET' && action === 'orders')
          return send(response, 200, await platform.adminOrders(user, page(url), url));
        const order = /^orders\/([^/]+)$/.exec(action);
        if (order) {
          if (method === 'GET')
            return send(response, 200, await platform.adminOrderDetail(user, decodeURIComponent(order[1])));
          if (method === 'PATCH')
            return send(response, 200, await platform.setOrderDeliveryStatus(user, decodeURIComponent(order[1]), await jsonBody(request)));
        }
        if (method === 'GET' && action === 'offers')
          return send(response, 200, await platform.adminList(user, 'offers', page(url), url));
        const offer = /^offers\/([^/]+)$/.exec(action);
        if (offer) {
          if (method === 'PATCH')
            return send(response, 200, await platform.saveOffer(user, await jsonBody(request), decodeURIComponent(offer[1])));
          if (method === 'DELETE')
            return send(response, 200, await platform.deleteOffer(user, decodeURIComponent(offer[1])));
        }
        if (method === 'GET' && action === 'home-content')
          return send(response, 200, await platform.adminList(user, 'home', page(url), url));
        const homeContent = /^home-content\/([^/]+)$/.exec(action);
        if (homeContent) {
          if (method === 'PATCH')
            return send(response, 200, await platform.saveHomeContent(user, await jsonBody(request), decodeURIComponent(homeContent[1])));
          if (method === 'DELETE')
            return send(response, 200, await platform.deleteHomeContent(user, decodeURIComponent(homeContent[1])));
        }
        if (method === 'GET' && action === 'push-campaigns')
          return send(response, 200, await platform.adminList(user, 'push', page(url), url));
        if (method === 'POST' && action === 'media/upload')
          return send(
            response,
            201,
            await platform.uploadAdminMedia(user, await multipartBody(request)),
          );
        if (method === 'DELETE' && action === 'media')
          return send(
            response,
            200,
            await platform.deleteAdminMedia(user, await jsonBody(request)),
          );
        if (method === 'POST' && action === 'offers')
          return send(response, 201, await platform.saveOffer(user, await jsonBody(request)));
        if (method === 'POST' && action === 'home-content')
          return send(response, 201, await platform.saveHomeContent(user, await jsonBody(request)));
        if (method === 'POST' && action === 'push-campaigns')
          return send(response, 202, await platform.savePushCampaign(user, await jsonBody(request)));
        throw fail(404, 'not_found');
      }
      if (
        !/^\/api\/(me(?:\/|$)|addresses(?:\/|$)|favorites(?:\/|$)|guest\/merge$|recently-viewed$|push-tokens$|notifications(?:\/|$)|notification-preferences$)/.test(
          path,
        )
      )
        throw fail(404, 'not_found');
      const user = await auth.authenticate(request);
      if (method === 'POST' && path === '/api/guest/merge')
        return send(response, 200, await platform.mergeGuest(user, await jsonBody(request)));
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
      if (path === '/api/recently-viewed') {
        if (method === 'GET')
          return send(response, 200, await platform.recent(user));
        if (method === 'POST')
          return send(response, 200, await platform.saveRecent(user, await jsonBody(request)));
      }
      if (path === '/api/push-tokens') {
        if (method === 'POST')
          return send(response, 200, await platform.savePushToken(user, await jsonBody(request)));
        if (method === 'DELETE')
          return send(response, 200, await platform.removePushToken(user, await jsonBody(request)));
      }
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
async function serveAdmin(response, mediaRoot) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end('<!doctype html><meta charset="utf-8"><title>MIG FARM Admin</title><body style="font-family:system-ui;padding:32px;background:#f6f4ef;color:#1f2a24"><h1>MIG FARM Admin Control Center</h1><p>The production Next.js admin dashboard lives in <code>admin-control-center</code> and is ready for Vercel deployment.</p></body>');
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
async function multipartBody(request) {
  const type = String(request.headers['content-type'] || ''),
    match = /multipart\/form-data;\s*boundary=([^;]+)/i.exec(type);
  if (!match) throw fail(400, 'invalid_multipart');
  const boundary = '--' + match[1].replace(/^"|"$/g, ''),
    raw = await readBody(request, 5 * 1024 * 1024 + 65536),
    parts = raw.toString('binary').split(boundary).slice(1, -1);
  const result = {};
  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, '').replace(/\r\n$/, ''),
      splitAt = trimmed.indexOf('\r\n\r\n');
    if (splitAt < 0) continue;
    const headerText = trimmed.slice(0, splitAt),
      bodyText = trimmed.slice(splitAt + 4),
      name = /name="([^"]+)"/.exec(headerText)?.[1];
    if (!name) continue;
    const filename = /filename="([^"]*)"/.exec(headerText)?.[1],
      contentType = /content-type:\s*([^\r\n]+)/i.exec(headerText)?.[1]?.trim();
    if (filename !== undefined)
      result.file = { filename, contentType, buffer: Buffer.from(bodyText, 'binary') };
    else result[name] = Buffer.from(bodyText, 'binary').toString('utf8');
  }
  return result;
}
async function rememberedFarmMutation(db, user, rawKey, method, path, operation) {
  if (!rawKey) return operation();
  if (Array.isArray(rawKey) || !/^[A-Za-z0-9._:-]{1,120}$/.test(rawKey))
    throw fail(400, 'invalid_idempotency_key');
  const previous = (
    await db.query(
      'SELECT response_json,method,path FROM mig_farm.farm_request_keys WHERE user_id=$1 AND request_key=$2',
      [user.id, rawKey],
    )
  ).rows[0];
  if (previous) {
    if (previous.method !== method || previous.path !== path)
      throw fail(409, 'idempotency_conflict');
    return typeof previous.response_json === 'string'
      ? JSON.parse(previous.response_json)
      : previous.response_json;
  }
  const result = await operation();
  await db.query(
    'INSERT INTO mig_farm.farm_request_keys(user_id,request_key,method,path,response_json) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,request_key) DO NOTHING',
    [user.id, rawKey, method, path, JSON.stringify(result)],
  );
  return result;
}
