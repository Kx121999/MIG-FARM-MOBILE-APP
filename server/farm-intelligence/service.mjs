import { randomUUID } from 'node:crypto';
import { fail, uuid } from '../lib/validation.mjs';
import { buildFarmIntelligence } from './engine.mjs';
import { createSensorProvider, createVisionProvider, createWeatherProvider } from './providers.mjs';

export function createFarmIntelligence(db, {
  farmCommand,
  knowledge,
  env = process.env,
  weatherProvider = createWeatherProvider(env),
  visionProvider = createVisionProvider(env),
  sensorProvider = createSensorProvider(env),
} = {}) {
  if (!db || !farmCommand || !knowledge) {
    const unavailable = async () => { throw fail(503, 'farm_intelligence_not_configured'); };
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

  const providerStatus = async () => {
    const [weather, vision, sensor] = await Promise.all([
      weatherProvider.status(), visionProvider.status(), sensorProvider.status(),
    ]);
    return { weather, vision, sensor };
  };

  const histories = async (user, farmId) => {
    const values = [user.id, farmId];
    const [tasks, problems, irrigations, expenses, sensors, seasons] = await Promise.all([
      db.query(`SELECT * FROM mig_farm.farm_tasks WHERE user_id=$1 AND deleted_at IS NULL
        AND due_at>now()-interval '90 days' AND ($2::uuid IS NULL OR farm_id=$2)
        ORDER BY due_at DESC,id LIMIT 600`, values),
      db.query(`SELECT * FROM mig_farm.farm_problems WHERE user_id=$1 AND deleted_at IS NULL
        AND first_observed_at>now()-interval '365 days' AND ($2::uuid IS NULL OR farm_id=$2)
        ORDER BY first_observed_at DESC,id LIMIT 500`, values),
      db.query(`SELECT * FROM mig_farm.irrigation_records WHERE user_id=$1
        AND started_at>now()-interval '365 days' AND ($2::uuid IS NULL OR farm_id=$2)
        ORDER BY started_at DESC,id LIMIT 1000`, values),
      db.query(`SELECT * FROM mig_farm.farm_cost_records WHERE user_id=$1
        AND occurred_at>current_date-interval '365 days' AND ($2::uuid IS NULL OR farm_id=$2)
        ORDER BY occurred_at DESC,created_at DESC,id LIMIT 1000`, values),
      db.query(`SELECT * FROM mig_farm.farm_sensor_readings WHERE user_id=$1
        AND observed_at>now()-interval '90 days' AND ($2::uuid IS NULL OR farm_id=$2)
        ORDER BY observed_at DESC,id LIMIT 2000`, values),
      db.query(`SELECT r.*,c.crop_name FROM mig_farm.season_reports r
        JOIN mig_farm.crop_cycles c ON c.id=r.crop_cycle_id
        WHERE r.user_id=$1 AND ($2::uuid IS NULL OR r.farm_id=$2)
        ORDER BY r.generated_at DESC,r.id LIMIT 100`, values),
    ]);
    return {
      tasks: tasks.rows,
      problems: problems.rows,
      irrigations: irrigations.rows,
      expenses: expenses.rows,
      sensors: sensors.rows,
      seasons: seasons.rows.map((row) => ({ cropName: row.crop_name, ...(row.report_json || {}) })),
    };
  };

  const generate = async (user, farmId, language = 'ar') => {
    const farm = await ownedFarm(user, farmId);
    const commandUrl = new URL(`/api/my-farm/today?farmId=${encodeURIComponent(farm.id)}`, 'http://request.invalid');
    const command = await farmCommand.today(user, commandUrl);
    const [history, statuses, profilesByCrop] = await Promise.all([
      histories(user, farm.id),
      providerStatus(),
      knowledge.profilesForCrops(command.missions.map((mission) => mission.crop.cropName)),
    ]);
    const result = buildFarmIntelligence({
      farmId: farm.id,
      command,
      histories: history,
      providerStatus: statuses,
      profilesByCrop,
      language,
    });
    await db.transaction(async (client) => {
      await client.query(`INSERT INTO mig_farm.farm_intelligence_snapshots
        (id,user_id,farm_id,generated_at,expires_at,data_freshness_json,intelligence_json)
        VALUES($1,$2,$3,$4,$4::timestamptz+interval '15 minutes',$5,$6)`, [
        randomUUID(), user.id, farm.id, result.generatedAt,
        JSON.stringify({ providers: statuses, crops: result.cropStates.map((state) => ({ cropId: state.cropId, freshness: state.freshness })) }),
        JSON.stringify(result),
      ]);
      await client.query(`DELETE FROM mig_farm.farm_intelligence_snapshots WHERE id IN (
        SELECT id FROM mig_farm.farm_intelligence_snapshots WHERE user_id=$1 AND farm_id=$2
        ORDER BY generated_at DESC,id OFFSET 20
      )`, [user.id, farm.id]);
    });
    return result;
  };

  return {
    async center(user, url) {
      let farmId = url.searchParams.get('farmId');
      if (!farmId) {
        const farm = await one('SELECT id FROM mig_farm.farms WHERE user_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC,id LIMIT 1', [user.id]);
        if (!farm) return emptyCenter(await providerStatus());
        farmId = farm.id;
      }
      const language = url.searchParams.get('language') === 'en' ? 'en' : 'ar';
      return generate(user, farmId, language);
    },

    async crop(user, cropId, url) {
      const crop = await ownedCrop(user, cropId);
      const result = await generate(user, crop.farm_id, url.searchParams.get('language') === 'en' ? 'en' : 'ar');
      const cropState = result.cropStates.find((item) => item.cropId === crop.id);
      if (!cropState) throw fail(404, 'not_found');
      return {
        generatedAt: result.generatedAt,
        cropState,
        forecasts: result.forecasts.filter((item) => item.cropId === crop.id),
        risks: result.risks.filter((risk) => risk.evidence?.some((item) => item?.cropCycleId === crop.id || item?.entityId === crop.id)),
        anomalies: result.anomalies.filter((item) => item.evidence?.cropCycleId === crop.id || item.evidence?.entityId === crop.id),
        providerStatus: result.providerStatus,
        diagnosis: null,
      };
    },

    providerStatus,
  };
}

function emptyCenter(providerStatus) {
  return {
    generatedAt: new Date().toISOString(),
    farmId: null,
    brief: { titleAr: 'ابدأ بإضافة مزرعتك', titleEn: 'Start by adding your farm', riskCount: 0, anomalyCount: 0, cropCount: 0 },
    cropStates: [], forecasts: [], risks: [], anomalies: [], decisionCards: [], upcoming: [], notifications: [],
    providerStatus, healthScore: null, healthScoreStatus: 'not_calculated', diagnosis: null,
    model: 'deterministic_verified_farm_intelligence_v5',
  };
}
