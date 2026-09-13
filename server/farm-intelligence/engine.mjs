import { detectAnomalies } from './anomaly-engine.mjs';
import { buildCropDigitalState } from './crop-state.mjs';
import { buildDecisionCards, buildRisks } from './risk-engine.mjs';
import { forecastHarvest, forecastYield } from './forecast-engine.mjs';

export function buildFarmIntelligence(input = {}, now = new Date()) {
  const command = input.command || { missions: [], priorities: [], topActions: [] };
  const histories = input.histories || {};
  const providerStatus = input.providerStatus || {};
  const profilesByCrop = input.profilesByCrop || new Map();
  const sensorReadings = histories.sensors || [];
  const anomalies = detectAnomalies({
    irrigations: histories.irrigations || [],
    tasks: histories.tasks || [],
    problems: histories.problems || [],
    expenses: histories.expenses || [],
    sensors: sensorReadings,
    now,
  });
  const risks = buildRisks({ command, anomalies, providerStatus, now });
  const cropStates = (command.missions || []).map((mission) => buildCropDigitalState({
    mission,
    knowledgeProfile: findProfile(profilesByCrop, mission.crop),
    providers: providerStatus,
    sensorReadings: sensorReadings.filter((reading) => belongsToCrop(reading, mission.id)),
    risks,
    now,
  }));
  const forecasts = (command.missions || []).map((mission) => {
    const profile = findProfile(profilesByCrop, mission.crop);
    const sourceIds = profile?.sources?.map((source) => source.id).filter(Boolean) || [];
    const harvestReference = profile?.payload?.seasonality?.harvest_reference || null;
    const seasonHistory = (histories.seasons || []).filter((season) => normalize(season.cropName || season.crop_name) === normalize(mission.crop.cropName));
    return {
      cropId: mission.id,
      crop: mission.crop.cropName,
      harvest: forecastHarvest({
        plantingDate: mission.crop.plantingDate,
        verifiedReference: harvestReference ? { harvestReference, reviewStatus: profile.reviewStatus, productionAllowed: profile.productionAllowed, synthetic: false, sourceIds } : null,
        farmHistory: seasonHistory,
        now,
      }),
      yield: forecastYield({
        areaM2: mission.crop.areaM2,
        plantPopulation: mission.crop.plantCount,
        farmHistory: seasonHistory,
      }),
    };
  });
  const decisionCards = buildDecisionCards(risks, input.language || 'ar');
  return {
    generatedAt: new Date(now).toISOString(),
    farmId: input.farmId || command.selectedFarmId || null,
    brief: buildBrief({ command, risks, anomalies, cropStates }),
    cropStates,
    forecasts,
    risks,
    anomalies,
    decisionCards,
    upcoming: decisionCards.slice(0, 5),
    providerStatus,
    notifications: risks.filter((risk) => ['critical', 'high'].includes(risk.severity)).map((risk) => ({
      id: `candidate:${risk.id}`,
      riskId: risk.id,
      deliveryStatus: 'not_sent',
      requiresUserNotificationConsent: true,
    })),
    healthScore: null,
    healthScoreStatus: 'not_calculated',
    diagnosis: null,
    model: 'deterministic_verified_farm_intelligence_v5',
  };
}

export function buildCommandIntelligenceActions({ anomalies = [], farmId = null } = {}) {
  return anomalies.map((anomaly) => ({
    id: `intelligence:${anomaly.id}`,
    kind: 'intelligence_check',
    priority: anomaly.severity === 'high' ? 'high' : anomaly.severity === 'medium' ? 'normal' : 'low',
    farmId,
    cropCycleId: anomaly.evidence?.cropCycleId || null,
    entityId: anomaly.evidence?.entityId || null,
    dueAt: null,
    titleAr: anomaly.titleAr,
    titleEn: anomaly.titleEn,
    reasonAr: anomaly.reasonAr,
    reasonEn: anomaly.reasonEn,
    action: 'open_farm_intelligence',
    source: 'personal_history_anomaly_not_agronomic_diagnosis',
    confidence: anomaly.confidence,
  }));
}

function buildBrief({ command, risks, anomalies, cropStates }) {
  const urgent = risks.filter((risk) => ['critical', 'high'].includes(risk.severity)).length;
  const incomplete = cropStates.filter((state) => state.dataCompleteness.status !== 'good').length;
  return {
    titleAr: urgent ? 'توجد نقاط تحتاج مراجعتك' : 'مركز ذكاء المزرعة جاهز',
    titleEn: urgent ? 'Some items need your review' : 'Farm Intelligence is ready',
    summaryAr: `${urgent} تنبيه مهم، ${anomalies.length} تغير في نمط سجلاتك، و${incomplete} محصول يحتاج بيانات إضافية.`,
    summaryEn: `${urgent} important alert(s), ${anomalies.length} farm-history pattern change(s), and ${incomplete} crop(s) need more data.`,
    taskCount: command.morningBrief?.tasks || 0,
    riskCount: risks.length,
    anomalyCount: anomalies.length,
    cropCount: cropStates.length,
    dataQualityOnly: risks.every((risk) => risk.riskType === 'DATA_QUALITY'),
  };
}

function findProfile(profilesByCrop, crop = {}) {
  const keys = [crop.cropName, crop.crop_name, crop.cropNameAr, crop.crop_name_ar, crop.scientificName, crop.scientific_name]
    .filter(Boolean)
    .map(normalize);
  if (profilesByCrop instanceof Map) {
    for (const key of keys) {
      if (profilesByCrop.has(key)) return profilesByCrop.get(key);
    }
    return null;
  }
  for (const key of keys) {
    if (profilesByCrop?.[key]) return profilesByCrop[key];
  }
  return null;
}

function belongsToCrop(reading, cropId) {
  const linked = reading.cropCycleId || reading.crop_cycle_id || null;
  return linked === null || String(linked) === String(cropId);
}

const normalize = (value) => String(value || '').trim().toLowerCase();
