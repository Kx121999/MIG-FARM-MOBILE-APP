import { evaluateConfidence } from './confidence.mjs';

const DAY = 86_400_000;

export function forecastHarvest({ plantingDate, verifiedReference, confirmedStage = null, farmHistory = [], now = new Date() } = {}) {
  if (!plantingDate || !verifiedReference || verifiedReference.reviewStatus !== 'verified' || verifiedReference.productionAllowed !== true || verifiedReference.synthetic === true) return insufficient('verified_harvest_reference_missing');
  const range = parseDayRange(verifiedReference.harvestReference || verifiedReference.harvest_reference);
  if (!range) return insufficient('verified_harvest_window_unavailable');
  const planted = new Date(`${String(plantingDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(planted.getTime())) return insufficient('planting_date_missing');
  let adjustmentDays = 0;
  const basedOn = ['verified_reference'];
  if (confirmedStage?.adjustmentDays !== undefined && Number.isFinite(Number(confirmedStage.adjustmentDays))) {
    adjustmentDays = Number(confirmedStage.adjustmentDays);
    basedOn.push('confirmed_stage');
  }
  const historicalDurations = farmHistory.map((item) => Number(item.seasonDurationDays)).filter((value) => Number.isFinite(value) && value > 0);
  if (historicalDurations.length >= 3) basedOn.push('farm_history');
  return {
    status: 'forecast_available',
    expectedWindow: {
      from: new Date(planted.getTime() + (range.min + adjustmentDays) * DAY).toISOString().slice(0, 10),
      to: new Date(planted.getTime() + (range.max + adjustmentDays) * DAY).toISOString().slice(0, 10),
    },
    exactDate: null,
    basedOn,
    confidence: evaluateConfidence({ verifiedSources: 1, observations: historicalDurations.length, completeness: confirmedStage ? 'good' : 'attention' }),
    generatedAt: new Date(now).toISOString(),
    sourceIds: verifiedReference.sourceIds || [],
  };
}

export function forecastYield({ areaM2, plantPopulation, verifiedRange = null, farmHistory = [] } = {}) {
  if (!positive(areaM2) || !positive(plantPopulation)) return insufficient('area_or_population_missing');
  const history = farmHistory.map((item) => Number(item.yieldPerM2Kg)).filter((value) => Number.isFinite(value) && value >= 0);
  if (history.length >= 3) {
    const sorted = history.sort((a, b) => a - b);
    return {
      status: 'forecast_available', unit: 'kg',
      range: { min: round(sorted[0] * Number(areaM2)), max: round(sorted.at(-1) * Number(areaM2)) },
      basedOn: ['farm_history'],
      confidence: evaluateConfidence({ observations: history.length, completeness: 'good' }),
      guaranteed: false,
    };
  }
  if (verifiedRange && verifiedRange.reviewStatus === 'verified' && verifiedRange.productionAllowed === true && verifiedRange.synthetic !== true && nonNegative(verifiedRange.minPerM2) && nonNegative(verifiedRange.maxPerM2)) {
    return {
      status: 'forecast_available', unit: verifiedRange.unit || 'kg',
      range: { min: round(Number(verifiedRange.minPerM2) * Number(areaM2)), max: round(Number(verifiedRange.maxPerM2) * Number(areaM2)) },
      basedOn: ['verified_reference'], sourceIds: verifiedRange.sourceIds || [],
      confidence: evaluateConfidence({ verifiedSources: 1, observations: 0, completeness: 'attention' }), guaranteed: false,
    };
  }
  return insufficient('yield_evidence_insufficient');
}

function parseDayRange(value) {
  if (typeof value !== 'string') return null;
  const numbers = [...value.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0])).filter((number) => number > 0);
  if (!numbers.length || !/day/i.test(value)) return null;
  return { min: Math.floor(numbers[0]), max: Math.ceil(numbers[1] || numbers[0]) };
}
function insufficient(reason) {
  return { status: 'insufficient_data', reason, expectedWindow: null, range: null, confidence: { level: 'INSUFFICIENT_DATA', reasons: [reason] }, basedOn: [] };
}
const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const nonNegative = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const round = (value) => Number(value.toFixed(2));
