const SOURCE_PRECEDENCE = Object.freeze({
  uae_official_authority: 1,
  uae_official_guidance: 2,
  international_authority: 3,
  university_extension: 4,
  manufacturer_label: 5,
  mig_farm_verified: 6,
});

export function resolveKnowledgeCandidates(candidates = [], context = {}) {
  const eligible = candidates.filter((candidate) => candidate.reviewStatus === 'verified'
    && candidate.productionAllowed === true
    && candidate.synthetic !== true
    && contextMatches(candidate, context));
  const ordered = eligible.map((candidate) => ({
    ...candidate,
    sourcePrecedence: sourceRank(candidate.sources || [], candidate),
  })).sort((a, b) => a.sourcePrecedence - b.sourcePrecedence || freshnessRank(b) - freshnessRank(a) || String(a.id).localeCompare(String(b.id)));
  const values = new Set(ordered.map((candidate) => JSON.stringify(candidate.value ?? candidate.payload?.value ?? null)));
  return {
    status: ordered.length ? 'candidates_available' : 'verified_data_unavailable',
    candidates: ordered,
    conflict: values.size > 1,
    automaticSelection: values.size <= 1 ? ordered[0] || null : null,
    rule: 'precedence_orders_relevant_candidates_but_never_overwrites_contextual_conflicts',
  };
}

function contextMatches(candidate, context) {
  for (const key of ['country', 'jurisdiction', 'productionSystem', 'crop', 'variety', 'growthStage']) {
    if (context[key] && candidate[key] && normalize(context[key]) !== normalize(candidate[key])) return false;
  }
  const today = Date.now();
  if (candidate.effectiveFrom && new Date(candidate.effectiveFrom).getTime() > today) return false;
  if (candidate.effectiveUntil && new Date(candidate.effectiveUntil).getTime() < today) return false;
  return true;
}

function sourceRank(sources, candidate = {}) {
  return Math.min(...sources.map((source) => {
    const organization = normalize(source.organization);
    const authority = normalize(source.authorityLevel);
    const country = String(source.country || candidate.country || '').toUpperCase();
    if (country === 'AE' && authority.includes('official')) return SOURCE_PRECEDENCE.uae_official_authority;
    if (country === 'AE') return SOURCE_PRECEDENCE.uae_official_guidance;
    if (organization.includes('fao') || authority.includes('international')) return SOURCE_PRECEDENCE.international_authority;
    if (authority.includes('university') || authority.includes('extension')) return SOURCE_PRECEDENCE.university_extension;
    if (authority.includes('manufacturer') || organization.includes('manufacturer')) return SOURCE_PRECEDENCE.manufacturer_label;
    if (organization.includes('mig farm')) return SOURCE_PRECEDENCE.mig_farm_verified;
    return 99;
  }), 99);
}

function freshnessRank(candidate) {
  const value = new Date(candidate.lastVerifiedAt || candidate.sources?.[0]?.lastVerifiedAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

const normalize = (value) => String(value || '').trim().toLowerCase();

export { SOURCE_PRECEDENCE };
