import { randomUUID } from 'node:crypto';
import { fail, text, uuid } from '../lib/validation.mjs';
import {
  calculateGreenhouseLayout,
  calculateIrrigationRuntime,
  calculatePlantPopulation,
  calculateRectangularArea,
  convertAreaToM2,
  estimateGrowthStage,
} from './calculators.mjs';

const iso = (value) => value ? new Date(value).toISOString() : null;
const json = (value, fallback) => value == null ? fallback : value;
const number = (value) => value == null ? null : Number(value);
const positive = (value, code = 'invalid_input') => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw fail(400, code);
  return parsed;
};
const date = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf()))
    throw fail(400, 'invalid_date');
  return value;
};
const list = (value, max = 20) => {
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 80))
    throw fail(400, 'invalid_input');
  return value.map((item) => item.trim().toLowerCase());
};

function sourceDTO(row, prefix = '') {
  if (!row[`${prefix}source_id`]) return null;
  return {
    id: row[`${prefix}source_id`],
    authority: row[`${prefix}source_authority`],
    titleAr: row[`${prefix}source_title_ar`],
    titleEn: row[`${prefix}source_title_en`],
    url: row[`${prefix}source_url`],
    jurisdiction: row[`${prefix}source_jurisdiction`],
    publishedAt: row[`${prefix}source_published_at`] ? String(row[`${prefix}source_published_at`]).slice(0, 10) : null,
    reviewedAt: iso(row[`${prefix}source_reviewed_at`]),
    version: row[`${prefix}source_version_label`],
    status: 'verified',
  };
}

const sourceSelect = `
  s.id source_id,s.authority source_authority,s.title_ar source_title_ar,
  s.title_en source_title_en,s.source_url,s.jurisdiction source_jurisdiction,
  s.published_at source_published_at,s.reviewed_at source_reviewed_at,
  s.version_label source_version_label`;

function cropDTO(row) {
  return {
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    scientificName: row.scientific_name,
    aliases: json(row.aliases, []),
    summaryAr: row.summary_ar,
    summaryEn: row.summary_en,
    productionSystems: json(row.production_systems, []),
    climateTags: json(row.climate_tags, []),
    reviewedAt: iso(row.reviewed_at),
    status: row.status,
    source: sourceDTO(row),
  };
}

function regulationDTO(row) {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    summaryAr: row.summary_ar,
    summaryEn: row.summary_en,
    effectiveAt: row.effective_at ? String(row.effective_at).slice(0, 10) : null,
    reviewedAt: iso(row.reviewed_at),
    status: row.status,
    source: sourceDTO(row),
  };
}

function conditionDTO(row) {
  return {
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    scientificName: row.scientific_name || row.pathogen || null,
    identifiersAr: json(row.identifiers_ar, []),
    identifiersEn: json(row.identifiers_en, []),
    affectedCrops: json(row.affected_crops, []),
    reviewedAt: iso(row.reviewed_at),
    status: row.status,
    source: sourceDTO(row),
  };
}

function spacingDTO(row) {
  return {
    id: row.id,
    productionSystem: row.production_system,
    plantingMethod: row.planting_method,
    rowSpacingCm: number(row.row_spacing_cm),
    plantSpacingCm: number(row.plant_spacing_cm),
    plantsPerStation: row.plants_per_station,
    usableAreaPercent: number(row.usable_area_percent),
    notesAr: row.notes_ar,
    notesEn: row.notes_en,
    reviewedAt: iso(row.reviewed_at),
    status: row.status,
    source: sourceDTO(row),
  };
}

function stageDTO(row) {
  return {
    id: row.id,
    key: row.stage_key,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    startDay: row.start_day,
    endDay: row.end_day,
    checksAr: json(row.checks_ar, []),
    checksEn: json(row.checks_en, []),
    reviewedAt: iso(row.reviewed_at),
    status: row.status,
    source: sourceDTO(row),
  };
}

function planDTO(row) {
  return {
    id: row.id,
    farmId: row.farm_id,
    zoneId: row.zone_id,
    cropProfileId: row.crop_profile_id,
    spacingProfileId: row.spacing_profile_id,
    cropCycleId: row.crop_cycle_id,
    crop: row.crop_name_en ? { slug: row.crop_slug, nameAr: row.crop_name_ar, nameEn: row.crop_name_en } : undefined,
    plantingDate: String(row.planting_date).slice(0, 10),
    areaM2: number(row.area_m2),
    productionSystem: row.production_system,
    plantingMethod: row.planting_method,
    calculation: json(row.calculation_json, {}),
    status: row.status,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function createSmartFarm(db) {
  async function verifiedCropById(id) {
    const result = await db.query(`SELECT cp.* FROM mig_farm.crop_profiles cp
      JOIN mig_farm.knowledge_sources s ON s.id=cp.source_id
      WHERE cp.id=$1 AND cp.status='verified' AND cp.reviewed_at IS NOT NULL AND s.status='verified'`, [uuid(id)]);
    if (!result.rows[0]) throw fail(422, 'verified_crop_data_unavailable');
    return result.rows[0];
  }

  async function verifiedSpacing(id, cropProfileId) {
    const result = await db.query(`SELECT sp.*,${sourceSelect} FROM mig_farm.crop_spacing_profiles sp
      JOIN mig_farm.knowledge_sources s ON s.id=sp.source_id
      WHERE sp.id=$1 AND sp.crop_profile_id=$2 AND sp.status='verified'
        AND sp.reviewed_at IS NOT NULL AND s.status='verified'`, [uuid(id), uuid(cropProfileId)]);
    if (!result.rows[0]) throw fail(422, 'verified_spacing_data_unavailable');
    return result.rows[0];
  }

  return {
    async listCrops(url) {
      const q = text(url.searchParams.get('q') || '', 80).toLowerCase();
      const values = [];
      let filter = '';
      if (q) {
        values.push(`%${q}%`);
        filter = ` AND (lower(cp.name_ar) LIKE $1 OR lower(cp.name_en) LIKE $1 OR lower(coalesce(cp.scientific_name,'')) LIKE $1 OR lower(cp.slug) LIKE $1)`;
      }
      const rows = (await db.query(`SELECT cp.*,${sourceSelect} FROM mig_farm.crop_profiles cp
        JOIN mig_farm.knowledge_sources s ON s.id=cp.source_id
        WHERE cp.status='verified' AND cp.reviewed_at IS NOT NULL AND s.status='verified'${filter}
        ORDER BY cp.name_en,cp.slug LIMIT 100`, values)).rows;
      return { crops: rows.map(cropDTO), verifiedOnly: true };
    },

    async crop(slug) {
      const result = await db.query(`SELECT cp.*,${sourceSelect} FROM mig_farm.crop_profiles cp
        JOIN mig_farm.knowledge_sources s ON s.id=cp.source_id
        WHERE cp.slug=$1 AND cp.status='verified' AND cp.reviewed_at IS NOT NULL AND s.status='verified'`, [text(decodeURIComponent(slug), 100, true).toLowerCase()]);
      if (!result.rows[0]) throw fail(404, 'verified_crop_not_found');
      const crop = cropDTO(result.rows[0]);
      const spacing = (await db.query(`SELECT sp.*,${sourceSelect} FROM mig_farm.crop_spacing_profiles sp
        JOIN mig_farm.knowledge_sources s ON s.id=sp.source_id
        WHERE sp.crop_profile_id=$1 AND sp.status='verified' AND sp.reviewed_at IS NOT NULL AND s.status='verified'
        ORDER BY sp.production_system,sp.planting_method`, [crop.id])).rows.map(spacingDTO);
      const stages = (await db.query(`SELECT gs.*,${sourceSelect} FROM mig_farm.crop_growth_stages gs
        JOIN mig_farm.knowledge_sources s ON s.id=gs.source_id
        WHERE gs.crop_profile_id=$1 AND gs.status='verified' AND gs.reviewed_at IS NOT NULL AND s.status='verified'
        ORDER BY gs.start_day,gs.end_day`, [crop.id])).rows.map(stageDTO);
      return { crop: { ...crop, spacingProfiles: spacing, growthStages: stages }, verifiedOnly: true };
    },

    async conditions(kind) {
      const table = kind === 'pests' ? 'pests' : 'diseases';
      const rows = (await db.query(`SELECT item.*,${sourceSelect} FROM mig_farm.${table} item
        JOIN mig_farm.knowledge_sources s ON s.id=item.source_id
        WHERE item.status='verified' AND item.reviewed_at IS NOT NULL AND s.status='verified'
        ORDER BY item.name_en,item.slug LIMIT 100`)).rows;
      return { [kind]: rows.map(conditionDTO), verifiedOnly: true };
    },

    async regulations() {
      const rows = (await db.query(`SELECT r.*,${sourceSelect} FROM mig_farm.uae_regulations r
        JOIN mig_farm.knowledge_sources s ON s.id=r.source_id
        WHERE r.status='verified' AND r.reviewed_at IS NOT NULL AND s.status='verified'
        ORDER BY r.effective_at DESC NULLS LAST,r.title_en`)).rows;
      return { regulations: rows.map(regulationDTO), verifiedOnly: true };
    },

    async search(url) {
      const q = text(url.searchParams.get('q') || '', 80, true).toLowerCase();
      if (q.length < 2) throw fail(400, 'search_query_too_short');
      const like = `%${q}%`;
      const crops = (await db.query(`SELECT cp.*,${sourceSelect} FROM mig_farm.crop_profiles cp JOIN mig_farm.knowledge_sources s ON s.id=cp.source_id
        WHERE cp.status='verified' AND s.status='verified' AND (lower(cp.name_ar) LIKE $1 OR lower(cp.name_en) LIKE $1 OR lower(cp.slug) LIKE $1) LIMIT 20`, [like])).rows.map(cropDTO);
      const regulations = (await db.query(`SELECT r.*,${sourceSelect} FROM mig_farm.uae_regulations r JOIN mig_farm.knowledge_sources s ON s.id=r.source_id
        WHERE r.status='verified' AND s.status='verified' AND (lower(r.title_ar) LIKE $1 OR lower(r.title_en) LIKE $1 OR lower(r.summary_ar) LIKE $1 OR lower(r.summary_en) LIKE $1) LIMIT 20`, [like])).rows.map(regulationDTO);
      const articles = (await db.query(`SELECT a.id,a.slug,a.kind,a.title_ar,a.title_en,a.summary_ar,a.summary_en,a.reviewed_at,a.status,${sourceSelect}
        FROM mig_farm.knowledge_articles a JOIN mig_farm.knowledge_sources s ON s.id=a.source_id
        WHERE a.status='verified' AND a.reviewed_at IS NOT NULL AND s.status='verified'
          AND (lower(a.title_ar) LIKE $1 OR lower(a.title_en) LIKE $1 OR lower(a.summary_ar) LIKE $1 OR lower(a.summary_en) LIKE $1) LIMIT 20`, [like])).rows.map((row) => ({
          id: row.id, slug: row.slug, kind: row.kind, titleAr: row.title_ar, titleEn: row.title_en,
          summaryAr: row.summary_ar, summaryEn: row.summary_en, reviewedAt: iso(row.reviewed_at), status: row.status, source: sourceDTO(row),
        }));
      return { crops, regulations, articles, verifiedOnly: true };
    },

    area(body) {
      if (body.mode === 'dimensions') return calculateRectangularArea(body);
      return {
        areaM2: convertAreaToM2(body.area, body.unit),
        inputs: { area: Number(body.area), unit: body.unit || 'm2' },
        dataOrigin: 'user_supplied',
      };
    },

    async planting(body) {
      const areaM2 = body.areaM2 == null ? convertAreaToM2(body.area, body.areaUnit) : positive(body.areaM2, 'invalid_area');
      if (body.spacingProfileId) {
        const profileId = uuid(body.spacingProfileId);
        const row = (await db.query(`SELECT sp.*,${sourceSelect} FROM mig_farm.crop_spacing_profiles sp
          JOIN mig_farm.knowledge_sources s ON s.id=sp.source_id
          WHERE sp.id=$1 AND sp.status='verified' AND sp.reviewed_at IS NOT NULL AND s.status='verified'`, [profileId])).rows[0];
        if (!row) throw fail(422, 'verified_spacing_data_unavailable');
        return {
          result: calculatePlantPopulation({ areaM2, rowSpacingCm:number(row.row_spacing_cm), plantSpacingCm:number(row.plant_spacing_cm), plantsPerStation:row.plants_per_station, usableAreaPercent:number(row.usable_area_percent), dataOrigin:'verified_profile' }),
          profile: spacingDTO(row),
        };
      }
      return {
        result: calculatePlantPopulation({ areaM2, rowSpacingCm:body.rowSpacingCm, plantSpacingCm:body.plantSpacingCm, plantsPerStation:body.plantsPerStation ?? 1, usableAreaPercent:body.usableAreaPercent ?? 100, dataOrigin:'user_supplied' }),
        profile: null,
        warning: 'Spacing values were supplied by the user and are not an agronomic recommendation.',
      };
    },

    layout(body) {
      return { result: calculateGreenhouseLayout(body), warning: 'Dimensions were supplied by the user.' };
    },

    irrigation(body) {
      return {
        result: calculateIrrigationRuntime(body),
        warning: 'Runtime is calculated from user-supplied volume and flow. It does not recommend crop water demand or frequency.',
      };
    },

    async growth(body) {
      const crop = await verifiedCropById(body.cropProfileId);
      const stages = (await db.query(`SELECT stage_key,name_ar,name_en,start_day,end_day,checks_ar,checks_en
        FROM mig_farm.crop_growth_stages WHERE crop_profile_id=$1 AND status='verified' ORDER BY start_day`, [crop.id])).rows.map((row) => ({
          key:row.stage_key,nameAr:row.name_ar,nameEn:row.name_en,startDay:row.start_day,endDay:row.end_day,checksAr:json(row.checks_ar,[]),checksEn:json(row.checks_en,[]),
        }));
      return { result: estimateGrowthStage({ plantingDate:date(body.plantingDate), asOfDate:date(body.asOfDate), stages }) };
    },

    async diagnose(body) {
      const symptoms = list(body.symptoms || []);
      if (!symptoms.length) throw fail(400, 'symptoms_required');
      let cropId = null;
      if (body.cropSlug) {
        const result = await db.query(`SELECT cp.id FROM mig_farm.crop_profiles cp JOIN mig_farm.knowledge_sources s ON s.id=cp.source_id
          WHERE cp.slug=$1 AND cp.status='verified' AND s.status='verified'`, [text(body.cropSlug, 100, true).toLowerCase()]);
        if (!result.rows[0]) throw fail(422, 'verified_crop_data_unavailable');
        cropId = result.rows[0].id;
      }
      const rows = (await db.query(`SELECT r.*,${sourceSelect} FROM mig_farm.symptom_rules r
        JOIN mig_farm.knowledge_sources s ON s.id=r.source_id
        WHERE r.status='verified' AND r.reviewed_at IS NOT NULL AND s.status='verified'
          AND ($1::uuid IS NULL OR r.crop_profile_id IS NULL OR r.crop_profile_id=$1)`, [cropId])).rows;
      const matches = rows.filter((row) => json(row.symptom_keys, []).some((key) => symptoms.includes(String(key).toLowerCase()))).map((row) => ({
        causeType:row.cause_type,possibleCauseAr:row.possible_cause_ar,possibleCauseEn:row.possible_cause_en,
        inspectionChecksAr:json(row.inspection_checks_ar,[]),inspectionChecksEn:json(row.inspection_checks_en,[]),source:sourceDTO(row),
      }));
      return {
        status: matches.length ? 'possible_causes_found' : 'no_verified_match',
        possibleCauses: matches,
        diagnosis: null,
        disclaimerAr: 'هذه احتمالات للفحص وليست تشخيصًا مؤكدًا. لا تستخدم أي علاج قبل التحقق من مختص وملصق المنتج المسجل.',
        disclaimerEn: 'These are inspection possibilities, not a confirmed diagnosis. Do not apply treatment before expert verification and checking the registered product label.',
        verifiedOnly: true,
      };
    },

    async createPlan(user, body) {
      const farmId = uuid(body.farmId);
      const owned = (await db.query(`SELECT id FROM mig_farm.farms WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`, [farmId, user.id])).rows[0];
      if (!owned) throw fail(404, 'not_found');
      let zoneId = null;
      if (body.zoneId) {
        zoneId = uuid(body.zoneId);
        const zone = (await db.query(`SELECT z.id FROM mig_farm.farm_zones z JOIN mig_farm.farms f ON f.id=z.farm_id
          WHERE z.id=$1 AND z.farm_id=$2 AND f.user_id=$3 AND z.deleted_at IS NULL AND f.deleted_at IS NULL`, [zoneId, farmId, user.id])).rows[0];
        if (!zone) throw fail(404, 'not_found');
      }
      const crop = await verifiedCropById(body.cropProfileId);
      const areaM2 = positive(body.areaM2, 'invalid_area');
      let spacing = null;
      let calculation = { resultType:'verified_data_unavailable', reason:'verified_spacing_data_unavailable' };
      if (body.spacingProfileId) {
        spacing = await verifiedSpacing(body.spacingProfileId, crop.id);
        calculation = calculatePlantPopulation({ areaM2, rowSpacingCm:number(spacing.row_spacing_cm), plantSpacingCm:number(spacing.plant_spacing_cm), plantsPerStation:spacing.plants_per_station, usableAreaPercent:number(spacing.usable_area_percent), dataOrigin:'verified_profile' });
      }
      const productionSystem = text(body.productionSystem, 60, true);
      const plantingMethod = text(body.plantingMethod, 60, true);
      const startDate = date(body.plantingDate);
      return db.transaction(async (client) => {
        const cropCycleId = randomUUID();
        await client.query(`INSERT INTO mig_farm.crop_cycles
          (id,farm_id,zone_id,crop_name,crop_catalog_id,planting_date,area_m2,display_area,area_unit,plant_count,growth_stage,status,notes)
          VALUES($1,$2,$3,$4,$5,$6,$7,$7,'m2',$8,'seedling','planned','')`,
          [cropCycleId,farmId,zoneId,user.language==='ar'?crop.name_ar:crop.name_en,crop.id,startDate,areaM2,'plantCount' in calculation?calculation.plantCount:null]);
        const planId = randomUUID();
        const row = (await client.query(`INSERT INTO mig_farm.crop_plans
          (id,user_id,farm_id,zone_id,crop_profile_id,spacing_profile_id,crop_cycle_id,planting_date,area_m2,production_system,planting_method,calculation_json)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [planId,user.id,farmId,zoneId,crop.id,spacing?.id||null,cropCycleId,startDate,areaM2,productionSystem,plantingMethod,JSON.stringify(calculation)])).rows[0];
        const templates = (await client.query(`SELECT t.* FROM mig_farm.crop_task_templates t
          JOIN mig_farm.knowledge_sources s ON s.id=t.source_id
          WHERE t.crop_profile_id=$1 AND t.production_system=$2 AND t.planting_method=$3
            AND t.status='verified' AND t.reviewed_at IS NOT NULL AND s.status='verified'
          ORDER BY t.offset_days,t.id`, [crop.id,productionSystem,plantingMethod])).rows;
        for (const template of templates) {
          const dueDate = new Date(`${startDate}T${String(template.due_time_local).slice(0,8)}+04:00`);
          dueDate.setUTCDate(dueDate.getUTCDate()+template.offset_days);
          await client.query(`INSERT INTO mig_farm.farm_tasks
            (id,user_id,farm_id,zone_id,crop_cycle_id,crop_plan_id,type,title,description,due_at,status,priority,source,original_due_at)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'scheduled','normal','system',$10)`,
            [randomUUID(),user.id,farmId,zoneId,cropCycleId,planId,template.task_type,user.language==='ar'?template.title_ar:template.title_en,user.language==='ar'?template.description_ar:template.description_en,dueDate.toISOString()]);
        }
        return {
          plan:planDTO({...row,crop_slug:crop.slug,crop_name_ar:crop.name_ar,crop_name_en:crop.name_en}),
          generatedTasks:templates.length,
          ...(templates.length?{}:{tasksReason:'verified_task_templates_unavailable'}),
        };
      });
    },

    async plan(user, id) {
      const row = (await db.query(`SELECT p.*,cp.slug crop_slug,cp.name_ar crop_name_ar,cp.name_en crop_name_en
        FROM mig_farm.crop_plans p JOIN mig_farm.crop_profiles cp ON cp.id=p.crop_profile_id
        WHERE p.id=$1 AND p.user_id=$2`, [uuid(id), user.id])).rows[0];
      if (!row) throw fail(404, 'not_found');
      return { plan: planDTO(row) };
    },
  };
}
