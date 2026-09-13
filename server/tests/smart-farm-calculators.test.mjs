import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGreenhouseLayout,
  calculateIrrigationRuntime,
  calculatePlantPopulation,
  calculateRectangularArea,
  convertAreaToM2,
  estimateGrowthStage,
} from '../smart-farm/calculators.mjs';

test('area calculations preserve explicit units and reject invalid dimensions', () => {
  assert.equal(convertAreaToM2(1, 'hectare'), 10000);
  assert.equal(convertAreaToM2(1, 'acre'), 4046.856);
  assert.deepEqual(calculateRectangularArea({length:10,width:5,unit:'m'}).areaM2,50);
  assert.throws(()=>calculateRectangularArea({length:0,width:5,unit:'m'}),/invalid_length/);
  assert.throws(()=>convertAreaToM2(2,'unknown'),/invalid_area_unit/);
});

test('plant population uses only supplied or verified spacing and stays deterministic', () => {
  const result=calculatePlantPopulation({areaM2:100,rowSpacingCm:100,plantSpacingCm:50,plantsPerStation:1,usableAreaPercent:100,dataOrigin:'verified_profile'});
  assert.equal(result.stationCount,200);
  assert.equal(result.plantCount,200);
  assert.equal(result.resultType,'calculated_estimate');
  assert.throws(()=>calculatePlantPopulation({areaM2:100,rowSpacingCm:0,plantSpacingCm:50,dataOrigin:'user_supplied'}),/invalid_row_spacing/);
  assert.throws(()=>calculatePlantPopulation({areaM2:100,rowSpacingCm:100,plantSpacingCm:50,dataOrigin:'guessed'}),/missing_data_origin/);
});

test('layout and irrigation calculations expose their inputs without agronomic defaults', () => {
  const layout=calculateGreenhouseLayout({lengthM:10,widthM:10,bedWidthM:1,aisleWidthM:1});
  assert.equal(layout.bedCount,5);
  assert.equal(layout.growingAreaM2,50);
  assert.equal(layout.circulationAreaM2,50);
  const runtime=calculateIrrigationRuntime({targetVolumeLiters:1000,emitterFlowLitersPerHour:4,emitterCount:100});
  assert.equal(runtime.runtimeMinutes,150);
  assert.equal(runtime.advisory,false);
  assert.throws(()=>calculateIrrigationRuntime({targetVolumeLiters:1000,emitterFlowLitersPerHour:4,emitterCount:1.5}),/invalid_emitter_count/);
});

test('growth stage boundaries require a verified stage profile', () => {
  const stages=[{key:'seedling',startDay:0,endDay:10},{key:'vegetative',startDay:11,endDay:30}];
  assert.equal(estimateGrowthStage({plantingDate:'2026-01-01',asOfDate:'2026-01-12',stages}).stage.key,'vegetative');
  assert.equal(estimateGrowthStage({plantingDate:'2026-01-01',asOfDate:'2026-02-10',stages}).stage,null);
  assert.throws(()=>estimateGrowthStage({plantingDate:'2026-01-01',asOfDate:'2026-01-10',stages:[]}),/verified_stage_data_unavailable/);
});

