export function calculateEtc({ eto, kc, crop, growthStage } = {}) {
  if (!validMeasurement(eto) || !['real_weather', 'verified_reference'].includes(eto.source)) return unavailable('verified_or_real_eto_missing');
  if (!kc || !positive(kc.value) || kc.reviewStatus !== 'verified' || kc.productionAllowed !== true || kc.synthetic === true) return unavailable('verified_kc_missing');
  if (!growthStage || (kc.growthStage && kc.growthStage !== growthStage) || (kc.crop && crop && kc.crop !== crop)) return unavailable('verified_crop_stage_kc_missing');
  return {
    status: 'calculated_result',
    resultType: 'CALCULATED_ESTIMATE',
    etcMm: round(Number(eto.value) * Number(kc.value), 3),
    unit: 'mm',
    formula: 'ETc = Kc * ETo',
    basedOn: ['verified_reference', eto.source, 'confirmed_stage'],
    sourceIds: [...new Set([...(eto.sourceIds || []), ...(kc.sourceIds || [])])],
  };
}

export function calculateWaterVolume({ irrigationDepthMm, irrigatedAreaM2 } = {}) {
  if (!nonNegative(irrigationDepthMm) || !positive(irrigatedAreaM2)) return unavailable('depth_or_area_missing');
  return {
    status: 'calculated_result',
    resultType: 'CALCULATED_RESULT',
    liters: round(Number(irrigationDepthMm) * Number(irrigatedAreaM2), 3),
    formula: 'liters = irrigation_depth_mm * irrigated_area_m2',
    basis: '1 mm over 1 m2 equals 1 litre',
  };
}

export function calculateIrrigationRuntime({ requiredLiters, emitterFlowLph, emitterCount, systemEfficiency } = {}) {
  if (!positive(requiredLiters)) return unavailable('required_liters_missing');
  if (!positive(emitterFlowLph)) return unavailable('verified_emitter_flow_missing');
  if (!Number.isInteger(Number(emitterCount)) || Number(emitterCount) <= 0) return unavailable('emitter_count_missing');
  if (!positive(systemEfficiency) || Number(systemEfficiency) > 1) return unavailable('system_efficiency_missing');
  const totalEffectiveFlowLph = Number(emitterFlowLph) * Number(emitterCount) * Number(systemEfficiency);
  return {
    status: 'calculated_result',
    resultType: 'CALCULATED_ESTIMATE',
    runtimeHours: round(Number(requiredLiters) / totalEffectiveFlowLph, 3),
    totalEffectiveFlowLph: round(totalEffectiveFlowLph, 3),
    formula: 'required_liters / (emitter_flow_lph * emitter_count * system_efficiency)',
  };
}

function unavailable(reason) {
  return { status: 'verified_data_unavailable', reason, messageAr: 'لا توجد بيانات موثقة كافية لهذه الحالة حاليًا.', messageEn: 'Verified data is not available for this configuration yet.' };
}
const validMeasurement = (value) => value && nonNegative(value.value) && typeof value.source === 'string';
const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const nonNegative = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const round = (value, digits) => Number(value.toFixed(digits));
