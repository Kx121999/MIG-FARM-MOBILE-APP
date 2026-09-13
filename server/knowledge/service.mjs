import { fail, page, pageResult, text } from '../lib/validation.mjs';

const SOURCE_REQUIRED_TYPES = [
  'agronomic_fact', 'crop_profile', 'planting_calendar', 'crop_guide', 'irrigation_reference',
  'crop_salinity_tolerance', 'diagnosis', 'symptom_rule', 'uae_regulation', 'uae_service',
];
const SEARCHABLE_TYPES = ['crop_profile', 'diagnosis', 'symptom_rule', 'uae_regulation', 'uae_service'];
const VERIFIED_WHERE = `r.review_status='verified' AND r.production_allowed=true AND r.synthetic=false
  AND (r.effective_from IS NULL OR r.effective_from<=current_date)
  AND (r.effective_until IS NULL OR r.effective_until>=current_date)
  AND r.superseded_by IS NULL
  AND EXISTS (
    SELECT 1 FROM mig_farm.knowledge_record_sources okrs
    JOIN mig_farm.knowledge_sources oks ON oks.id=okrs.source_id
    WHERE okrs.record_id=r.id AND oks.status='verified' AND oks.production_allowed=true
  )
  AND NOT EXISTS (
    SELECT 1 FROM mig_farm.knowledge_record_sources badrs
    JOIN mig_farm.knowledge_sources bads ON bads.id=badrs.source_id
    WHERE badrs.record_id=r.id AND (bads.status<>'verified' OR bads.production_allowed=false)
  )`;

export function createKnowledgeService(db) {
  if (!db) {
    const unavailable = async () => { throw fail(503, 'database_not_configured'); };
    return new Proxy({}, { get: () => unavailable });
  }

  const verifiedRows = async ({ types, query = '', crop = null, productionSystem = null, offset = 0, limit = 50 }) => {
    const values = [types];
    const filters = [VERIFIED_WHERE, 'r.record_type=ANY($1::text[])'];
    if (query) {
      values.push(`%${normalize(query)}%`);
      filters.push(`(lower(r.search_text) LIKE $${values.length} OR EXISTS (
        SELECT 1 FROM mig_farm.knowledge_terms term
        WHERE term.record_id=r.id AND term.normalized_term LIKE $${values.length}
      ))`);
    }
    if (crop) { values.push(normalize(crop)); filters.push(`lower(r.crop)=lower($${values.length})`); }
    if (productionSystem) { values.push(productionSystem); filters.push(`(r.production_system IS NULL OR r.production_system=$${values.length})`); }
    values.push(limit + 1, offset);
    const rows = (await db.query(`SELECT r.* FROM mig_farm.knowledge_records r
      WHERE ${filters.join(' AND ')} ORDER BY r.record_type,r.crop NULLS LAST,r.id
      LIMIT $${values.length - 1} OFFSET $${values.length}`, values)).rows;
    return attachSources(db, rows);
  };

  return {
    async cropProfiles(url) {
      const paging = page(url);
      const rows = await verifiedRows({ types: ['crop_profile'], offset: paging.offset, limit: paging.limit });
      return { ...pageResult(rows.map(recordDTO), paging), verifiedOnly: true };
    },

    async search(url) {
      const q = text(url.searchParams.get('q') || '', 100, true);
      if (q.length < 2) throw fail(400, 'search_query_too_short');
      const paging = page(url);
      const requested = url.searchParams.get('type');
      const types = requested ? requested.split(',').filter((item) => SEARCHABLE_TYPES.includes(item)) : SEARCHABLE_TYPES;
      if (!types.length) throw fail(400, 'invalid_input');
      const rows = await verifiedRows({ types, query: q, offset: paging.offset, limit: paging.limit });
      return { ...pageResult(rows.map(recordDTO), paging), query: q, verifiedOnly: true };
    },

    async cropProfile(slug) {
      const crop = text(decodeURIComponent(slug), 100, true).toLowerCase();
      const rows = await verifiedRows({ types: ['crop_profile'], crop, limit: 1 });
      if (!rows[0]) throw fail(404, 'verified_crop_not_found');
      const related = await verifiedRows({ types: ['planting_calendar', 'crop_guide', 'crop_salinity_tolerance'], crop, limit: 30 });
      return { profile: recordDTO(rows[0]), related: related.map(recordDTO), verifiedOnly: true };
    },

    async plantingCalendar(url) {
      const month = Number(url.searchParams.get('month') || new Date().getMonth() + 1);
      const mode = url.searchParams.get('mode') || 'field';
      if (!Number.isInteger(month) || month < 1 || month > 12 || !['field', 'nursery'].includes(mode)) throw fail(400, 'invalid_input');
      const rows = await verifiedRows({ types: ['planting_calendar'], limit: 100 });
      const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];
      const key = mode === 'nursery' ? 'nursery_months' : 'field_months';
      const items = rows.filter((row) => Array.isArray(row.payload_json?.[key]) && row.payload_json[key].includes(monthName)).map(recordDTO);
      return { month, monthName, mode, items, verifiedOnly: true };
    },

    async regulations(url) {
      const paging = page(url);
      const query = text(url.searchParams.get('q') || '', 100);
      const types = url.searchParams.get('kind') === 'service' ? ['uae_service'] : url.searchParams.get('kind') === 'regulation' ? ['uae_regulation'] : ['uae_regulation', 'uae_service'];
      const rows = await verifiedRows({ types, query, offset: paging.offset, limit: paging.limit });
      return {
        ...pageResult(rows.map(recordDTO), paging),
        verifiedOnly: true,
        disclaimerAr: 'قد تتغير المتطلبات. تحقق من المتطلبات الحالية لدى الجهة الرسمية.',
        disclaimerEn: 'Requirements may change. Confirm current requirements with the official authority.',
      };
    },

    async waterQuality(body) {
      const ec = finiteNonNegative(body.ecDsM, 'invalid_ec');
      const crop = body.crop ? text(body.crop, 100, true).toLowerCase() : null;
      const classes = await verifiedRows({ types: ['irrigation_reference'], limit: 50 });
      const matchingClasses = classes.filter((row) => row.payload_json?.ec_ds_m && inRange(ec, row.payload_json.ec_ds_m)).map(recordDTO);
      const tolerance = crop ? (await verifiedRows({ types: ['crop_salinity_tolerance'], crop, limit: 5 })).map(recordDTO) : [];
      return {
        status: matchingClasses.length || tolerance.length ? 'reference_available' : 'verified_data_unavailable',
        userMeasurement: { value: ec, unit: 'dS/m', source: 'user_measurement', measuredAt: body.measuredAt || null },
        referenceClasses: matchingClasses,
        cropReferences: tolerance,
        interpretation: tolerance.length ? compareTolerance(ec, tolerance[0].payload) : null,
        prescription: null,
        warningAr: 'هذه مقارنة مرجعية وليست وصفة علاج. تتداخل بعض فئات FAO وقد تختلف الاستجابة حسب الظروف.',
        warningEn: 'This is a reference comparison, not a treatment prescription. Some FAO classes overlap and response varies by context.',
      };
    },

    async population(body) {
      const crop = text(body.crop, 100, true).toLowerCase();
      const productionSystem = text(body.productionSystem || '', 80, true);
      const areaM2 = finitePositive(body.areaM2, 'invalid_area');
      const rows = await verifiedRows({ types: ['crop_guide'], crop, productionSystem, limit: 20 });
      const match = rows.find((row) => row.production_system === productionSystem && spacingRange(row.payload_json?.plant_spacing_cm) && spacingRange(row.payload_json?.row_spacing_cm));
      if (!match) return unavailable('verified_spacing_data_unavailable');
      const plantSpacingCm = spacingRange(match.payload_json.plant_spacing_cm);
      const rowSpacingCm = spacingRange(match.payload_json.row_spacing_cm);
      const populationRange = {
        min: Math.floor(areaM2 / ((plantSpacingCm.max / 100) * (rowSpacingCm.max / 100))),
        max: Math.floor(areaM2 / ((plantSpacingCm.min / 100) * (rowSpacingCm.min / 100))),
      };
      return {
        status: 'calculated_result',
        resultType: 'CALCULATED_ESTIMATE',
        population: populationRange.min === populationRange.max ? populationRange.min : null,
        populationRange,
        inputs: { crop, productionSystem, areaM2, plantSpacingCm, rowSpacingCm },
        formula: 'floor(area_m2 / ((plant_spacing_cm/100) * (row_spacing_cm/100)))',
        sources: match.sources,
        warningAr: 'تقدير هندسي. قد تقل المساحة القابلة للزراعة بسبب الممرات والحواف وممرات الخدمة وتصميم الأحواض والمعدات.',
        warningEn: 'Geometric estimate. Aisles, edges, service corridors, bed layout, and equipment may reduce usable planting area.',
      };
    },

    async diagnose(body) {
      const crop = body.cropSlug ? text(body.cropSlug, 100, true).toLowerCase() : null;
      const part = body.plantPart ? normalize(text(body.plantPart, 80, true)) : null;
      const symptoms = Array.isArray(body.symptoms) ? body.symptoms.map((item) => normalize(text(item, 120, true))) : [];
      if (!symptoms.length) throw fail(400, 'symptoms_required');
      const rules = await verifiedRows({ types: ['symptom_rule'], crop, limit: 100 });
      const matches = rules.filter((row) => {
        const payload = row.payload_json || {};
        const symptom = normalize(payload.symptom || '');
        const partMatches = !part || !payload.part || normalize(payload.part) === part || `${normalize(payload.part)}s` === part;
        return partMatches && symptoms.some((value) => value === symptom || symptom.includes(value) || value.includes(symptom));
      });
      const diagnosisIds = [...new Set(matches.flatMap((row) => row.payload_json?.possible || []))];
      const diagnoses = diagnosisIds.length ? await verifiedRows({ types: ['diagnosis'], limit: 100 }) : [];
      const possibleCauses = diagnosisIds.map((id) => {
        const diagnosis = diagnoses.find((row) => row.id === `diagnosis:${id}`);
        const rule = matches.find((row) => row.payload_json?.possible?.includes(id));
        if (!diagnosis || !rule) return null;
        return {
          causeType: diagnosis.payload_json.type,
          possibleCauseAr: diagnosis.payload_json.name_ar,
          possibleCauseEn: diagnosis.payload_json.name_en,
          inspectionChecksAr: diagnosis.payload_json.checks || rule.payload_json.confirm || [],
          inspectionChecksEn: diagnosis.payload_json.checks || rule.payload_json.confirm || [],
          source: diagnosis.sources[0] || null,
          confidence: 'LOW',
          classification: 'possible_cause_not_diagnosis',
        };
      }).filter(Boolean);
      return {
        status: possibleCauses.length ? 'possible_causes_found' : 'no_verified_match',
        possibleCauses,
        diagnosis: null,
        visionStatus: 'not_configured',
        disclaimerAr: 'هذه احتمالات للفحص وليست تشخيصًا مؤكدًا. لا تستخدم علاجًا قبل التحقق من مختص وملصق منتج مسجل.',
        disclaimerEn: 'These are inspection possibilities, not a confirmed diagnosis. Verify with a specialist and a registered product label before treatment.',
        verifiedOnly: true,
      };
    },

    async profilesForCrops(crops = []) {
      const names = [...new Set(crops.map((crop) => normalize(crop)).filter(Boolean))].slice(0, 60);
      const result = new Map();
      await Promise.all(names.map(async (crop) => {
        const rows = await verifiedRows({ types: ['crop_profile'], crop, limit: 1 });
        if (rows[0]) result.set(crop, recordDTO(rows[0]));
      }));
      return result;
    },

    async sourceRegistry(url) {
      const paging = page(url);
      const rows = (await db.query(`SELECT external_id,organization,title_en,source_url,source_type,country,
        authority_level,language,retrieved_at,last_verified_at,license_note,production_allowed,status,source_notes
        FROM mig_farm.knowledge_sources WHERE external_id IS NOT NULL ORDER BY organization,external_id
        LIMIT $1 OFFSET $2`, [paging.limit + 1, paging.offset])).rows;
      return { ...pageResult(rows.map(sourceDTO), paging), credentialsExposed: false };
    },
  };
}

async function attachSources(db, rows) {
  if (!rows.length) return [];
  const sourceRows = (await db.query(`SELECT rs.record_id,rs.source_order,s.*
    FROM mig_farm.knowledge_record_sources rs JOIN mig_farm.knowledge_sources s ON s.id=rs.source_id
    WHERE rs.record_id=ANY($1::text[]) ORDER BY rs.record_id,rs.source_order`, [rows.map((row) => row.id)])).rows;
  return rows.map((row) => ({ ...row, sources: sourceRows.filter((source) => source.record_id === row.id).map(sourceDTO) }));
}

function recordDTO(row) {
  return {
    id: row.id,
    type: row.record_type,
    domain: row.domain,
    crop: row.crop,
    productionSystem: row.production_system,
    growthStage: row.growth_stage,
    country: row.country,
    jurisdiction: row.jurisdiction,
    reviewStatus: row.review_status,
    productionAllowed: row.production_allowed,
    lastVerifiedAt: iso(row.last_verified_at),
    payload: row.payload_json,
    sources: row.sources || [],
    dataStatus: 'verified',
  };
}

function sourceDTO(row) {
  return {
    id: row.external_id,
    organization: row.organization || row.authority,
    title: row.title_en,
    url: row.source_url,
    sourceType: row.source_type,
    country: row.country,
    authorityLevel: row.authority_level,
    language: row.language,
    retrievedAt: date(row.retrieved_at),
    lastVerifiedAt: iso(row.last_verified_at),
    license: row.license_note,
    productionAllowed: row.production_allowed,
    status: row.status,
    notes: row.source_notes || '',
  };
}

function compareTolerance(ec, payload) {
  const thresholds = [
    ['reference_0pct', payload.yield_loss_0pct],
    ['reference_10pct', payload.yield_loss_10pct],
    ['reference_25pct', payload.yield_loss_25pct],
  ].filter(([, value]) => validPositive(value));
  if (!thresholds.length) return null;
  const reached = thresholds.filter(([, value]) => ec >= Number(value)).map(([key]) => key);
  return { relation: reached.at(-1) || 'below_first_reference', reachedReferences: reached, sourceBasis: 'verified_reference', treatment: null };
}

function inRange(value, range) {
  if (range.lt !== undefined && !(value < Number(range.lt))) return false;
  if (range.gt !== undefined && !(value > Number(range.gt))) return false;
  if (range.min !== undefined && value < Number(range.min)) return false;
  if (range.max !== undefined && value > Number(range.max)) return false;
  return true;
}
function unavailable(reason) {
  return {
    status: 'verified_data_unavailable',
    reason,
    messageAr: 'لا توجد بيانات موثقة كافية لهذه الحالة حاليًا.',
    messageEn: 'Verified data is not available for this configuration yet.',
  };
}
function finitePositive(value, code) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw fail(400, code);
  return number;
}
function finiteNonNegative(value, code) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw fail(400, code);
  return number;
}
const validPositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
function spacingRange(value) {
  if (validPositive(value)) return { min: Number(value), max: Number(value) };
  if (value && validPositive(value.min) && validPositive(value.max) && Number(value.max) >= Number(value.min)) return { min: Number(value.min), max: Number(value.max) };
  return null;
}
const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670]/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const iso = (value) => value ? new Date(value).toISOString() : null;
const date = (value) => value ? String(value).slice(0, 10) : null;

export { VERIFIED_WHERE, SOURCE_REQUIRED_TYPES };
