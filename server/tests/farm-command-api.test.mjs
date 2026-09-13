import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../db/migrate.mjs';
import { createApp } from '../src/app.mjs';

test('Farm Command Center API is factual, adaptive and owner-isolated',async(t)=>{
  const engine=new PGlite();
  const wrap=(client)=>({query:(sql,values)=>values?client.query(sql,values):client.exec(sql).then((result)=>result.at(-1))});
  const db={...wrap(engine),transaction:(operation)=>engine.transaction((tx)=>operation(wrap(tx)))};
  t.after(()=>engine.close());
  await migrate(db);
  const server=createApp({db,catalog:{products:[],version:'test'},mediaRoot:fileURLToPath(new URL('../public/',import.meta.url)),stripe:{configured:false,verify:()=>false}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise((resolve)=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const request=async(path,method='GET',body,token,headers={})=>{const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...headers},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,body:await response.json()};};
  const register=async(email)=>(await request('/api/auth/register','POST',{name:'Command owner',email,password:'MIG-farm-test-only!42',language:'en'})).body;
  const owner=await register('command-owner@example.test'),other=await register('command-other@example.test');
  const date=(offset)=>new Date(Date.now()+offset*86_400_000).toISOString();
  const day=(offset)=>date(offset).slice(0,10);
  let farm,zone,crop,problem,futureTaskId;

  await t.test('empty and protected states are explicit',async()=>{
    assert.equal((await request('/api/my-farm/today')).status,401);
    const empty=await request('/api/my-farm/command-center','GET',undefined,owner.accessToken);
    assert.equal(empty.status,200);assert.equal(empty.body.emptyState,'plan_first_crop');assert.equal(empty.body.weather.weatherStatus,'not_configured');assert.deepEqual(empty.body.missions,[]);
  });

  await t.test('today view ranks real records and irrigation history gaps',async()=>{
    farm=(await request('/api/farms','POST',{name:'Command Farm',type:'farm',area:1000,areaUnit:'m2'},owner.accessToken)).body.farm;
    zone=(await request(`/api/farms/${farm.id}/zones`,'POST',{name:'Field A',type:'open_field',area:500,areaUnit:'m2',irrigationSystem:'drip'},owner.accessToken)).body.zone;
    crop=(await request('/api/crops','POST',{farmId:farm.id,zoneId:zone.id,cropName:'Verified command crop',plantingDate:day(-10),area:300,areaUnit:'m2',status:'active',growthStage:'seedling'},owner.accessToken)).body.crop;
    await request('/api/farm-tasks','POST',{farmId:farm.id,zoneId:zone.id,cropCycleId:crop.id,type:'crop_inspection',title:'Overdue inspection',dueAt:date(-3),priority:'important'},owner.accessToken);
    problem=(await request('/api/farm-problems','POST',{farmId:farm.id,zoneId:zone.id,cropCycleId:crop.id,category:'growth',title:'Recorded severe issue',severity:'severe',firstObservedAt:date(-1)},owner.accessToken)).body.problem;
    for(const offset of [-14,-16,-18,-20])await request('/api/irrigation-records','POST',{farmId:farm.id,zoneId:zone.id,cropCycleId:crop.id,startedAt:date(offset),method:'drip'},owner.accessToken);
    const today=await request(`/api/my-farm/today?farmId=${farm.id}`,'GET',undefined,owner.accessToken);
    assert.equal(today.status,200);assert.equal(today.body.missions.length,1);assert.equal(today.body.missions[0].irrigation.status,'attention');
    assert.equal(today.body.topActions[0].priority,'critical');
    assert.ok(today.body.topActions.some((item)=>item.kind==='irrigation_record_gap'));
    assert.doesNotMatch(today.body.missions[0].irrigation.observationEn,/dehydrat|thirst|needs water/i);
    assert.equal((await request(`/api/my-farm/today?farmId=${farm.id}`,'GET',undefined,other.accessToken)).status,404);
  });

  await t.test('verified stage confirmation shifts future system tasks only',async()=>{
    await db.query(`INSERT INTO mig_farm.crop_profiles(id,slug,name_ar,name_en,summary_ar,summary_en,production_systems,source_id,reviewed_at,status)
      VALUES('93000000-0000-4000-8000-000000000001','command-test-crop','محصول اختبار القيادة','Command test crop','','','["open_field"]','81000000-0000-4000-8000-000000000001',now(),'verified')`);
    await db.query(`INSERT INTO mig_farm.crop_growth_stages(id,crop_profile_id,stage_key,name_ar,name_en,start_day,end_day,source_id,reviewed_at,status) VALUES
      ('93100000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','seedling','شتلة','Seedling',0,20,'81000000-0000-4000-8000-000000000001',now(),'verified'),
      ('93100000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','vegetative','نمو خضري','Vegetative',21,45,'81000000-0000-4000-8000-000000000001',now(),'verified')`);
    await db.query(`INSERT INTO mig_farm.crop_plans(id,user_id,farm_id,zone_id,crop_profile_id,crop_cycle_id,planting_date,area_m2,production_system,planting_method)
      VALUES('93200000-0000-4000-8000-000000000001',$1,$2,$3,'93000000-0000-4000-8000-000000000001',$4,$5,300,'open_field','direct_sow')`,[owner.user.id,farm.id,zone.id,crop.id,day(-10)]);
    futureTaskId='93300000-0000-4000-8000-000000000001';
    await db.query(`INSERT INTO mig_farm.farm_tasks(id,user_id,farm_id,zone_id,crop_cycle_id,crop_plan_id,type,title,due_at,status,priority,source,original_due_at)
      VALUES($1,$2,$3,$4,$5,'93200000-0000-4000-8000-000000000001','crop_inspection','Future verified inspection',$6,'scheduled','normal','system',$6)`,[futureTaskId,owner.user.id,farm.id,zone.id,crop.id,date(3)]);
    const before=(await db.query('SELECT due_at FROM mig_farm.farm_tasks WHERE id=$1',[futureTaskId])).rows[0].due_at;
    const confirmation=await request(`/api/crops/${crop.id}/stage-confirmation`,'POST',{stageKey:'seedling',confirmedAt:new Date().toISOString()},owner.accessToken,{'Idempotency-Key':'stage-confirmation-1'});
    assert.equal(confirmation.status,200,JSON.stringify(confirmation.body));assert.equal(confirmation.body.adaptation,'future_verified_tasks_shifted');assert.equal(confirmation.body.adjustedTasks,1);
    const after=(await db.query('SELECT due_at,schedule_adjustment_days FROM mig_farm.farm_tasks WHERE id=$1',[futureTaskId])).rows[0];
    assert.ok(new Date(after.due_at)>new Date(before));assert.ok(after.schedule_adjustment_days>=9);
    assert.equal((await request(`/api/crops/${crop.id}/stage-confirmation`,'POST',{stageKey:'seedling'},other.accessToken)).status,404);
  });

  await t.test('check-in, follow-up and timeline retain authoritative events',async()=>{
    const checkin=await request(`/api/crops/${crop.id}/check-in`,'POST',{date:day(0),answers:{irrigated:'yes',stageStarted:'yes',newProblem:'no'},notes:'Observed by owner'},owner.accessToken,{'Idempotency-Key':'checkin-1'});
    assert.equal(checkin.status,200);assert.equal(checkin.body.checkIn.answers.newProblem,'no');
    const follow=await request(`/api/problems/${problem.id}/follow-up`,'POST',{condition:'same',notes:'Still monitoring'},owner.accessToken);
    assert.equal(follow.body.problem.status,'monitoring');assert.ok(follow.body.problem.nextFollowUpAt);
    const timeline=await request(`/api/crops/${crop.id}/timeline`,'GET',undefined,owner.accessToken);
    assert.ok(timeline.body.timeline.some((item)=>item.eventType==='checkin_recorded'));
    assert.ok(timeline.body.timeline.some((item)=>item.eventType==='stage_confirmed'));
    assert.ok(timeline.body.timeline.some((item)=>item.eventType==='problem_updated'));
    assert.equal((await request(`/api/crops/${crop.id}/timeline`,'GET',undefined,other.accessToken)).status,404);
  });

  await t.test('finance, inventory and reports use recorded amounts only',async()=>{
    const expense=await request('/api/farm-expenses','POST',{farmId:farm.id,cropCycleId:crop.id,category:'labor',amount:125.5,currency:'AED',date:day(0)},owner.accessToken);
    const sale=await request('/api/farm-sales','POST',{farmId:farm.id,cropCycleId:crop.id,quantity:10,unit:'kg',unitPrice:20,currency:'AED',date:day(0)},owner.accessToken);
    assert.equal(expense.body.expense.amountMinor,12550);assert.equal(sale.body.sale.totalMinor,20000);
    const expenses=await request(`/api/farm-expenses?farmId=${farm.id}&cropId=${crop.id}`,'GET',undefined,owner.accessToken);
    assert.equal(expenses.body.totalMinor,12550);
    assert.equal((await request(`/api/farm-sales?farmId=${farm.id}`,'GET',undefined,other.accessToken)).status,404);
    const inventory=await request('/api/farm-inventory','POST',{farmId:farm.id,productNameSnapshot:'Recorded stock',category:'equipment',quantity:2,minimumQuantity:3,expiresAt:day(20),unit:'piece'},owner.accessToken);
    assert.equal(inventory.body.item.status,'low_stock');assert.equal(inventory.body.item.minimumQuantity,3);
    const weekly=await request(`/api/farms/${farm.id}/weekly-report`,'GET',undefined,owner.accessToken);
    assert.equal(weekly.status,200);assert.equal(weekly.body.report.expensesMinor,12550);assert.equal(weekly.body.report.salesMinor,20000);assert.equal(weekly.body.comparison,null);
    const season=await request(`/api/crops/${crop.id}/season-report`,'GET',undefined,owner.accessToken);
    assert.equal(season.status,200);assert.equal(season.body.stored,false);assert.equal(season.body.report.grossMarginMinor,7450);
    const history=await request(`/api/farms/${farm.id}/seasons`,'GET',undefined,owner.accessToken);
    assert.equal(history.status,200);assert.deepEqual(history.body.seasons,[]);
    assert.equal((await request(`/api/farms/${farm.id}/seasons`,'GET',undefined,other.accessToken)).status,404);
    const completed=await request(`/api/crops/${crop.id}/complete`,'POST',{actualHarvestDate:day(0)},owner.accessToken);
    assert.equal(completed.status,200);assert.equal(completed.body.crop.status,'completed');
    const storedSeason=await request(`/api/crops/${crop.id}/season-report`,'GET',undefined,owner.accessToken);
    assert.equal(storedSeason.status,200);assert.equal(storedSeason.body.stored,true);assert.equal(storedSeason.body.report.grossMarginMinor,7450);
    const storedHistory=await request(`/api/farms/${farm.id}/seasons`,'GET',undefined,owner.accessToken);
    assert.equal(storedHistory.status,200);assert.equal(storedHistory.body.seasons.length,1);assert.equal(storedHistory.body.seasons[0].cropCycleId,crop.id);
  });

  await t.test('agronomist escalation prepares a private case without fake delivery',async()=>{
    const result=await request(`/api/problems/${problem.id}/escalate`,'POST',{},owner.accessToken);
    assert.equal(result.status,201);assert.equal(result.body.escalation.status,'prepared');assert.equal(result.body.escalation.deliveryStatus,'provider_not_configured');
    assert.equal(result.body.escalation.casePackage.problem.id,problem.id);
    assert.equal((await request(`/api/problems/${problem.id}/escalate`,'POST',{},other.accessToken)).status,404);
    const stored=(await db.query('SELECT status,delivery_provider FROM mig_farm.agronomist_escalations WHERE id=$1',[result.body.escalation.id])).rows[0];
    assert.equal(stored.status,'prepared');assert.equal(stored.delivery_provider,null);
  });
});
