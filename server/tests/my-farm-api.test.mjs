import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../db/migrate.mjs';
import { createApp } from '../src/app.mjs';

test('Smart My Farm OS API and ownership', async (t) => {
  const engine = new PGlite();
  const wrap = (client) => ({ query: (sql, values) => values ? client.query(sql, values) : client.exec(sql).then((result) => result.at(-1)) });
  const db = { ...wrap(engine), transaction: (operation) => engine.transaction((tx) => operation(wrap(tx))) };
  t.after(() => engine.close());
  await migrate(db);
  const server = createApp({ db, catalog: { products: [], version: 'test' }, mediaRoot: fileURLToPath(new URL('../public/', import.meta.url)), stripe: { configured:false, verify:()=>false } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, method='GET', body, token, headers={}) => {
    const response = await fetch(origin + path, { method, headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...headers }, body:body===undefined?undefined:JSON.stringify(body) });
    return { status:response.status, body:await response.json() };
  };
  const register = async (email) => (await request('/api/auth/register','POST',{ name:'Farm owner', email, password:'MIG-farm-test-only!42', language:'ar' })).body;
  const a=await register('farm-a@example.test'), b=await register('farm-b@example.test');
  let farm,zone,crop,problem;

  await t.test('requires auth, converts area canonically, isolates farms', async () => {
    assert.equal((await request('/api/farms')).status,401);
    const created=await request('/api/farms','POST',{ name:'Al Ain Farm', type:'farm', emirate:'Abu Dhabi', area:1, areaUnit:'acre' },a.accessToken);
    assert.equal(created.status,201); farm=created.body.farm;
    assert.equal(farm.area,1); assert.equal(farm.areaUnit,'acre'); assert.equal(farm.areaM2,4046.856);
    assert.equal((await request('/api/farms/'+farm.id,'GET',undefined,b.accessToken)).status,404);
    assert.equal((await request('/api/farms')).status,401);
    assert.equal((await request('/api/farms','GET',undefined,a.accessToken)).body.farms.length,1);
    assert.equal((await request('/api/farms','GET',undefined,b.accessToken)).body.farms.length,0);
  });

  await t.test('zones and crop cycles preserve hierarchy and history', async () => {
    let result=await request(`/api/farms/${farm.id}/zones`,'POST',{ name:'Greenhouse 1', type:'greenhouse', area:500, areaUnit:'m2', soilType:'sandy', irrigationSystem:'drip', waterSource:'tank' },a.accessToken);
    assert.equal(result.status,201); zone=result.body.zone;
    assert.equal((await request('/api/zones/'+zone.id,'PATCH',{ name:'Stolen' },b.accessToken)).status,404);
    result=await request('/api/crops','POST',{ farmId:farm.id, zoneId:zone.id, cropName:'Cucumber', variety:'Test variety', plantingDate:'2026-09-01', status:'active', growthStage:'vegetative' },a.accessToken);
    assert.equal(result.status,201); crop=result.body.crop;
    assert.equal((await request('/api/crops/'+crop.id,'GET',undefined,b.accessToken)).status,404);
    const completed=await request('/api/crops/'+crop.id+'/complete','POST',{ actualHarvestDate:'2026-12-01' },a.accessToken);
    assert.equal(completed.body.crop.status,'completed');
    crop=(await request('/api/crops/'+crop.id,'PATCH',{ status:'active', growthStage:'production' },a.accessToken)).body.crop;
  });

  await t.test('daily tasks, recurrence, completion, and owner isolation', async () => {
    const due=new Date(Date.now()-60_000).toISOString();
    const taskBody={ farmId:farm.id, zoneId:zone.id, cropCycleId:crop.id, type:'crop_inspection', title:'Inspect cucumber', dueAt:due, priority:'important', recurrenceRule:{frequency:'interval_days',interval:3} };
    let result=await request('/api/farm-tasks','POST',taskBody,a.accessToken,{'Idempotency-Key':'offline-task-1'});
    const task=result.body.task; assert.equal(result.status,201);
    const repeated=await request('/api/farm-tasks','POST',taskBody,a.accessToken,{'Idempotency-Key':'offline-task-1'});
    assert.equal(repeated.body.task.id,task.id);
    assert.equal((await request('/api/farm-tasks?view=overdue','GET',undefined,a.accessToken)).body.items.length,1);
    assert.equal((await request('/api/farm-tasks/'+task.id,'PATCH',{title:'Stolen'},b.accessToken)).status,404);
    result=await request('/api/farm-tasks/'+task.id+'/complete','POST',{ notes:'Leaves checked',actualMinutes:12,result:'No visible insects' },a.accessToken);
    assert.equal(result.body.task.status,'completed');
    const all=await request('/api/farm-tasks?view=all','GET',undefined,a.accessToken);
    assert.equal(all.body.items.length,2);
    assert.ok(all.body.items.some((item)=>item.status==='scheduled'));
  });

  await t.test('records facts without inventing agronomic recommendations', async () => {
    let result=await request('/api/irrigation-records','POST',{ farmId:farm.id, zoneId:zone.id, cropCycleId:crop.id, startedAt:new Date().toISOString(), durationMinutes:15, method:'drip', notes:'Pressure normal' },a.accessToken);
    assert.equal(result.status,201); assert.equal(result.body.record.waterVolumeLiters,null);
    result=await request('/api/farm-operations','POST',{ farmId:farm.id, zoneId:zone.id, cropCycleId:crop.id, type:'fertilization', performedAt:new Date().toISOString(), productNameSnapshot:'Recorded product', quantity:2, unit:'kg' },a.accessToken);
    assert.equal(result.body.operation.source,'user_recorded');
    assert.equal(result.body.operation.recommendation,undefined);
    assert.equal((await request('/api/irrigation-records?farmId='+farm.id,'GET',undefined,b.accessToken)).body.records.length,0);
  });

  await t.test('problem follow-up retains timeline, resolves and reopens', async () => {
    let result=await request('/api/farm-problems','POST',{ farmId:farm.id, zoneId:zone.id, cropCycleId:crop.id, category:'growth', title:'Yellow leaves', description:'Observed near last row', severity:'medium' },a.accessToken);
    problem=result.body.problem;
    assert.equal((await request('/api/farm-problems/'+problem.id,'GET',undefined,b.accessToken)).status,404);
    result=await request(`/api/farm-problems/${problem.id}/follow-up`,'POST',{ condition:'better',notes:'New leaves improved' },a.accessToken);
    assert.equal(result.body.problem.status,'improving');
    assert.equal((await request(`/api/farm-problems/${problem.id}/resolve`,'POST',{notes:'Resolved after monitoring'},a.accessToken)).body.problem.status,'resolved');
    assert.equal((await request(`/api/farm-problems/${problem.id}/reopen`,'POST',{notes:'Symptoms returned'},a.accessToken)).body.problem.status,'reopened');
    const detail=await request('/api/farm-problems/'+problem.id,'GET',undefined,a.accessToken);
    assert.equal(detail.body.updates.length,3);
    assert.equal((await request('/api/farm-media','POST',{farmId:farm.id,problemId:problem.id},a.accessToken)).body.error,'farm_media_storage_not_configured');
  });

  await t.test('inventory, actual analyses, and diagnosis records stay private and explicit', async () => {
    const inventory=await request('/api/farm-inventory','POST',{farmId:farm.id,productNameSnapshot:'Owned fertilizer',category:'fertilizer',quantity:2,unit:'bag'},a.accessToken);
    assert.equal(inventory.status,201);
    assert.equal((await request('/api/farm-inventory?farmId='+farm.id,'GET',undefined,b.accessToken)).status,404);
    const analysis=await request('/api/farm-analyses','POST',{farmId:farm.id,zoneId:zone.id,type:'soil',sampledAt:'2026-09-02',labName:'User lab',results:{pH:7.1,EC:1.2}},a.accessToken);
    assert.equal(analysis.body.analysis.results.pH,7.1);
    assert.equal((await request('/api/farm-analyses','POST',{farmId:farm.id,type:'soil',sampledAt:'2026-09-02',document:'local-file'},a.accessToken)).body.error,'farm_media_storage_not_configured');
    const diagnosis=await request('/api/diagnosis-sessions','POST',{farmId:farm.id,zoneId:zone.id,cropCycleId:crop.id,problemId:problem.id,observations:['Yellowing was reported'],questions:['Old or new leaves?'],answers:{leafAge:'old'},possibleCauses:['More than one cause remains possible'],recommendedInspections:['Inspect leaf undersides']},a.accessToken);
    assert.equal(diagnosis.status,201);
    assert.equal(diagnosis.body.session.verifiedDiagnosis,null);
    assert.equal((await request(`/api/farm-problems/${problem.id}/diagnoses`,'GET',undefined,a.accessToken)).body.sessions.length,1);
    assert.equal((await request(`/api/farm-problems/${problem.id}/diagnoses`,'GET',undefined,b.accessToken)).status,404);
  });

  await t.test('harvest, crop timeline, search, report and dashboard are factual', async () => {
    const harvest=await request('/api/harvest-records','POST',{ farmId:farm.id,zoneId:zone.id,cropCycleId:crop.id,harvestedAt:new Date().toISOString(),quantity:25,unit:'kg',qualityNotes:'User recorded' },a.accessToken);
    assert.equal(harvest.status,201);
    const timeline=await request('/api/crops/'+crop.id+'/timeline','GET',undefined,a.accessToken);
    assert.ok(timeline.body.timeline.some((item)=>item.eventType==='harvest_recorded'));
    assert.ok(timeline.body.timeline.some((item)=>item.eventType==='problem_opened'));
    assert.equal((await request('/api/my-farm/search?q=Yellow','GET',undefined,a.accessToken)).body.problems.length,1);
    const report=await request('/api/my-farm/report?farmId='+farm.id+'&from=2026-01-01&to=2026-12-31','GET',undefined,a.accessToken);
    assert.equal(report.body.facts.harvests[0].quantity,25);
    assert.equal(report.body.facts.irrigations,1);
    assert.equal(report.body.facts.tasksCompleted,1);
    assert.equal(report.body.facts.problemsResolved,1);
    assert.equal(report.body.facts.tasks_completed,undefined);
    assert.equal(report.body.labels.ai,'ai_observation');
    const dashboard=await request('/api/my-farm/dashboard','GET',undefined,a.accessToken);
    assert.equal(dashboard.body.farms.length,1);
    assert.equal(dashboard.body.weather.available,false);
    assert.equal(dashboard.body.weather.reason,'weather_provider_not_configured');
    assert.equal((await request('/api/my-farm/dashboard','GET',undefined,b.accessToken)).body.farms.length,0);
  });

  await t.test('foreign keys and soft delete prevent accidental orphan exposure', async () => {
    assert.equal((await request('/api/farms/'+farm.id,'DELETE',undefined,b.accessToken)).status,404);
    assert.equal((await request('/api/farms/'+farm.id,'DELETE',undefined,a.accessToken)).status,200);
    assert.equal((await request('/api/farms/'+farm.id,'GET',undefined,a.accessToken)).status,404);
    assert.equal((await request('/api/crops/'+crop.id,'GET',undefined,a.accessToken)).status,404);
    const stored=(await db.query('SELECT status FROM mig_farm.crop_cycles WHERE id=$1',[crop.id])).rows[0];
    assert.equal(stored.status,'active');
  });
});
