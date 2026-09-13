import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectIrrigationIntervalAnomaly } from '../farm-intelligence/anomaly-engine.mjs';
import { dataFreshness, evaluateConfidence } from '../farm-intelligence/confidence.mjs';
import { forecastHarvest, forecastYield } from '../farm-intelligence/forecast-engine.mjs';
import { calculateEtc, calculateIrrigationRuntime, calculateWaterVolume } from '../farm-intelligence/irrigation-engine.mjs';
import { createSensorProvider, createVisionProvider, createWeatherProvider } from '../farm-intelligence/providers.mjs';
import { buildRisks, pesticideSafetyGate } from '../farm-intelligence/risk-engine.mjs';

test('V5 calculators require real or verified inputs', () => {
  assert.equal(calculateEtc({ eto: { value: 5, source: 'model_memory' }, kc: { value: 0.8, reviewStatus: 'verified', productionAllowed: true }, crop: 'x', growthStage: 'mid' }).status, 'verified_data_unavailable');
  const etc = calculateEtc({ eto: { value: 5, source: 'real_weather', sourceIds: ['weather'] }, kc: { value: 0.8, crop: 'x', growthStage: 'mid', reviewStatus: 'verified', productionAllowed: true, sourceIds: ['fao'] }, crop: 'x', growthStage: 'mid' });
  assert.equal(etc.etcMm, 4);
  assert.equal(calculateWaterVolume({ irrigationDepthMm: 4, irrigatedAreaM2: 125 }).liters, 500);
  assert.equal(calculateIrrigationRuntime({ requiredLiters: 500, emitterFlowLph: 4, emitterCount: 50 }).status, 'verified_data_unavailable');
  assert.equal(calculateIrrigationRuntime({ requiredLiters: 500, emitterFlowLph: 4, emitterCount: 50, systemEfficiency: 0.8 }).runtimeHours, 3.125);
});

test('providers never fabricate missing weather, vision or sensors', async () => {
  const weather = await createWeatherProvider({}).status();
  const vision = await createVisionProvider({}).analyze({ image: 'private' });
  const sensor = await createSensorProvider({}).status();
  assert.equal(weather.status, 'not_configured');
  assert.equal(vision.status, 'not_configured');
  assert.equal(vision.diagnosis, null);
  assert.equal(sensor.status, 'not_configured');
});

test('anomalies and risks remain checks, never diagnoses', () => {
  const now = new Date('2026-09-13T00:00:00Z');
  const records = [2, 4, 6, 8].map((days, index) => ({ id: String(index), startedAt: new Date(now.getTime() - days * 86_400_000).toISOString() }));
  const anomaly = detectIrrigationIntervalAnomaly(records, new Date('2026-09-20T00:00:00Z'));
  assert.ok(anomaly);
  assert.equal(anomaly.agronomicConclusion, null);
  assert.equal(anomaly.evidence.basis, 'YOUR_FARM_HISTORY');
  const risks = buildRisks({ command: { priorities: [] }, anomalies: [anomaly], providerStatus: { weather: { status: 'not_configured' } }, now });
  assert.ok(risks.every((risk) => risk.diagnosis === null && risk.classification === 'risk_not_diagnosis'));
});

test('forecasts expose provenance and stop when evidence is insufficient', () => {
  assert.equal(forecastYield({ areaM2: 100, plantPopulation: 200 }).status, 'insufficient_data');
  const harvest = forecastHarvest({ plantingDate: '2026-09-01', verifiedReference: { harvestReference: '40-50 days', reviewStatus: 'verified', productionAllowed: true, sourceIds: ['UAE'] } });
  assert.equal(harvest.status, 'forecast_available');
  assert.deepEqual(harvest.basedOn, ['verified_reference']);
  assert.equal(harvest.exactDate, null);
});

test('pesticide gate blocks incomplete labels and confidence/freshness are explicit', () => {
  assert.equal(pesticideSafetyGate({ labelVerified: true }).status, 'blocked');
  const allowed = pesticideSafetyGate({ labelVerified: true, uaeRegistrationReference: 'verified-ref', targetCropOnLabel: 'crop', targetPestOnLabel: 'pest', verifiedLabelRate: 'label-rate', phi: 'label-phi', rei: 'label-rei' });
  assert.equal(allowed.status, 'label_information_available');
  assert.equal(allowed.recommendation, null);
  assert.equal(evaluateConfidence().level, 'INSUFFICIENT_DATA');
  assert.equal(evaluateConfidence({ verifiedSources: 1, observations: 5, completeness: 'good' }).level, 'HIGH');
  assert.equal(dataFreshness('2026-09-12T23:00:00Z', new Date('2026-09-13T00:00:00Z')).status, 'fresh');
  assert.equal(dataFreshness('2026-09-12T00:00:00Z', new Date('2026-09-13T00:00:00Z')).status, 'stale');
});
