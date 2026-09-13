import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../db/migrate.mjs';
import { createApp } from '../src/app.mjs';

test('verified Smart Farm knowledge, calculators and plan ownership', async (t) => {
  const engine=new PGlite();
  const wrap=(client)=>({query:(sql,values)=>values?client.query(sql,values):client.exec(sql).then(result=>result.at(-1))});
  const db={...wrap(engine),transaction:(operation)=>engine.transaction(tx=>operation(wrap(tx)))};
  t.after(()=>engine.close());
  await migrate(db);
  await db.query(`INSERT INTO mig_farm.crop_profiles
    (id,slug,name_ar,name_en,scientific_name,summary_ar,summary_en,production_systems,source_id,reviewed_at,status)
    VALUES
    ('83000000-0000-4000-8000-000000000001','verified-test-crop','محصول اختبار موثق','Verified test crop','Testus verified','ملف اختبار فقط','Test fixture only','["greenhouse"]','81000000-0000-4000-8000-000000000001','2026-09-12T00:00:00Z','verified'),
    ('83000000-0000-4000-8000-000000000002','draft-test-crop','مسودة اختبار','Draft test crop',NULL,'','','[]','81000000-0000-4000-8000-000000000001',NULL,'draft')`);
  await db.query(`INSERT INTO mig_farm.crop_spacing_profiles
    (id,crop_profile_id,production_system,planting_method,row_spacing_cm,plant_spacing_cm,plants_per_station,usable_area_percent,source_id,reviewed_at,status)
    VALUES('84000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','greenhouse','transplant',100,50,1,100,'81000000-0000-4000-8000-000000000001','2026-09-12T00:00:00Z','verified')`);
  await db.query(`INSERT INTO mig_farm.symptom_rules
    (id,crop_profile_id,cause_type,symptom_keys,possible_cause_ar,possible_cause_en,inspection_checks_ar,inspection_checks_en,source_id,reviewed_at,status)
    VALUES('85000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','environment','["yellowing"]','احتمال اختبار يحتاج فحصًا','Test possibility requiring inspection','["افحص السجل"]','["Check the record"]','81000000-0000-4000-8000-000000000001','2026-09-12T00:00:00Z','verified')`);
  await db.query(`INSERT INTO mig_farm.crop_task_templates
    (id,crop_profile_id,production_system,planting_method,growth_stage_key,task_type,offset_days,due_time_local,title_ar,title_en,description_ar,description_en,source_id,reviewed_at,status)
    VALUES('86000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','greenhouse','transplant','seedling','crop_inspection',2,'09:00:00','مهمة اختبار موثقة','Verified test task','للاختبار فقط','Test fixture only','81000000-0000-4000-8000-000000000001','2026-09-12T00:00:00Z','verified')`);

  const server=createApp({db,catalog:{products:[],version:'test'},mediaRoot:fileURLToPath(new URL('../public/',import.meta.url)),stripe:{configured:false,verify:()=>false}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const request=async(path,method='GET',body,token)=>{const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,body:await response.json()};};

  await t.test('public knowledge filters drafts and includes source metadata',async()=>{
    const crops=await request('/api/knowledge/crops');
    assert.equal(crops.status,200);assert.equal(crops.body.verifiedOnly,true);assert.equal(crops.body.crops.length,1);
    assert.equal(crops.body.crops[0].slug,'verified-test-crop');assert.equal(crops.body.crops[0].source.status,'verified');assert.ok(crops.body.crops[0].source.url.startsWith('https://'));
    assert.equal((await request('/api/knowledge/crops/draft-test-crop')).status,404);
    const regulations=await request('/api/knowledge/uae/regulations');
    assert.equal(regulations.body.regulations.length,3);assert.ok(regulations.body.regulations.every(item=>item.source.reviewedAt));
  });

  await t.test('calculators distinguish verified profiles and user-supplied values',async()=>{
    const verified=await request('/api/farm-calculators/planting','POST',{areaM2:100,spacingProfileId:'84000000-0000-4000-8000-000000000001'});
    assert.equal(verified.body.result.plantCount,200);assert.equal(verified.body.result.dataOrigin,'verified_profile');assert.equal(verified.body.profile.source.status,'verified');
    const supplied=await request('/api/farm-calculators/planting','POST',{areaM2:100,rowSpacingCm:100,plantSpacingCm:50});
    assert.equal(supplied.body.result.dataOrigin,'user_supplied');assert.match(supplied.body.warning,/not an agronomic recommendation/);
    const irrigation=await request('/api/farm-calculators/irrigation','POST',{targetVolumeLiters:1000,emitterFlowLitersPerHour:4,emitterCount:100});
    assert.equal(irrigation.body.result.runtimeMinutes,150);assert.equal(irrigation.body.result.advisory,false);
  });

  await t.test('guided diagnosis returns possibilities, never a confirmed diagnosis',async()=>{
    const result=await request('/api/diagnosis/guide','POST',{cropSlug:'verified-test-crop',symptoms:['yellowing']});
    assert.equal(result.status,200);assert.equal(result.body.status,'possible_causes_found');assert.equal(result.body.diagnosis,null);assert.equal(result.body.possibleCauses[0].source.status,'verified');
    const noMatch=await request('/api/diagnosis/guide','POST',{symptoms:['unknown-test-sign']});
    assert.equal(noMatch.body.status,'no_verified_match');assert.deepEqual(noMatch.body.possibleCauses,[]);
  });

  await t.test('crop plans require authentication and remain owner-isolated',async()=>{
    const register=async(email)=>(await request('/api/auth/register','POST',{name:'Plan owner',email,password:'MIG-farm-test-only!42',language:'en'})).body;
    const a=await register('plan-a@example.test'),b=await register('plan-b@example.test');
    const farm=(await request('/api/farms','POST',{name:'Plan farm',type:'greenhouse',area:100,areaUnit:'m2'},a.accessToken)).body.farm;
    const body={farmId:farm.id,cropProfileId:'83000000-0000-4000-8000-000000000001',spacingProfileId:'84000000-0000-4000-8000-000000000001',plantingDate:'2026-10-01',areaM2:100,productionSystem:'greenhouse',plantingMethod:'transplant'};
    assert.equal((await request('/api/crop-plans','POST',body)).status,401);
    const created=await request('/api/crop-plans','POST',body,a.accessToken);
    assert.equal(created.status,201);assert.equal(created.body.plan.calculation.plantCount,200);assert.ok(created.body.plan.cropCycleId);assert.equal(created.body.generatedTasks,1);
    const tasks=await request(`/api/farm-tasks?view=all&farmId=${farm.id}`,'GET',undefined,a.accessToken);
    assert.equal(tasks.body.items.length,1);assert.equal(tasks.body.items[0].source,'system');assert.equal(tasks.body.items[0].title,'Verified test task');
    assert.equal((await request(`/api/crop-plans/${created.body.plan.id}`,'GET',undefined,b.accessToken)).status,404);
    assert.equal((await request(`/api/crop-plans/${created.body.plan.id}`,'GET',undefined,a.accessToken)).body.plan.farmId,farm.id);
  });
});
