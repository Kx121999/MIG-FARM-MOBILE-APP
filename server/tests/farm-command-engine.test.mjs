import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCropMission,
  buildDailyPriorities,
  buildSeasonReport,
  buildWeeklyFarmReport,
  evaluateGrowthStage,
  evaluateHarvestStatus,
  evaluateIrrigationStatus,
  evaluateTasks,
} from '../farm-command/engine.mjs';
import { createWeatherProvider } from '../farm-command/weather.mjs';

const now=new Date('2026-09-12T12:00:00Z');

test('priority engine is deterministic and sorts critical before normal work',()=>{
  const tasks=[
    {id:'future',farmId:'farm',title:'Future',dueAt:'2026-09-15T12:00:00Z',status:'scheduled',priority:'normal'},
    {id:'today',farmId:'farm',title:'Today',dueAt:'2026-09-12T08:00:00Z',status:'scheduled',priority:'normal'},
    {id:'late',farmId:'farm',title:'Late',dueAt:'2026-09-09T08:00:00Z',status:'scheduled',priority:'normal'},
    {id:'done',farmId:'farm',title:'Done',dueAt:'2026-09-01T08:00:00Z',status:'completed',priority:'urgent'},
  ];
  const evaluated=evaluateTasks(tasks,now);
  assert.equal(evaluated.find((item)=>item.entityId==='late').priority,'critical');
  assert.equal(evaluated.find((item)=>item.entityId==='today').priority,'normal');
  assert.equal(evaluated.some((item)=>item.entityId==='done'),false);
  const priorities=buildDailyPriorities({tasks,problems:[],missions:[]},now);
  assert.deepEqual(priorities.map((item)=>item.entityId),['late','today']);
});

test('irrigation engine reports recording gaps only after enough history',()=>{
  const sparse=evaluateIrrigationStatus([{startedAt:'2026-09-01T00:00:00Z'}],{now,farmId:'farm',cropCycleId:'crop'});
  assert.equal(sparse.status,'good');
  assert.equal(sparse.averageIntervalDays,null);
  const history=['2026-08-29','2026-08-27','2026-08-25','2026-08-23'].map((date,index)=>index%2?{started_at:`${date}T00:00:00Z`}:{startedAt:`${date}T00:00:00Z`});
  const gap=evaluateIrrigationStatus(history,{now,farmId:'farm',cropCycleId:'crop'});
  assert.equal(gap.status,'attention');
  assert.equal(gap.averageIntervalDays,2);
  assert.equal(gap.action.kind,'irrigation_record_gap');
  assert.doesNotMatch(gap.observationEn,/dehydrat|thirst|needs water/i);
});

test('growth stage remains unavailable without verified profiles and future planting is not aged',()=>{
  const unavailable=evaluateGrowthStage({crop:{plantingDate:'2026-09-01'},stageProfiles:[],confirmations:[],now});
  assert.equal(unavailable.expected,null);
  assert.equal(unavailable.verifiedGuidanceAvailable,false);
  const future=evaluateGrowthStage({crop:{plantingDate:'2026-10-01'},stageProfiles:[{key:'seedling',nameAr:'شتلة',nameEn:'Seedling',startDay:0,endDay:10,status:'verified'}],confirmations:[],now});
  assert.equal(future.ageDays,null);
  assert.equal(future.expected,null);
});

test('harvest readiness requires a verified stage or an actual harvest record',()=>{
  const unavailable=evaluateHarvestStatus({crop:{id:'crop',farmId:'farm',status:'active'},stage:{expected:null,next:null},harvests:[],now});
  assert.equal(unavailable.status,'no_data');assert.equal(unavailable.action,null);
  const verified=evaluateHarvestStatus({crop:{id:'crop',farmId:'farm',status:'active'},stage:{expected:null,next:{key:'harvest',expectedAt:'2026-09-15T00:00:00Z'}},harvests:[],now});
  assert.equal(verified.status,'attention');assert.equal(verified.action.kind,'harvest_window');assert.equal(verified.action.source,'verified_knowledge_and_farm_record');
  const actual=evaluateHarvestStatus({crop:{id:'crop',farmId:'farm',status:'active'},stage:{expected:null,next:null},harvests:[{harvestedAt:'2026-09-10T00:00:00Z'}],now});
  assert.equal(actual.status,'good');assert.ok(actual.actualStart);
});

test('mission and reports use only recorded values and compatible units',()=>{
  const mission=buildCropMission({
    crop:{id:'crop',farmId:'farm',cropName:'Tomato',plantingDate:'2026-09-01',areaM2:100,status:'active'},
    farm:{id:'farm',name:'Farm',areaM2:500},zone:{id:'zone',name:'Field'},tasks:[],problems:[],irrigations:[],operations:[],photos:[],stageProfiles:[],confirmations:[],
    harvests:[{quantity:20,unit:'kg'}],expenses:[{amountMinor:1000}],sales:[{totalMinor:2500}],
  },now);
  assert.equal(mission.financials.grossMarginMinor,1500);
  assert.equal(mission.harvest.totals[0].quantity,20);
  const season=buildSeasonReport({crop:{id:'crop',plantingDate:'2026-09-01',actualHarvestDate:'2026-09-11',areaM2:10},stageConfirmations:[],irrigations:[],problems:[],harvests:[{quantity:20,unit:'kg'}],expenses:[{amountMinor:1000}],sales:[{totalMinor:2500}],notes:[]});
  assert.equal(season.yieldPerM2Kg,2);
  assert.equal(season.costPerKgMinor,50);
  const mixed=buildSeasonReport({crop:{id:'crop',areaM2:10},stageConfirmations:[],irrigations:[],problems:[],harvests:[{quantity:20,unit:'kg'},{quantity:2,unit:'box'}],expenses:[],sales:[],notes:[]});
  assert.equal(mixed.yieldPerM2Kg,null);
  assert.equal(mixed.costPerKgMinor,null);
  const weekly=buildWeeklyFarmReport({period:{from:'2026-09-06',to:'2026-09-12'},tasks:[],irrigations:[],operations:[],problems:[],problemUpdates:[],stageConfirmations:[],photos:[],harvests:[],expenses:[{amount_minor:500}],sales:[{total_minor:900}]});
  assert.equal(weekly.salesMinor-weekly.expensesMinor,400);
});

test('weather abstraction never fabricates observations when provider is missing',async()=>{
  const provider=createWeatherProvider({});
  const result=await provider.current({farms:[]});
  assert.equal(provider.configured,false);
  assert.equal(result.weatherStatus,'not_configured');
  assert.equal(result.observations,null);
});
