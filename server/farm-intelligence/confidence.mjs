export const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA'];

export function evaluateConfidence({ verifiedSources = 0, observations = 0, completeness = 'no_data', providerStatus = null, freshness = null } = {}) {
  const reasons = [];
  if (!verifiedSources) reasons.push('verified_source_missing');
  if (!observations) reasons.push('observations_missing');
  if (completeness === 'critical' || completeness === 'no_data') reasons.push('farm_data_incomplete');
  if (providerStatus === 'not_configured' || providerStatus === 'unavailable') reasons.push('provider_unavailable');
  if (freshness === 'stale') reasons.push('data_stale');
  if (!verifiedSources && !observations) return { level: 'INSUFFICIENT_DATA', reasons };
  if (verifiedSources > 0 && observations >= 5 && completeness === 'good' && !reasons.includes('data_stale')) return { level: 'HIGH', reasons };
  if ((verifiedSources > 0 && observations >= 2) || observations >= 5) return { level: 'MEDIUM', reasons };
  return { level: 'LOW', reasons };
}

export function dataFreshness(timestamp, now = new Date()) {
  if (!timestamp) return { status: 'unavailable', ageMinutes: null, timestamp: null };
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return { status: 'invalid', ageMinutes: null, timestamp: null };
  const ageMinutes = Math.max(0, Math.floor((new Date(now).getTime() - value.getTime()) / 60_000));
  return { status: ageMinutes > 180 ? 'stale' : 'fresh', ageMinutes, timestamp: value.toISOString() };
}
