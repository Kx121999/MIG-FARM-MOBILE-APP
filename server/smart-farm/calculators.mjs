import { fail } from '../lib/validation.mjs';

const AREA_FACTORS = Object.freeze({
  m2: 1,
  hectare: 10000,
  acre: 4046.8564224,
});

function positive(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0)
    throw fail(400, `invalid_${field}`);
  return number;
}

function wholePositive(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw fail(400, `invalid_${field}`);
  return number;
}

function rounded(value, digits = 3) {
  return Number(value.toFixed(digits));
}

export function convertAreaToM2(value, unit = 'm2') {
  const factor = AREA_FACTORS[unit];
  if (!factor) throw fail(400, 'invalid_area_unit');
  return rounded(positive(value, 'area') * factor);
}

export function calculateRectangularArea({ length, width, unit = 'm' }) {
  const factors = { m: 1, cm: 0.01, ft: 0.3048 };
  const factor = factors[unit];
  if (!factor) throw fail(400, 'invalid_length_unit');
  const lengthM = positive(length, 'length') * factor;
  const widthM = positive(width, 'width') * factor;
  return {
    areaM2: rounded(lengthM * widthM),
    inputs: { length: Number(length), width: Number(width), unit },
    dataOrigin: 'user_supplied',
  };
}

export function calculatePlantPopulation({
  areaM2,
  rowSpacingCm,
  plantSpacingCm,
  plantsPerStation = 1,
  usableAreaPercent = 100,
  dataOrigin,
}) {
  const area = positive(areaM2, 'area');
  const rowSpacing = positive(rowSpacingCm, 'row_spacing');
  const plantSpacing = positive(plantSpacingCm, 'plant_spacing');
  const plants = wholePositive(plantsPerStation, 'plants_per_station');
  const usable = positive(usableAreaPercent, 'usable_area_percent');
  if (usable > 100) throw fail(400, 'invalid_usable_area_percent');
  if (!['verified_profile', 'user_supplied'].includes(dataOrigin))
    throw fail(400, 'missing_data_origin');

  const usableAreaM2 = area * (usable / 100);
  const stationAreaM2 = (rowSpacing / 100) * (plantSpacing / 100);
  const stationCount = Math.floor(usableAreaM2 / stationAreaM2);
  return {
    plantCount: stationCount * plants,
    stationCount,
    usableAreaM2: rounded(usableAreaM2),
    spacing: { rowCm: rowSpacing, plantCm: plantSpacing },
    plantsPerStation: plants,
    dataOrigin,
    resultType: 'calculated_estimate',
  };
}

export function calculateGreenhouseLayout({
  lengthM,
  widthM,
  bedWidthM,
  aisleWidthM,
}) {
  const length = positive(lengthM, 'length');
  const width = positive(widthM, 'width');
  const bedWidth = positive(bedWidthM, 'bed_width');
  const aisleWidth = positive(aisleWidthM, 'aisle_width');
  const bedCount = Math.floor((width + aisleWidth) / (bedWidth + aisleWidth));
  if (bedCount < 1) throw fail(400, 'layout_does_not_fit');
  const growingAreaM2 = bedCount * bedWidth * length;
  const totalAreaM2 = length * width;
  return {
    bedCount,
    growingAreaM2: rounded(growingAreaM2),
    circulationAreaM2: rounded(totalAreaM2 - growingAreaM2),
    utilizationPercent: rounded((growingAreaM2 / totalAreaM2) * 100, 1),
    inputs: { lengthM: length, widthM: width, bedWidthM: bedWidth, aisleWidthM: aisleWidth },
    dataOrigin: 'user_supplied',
    resultType: 'calculated_estimate',
  };
}

export function calculateIrrigationRuntime({
  targetVolumeLiters,
  emitterFlowLitersPerHour,
  emitterCount,
}) {
  const target = positive(targetVolumeLiters, 'target_volume');
  const flow = positive(emitterFlowLitersPerHour, 'emitter_flow');
  const count = wholePositive(emitterCount, 'emitter_count');
  const totalFlowLitersPerHour = flow * count;
  return {
    runtimeMinutes: rounded((target / totalFlowLitersPerHour) * 60, 1),
    totalFlowLitersPerHour: rounded(totalFlowLitersPerHour),
    targetVolumeLiters: target,
    dataOrigin: 'user_supplied',
    resultType: 'calculated_estimate',
    advisory: false,
  };
}

export function estimateGrowthStage({ plantingDate, asOfDate, stages }) {
  const start = new Date(`${plantingDate}T00:00:00.000Z`);
  const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(asOf.valueOf()) || asOf < start)
    throw fail(400, 'invalid_growth_dates');
  if (!Array.isArray(stages) || !stages.length)
    throw fail(422, 'verified_stage_data_unavailable');
  const day = Math.floor((asOf - start) / 86400000);
  const stage = stages.find((item) =>
    Number.isInteger(item.startDay) && Number.isInteger(item.endDay) &&
    day >= item.startDay && day <= item.endDay,
  );
  return {
    dayAfterPlanting: day,
    stage: stage || null,
    dataOrigin: 'verified_profile',
    resultType: stage ? 'calculated_estimate' : 'verified_data_unavailable',
  };
}

