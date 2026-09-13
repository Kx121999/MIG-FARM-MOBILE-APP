import { randomUUID } from 'node:crypto';
import { fail, text, uuid } from '../lib/validation.mjs';
import {
  buildCropMission,
  buildFarmToday,
  buildSeasonReport,
  buildWeeklyFarmReport,
} from './engine.mjs';
import { createWeatherProvider } from './weather.mjs';

const STAGES = ['seedling', 'vegetative', 'flowering', 'fruit_set', 'production', 'harvest', 'finished'];
const CHECKIN_VALUES = {
  irrigated: ['yes', 'no', 'skip'],
  stageStarted: ['yes', 'not_yet', 'skip'],
  newProblem: ['yes', 'no'],
  harvested: ['yes', 'no'],
};
const EXPENSE_CATEGORIES = {
  seeds: 'seed', seedlings: 'seedling', fertilizer: 'fertilizer', crop_protection: 'treatment',
  water: 'water', labor: 'labor', transport: 'transport', equipment: 'equipment', other: 'other', energy: 'energy',
};
const PROBLEM_CONDITIONS = ['better', 'same', 'worse', 'resolved', 'note'];
const iso = (value) => value ? new Date(value).toISOString() : null;
const number = (value) => value == null ? null : Number(value);
const today = () => new Date().toISOString().slice(0, 10);
const dateOnly = (value, fallback = null) => {
  const result = value || fallback;
  if (!result || typeof result !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw fail(400, 'invalid_input');
  return result;
};
const timestamp = (value = new Date().toISOString()) => {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw fail(400, 'invalid_input');
  return result.toISOString();
};
const positive = (value) => {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) throw fail(400, 'invalid_input');
  return result;
};
const minorAmount = (value) => Math.round(positive(value) * 100);
const currency = (value) => {
  const result = String(value || 'AED').toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) throw fail(400, 'invalid_input');
  return result;
};
const jsonObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(400, 'invalid_input');
  return value;
};
const rowTime = (row, field) => iso(row[field]);

const farmDTO = (row) => ({
  id: row.id, name: row.name, type: row.type, emirate: row.emirate, region: row.region,
  areaM2: number(row.area_m2), updatedAt: rowTime(row, 'updated_at'),
});
const zoneDTO = (row) => ({
  id: row.id, farmId: row.farm_id, name: row.name, type: row.type,
  irrigationSystem: row.irrigation_system, waterSource: row.water_source,
});
const cropDTO = (row) => ({
  id: row.id, farmId: row.farm_id, zoneId: row.zone_id, cropName: row.crop_name,
  variety: row.variety, plantingDate: row.planting_date, expectedHarvestDate: row.expected_harvest_date,
  actualHarvestDate: row.actual_harvest_date, areaM2: number(row.area_m2), plantCount: row.plant_count,
  growthStage: row.growth_stage, status: row.status, notes: row.notes,
  createdAt: rowTime(row, 'created_at'), updatedAt: rowTime(row, 'updated_at'),
});
const taskDTO = (row) => ({
  id: row.id, farmId: row.farm_id, zoneId: row.zone_id, cropCycleId: row.crop_cycle_id,
  problemId: row.problem_id, type: row.type, title: row.title, description: row.description,
  dueAt: rowTime(row, 'due_at'), completedAt: rowTime(row, 'completed_at'), status: row.status,
  priority: row.priority, source: row.source,
});
const problemDTO = (row) => ({
  id: row.id, farmId: row.farm_id, zoneId: row.zone_id, cropCycleId: row.crop_cycle_id,
  title: row.title, description: row.description, category: row.category, severity: row.severity,
  status: row.status, firstObservedAt: rowTime(row, 'first_observed_at'),
  lastFollowUpAt: rowTime(row, 'last_follow_up_at'), nextFollowUpAt: rowTime(row, 'next_follow_up_at'),
  resolvedAt: rowTime(row, 'resolved_at'), updatedAt: rowTime(row, 'updated_at'),
});
const irrigationDTO = (row) => ({
  id: row.id, farmId: row.farm_id, zoneId: row.zone_id, cropCycleId: row.crop_cycle_id,
  startedAt: rowTime(row, 'started_at'), durationMinutes: row.duration_minutes,
  waterVolumeLiters: number(row.water_volume_liters), method: row.method, notes: row.notes,
});
const operationDTO = (row) => ({
  id: row.id, farmId: row.farm_id, zoneId: row.zone_id, cropCycleId: row.crop_cycle_id,
  type: row.type, performedAt: rowTime(row, 'performed_at'), productNameSnapshot: row.product_name_snapshot,
  quantity: number(row.quantity), unit: row.unit, notes: row.notes, source: row.source,
});
const harvestDTO = (row) => ({
  id: row.id, farmId: row.farm_id, zoneId: row.zone_id, cropCycleId: row.crop_cycle_id,
  harvestedAt: rowTime(row, 'harvested_at'), quantity: Number(row.quantity), unit: row.unit,
  customUnit: row.custom_unit, qualityNotes: row.quality_notes,
});
const expenseDTO = (row) => ({
  id: row.id, farmId: row.farm_id, cropCycleId: row.crop_cycle_id, cropPlanId: row.crop_plan_id,
  category: row.category, amountMinor: Number(row.amount_minor), currency: row.currency,
  occurredAt: row.occurred_at, notes: row.notes, createdAt: rowTime(row, 'created_at'),
});
const saleDTO = (row) => ({
  id: row.id, farmId: row.farm_id, cropCycleId: row.crop_cycle_id, soldAt: row.sold_at,
  quantity: Number(row.quantity), unit: row.unit, unitPriceMinor: Number(row.unit_price_minor),
  totalMinor: Number(row.total_minor), currency: row.currency, buyerNotes: row.buyer_notes,
  createdAt: rowTime(row, 'created_at'),
});
const eventDTO = (row) => ({
  id: row.id, farmId: row.farm_id, zoneId: row.zone_id, cropCycleId: row.crop_cycle_id,
  problemId: row.problem_id, eventType: row.event_type, eventAt: rowTime(row, 'occurred_at'),
  payload: row.payload_json, source: row.source,
});

export function createFarmCommand(db, { env = process.env, weatherProvider = createWeatherProvider(env) } = {}) {
  if (!db) {
    const unavailable = async () => { throw fail(503, 'database_not_configured'); };
    return new Proxy({}, { get: () => unavailable });
  }
  const one = async (sql, values) => (await db.query(sql, values)).rows[0];
  const ownedFarm = async (user, rawId) => {
    const row = await one('SELECT * FROM mig_farm.farms WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [uuid(rawId), user.id]);
    if (!row) throw fail(404, 'not_found');
    return row;
  };
  const ownedCrop = async (user, rawId) => {
    const row = await one(`SELECT c.* FROM mig_farm.crop_cycles c JOIN mig_farm.farms f ON f.id=c.farm_id
      WHERE c.id=$1 AND f.user_id=$2 AND c.deleted_at IS NULL AND f.deleted_at IS NULL`, [uuid(rawId), user.id]);
    if (!row) throw fail(404, 'not_found');
    return row;
  };
  const ownedProblem = async (user, rawId) => {
    const row = await one('SELECT * FROM mig_farm.farm_problems WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [uuid(rawId), user.id]);
    if (!row) throw fail(404, 'not_found');
    return row;
  };
  const addEvent = (client, user, data) => client.query(`INSERT INTO mig_farm.farm_events
    (id,user_id,farm_id,zone_id,crop_cycle_id,problem_id,event_type,occurred_at,payload_json,source)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
    randomUUID(), user.id, data.farmId, data.zoneId || null, data.cropCycleId || null,
    data.problemId || null, data.eventType, data.occurredAt || new Date().toISOString(),
    JSON.stringify(data.payload || {}), data.source || 'user_recorded',
  ]);

  const loadCommandData = async (user, rawFarmId = null) => {
    const farmId = rawFarmId ? (await ownedFarm(user, rawFarmId)).id : null;
    const values = [user.id, farmId];
    const [farms, zones, crops, tasks, problems, irrigations, operations, harvests, expenses, sales, photos, confirmations, stages] = await Promise.all([
      db.query(`SELECT * FROM mig_farm.farms WHERE user_id=$1 AND deleted_at IS NULL AND ($2::uuid IS NULL OR id=$2) ORDER BY updated_at DESC,id`, values),
      db.query(`SELECT z.* FROM mig_farm.farm_zones z JOIN mig_farm.farms f ON f.id=z.farm_id WHERE f.user_id=$1 AND f.deleted_at IS NULL AND z.deleted_at IS NULL AND ($2::uuid IS NULL OR z.farm_id=$2) ORDER BY z.created_at,z.id`, values),
      db.query(`SELECT c.* FROM mig_farm.crop_cycles c JOIN mig_farm.farms f ON f.id=c.farm_id WHERE f.user_id=$1 AND f.deleted_at IS NULL AND c.deleted_at IS NULL AND c.status IN ('planted','active','harvesting') AND ($2::uuid IS NULL OR c.farm_id=$2) ORDER BY c.updated_at DESC,c.id LIMIT 60`, values),
      db.query(`SELECT * FROM mig_farm.farm_tasks WHERE user_id=$1 AND deleted_at IS NULL AND status NOT IN ('completed','cancelled') AND due_at<now()+interval '30 days' AND ($2::uuid IS NULL OR farm_id=$2) ORDER BY due_at,id LIMIT 300`, values),
      db.query(`SELECT * FROM mig_farm.farm_problems WHERE user_id=$1 AND deleted_at IS NULL AND status<>'resolved' AND ($2::uuid IS NULL OR farm_id=$2) ORDER BY updated_at DESC,id LIMIT 200`, values),
      db.query(`SELECT * FROM mig_farm.irrigation_records WHERE user_id=$1 AND started_at>now()-interval '180 days' AND ($2::uuid IS NULL OR farm_id=$2) ORDER BY started_at DESC,id LIMIT 600`, values),
      db.query(`SELECT * FROM mig_farm.farm_operations WHERE user_id=$1 AND ($2::uuid IS NULL OR farm_id=$2) ORDER BY performed_at DESC,id LIMIT 300`, values),
      db.query(`SELECT * FROM mig_farm.harvest_records WHERE user_id=$1 AND ($2::uuid IS NULL OR farm_id=$2) ORDER BY harvested_at DESC,id LIMIT 300`, values),
      db.query(`SELECT * FROM mig_farm.farm_cost_records WHERE user_id=$1 AND ($2::uuid IS NULL OR farm_id=$2) ORDER BY occurred_at DESC,id LIMIT 500`, values),
      db.query(`SELECT * FROM mig_farm.farm_sales WHERE user_id=$1 AND ($2::uuid IS NULL OR farm_id=$2) ORDER BY sold_at DESC,id LIMIT 500`, values),
      db.query(`SELECT * FROM mig_farm.farm_media WHERE user_id=$1 AND crop_cycle_id IS NOT NULL AND ($2::uuid IS NULL OR farm_id=$2) ORDER BY captured_at DESC,id LIMIT 300`, values),
      db.query(`SELECT * FROM mig_farm.crop_stage_confirmations WHERE user_id=$1 AND ($2::uuid IS NULL OR farm_id=$2) ORDER BY confirmed_at DESC,id`, values),
      db.query(`SELECT s.*,p.crop_cycle_id FROM mig_farm.crop_plans p
        JOIN mig_farm.crop_growth_stages s ON s.crop_profile_id=p.crop_profile_id
        JOIN mig_farm.knowledge_sources source ON source.id=s.source_id
        WHERE p.user_id=$1 AND p.crop_cycle_id IS NOT NULL AND s.status='verified' AND source.status='verified'
          AND ($2::uuid IS NULL OR p.farm_id=$2) ORDER BY s.start_day,s.id`, values),
    ]);
    const data = {
      farms: farms.rows.map(farmDTO), zones: zones.rows.map(zoneDTO), crops: crops.rows.map(cropDTO),
      tasks: tasks.rows.map(taskDTO), problems: problems.rows.map(problemDTO),
      irrigations: irrigations.rows.map(irrigationDTO), operations: operations.rows.map(operationDTO),
      harvests: harvests.rows.map(harvestDTO), expenses: expenses.rows.map(expenseDTO),
      sales: sales.rows.map(saleDTO),
      photos: photos.rows.map((row) => ({ id: row.id, cropCycleId: row.crop_cycle_id, type: row.type, url: row.url, thumbnailUrl: row.thumbnail_url, capturedAt: rowTime(row, 'captured_at'), notes: row.notes })),
      confirmations: confirmations.rows.map((row) => ({ id: row.id, cropCycleId: row.crop_cycle_id, stageKey: row.stage_key, expectedAt: row.expected_at, confirmedAt: rowTime(row, 'confirmed_at'), adjustmentDays: row.adjustment_days })),
      stages: stages.rows.map((row) => ({ id: row.id, cropCycleId: row.crop_cycle_id, key: row.stage_key, nameAr: row.name_ar, nameEn: row.name_en, startDay: row.start_day, endDay: row.end_day, status: row.status })),
    };
    const missions = data.crops.map((crop) => buildCropMission({
      crop,
      farm: data.farms.find((item) => item.id === crop.farmId),
      zone: data.zones.find((item) => item.id === crop.zoneId) || null,
      tasks: data.tasks.filter((item) => item.cropCycleId === crop.id),
      problems: data.problems.filter((item) => item.cropCycleId === crop.id),
      irrigations: data.irrigations.filter((item) => item.cropCycleId === crop.id),
      operations: data.operations.filter((item) => item.cropCycleId === crop.id),
      harvests: data.harvests.filter((item) => item.cropCycleId === crop.id),
      expenses: data.expenses.filter((item) => item.cropCycleId === crop.id),
      sales: data.sales.filter((item) => item.cropCycleId === crop.id),
      photos: data.photos.filter((item) => item.cropCycleId === crop.id),
      stageProfiles: data.stages.filter((item) => item.cropCycleId === crop.id),
      confirmations: data.confirmations.filter((item) => item.cropCycleId === crop.id),
    }));
    return { ...data, missions, farmId };
  };

  const reportData = async (user, farmId, from, to) => {
    const values = [user.id, farmId, from, to];
    const [tasks, irrigations, operations, problems, updates, confirmations, photos, harvests, expenses, sales] = await Promise.all([
      db.query(`SELECT * FROM mig_farm.farm_tasks WHERE user_id=$1 AND farm_id=$2 AND deleted_at IS NULL AND (due_at::date BETWEEN $3 AND $4 OR completed_at::date BETWEEN $3 AND $4)`, values),
      db.query(`SELECT * FROM mig_farm.irrigation_records WHERE user_id=$1 AND farm_id=$2 AND started_at::date BETWEEN $3 AND $4`, values),
      db.query(`SELECT * FROM mig_farm.farm_operations WHERE user_id=$1 AND farm_id=$2 AND performed_at::date BETWEEN $3 AND $4`, values),
      db.query(`SELECT * FROM mig_farm.farm_problems WHERE user_id=$1 AND farm_id=$2 AND first_observed_at::date BETWEEN $3 AND $4`, values),
      db.query(`SELECT u.* FROM mig_farm.farm_problem_updates u JOIN mig_farm.farm_problems p ON p.id=u.problem_id WHERE u.user_id=$1 AND p.farm_id=$2 AND u.created_at::date BETWEEN $3 AND $4`, values),
      db.query(`SELECT * FROM mig_farm.crop_stage_confirmations WHERE user_id=$1 AND farm_id=$2 AND confirmed_at::date BETWEEN $3 AND $4`, values),
      db.query(`SELECT * FROM mig_farm.farm_media WHERE user_id=$1 AND farm_id=$2 AND captured_at::date BETWEEN $3 AND $4`, values),
      db.query(`SELECT * FROM mig_farm.harvest_records WHERE user_id=$1 AND farm_id=$2 AND harvested_at::date BETWEEN $3 AND $4`, values),
      db.query(`SELECT * FROM mig_farm.farm_cost_records WHERE user_id=$1 AND farm_id=$2 AND occurred_at BETWEEN $3 AND $4`, values),
      db.query(`SELECT * FROM mig_farm.farm_sales WHERE user_id=$1 AND farm_id=$2 AND sold_at BETWEEN $3 AND $4`, values),
    ]);
    return buildWeeklyFarmReport({ period: { from, to }, tasks: tasks.rows, irrigations: irrigations.rows, operations: operations.rows, problems: problems.rows, problemUpdates: updates.rows, stageConfirmations: confirmations.rows, photos: photos.rows, harvests: harvests.rows, expenses: expenses.rows, sales: sales.rows });
  };

  return {
    async today(user, url) {
      const data = await loadCommandData(user, url.searchParams.get('farmId'));
      const weather = await weatherProvider.current({ farms: data.farms });
      return buildFarmToday({ ...data, selectedFarmId: data.farmId || data.farms[0]?.id || null, weather });
    },

    async commandCenter(user, url) {
      const result = await this.today(user, url);
      return { ...result, emptyState: result.missions.length ? null : 'plan_first_crop' };
    },

    async changes(user, url) {
      const sinceRaw = url.searchParams.get('since');
      if (!sinceRaw) return { since: null, changes: [], reason: 'last_visit_not_provided' };
      const since = timestamp(sinceRaw);
      const farmId = url.searchParams.get('farmId') ? (await ownedFarm(user, url.searchParams.get('farmId'))).id : null;
      const values = [user.id, since, farmId];
      const [events, overdue] = await Promise.all([
        db.query(`SELECT * FROM mig_farm.farm_events WHERE user_id=$1 AND occurred_at>$2 AND ($3::uuid IS NULL OR farm_id=$3) ORDER BY occurred_at DESC,id LIMIT 80`, values),
        db.query(`SELECT count(*)::int count FROM mig_farm.farm_tasks WHERE user_id=$1 AND deleted_at IS NULL AND status NOT IN ('completed','cancelled') AND due_at>$2 AND due_at<=now() AND ($3::uuid IS NULL OR farm_id=$3)`, values),
      ]);
      const changes = events.rows.map(eventDTO);
      if (overdue.rows[0].count) changes.unshift({ eventType: 'tasks_became_overdue', count: overdue.rows[0].count, eventAt: new Date().toISOString(), source: 'farm_record' });
      return { since, changes };
    },

    async mission(user, cropId) {
      const crop = await ownedCrop(user, cropId);
      const data = await loadCommandData(user, crop.farm_id);
      const mission = data.missions.find((item) => item.id === crop.id);
      if (!mission) throw fail(404, 'not_found');
      const checkin = await one('SELECT * FROM mig_farm.crop_checkins WHERE user_id=$1 AND crop_cycle_id=$2 AND checkin_date=current_date', [user.id, crop.id]);
      return {
        mission,
        todayCheckIn: checkin ? { id: checkin.id, date: checkin.checkin_date, answers: checkin.answers_json, notes: checkin.notes } : null,
        checkInQuestions: buildCheckInQuestions(mission),
      };
    },

    async checkIn(user, cropId, body) {
      const crop = await ownedCrop(user, cropId);
      const answers = jsonObject(body.answers || {});
      for (const [key, value] of Object.entries(answers)) {
        if (!CHECKIN_VALUES[key]?.includes(value)) throw fail(400, 'invalid_input');
      }
      const checkinDate = dateOnly(body.date, today());
      const notes = body.notes == null ? '' : text(body.notes, 1000);
      return db.transaction(async (client) => {
        const row = (await client.query(`INSERT INTO mig_farm.crop_checkins
          (id,user_id,farm_id,zone_id,crop_cycle_id,checkin_date,answers_json,notes)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT(user_id,crop_cycle_id,checkin_date) DO UPDATE SET answers_json=EXCLUDED.answers_json,notes=EXCLUDED.notes,updated_at=now()
          RETURNING *`, [randomUUID(), user.id, crop.farm_id, crop.zone_id, crop.id, checkinDate, JSON.stringify(answers), notes])).rows[0];
        await addEvent(client, user, { farmId: crop.farm_id, zoneId: crop.zone_id, cropCycleId: crop.id, eventType: 'checkin_recorded', occurredAt: `${checkinDate}T12:00:00Z`, payload: { entityId: row.id, answers }, source: 'user_recorded' });
        return { checkIn: { id: row.id, date: row.checkin_date, answers: row.answers_json, notes: row.notes }, nextActions: answers.newProblem === 'yes' ? ['record_problem'] : answers.harvested === 'yes' ? ['record_harvest'] : [] };
      });
    },

    async confirmStage(user, cropId, body) {
      const crop = await ownedCrop(user, cropId);
      const stageKey = String(body.stageKey || '');
      if (!STAGES.includes(stageKey)) throw fail(400, 'invalid_input');
      const confirmedAt = timestamp(body.confirmedAt);
      const verified = await one(`SELECT s.* FROM mig_farm.crop_plans p
        JOIN mig_farm.crop_growth_stages s ON s.crop_profile_id=p.crop_profile_id
        JOIN mig_farm.knowledge_sources source ON source.id=s.source_id
        WHERE p.user_id=$1 AND p.crop_cycle_id=$2 AND s.stage_key=$3 AND s.status='verified' AND source.status='verified'
        ORDER BY s.reviewed_at DESC,s.id LIMIT 1`, [user.id, crop.id, stageKey]);
      const expectedAt = verified && crop.planting_date ? new Date(crop.planting_date) : null;
      if (expectedAt) expectedAt.setUTCHours(0,0,0,0);
      if (expectedAt) expectedAt.setUTCDate(expectedAt.getUTCDate() + Number(verified.start_day));
      const adjustmentDays = expectedAt ? Math.round((new Date(confirmedAt).getTime() - expectedAt.getTime()) / 86_400_000) : 0;
      const notes = body.notes == null ? '' : text(body.notes, 1000);
      return db.transaction(async (client) => {
        const previous = (await client.query('SELECT * FROM mig_farm.crop_stage_confirmations WHERE user_id=$1 AND crop_cycle_id=$2 AND stage_key=$3', [user.id, crop.id, stageKey])).rows[0];
        const delta = adjustmentDays - Number(previous?.adjustment_days || 0);
        const row = (await client.query(`INSERT INTO mig_farm.crop_stage_confirmations
          (id,user_id,farm_id,crop_cycle_id,stage_key,expected_at,confirmed_at,adjustment_days,source_stage_id,notes)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT(user_id,crop_cycle_id,stage_key) DO UPDATE SET expected_at=EXCLUDED.expected_at,confirmed_at=EXCLUDED.confirmed_at,adjustment_days=EXCLUDED.adjustment_days,source_stage_id=EXCLUDED.source_stage_id,notes=EXCLUDED.notes
          RETURNING *`, [randomUUID(), user.id, crop.farm_id, crop.id, stageKey, expectedAt?.toISOString().slice(0, 10) || null, confirmedAt, adjustmentDays, verified?.id || null, notes])).rows[0];
        await client.query(`UPDATE mig_farm.crop_cycles SET growth_stage=$1,status=$2,updated_at=now(),version=version+1 WHERE id=$3`, [stageKey, stageKey === 'harvest' ? 'harvesting' : stageKey === 'finished' ? 'completed' : 'active', crop.id]);
        let adjustedTasks = 0;
        if (verified && delta !== 0) {
          const changed = await client.query(`UPDATE mig_farm.farm_tasks
            SET original_due_at=COALESCE(original_due_at,due_at),due_at=due_at+($1*interval '1 day'),schedule_adjustment_days=schedule_adjustment_days+$1,updated_at=now(),version=version+1
            WHERE user_id=$2 AND crop_cycle_id=$3 AND source='system' AND deleted_at IS NULL AND completed_at IS NULL
              AND status IN ('scheduled','due') AND due_at::date>=$4 RETURNING id`, [delta, user.id, crop.id, expectedAt.toISOString().slice(0, 10)]);
          adjustedTasks = changed.rows.length;
        }
        await addEvent(client, user, { farmId: crop.farm_id, zoneId: crop.zone_id, cropCycleId: crop.id, eventType: 'stage_confirmed', occurredAt: confirmedAt, payload: { entityId: row.id, stageKey, expectedAt: expectedAt?.toISOString().slice(0, 10) || null, adjustmentDays, adjustedTasks }, source: verified ? 'verified_knowledge' : 'user_recorded' });
        return {
          confirmation: { id: row.id, stageKey: row.stage_key, expectedAt: row.expected_at, confirmedAt: rowTime(row, 'confirmed_at'), adjustmentDays: row.adjustment_days },
          adjustedTasks,
          adaptation: verified ? 'future_verified_tasks_shifted' : 'verified_guidance_not_available',
        };
      });
    },

    async timeline(user, cropId, url) {
      const crop = await ownedCrop(user, cropId);
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));
      if (!Number.isInteger(limit)) throw fail(400, 'invalid_input');
      const events = (await db.query('SELECT * FROM mig_farm.farm_events WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY occurred_at DESC,id LIMIT $3', [user.id, crop.id, limit])).rows.map(eventDTO);
      const represented = new Set(events.map((item) => `${item.eventType}:${item.payload?.entityId || ''}`));
      const [irrigations, operations, problems, photos, harvests, notes, tasks, stages, expenses, sales] = await Promise.all([
        db.query('SELECT * FROM mig_farm.irrigation_records WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY started_at DESC,id LIMIT $3', [user.id, crop.id, limit]),
        db.query('SELECT * FROM mig_farm.farm_operations WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY performed_at DESC,id LIMIT $3', [user.id, crop.id, limit]),
        db.query('SELECT * FROM mig_farm.farm_problems WHERE user_id=$1 AND crop_cycle_id=$2 AND deleted_at IS NULL ORDER BY first_observed_at DESC,id LIMIT $3', [user.id, crop.id, limit]),
        db.query('SELECT * FROM mig_farm.farm_media WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY captured_at DESC,id LIMIT $3', [user.id, crop.id, limit]),
        db.query('SELECT * FROM mig_farm.harvest_records WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY harvested_at DESC,id LIMIT $3', [user.id, crop.id, limit]),
        db.query('SELECT * FROM mig_farm.farm_notes WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY created_at DESC,id LIMIT $3', [user.id, crop.id, limit]),
        db.query("SELECT * FROM mig_farm.farm_tasks WHERE user_id=$1 AND crop_cycle_id=$2 AND completed_at IS NOT NULL ORDER BY completed_at DESC,id LIMIT $3", [user.id, crop.id, limit]),
        db.query('SELECT * FROM mig_farm.crop_stage_confirmations WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY confirmed_at DESC,id LIMIT $3', [user.id, crop.id, limit]),
        db.query('SELECT * FROM mig_farm.farm_cost_records WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY occurred_at DESC,id LIMIT $3', [user.id, crop.id, limit]),
        db.query('SELECT * FROM mig_farm.farm_sales WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY sold_at DESC,id LIMIT $3', [user.id, crop.id, limit]),
      ]);
      const legacy = [
        legacyEvent(crop, 'crop_planted', crop.planting_date || crop.created_at, crop, { cropName: crop.crop_name }),
        ...irrigations.rows.map((row) => legacyEvent(row, 'irrigation_recorded', row.started_at, crop, { method: row.method })),
        ...operations.rows.map((row) => legacyEvent(row, 'operation_recorded', row.performed_at, crop, { type: row.type, product: row.product_name_snapshot })),
        ...problems.rows.map((row) => legacyEvent(row, 'problem_opened', row.first_observed_at, crop, { title: row.title, severity: row.severity })),
        ...photos.rows.map((row) => legacyEvent(row, 'photo_added', row.captured_at, crop, { type: row.type, url: row.url })),
        ...harvests.rows.map((row) => legacyEvent(row, 'harvest_recorded', row.harvested_at, crop, { quantity: Number(row.quantity), unit: row.custom_unit || row.unit })),
        ...notes.rows.map((row) => legacyEvent(row, 'note_added', row.created_at, crop, { body: row.body })),
        ...tasks.rows.map((row) => legacyEvent(row, 'task_completed', row.completed_at, crop, { title: row.title })),
        ...stages.rows.map((row) => legacyEvent(row, 'stage_confirmed', row.confirmed_at, crop, { stageKey: row.stage_key })),
        ...expenses.rows.map((row) => legacyEvent(row, 'expense_added', row.occurred_at, crop, { category: row.category, amountMinor: Number(row.amount_minor), currency: row.currency })),
        ...sales.rows.map((row) => legacyEvent(row, 'sale_added', row.sold_at, crop, { quantity: Number(row.quantity), unit: row.unit, totalMinor: Number(row.total_minor), currency: row.currency })),
      ].filter((item) => !represented.has(`${item.eventType}:${item.payload.entityId}`));
      return { timeline: [...events, ...legacy].sort((a, b) => String(b.eventAt).localeCompare(String(a.eventAt))).slice(0, limit) };
    },

    async followProblem(user, problemId, body) {
      const problem = await ownedProblem(user, problemId);
      const condition = String(body.condition || 'note');
      if (!PROBLEM_CONDITIONS.includes(condition)) throw fail(400, 'invalid_input');
      const notes = body.notes == null ? '' : text(body.notes, 1000);
      const nextFollowUpAt = condition === 'resolved' ? null : timestamp(body.nextFollowUpAt || new Date(Date.now() + 2 * 86_400_000).toISOString());
      const status = condition === 'better' ? 'improving' : condition === 'same' ? 'monitoring' : condition === 'worse' ? 'action_required' : condition === 'resolved' ? 'resolved' : problem.status;
      return db.transaction(async (client) => {
        const update = (await client.query('INSERT INTO mig_farm.farm_problem_updates(id,problem_id,user_id,condition,notes) VALUES($1,$2,$3,$4,$5) RETURNING *', [randomUUID(), problem.id, user.id, condition, notes])).rows[0];
        const changed = (await client.query(`UPDATE mig_farm.farm_problems SET status=$1,last_follow_up_at=now(),next_follow_up_at=$2,resolved_at=$3,updated_at=now(),version=version+1 WHERE id=$4 AND user_id=$5 RETURNING *`, [status, nextFollowUpAt, status === 'resolved' ? new Date().toISOString() : null, problem.id, user.id])).rows[0];
        if (nextFollowUpAt) {
          const existing = (await client.query("SELECT id FROM mig_farm.farm_tasks WHERE user_id=$1 AND problem_id=$2 AND type='problem_follow_up' AND status NOT IN ('completed','cancelled') AND deleted_at IS NULL ORDER BY due_at LIMIT 1", [user.id, problem.id])).rows[0];
          if (existing) await client.query('UPDATE mig_farm.farm_tasks SET due_at=$1,status=\'scheduled\',updated_at=now(),version=version+1 WHERE id=$2', [nextFollowUpAt, existing.id]);
          else await client.query(`INSERT INTO mig_farm.farm_tasks(id,user_id,farm_id,zone_id,crop_cycle_id,problem_id,type,title,due_at,status,priority,source,original_due_at)
            VALUES($1,$2,$3,$4,$5,$6,'problem_follow_up',$7,$8,'scheduled','important','problem_follow_up',$8)`, [randomUUID(), user.id, problem.farm_id, problem.zone_id, problem.crop_cycle_id, problem.id, `Follow up: ${problem.title}`, nextFollowUpAt]);
        }
        await addEvent(client, user, { farmId: problem.farm_id, zoneId: problem.zone_id, cropCycleId: problem.crop_cycle_id, problemId: problem.id, eventType: status === 'resolved' ? 'problem_resolved' : 'problem_updated', payload: { entityId: update.id, condition, nextFollowUpAt }, source: 'user_recorded' });
        return { problem: problemDTO(changed), update: { id: update.id, condition: update.condition, notes: update.notes, createdAt: rowTime(update, 'created_at') } };
      });
    },

    async weeklyReport(user, farmId, url) {
      const farm = await ownedFarm(user, farmId);
      const end = dateOnly(url.searchParams.get('to'), today());
      const startDate = new Date(`${end}T00:00:00Z`);
      startDate.setUTCDate(startDate.getUTCDate() - 6);
      const from = dateOnly(url.searchParams.get('from'), startDate.toISOString().slice(0, 10));
      if (from > end) throw fail(400, 'invalid_input');
      const report = await reportData(user, farm.id, from, end);
      await db.query(`INSERT INTO mig_farm.farm_report_snapshots(id,user_id,farm_id,period_start,period_end,report_json)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,farm_id,period_start,period_end) DO UPDATE SET report_json=EXCLUDED.report_json,generated_at=now()`, [randomUUID(), user.id, farm.id, from, end, JSON.stringify(report)]);
      return { farm: farmDTO(farm), report, comparison: null };
    },

    async seasonReport(user, cropId) {
      const crop = await ownedCrop(user, cropId);
      const values = [user.id, crop.id];
      const [stages, irrigations, problems, harvests, expenses, sales, notes] = await Promise.all([
        db.query('SELECT * FROM mig_farm.crop_stage_confirmations WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY confirmed_at,id', values),
        db.query('SELECT * FROM mig_farm.irrigation_records WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY started_at,id', values),
        db.query('SELECT * FROM mig_farm.farm_problems WHERE user_id=$1 AND crop_cycle_id=$2 AND deleted_at IS NULL ORDER BY first_observed_at,id', values),
        db.query('SELECT * FROM mig_farm.harvest_records WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY harvested_at,id', values),
        db.query('SELECT * FROM mig_farm.farm_cost_records WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY occurred_at,id', values),
        db.query('SELECT * FROM mig_farm.farm_sales WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY sold_at,id', values),
        db.query('SELECT * FROM mig_farm.farm_notes WHERE user_id=$1 AND crop_cycle_id=$2 ORDER BY created_at,id', values),
      ]);
      const report = buildSeasonReport({ crop, stageConfirmations: stages.rows, irrigations: irrigations.rows, problems: problems.rows, harvests: harvests.rows, expenses: expenses.rows, sales: sales.rows, notes: notes.rows });
      if (crop.status === 'completed') await db.query(`INSERT INTO mig_farm.season_reports(id,user_id,farm_id,crop_cycle_id,report_json)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(crop_cycle_id) DO UPDATE SET report_json=EXCLUDED.report_json,generated_at=now(),updated_at=now()`, [randomUUID(), user.id, crop.farm_id, crop.id, JSON.stringify(report)]);
      return { report, stored: crop.status === 'completed' };
    },

    async seasonHistory(user, farmId) {
      const farm = await ownedFarm(user, farmId);
      const rows = (await db.query(`SELECT r.report_json,r.generated_at,c.id crop_cycle_id,c.crop_name,c.variety,c.planting_date,c.actual_harvest_date
        FROM mig_farm.season_reports r JOIN mig_farm.crop_cycles c ON c.id=r.crop_cycle_id
        WHERE r.user_id=$1 AND r.farm_id=$2 ORDER BY c.actual_harvest_date DESC NULLS LAST,r.generated_at DESC,r.id LIMIT 100`,[user.id,farm.id])).rows;
      return {farm:farmDTO(farm),seasons:rows.map((row)=>({cropCycleId:row.crop_cycle_id,cropName:row.crop_name,variety:row.variety,plantingDate:row.planting_date,actualHarvestDate:row.actual_harvest_date,generatedAt:rowTime(row,'generated_at'),report:row.report_json,source:'farm_record_calculation'}))};
    },

    async listExpenses(user, url) {
      const farm = await ownedFarm(user, url.searchParams.get('farmId'));
      const values = [user.id, farm.id];
      let cropClause = '';
      if (url.searchParams.get('cropId')) { const crop = await ownedCrop(user, url.searchParams.get('cropId')); if (crop.farm_id !== farm.id) throw fail(404, 'not_found'); values.push(crop.id); cropClause = ' AND crop_cycle_id=$3'; }
      const rows = (await db.query(`SELECT * FROM mig_farm.farm_cost_records WHERE user_id=$1 AND farm_id=$2${cropClause} ORDER BY occurred_at DESC,id LIMIT 200`, values)).rows.map(expenseDTO);
      return { expenses: rows, totalMinor: rows.reduce((sum, item) => sum + item.amountMinor, 0), currency: rows[0]?.currency || 'AED' };
    },

    async createExpense(user, body) {
      const farm = await ownedFarm(user, body.farmId);
      let cropId = null;
      if (body.cropCycleId) { const crop = await ownedCrop(user, body.cropCycleId); if (crop.farm_id !== farm.id) throw fail(404, 'not_found'); cropId = crop.id; }
      const category = EXPENSE_CATEGORIES[String(body.category || '')];
      if (!category) throw fail(400, 'invalid_input');
      const occurredAt = dateOnly(body.date, today());
      const amountMinor = minorAmount(body.amount);
      const code = currency(body.currency);
      const notes = body.notes == null ? '' : text(body.notes, 1000);
      return db.transaction(async (client) => {
        const row = (await client.query(`INSERT INTO mig_farm.farm_cost_records(id,user_id,farm_id,crop_cycle_id,category,amount_minor,currency,occurred_at,notes)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [randomUUID(), user.id, farm.id, cropId, category, amountMinor, code, occurredAt, notes])).rows[0];
        await addEvent(client, user, { farmId: farm.id, cropCycleId: cropId, eventType: 'expense_added', occurredAt: `${occurredAt}T12:00:00Z`, payload: { entityId: row.id, category, amountMinor, currency: code }, source: 'user_recorded' });
        return { expense: expenseDTO(row) };
      });
    },

    async listSales(user, url) {
      const farm = await ownedFarm(user, url.searchParams.get('farmId'));
      const values = [user.id, farm.id];
      let cropClause = '';
      if (url.searchParams.get('cropId')) { const crop = await ownedCrop(user, url.searchParams.get('cropId')); if (crop.farm_id !== farm.id) throw fail(404, 'not_found'); values.push(crop.id); cropClause = ' AND crop_cycle_id=$3'; }
      const rows = (await db.query(`SELECT * FROM mig_farm.farm_sales WHERE user_id=$1 AND farm_id=$2${cropClause} ORDER BY sold_at DESC,id LIMIT 200`, values)).rows.map(saleDTO);
      return { sales: rows, revenueMinor: rows.reduce((sum, item) => sum + item.totalMinor, 0), currency: rows[0]?.currency || 'AED' };
    },

    async createSale(user, body) {
      const farm = await ownedFarm(user, body.farmId);
      const crop = await ownedCrop(user, body.cropCycleId);
      if (crop.farm_id !== farm.id) throw fail(404, 'not_found');
      const quantity = positive(body.quantity);
      const unitPriceMinor = minorAmount(body.unitPrice);
      const totalMinor = Math.round(quantity * unitPriceMinor);
      const soldAt = dateOnly(body.date, today());
      const unit = text(body.unit, 40, true);
      const code = currency(body.currency);
      const buyerNotes = body.buyerNotes == null ? '' : text(body.buyerNotes, 1000);
      return db.transaction(async (client) => {
        const row = (await client.query(`INSERT INTO mig_farm.farm_sales(id,user_id,farm_id,crop_cycle_id,sold_at,quantity,unit,unit_price_minor,total_minor,currency,buyer_notes)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [randomUUID(), user.id, farm.id, crop.id, soldAt, quantity, unit, unitPriceMinor, totalMinor, code, buyerNotes])).rows[0];
        await addEvent(client, user, { farmId: farm.id, zoneId: crop.zone_id, cropCycleId: crop.id, eventType: 'sale_added', occurredAt: `${soldAt}T12:00:00Z`, payload: { entityId: row.id, quantity, unit, totalMinor, currency: code }, source: 'user_recorded' });
        return { sale: saleDTO(row) };
      });
    },

    async statusReport(user, url) {
      const command = await this.today(user, url);
      return {
        doingWell: Object.entries(command.status).filter(([, value]) => value === 'good').map(([key]) => key),
        needsAttention: command.topActions.filter((item) => ['critical', 'high'].includes(item.priority)),
        missingInformation: command.missions.flatMap((mission) => mission.completeness.missing.map((field) => ({ cropCycleId: mission.id, field }))),
        upcomingMilestones: command.missions.map((mission) => ({ cropCycleId: mission.id, next: mission.stage.next })).filter((item) => item.next),
        unresolvedProblems: command.missions.flatMap((mission) => mission.openProblems),
        suggestedChecks: command.topActions.filter((item) => ['irrigation_record_gap', 'stage_confirmation'].includes(item.kind)),
        source: 'deterministic_farm_command',
      };
    },

    async escalateProblem(user, problemId) {
      const problem = await ownedProblem(user, problemId);
      const crop = problem.crop_cycle_id ? await ownedCrop(user, problem.crop_cycle_id) : null;
      const farm = await ownedFarm(user, problem.farm_id);
      const values = [user.id, problem.id];
      const [updates, media, diagnoses] = await Promise.all([
        db.query('SELECT condition,notes,created_at FROM mig_farm.farm_problem_updates WHERE user_id=$1 AND problem_id=$2 ORDER BY created_at,id', values),
        db.query('SELECT type,url,thumbnail_url,captured_at,notes FROM mig_farm.farm_media WHERE user_id=$1 AND problem_id=$2 ORDER BY captured_at,id', values),
        db.query('SELECT observations,questions,answers,possible_causes,recommended_inspections,review_status,created_at FROM mig_farm.diagnosis_sessions WHERE user_id=$1 AND problem_id=$2 ORDER BY created_at DESC,id LIMIT 5', values),
      ]);
      const recent = crop ? await loadCommandData(user, farm.id) : null;
      const mission = crop ? recent.missions.find((item) => item.id === crop.id) : null;
      const casePackage = {
        farm: farmDTO(farm),
        zone: mission?.zone || null,
        crop: crop ? cropDTO(crop) : null,
        confirmedStage: mission?.stage.confirmed || null,
        problem: problemDTO(problem),
        history: updates.rows.map((row) => ({ condition: row.condition, notes: row.notes, createdAt: rowTime(row, 'created_at') })),
        photos: media.rows.map((row) => ({ type: row.type, url: row.url, thumbnailUrl: row.thumbnail_url, capturedAt: rowTime(row, 'captured_at'), notes: row.notes })),
        recentIrrigation: mission?.irrigation || null,
        recentOperations: recent?.operations.filter((item) => item.cropCycleId === crop?.id).slice(0, 10) || [],
        diagnosisSessions: diagnoses.rows,
        generatedAt: new Date().toISOString(),
        source: 'user_farm_records',
      };
      const row = await one(`INSERT INTO mig_farm.agronomist_escalations(id,user_id,farm_id,crop_cycle_id,problem_id,case_package_json,status)
        VALUES($1,$2,$3,$4,$5,$6,'prepared') RETURNING *`, [randomUUID(), user.id, farm.id, crop?.id || null, problem.id, JSON.stringify(casePackage)]);
      return { escalation: { id: row.id, status: row.status, casePackage, deliveryStatus: 'provider_not_configured' } };
    },
  };
}

function buildCheckInQuestions(mission) {
  const questions = [];
  if (mission.zone) questions.push({ key: 'irrigated', ar: 'هل تم الري؟', en: 'Was irrigation completed?', options: ['yes', 'no', 'skip'], source: 'farm_record_prompt' });
  if (mission.stage.needsConfirmation && mission.stage.expected) questions.push({ key: 'stageStarted', ar: `هل بدأت مرحلة ${mission.stage.expected.nameAr}؟`, en: `Has ${mission.stage.expected.nameEn} started?`, options: ['yes', 'not_yet', 'skip'], stageKey: mission.stage.expected.key, source: 'verified_knowledge' });
  questions.push({ key: 'newProblem', ar: 'هل لاحظت مشكلة جديدة؟', en: 'Did you notice a new problem?', options: ['yes', 'no'], source: 'farm_record_prompt' });
  if (['harvesting', 'harvest'].includes(mission.crop.status) || mission.crop.growthStage === 'harvest') questions.push({ key: 'harvested', ar: 'هل يوجد حصاد اليوم؟', en: 'Was there a harvest today?', options: ['yes', 'no'], source: 'farm_record_prompt' });
  return questions;
}

function legacyEvent(row, eventType, eventAt, crop, payload) {
  return {
    id: `legacy:${eventType}:${row.id}`,
    farmId: crop.farm_id,
    zoneId: row.zone_id || crop.zone_id,
    cropCycleId: crop.id,
    problemId: row.problem_id || null,
    eventType,
    eventAt: iso(eventAt),
    payload: { entityId: row.id, ...payload },
    source: 'farm_record',
  };
}
