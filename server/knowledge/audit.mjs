import { pathToFileURL } from 'node:url';
import { createDatabase } from '../db/client.mjs';
import { migrate } from '../db/migrate.mjs';
import { loadEnv } from '../lib/env.mjs';

const SOURCE_OPTIONAL_TYPES = ['farm_command_rule', 'predictive_guardrail', 'calculator_spec'];

export async function auditKnowledge(db) {
  if (!db) throw new Error('database_not_configured');
  const [totals, byType, missingSources, inactiveSources, duplicateContent, sources, records] = await Promise.all([
    db.query(`SELECT
      count(*)::int total,
      count(*) FILTER(WHERE review_status='verified' AND production_allowed=true AND synthetic=false)::int production_verified,
      count(*) FILTER(WHERE review_status<>'verified')::int unverified,
      count(*) FILTER(WHERE review_status='deprecated')::int deprecated,
      count(*) FILTER(WHERE synthetic=true)::int synthetic,
      count(*) FILTER(WHERE synthetic=true AND production_allowed=true)::int synthetic_production
      FROM mig_farm.knowledge_records`),
    db.query(`SELECT record_type,count(*)::int count FROM mig_farm.knowledge_records
      WHERE review_status='verified' AND production_allowed=true AND synthetic=false
      GROUP BY record_type ORDER BY record_type`),
    db.query(`SELECT r.id,r.record_type FROM mig_farm.knowledge_records r
      LEFT JOIN mig_farm.knowledge_record_sources rs ON rs.record_id=r.id
      WHERE r.record_type<>ALL($1::text[]) GROUP BY r.id,r.record_type HAVING count(rs.source_id)=0
      ORDER BY r.id LIMIT 200`, [SOURCE_OPTIONAL_TYPES]),
    db.query(`SELECT DISTINCT r.id,s.external_id,s.status,s.production_allowed
      FROM mig_farm.knowledge_records r
      JOIN mig_farm.knowledge_record_sources rs ON rs.record_id=r.id
      JOIN mig_farm.knowledge_sources s ON s.id=rs.source_id
      WHERE r.review_status='verified' AND r.production_allowed=true AND r.synthetic=false
        AND (s.status<>'verified' OR s.production_allowed=false)
      ORDER BY r.id LIMIT 200`),
    db.query(`SELECT content_hash,count(*)::int count,array_agg(id ORDER BY id) ids
      FROM mig_farm.knowledge_records GROUP BY content_hash HAVING count(*)>1 ORDER BY count(*) DESC LIMIT 100`),
    db.query(`SELECT external_id,organization,title_en,source_url,status,production_allowed,last_verified_at,retrieved_at
      FROM mig_farm.knowledge_sources ORDER BY external_id NULLS LAST,id`),
    db.query(`SELECT id,record_type,payload_json,last_verified_at FROM mig_farm.knowledge_records ORDER BY id`),
  ]);
  const unitProblems = [];
  const profileCoverage = { total: 0, missingSpacing: 0, missingIrrigationGuidance: 0, missingSeasonality: 0 };
  for (const row of records.rows) {
    const payload = row.payload_json || {};
    if (Object.hasOwn(payload, 'unit') && payload.unit !== null && (typeof payload.unit !== 'string' || !payload.unit.trim())) {
      unitProblems.push({ id: row.id, unit: payload.unit });
    }
    if (row.record_type === 'crop_profile') {
      profileCoverage.total += 1;
      const spacing = payload.spacing || {};
      if (![spacing.plant_spacing_cm, spacing.row_spacing_cm, spacing.seed_spacing_cm, spacing.bulb_spacing_cm].some(validNumber)) profileCoverage.missingSpacing += 1;
      if (!payload.irrigation_guidance) profileCoverage.missingIrrigationGuidance += 1;
      if (!payload.seasonality) profileCoverage.missingSeasonality += 1;
    }
  }
  const now = Date.now();
  const sourceVerificationAges = sources.rows.map((row) => {
    const date = row.last_verified_at || row.retrieved_at;
    return {
      id: row.external_id,
      organization: row.organization,
      status: row.status,
      productionAllowed: row.production_allowed,
      lastVerifiedAt: date ? new Date(date).toISOString() : null,
      ageDays: date ? Math.max(0, Math.floor((now - new Date(date).getTime()) / 86_400_000)) : null,
    };
  });
  const values = totals.rows[0];
  const errors = [];
  if (Number(values.synthetic_production)) errors.push({ code: 'synthetic_records_in_production', count: Number(values.synthetic_production) });
  if (missingSources.rows.length) errors.push({ code: 'records_missing_sources', count: missingSources.rows.length });
  if (inactiveSources.rows.length) errors.push({ code: 'records_with_inactive_sources', count: inactiveSources.rows.length });
  if (unitProblems.length) errors.push({ code: 'invalid_units', count: unitProblems.length });
  return {
    status: errors.length ? 'failed' : 'passed',
    counts: {
      total: Number(values.total),
      productionVerified: Number(values.production_verified),
      unverified: Number(values.unverified),
      deprecated: Number(values.deprecated),
      synthetic: Number(values.synthetic),
    },
    byType: byType.rows.map((row) => ({ type: row.record_type, count: Number(row.count) })),
    profileCoverage,
    errors,
    details: {
      missingSources: missingSources.rows,
      inactiveSources: inactiveSources.rows,
      duplicateContent: duplicateContent.rows,
      unitProblems,
      sourceVerificationAges,
    },
  };
}

export async function knowledgeCoverage(db) {
  const audit = await auditKnowledge(db);
  const count = (type) => audit.byType.find((item) => item.type === type)?.count || 0;
  const diagnosisTypes = (await db.query(`SELECT lower(payload_json->>'type') type,count(*)::int count
    FROM mig_farm.knowledge_records
    WHERE record_type='diagnosis' AND review_status='verified' AND production_allowed=true AND synthetic=false
    GROUP BY lower(payload_json->>'type') ORDER BY type`)).rows;
  const diagnosticCount = (type) => Number(diagnosisTypes.find((item) => item.type === type)?.count || 0);
  return {
    cropsCovered: count('crop_profile'),
    cropsMissingSpacing: audit.profileCoverage.missingSpacing,
    cropsMissingIrrigationProfile: audit.profileCoverage.missingIrrigationGuidance,
    diagnosesCovered: count('diagnosis'),
    pestsCovered: diagnosticCount('pest'),
    diseasesCovered: diagnosticCount('disease'),
    symptomRules: count('symptom_rule'),
    regulations: count('uae_regulation'),
    services: count('uae_service'),
    recordsRequiringReview: audit.counts.unverified,
    lastVerifiedSources: audit.details.sourceVerificationAges,
    auditStatus: audit.status,
  };
}

const validNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnv();
  const db = createDatabase(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
  try {
    if (!db) throw new Error('database_not_configured');
    await migrate(db);
    const report = await auditKnowledge(db);
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', code: error?.code || error?.message || 'knowledge_audit_failed' }));
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
