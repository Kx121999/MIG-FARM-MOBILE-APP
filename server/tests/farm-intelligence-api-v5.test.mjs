import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../db/migrate.mjs';
import { importKnowledge } from '../knowledge/import.mjs';
import { createApp } from '../src/app.mjs';

test('V5 Farm Intelligence API is verified, honest and owner-isolated', async (t) => {
  const engine = new PGlite();
  const wrap = (client) => ({ query: (sql, values) => values ? client.query(sql, values) : client.exec(sql).then((result) => result.at(-1)) });
  const db = { ...wrap(engine), transaction: (operation) => engine.transaction((tx) => operation(wrap(tx))) };
  t.after(() => engine.close());
  await migrate(db);
  await importKnowledge(db);
  const server = createApp({ db, catalog: { products: [], version: 'test' }, mediaRoot: fileURLToPath(new URL('../public/', import.meta.url)), stripe: { configured: false, verify: () => false } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, method = 'GET', body, token) => {
    const response = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const register = async (email) => (await request('/api/auth/register', 'POST', { name: 'V5 owner', email, password: 'MIG-farm-test-only!42', language: 'en' })).body;
  const owner = await register('v5-owner@example.test');
  const other = await register('v5-other@example.test');

  await t.test('public search, calculator and UAE records expose verified sources', async () => {
    const english = await request('/api/knowledge/v5/search?q=arugula');
    const arabic = await request('/api/knowledge/v5/search?q=' + encodeURIComponent('جرجير'));
    assert.equal(english.status, 200);
    assert.ok(english.body.items.some((item) => item.id === 'crop_profile:arugula'));
    assert.ok(arabic.body.items.some((item) => item.id === 'crop_profile:arugula'));
    assert.ok(english.body.items.every((item) => item.reviewStatus === 'verified' && item.sources.length));
    const population = await request('/api/farm-calculators/v5/population', 'POST', { crop: 'tomato', productionSystem: 'garden/open-field guide', areaM2: 100 });
    assert.equal(population.body.status, 'calculated_result');
    assert.deepEqual(population.body.populationRange, { min: 222, max: 357 });
    assert.ok(population.body.sources[0].url.startsWith('https://'));
    const legal = await request('/api/knowledge/v5/uae?kind=regulation');
    assert.equal(legal.status, 200);
    assert.ok(legal.body.items.length > 0);
    assert.ok(legal.body.items.every((item) => item.sources[0]?.organization));
    assert.match(legal.body.disclaimerEn, /Requirements may change/);
  });

  await t.test('private intelligence returns explicit provider states and no health fiction', async () => {
    const farm = (await request('/api/farms', 'POST', { name: 'V5 Farm', type: 'farm', area: 1000, areaUnit: 'm2' }, owner.accessToken)).body.farm;
    const zone = (await request(`/api/farms/${farm.id}/zones`, 'POST', { name: 'Field 1', type: 'open_field', area: 500, areaUnit: 'm2', irrigationSystem: 'drip' }, owner.accessToken)).body.zone;
    const crop = (await request('/api/crops', 'POST', { farmId: farm.id, zoneId: zone.id, cropName: 'arugula', plantingDate: new Date().toISOString().slice(0, 10), area: 300, areaUnit: 'm2', status: 'active', growthStage: 'seedling' }, owner.accessToken)).body.crop;
    const center = await request(`/api/my-farm/intelligence?farmId=${farm.id}&language=en`, 'GET', undefined, owner.accessToken);
    assert.equal(center.status, 200, JSON.stringify(center.body));
    assert.equal(center.body.healthScore, null);
    assert.equal(center.body.diagnosis, null);
    assert.equal(center.body.providerStatus.weather.status, 'not_configured');
    assert.equal(center.body.providerStatus.vision.status, 'not_configured');
    assert.equal(center.body.providerStatus.sensor.status, 'not_configured');
    assert.equal(center.body.cropStates[0].verifiedKnowledgeAvailability.status, 'verified_available');
    assert.equal(center.body.cropStates[0].expectedGrowthStage, null);
    assert.equal(center.body.cropStates[0].confirmedGrowthStage, null);
    assert.equal(center.body.cropStates[0].stageConfirmationRequired, false);
    assert.equal(center.body.risks.every((risk) => risk.diagnosis === null), true);
    const detail = await request(`/api/crops/${crop.id}/intelligence`, 'GET', undefined, owner.accessToken);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.cropState.cropId, crop.id);
    assert.equal((await request(`/api/my-farm/intelligence?farmId=${farm.id}`, 'GET', undefined, other.accessToken)).status, 404);
    assert.equal((await request(`/api/crops/${crop.id}/intelligence`, 'GET', undefined, other.accessToken)).status, 404);
    const stored = await db.query('SELECT count(*)::int count FROM mig_farm.farm_intelligence_snapshots WHERE user_id=$1 AND farm_id=$2', [owner.user.id, farm.id]);
    assert.ok(stored.rows[0].count >= 2);
  });
});
