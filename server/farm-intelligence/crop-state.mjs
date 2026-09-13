import { evaluateConfidence, dataFreshness } from './confidence.mjs';

export function buildCropDigitalState({ mission, knowledgeProfile = null, providers = {}, sensorReadings = [], risks = [], now = new Date() }) {
  const missing = [...new Set([
    ...(mission.completeness?.missing || []),
    ...(!knowledgeProfile ? ['verified_crop_profile'] : []),
    ...(!mission.stage?.confirmed ? ['growth_stage_confirmation'] : []),
    ...(providers.weather?.status !== 'configured' ? ['live_weather'] : []),
    ...(!sensorReadings.length ? ['sensor_data'] : []),
  ])];
  const observations = (mission.irrigation?.lastRecordedAt ? 1 : 0) + (mission.openProblems?.length || 0) + (mission.harvest?.events || 0) + sensorReadings.length;
  const sourceIds = knowledgeProfile?.sources?.map((source) => source.id).filter(Boolean) || [];
  return {
    cropId: mission.id,
    farmId: mission.farm.id,
    zoneId: mission.zone?.id || null,
    crop: mission.crop.cropName,
    variety: mission.crop.variety || null,
    plantingDate: mission.crop.plantingDate || null,
    ageDays: mission.ageDays,
    expectedGrowthStage: mission.stage?.expected || null,
    confirmedGrowthStage: mission.stage?.confirmed || null,
    stageConfirmationRequired: mission.stage?.needsConfirmation === true,
    activeTasks: mission.upcomingTask ? [mission.upcomingTask] : [],
    lastIrrigation: mission.irrigation?.lastRecordedAt || null,
    recentOperations: mission.lastOperation ? [mission.lastOperation] : [],
    openProblems: mission.openProblems || [],
    photoHistory: mission.photos || [],
    harvestStatus: mission.harvest?.status || null,
    harvestTotals: mission.harvest?.totals || [],
    expenses: mission.financials?.totalCostMinor || 0,
    sales: mission.financials?.totalRevenueMinor || 0,
    verifiedKnowledgeAvailability: {
      status: knowledgeProfile ? 'verified_available' : 'verified_data_unavailable',
      sourceIds,
      lastVerifiedAt: knowledgeProfile?.lastVerifiedAt || null,
    },
    weatherStatus: providers.weather?.status || 'not_configured',
    sensorStatus: providers.sensor?.status || 'not_configured',
    riskFlags: risks.filter((risk) => risk.evidence?.some((item) => item?.cropCycleId === mission.id || item?.entityId === mission.id)).map((risk) => risk.id),
    dataCompleteness: { status: missing.length ? 'attention' : 'good', missing, why: missing.map(missingReason) },
    confidence: evaluateConfidence({ verifiedSources: sourceIds.length, observations, completeness: missing.length ? 'attention' : 'good', providerStatus: providers.weather?.status }),
    freshness: {
      cropRecord: dataFreshness(mission.crop.updatedAt || mission.crop.createdAt, now),
      irrigation: dataFreshness(mission.irrigation?.lastRecordedAt, now),
      knowledge: dataFreshness(knowledgeProfile?.lastVerifiedAt, now),
      sensor: dataFreshness(sensorReadings[0]?.observedAt || sensorReadings[0]?.observed_at, now),
    },
    lastUpdatedAt: newest([mission.crop.updatedAt, mission.irrigation?.lastRecordedAt, mission.lastOperation?.performedAt, mission.stage?.confirmed?.confirmedAt]) || new Date(now).toISOString(),
    dataModel: 'deterministic_crop_state', reminders: { expectedIsObserved: false },
  };
}

function missingReason(field) {
  const reasons = {
    farm_area: 'Required for area-based calculations.', crop_area: 'Required for area-based calculations.',
    planting_date: 'Required for crop age and stage estimates.', zone: 'Required to relate records to a growing area.',
    verified_crop_profile: 'Required before showing agronomic reference values.', growth_stage_confirmation: 'Keeps expected and observed stages separate.',
    live_weather: 'Required for live weather-aware checks.', sensor_data: 'Required for sensor baselines and anomalies.',
  };
  return { field, reason: reasons[field] || 'Improves the completeness of the recorded crop state.' };
}
function newest(values) {
  return values.filter(Boolean).map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime())).sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() || null;
}
