import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createDatabase } from '../db/client.mjs';
import { migrate } from '../db/migrate.mjs';
import { loadEnv } from '../lib/env.mjs';
import { DEFAULT_PACK_DIR, contentHash, readPackJson, validateDataPack } from './pack.mjs';

const REVIEW_STATUSES = new Set(['draft', 'review_required', 'verified', 'deprecated']);
const SOURCELESS_RULE_TYPES = new Set(['farm_command_rule', 'predictive_guardrail', 'calculator_spec']);

export function stableUuid(value) {
  const bytes = createHash('sha256').update(String(value)).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function loadProductionPack(packDir = DEFAULT_PACK_DIR) {
  const { manifest, report } = await validateDataPack(packDir);
  const sources = await readPackJson(packDir, 'source_registry/sources.json');
  validateArray(sources, 'source_registry/sources.json');
  const sourceIds = new Set();
  for (const source of sources) {
    requireFields(source, ['id', 'organization', 'title', 'url', 'source_type', 'retrieved_at'], 'source_registry/sources.json');
    if (sourceIds.has(source.id)) throw invalid('duplicate_source_id', source.id);
    sourceIds.add(source.id);
    if (!isHttpUrl(source.url)) throw invalid('invalid_source_url', source.id);
  }

  const records = [];
  const rejected = [];
  const add = (record) => {
    if (record.payload?.synthetic === true || record.synthetic === true) {
      rejected.push({ id: record.id, reason: 'synthetic_rejected' });
      return;
    }
    if (record.productionAllowed !== true) {
      rejected.push({ id: record.id, reason: 'production_not_allowed' });
      return;
    }
    if (record.reviewStatus !== 'verified' && !SOURCELESS_RULE_TYPES.has(record.recordType)) {
      rejected.push({ id: record.id, reason: 'not_verified' });
      return;
    }
    if (!REVIEW_STATUSES.has(record.reviewStatus)) throw invalid('invalid_review_status', record.id);
    const refs = [...new Set(record.sourceExternalIds || [])];
    if (!refs.length && !SOURCELESS_RULE_TYPES.has(record.recordType)) {
      rejected.push({ id: record.id, reason: 'missing_source' });
      return;
    }
    const missing = refs.filter((id) => !sourceIds.has(id));
    if (missing.length) {
      rejected.push({ id: record.id, reason: 'missing_source', sourceIds: missing });
      return;
    }
    const disabled = refs.filter((id) => sources.find((source) => source.id === id)?.production_allowed !== true);
    if (disabled.length) {
      rejected.push({ id: record.id, reason: 'source_not_production_allowed', sourceIds: disabled });
      return;
    }
    records.push({ ...record, sourceExternalIds: refs, contentHash: contentHash(record.payload) });
  };

  for (const item of await jsonArray(packDir, 'verified_core/facts/facts.json')) {
    requireFields(item, ['id', 'domain', 'source_id', 'review_status', 'production_allowed'], 'facts');
    add(recordFrom(item, { id: `fact:${item.id}`, recordType: 'agronomic_fact', domain: item.domain, sources: [item.source_id] }));
  }
  for (const item of await jsonArray(packDir, 'verified_core/crops/crop_profiles_uae.json')) {
    requireFields(item, ['slug', 'name_en', 'name_ar', 'sources', 'review_status', 'production_allowed'], 'crop_profiles');
    add(recordFrom(item, { id: `crop_profile:${item.slug}`, recordType: 'crop_profile', domain: 'crop_profile', crop: item.slug, sources: item.sources }));
  }
  for (const item of await jsonArray(packDir, 'verified_core/crops/uae_crop_guide_facts.json')) {
    requireFields(item, ['crop', 'source_id', 'review_status', 'production_allowed'], 'crop_guide');
    add(recordFrom(item, { id: `crop_guide:${item.crop}:${item.production_system || 'unspecified'}`, recordType: 'crop_guide', domain: 'crop_profile', crop: item.crop, productionSystem: item.production_system, sources: [item.source_id] }));
  }
  for (const item of await jsonArray(packDir, 'verified_core/uae/planting_calendar_moccae.json')) {
    requireFields(item, ['slug', 'source_id', 'review_status', 'production_allowed'], 'planting_calendar');
    add(recordFrom(item, { id: `planting_calendar:${item.slug}`, recordType: 'planting_calendar', domain: 'planting_calendar', crop: item.slug, sources: [item.source_id], country: item.country }));
  }
  for (const item of await jsonArray(packDir, 'verified_core/irrigation/fao_water_salinity_classes.json')) {
    requireFields(item, ['class', 'source_id', 'review_status', 'production_allowed'], 'water_salinity');
    add(recordFrom(item, { id: `irrigation_reference:water_salinity:${slug(item.class)}`, recordType: 'irrigation_reference', domain: 'water_quality', sources: [item.source_id] }));
  }
  const cropwat = await readPackJson(packDir, 'verified_core/irrigation/fao_cropwat_engine_spec.json');
  requireFields(cropwat, ['source_ids', 'review_status', 'production_allowed'], 'cropwat');
  add(recordFrom(cropwat, { id: 'irrigation_reference:fao_cropwat', recordType: 'irrigation_reference', domain: 'irrigation', sources: cropwat.source_ids }));
  for (const item of await jsonArray(packDir, 'verified_core/irrigation/fao_crop_salinity_tolerance.json')) {
    requireFields(item, ['crop', 'source_id', 'review_status', 'production_allowed'], 'crop_salinity');
    add(recordFrom(item, { id: `crop_salinity:${slug(item.crop)}`, recordType: 'crop_salinity_tolerance', domain: 'water_quality', crop: item.crop, sources: [item.source_id], country: item.country }));
  }
  for (const item of await jsonArray(packDir, 'verified_core/diagnosis/diagnosis_records.json')) {
    requireFields(item, ['id', 'type', 'name_en', 'name_ar', 'source_id', 'review_status', 'production_allowed'], 'diagnosis');
    add(recordFrom(item, { id: `diagnosis:${item.id}`, recordType: 'diagnosis', domain: 'diagnosis', sources: [item.source_id] }));
  }
  const symptomRules = await jsonArray(packDir, 'verified_core/diagnosis/symptom_decision_rules.json');
  symptomRules.forEach((item, index) => {
    requireFields(item, ['symptom', 'source_id', 'review_status', 'production_allowed'], 'symptom_rules');
    add(recordFrom(item, { id: `symptom_rule:${index + 1}:${contentHash(item).slice(0, 12)}`, recordType: 'symptom_rule', domain: 'diagnosis', crop: item.crop, sources: [item.source_id] }));
  });
  for (const item of await jsonArray(packDir, 'verified_core/uae/regulations.json')) {
    requireFields(item, ['id', 'source_id', 'review_status', 'production_allowed'], 'regulations');
    add(recordFrom(item, { id: `uae_regulation:${item.id}`, recordType: 'uae_regulation', domain: 'uae_regulation', jurisdiction: item.jurisdiction || 'AE', sources: [item.source_id] }));
  }
  for (const item of await jsonArray(packDir, 'verified_core/uae/services.json')) {
    requireFields(item, ['slug', 'source_id', 'review_status', 'production_allowed'], 'services');
    add(recordFrom(item, { id: `uae_service:${item.slug}`, recordType: 'uae_service', domain: 'uae_service', jurisdiction: item.jurisdiction || 'AE', sources: [item.source_id] }));
  }
  for (const item of await jsonArray(packDir, 'rules/farm_command_rules.json')) {
    requireFields(item, ['id', 'domain', 'production_allowed'], 'farm_command_rules');
    add(recordFrom({ ...item, review_status: 'verified' }, { id: `farm_command_rule:${item.id}`, recordType: 'farm_command_rule', domain: item.domain, sources: [] }));
  }
  for (const item of await jsonArray(packDir, 'rules/predictive_intelligence_guardrails.json')) {
    requireFields(item, ['id', 'domain', 'production_allowed'], 'predictive_guardrails');
    add(recordFrom({ ...item, review_status: 'verified' }, { id: `predictive_guardrail:${item.id}`, recordType: 'predictive_guardrail', domain: item.domain, sources: [] }));
  }
  const calculatorSpecs = await readPackJson(packDir, 'calculators/calculator_specs.json');
  for (const [key, item] of Object.entries(calculatorSpecs)) {
    const sourceIdsForSpec = item.source_id ? [item.source_id] : [];
    add(recordFrom({ ...item, id: key, production_allowed: true, review_status: 'verified' }, { id: `calculator_spec:${key}`, recordType: 'calculator_spec', domain: 'calculator', sources: sourceIdsForSpec }));
  }
  const duplicates = records.map((item) => item.id).filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicates.length) throw invalid('duplicate_record_id', duplicates[0]);
  return { manifest, manifestReport: report, sources, records, rejected };
}

export async function importKnowledge(db, { packDir = DEFAULT_PACK_DIR } = {}) {
  if (!db) throw new Error('database_not_configured');
  const pack = await loadProductionPack(packDir);
  const runId = randomUUID();
  await db.query(`INSERT INTO mig_farm.knowledge_ingestion_runs
    (id,pack_name,pack_generated_at,manifest_hash,status,summary_json)
    VALUES($1,$2,$3,$4,'running','{}')`, [runId, pack.manifest.pack, pack.manifest.generated_at || null, pack.manifestReport.manifestHash]);
  const summary = {
    pack: pack.manifest.pack,
    sourcesImported: 0,
    recordsImported: 0,
    recordsUpdated: 0,
    duplicateRecords: 0,
    rejectedRecords: pack.rejected.length,
    rejected: pack.rejected,
    syntheticFilesExcluded: pack.manifestReport.excludedSyntheticFiles.length,
    manifestWarnings: pack.manifestReport.warnings,
  };
  try {
    await db.transaction(async (client) => {
      const sourceMap = new Map();
      for (const source of pack.sources) {
        const id = await upsertSource(client, source);
        sourceMap.set(source.id, id);
        summary.sourcesImported += 1;
      }
      for (const record of pack.records) {
        const previous = (await client.query('SELECT content_hash FROM mig_farm.knowledge_records WHERE id=$1', [record.id])).rows[0];
        if (previous?.content_hash === record.contentHash) summary.duplicateRecords += 1;
        else if (previous) summary.recordsUpdated += 1;
        else summary.recordsImported += 1;
        await client.query(`INSERT INTO mig_farm.knowledge_records
          (id,record_type,domain,crop,production_system,growth_stage,country,jurisdiction,review_status,production_allowed,synthetic,effective_from,effective_until,last_verified_at,superseded_by,content_hash,search_text,payload_json)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12,$13,$14,$15,$16,$17)
          ON CONFLICT(id) DO UPDATE SET record_type=EXCLUDED.record_type,domain=EXCLUDED.domain,crop=EXCLUDED.crop,
            production_system=EXCLUDED.production_system,growth_stage=EXCLUDED.growth_stage,country=EXCLUDED.country,
            jurisdiction=EXCLUDED.jurisdiction,review_status=EXCLUDED.review_status,
            production_allowed=EXCLUDED.production_allowed,effective_from=EXCLUDED.effective_from,
            effective_until=EXCLUDED.effective_until,last_verified_at=EXCLUDED.last_verified_at,
            superseded_by=EXCLUDED.superseded_by,content_hash=EXCLUDED.content_hash,
            search_text=EXCLUDED.search_text,payload_json=EXCLUDED.payload_json,updated_at=now()`, [
          record.id, record.recordType, record.domain, record.crop || null, record.productionSystem || null,
          record.growthStage || null, record.country || null, record.jurisdiction || null,
          record.reviewStatus, record.productionAllowed, record.effectiveFrom || null, record.effectiveUntil || null,
          record.lastVerifiedAt || null, record.supersededBy || null, record.contentHash,
          buildSearchText(record.payload), JSON.stringify(record.payload),
        ]);
        await client.query('DELETE FROM mig_farm.knowledge_record_sources WHERE record_id=$1', [record.id]);
        for (let index = 0; index < record.sourceExternalIds.length; index += 1) {
          await client.query(`INSERT INTO mig_farm.knowledge_record_sources(record_id,source_id,source_order)
            VALUES($1,$2,$3) ON CONFLICT(record_id,source_id) DO UPDATE SET source_order=EXCLUDED.source_order`, [record.id, sourceMap.get(record.sourceExternalIds[index]), index + 1]);
        }
        await importTerms(client, record, record.sourceExternalIds[0] ? sourceMap.get(record.sourceExternalIds[0]) : null);
      }
      await importLegacyCropProfiles(client, pack.records, sourceMap, pack.sources);
    });
    await db.query(`UPDATE mig_farm.knowledge_ingestion_runs SET status='completed',summary_json=$1,completed_at=now() WHERE id=$2`, [JSON.stringify(summary), runId]);
    return summary;
  } catch (error) {
    await db.query(`UPDATE mig_farm.knowledge_ingestion_runs SET status='failed',summary_json=$1,completed_at=now() WHERE id=$2`, [JSON.stringify({ code: error?.code || 'knowledge_import_failed' }), runId]).catch(() => {});
    throw error;
  }
}

async function upsertSource(client, source) {
  const existing = (await client.query('SELECT id FROM mig_farm.knowledge_sources WHERE external_id=$1 OR source_url=$2 ORDER BY external_id=$1 DESC LIMIT 1', [source.id, source.url])).rows[0];
  const id = existing?.id || stableUuid(`knowledge-source:${source.id}`);
  const status = source.production_allowed === true ? 'verified' : 'review_required';
  const reviewedAt = `${source.retrieved_at}T00:00:00Z`;
  if (existing) {
    await client.query(`UPDATE mig_farm.knowledge_sources SET external_id=$1,authority=$2,organization=$2,
      title_en=$3,title_ar=$3,source_url=$4,source_type=$5,country=$6,authority_level=$7,language=$8,
      license_note=$9,retrieved_at=$10,last_verified_at=$11,production_allowed=$12,status=$13,
      source_notes=$14,reviewed_at=$11,updated_at=now() WHERE id=$15`, [
      source.id, source.organization, source.title, source.url, source.source_type || null,
      normalizeCountry(source.country), source.authority_level || null, source.language || null,
      source.license || source.license_note || null, source.retrieved_at, reviewedAt,
      source.production_allowed === true, status, source.note || source.notes || '', id,
    ]);
  } else {
    await client.query(`INSERT INTO mig_farm.knowledge_sources
      (id,external_id,authority,organization,title_ar,title_en,source_url,jurisdiction,source_type,country,
       authority_level,language,license_note,retrieved_at,last_verified_at,production_allowed,source_notes,
       reviewed_at,status)
      VALUES($1,$2,$3,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$13,$16)`, [
      id, source.id, source.organization, source.title, source.url, source.country || 'global',
      source.source_type || null, normalizeCountry(source.country), source.authority_level || null,
      source.language || null, source.license || source.license_note || null, source.retrieved_at,
      reviewedAt, source.production_allowed === true, source.note || source.notes || '', status,
    ]);
  }
  return id;
}

async function importLegacyCropProfiles(client, records, sourceMap, sources) {
  for (const record of records.filter((item) => item.recordType === 'crop_profile')) {
    const payload = record.payload;
    const sourceId = sourceMap.get(record.sourceExternalIds[0]);
    const source = sources.find((item) => item.id === record.sourceExternalIds[0]);
    const reviewedAt = record.lastVerifiedAt || (source?.retrieved_at ? `${source.retrieved_at}T00:00:00Z` : null);
    if (!reviewedAt) continue;
    await client.query(`INSERT INTO mig_farm.crop_profiles
      (id,slug,name_ar,name_en,aliases,summary_ar,summary_en,production_systems,climate_tags,source_id,reviewed_at,status)
      VALUES($1,$2,$3,$4,'[]','','','[]','[]',$5,$6,'verified')
      ON CONFLICT(slug) DO NOTHING`, [stableUuid(record.id), payload.slug, payload.name_ar, payload.name_en, sourceId, reviewedAt]);
  }
}

async function importTerms(client, record, sourceId) {
  await client.query('DELETE FROM mig_farm.knowledge_terms WHERE record_id=$1', [record.id]);
  const terms = collectTerms(record);
  for (const item of terms) {
    await client.query(`INSERT INTO mig_farm.knowledge_terms(id,record_id,language,term,normalized_term,source_id)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(record_id,language,normalized_term) DO NOTHING`, [
      stableUuid(`term:${record.id}:${item.language}:${item.normalized}`), record.id, item.language,
      item.term, item.normalized, sourceId,
    ]);
  }
}

function collectTerms(record) {
  const payload = record.payload;
  const values = [
    ['ar', payload.name_ar], ['en', payload.name_en], ['en', payload.title_en], ['ar', payload.title_ar],
    ['la', payload.scientific_name], ['en', record.crop], ['und', payload.id], ['und', payload.slug],
  ];
  for (const alias of payload.aliases || payload.synonyms || []) values.push(['und', alias]);
  const seen = new Set();
  return values.filter(([, value]) => typeof value === 'string' && value.trim()).map(([language, term]) => ({ language, term: term.trim(), normalized: normalizeTerm(term) })).filter((item) => {
    const key = `${item.language}:${item.normalized}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recordFrom(item, options) {
  return {
    id: options.id,
    recordType: options.recordType,
    domain: options.domain,
    crop: options.crop || item.crop || null,
    productionSystem: options.productionSystem || item.production_system || null,
    growthStage: item.growth_stage || null,
    country: options.country || item.country || null,
    jurisdiction: options.jurisdiction || item.jurisdiction || null,
    reviewStatus: item.review_status || 'review_required',
    productionAllowed: item.production_allowed === true,
    synthetic: item.synthetic === true,
    effectiveFrom: item.effective_from || null,
    effectiveUntil: item.effective_until || null,
    lastVerifiedAt: item.last_verified_at || null,
    supersededBy: item.superseded_by || null,
    sourceExternalIds: options.sources || [],
    payload: item,
  };
}

async function jsonArray(packDir, relativePath) {
  const value = await readPackJson(packDir, relativePath);
  validateArray(value, relativePath);
  return value;
}

function validateArray(value, source) {
  if (!Array.isArray(value)) throw invalid('expected_array', source);
}
function requireFields(value, fields, source) {
  if (!value || typeof value !== 'object') throw invalid('invalid_record', source);
  const missing = fields.filter((field) => value[field] === undefined || value[field] === null || value[field] === '');
  if (missing.length) throw invalid('missing_required_field', `${source}:${missing.join(',')}`);
}
function invalid(code, detail) {
  const error = new Error(code);
  error.code = code;
  error.detail = detail;
  return error;
}
function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}
function normalizeCountry(value) {
  const country = String(value || '').toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : null;
}
function slug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || contentHash(value).slice(0, 12);
}
function normalizeTerm(value) {
  return String(value).normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim();
}
function buildSearchText(value) {
  const strings = [];
  const walk = (item) => {
    if (typeof item === 'string') strings.push(item);
    else if (Array.isArray(item)) item.forEach(walk);
    else if (item && typeof item === 'object') Object.values(item).forEach(walk);
  };
  walk(value);
  return normalizeTerm(strings.join(' ')).slice(0, 30000);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnv();
  const argIndex = process.argv.indexOf('--pack');
  const packDir = argIndex >= 0 ? process.argv[argIndex + 1] : DEFAULT_PACK_DIR;
  const db = createDatabase(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
  try {
    if (!db) throw new Error('database_not_configured');
    await migrate(db);
    const summary = await importKnowledge(db, { packDir });
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', code: error?.code || error?.message || 'knowledge_import_failed', detail: error?.detail || null }));
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
