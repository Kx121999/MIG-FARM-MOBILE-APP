ALTER TABLE mig_farm.knowledge_sources
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS organization text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS country char(2),
  ADD COLUMN IF NOT EXISTS authority_level text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS license_note text,
  ADD COLUMN IF NOT EXISTS retrieved_at date,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS production_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_notes text NOT NULL DEFAULT '';

UPDATE mig_farm.knowledge_sources
SET external_id=COALESCE(external_id,'legacy:' || id::text),
    organization=COALESCE(organization,authority),
    retrieved_at=COALESCE(retrieved_at,reviewed_at::date),
    last_verified_at=COALESCE(last_verified_at,reviewed_at),
    production_allowed=CASE WHEN status='verified' THEN true ELSE production_allowed END
WHERE external_id IS NULL OR organization IS NULL OR retrieved_at IS NULL
   OR last_verified_at IS NULL OR (status='verified' AND production_allowed=false);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_sources_external_id
  ON mig_farm.knowledge_sources(external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_sources_production
  ON mig_farm.knowledge_sources(status,production_allowed,last_verified_at DESC,id);

CREATE TABLE IF NOT EXISTS mig_farm.knowledge_records (
  id text PRIMARY KEY,
  record_type text NOT NULL CHECK(record_type IN (
    'agronomic_fact','crop_profile','planting_calendar','crop_guide','irrigation_reference',
    'crop_salinity_tolerance','diagnosis','symptom_rule','uae_regulation','uae_service',
    'farm_command_rule','predictive_guardrail','calculator_spec'
  )),
  domain text NOT NULL,
  crop text,
  production_system text,
  growth_stage text,
  country text,
  jurisdiction text,
  review_status text NOT NULL CHECK(review_status IN ('draft','review_required','verified','deprecated')),
  production_allowed boolean NOT NULL DEFAULT false,
  synthetic boolean NOT NULL DEFAULT false,
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  superseded_by text REFERENCES mig_farm.knowledge_records(id) ON DELETE SET NULL,
  content_hash char(64) NOT NULL,
  search_text text NOT NULL DEFAULT '',
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(NOT (synthetic AND production_allowed)),
  CHECK(effective_until IS NULL OR effective_from IS NULL OR effective_until>=effective_from)
);
CREATE INDEX IF NOT EXISTS knowledge_records_production
  ON mig_farm.knowledge_records(record_type,review_status,production_allowed,synthetic,id);
CREATE INDEX IF NOT EXISTS knowledge_records_crop
  ON mig_farm.knowledge_records(crop,production_system,record_type,id);
CREATE INDEX IF NOT EXISTS knowledge_records_verified_at
  ON mig_farm.knowledge_records(last_verified_at DESC,id);

CREATE TABLE IF NOT EXISTS mig_farm.knowledge_record_sources (
  record_id text NOT NULL REFERENCES mig_farm.knowledge_records(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  source_order smallint NOT NULL DEFAULT 1 CHECK(source_order>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(record_id,source_id)
);
CREATE INDEX IF NOT EXISTS knowledge_record_sources_source
  ON mig_farm.knowledge_record_sources(source_id,record_id);

CREATE TABLE IF NOT EXISTS mig_farm.knowledge_terms (
  id uuid PRIMARY KEY,
  record_id text NOT NULL REFERENCES mig_farm.knowledge_records(id) ON DELETE CASCADE,
  language text NOT NULL CHECK(language IN ('ar','en','la','und')),
  term text NOT NULL,
  normalized_term text NOT NULL,
  source_id uuid REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(record_id,language,normalized_term)
);
CREATE INDEX IF NOT EXISTS knowledge_terms_lookup
  ON mig_farm.knowledge_terms(normalized_term,language,record_id);

CREATE TABLE IF NOT EXISTS mig_farm.knowledge_ingestion_runs (
  id uuid PRIMARY KEY,
  pack_name text NOT NULL,
  pack_generated_at timestamptz,
  manifest_hash char(64),
  status text NOT NULL CHECK(status IN ('running','completed','failed')),
  summary_json jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS knowledge_ingestion_runs_time
  ON mig_farm.knowledge_ingestion_runs(started_at DESC,id);

CREATE TABLE IF NOT EXISTS mig_farm.knowledge_review_events (
  id uuid PRIMARY KEY,
  record_id text NOT NULL REFERENCES mig_farm.knowledge_records(id) ON DELETE RESTRICT,
  from_status text CHECK(from_status IS NULL OR from_status IN ('draft','review_required','verified','deprecated')),
  to_status text NOT NULL CHECK(to_status IN ('draft','review_required','verified','deprecated')),
  reviewed_by uuid REFERENCES mig_farm.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  review_note text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS knowledge_review_record_time
  ON mig_farm.knowledge_review_events(record_id,reviewed_at DESC,id);

CREATE TABLE IF NOT EXISTS mig_farm.farm_sensor_readings (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
  crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
  provider text NOT NULL,
  device_id text NOT NULL,
  sensor_type text NOT NULL CHECK(sensor_type IN ('soil_moisture','air_temperature','relative_humidity','ec','ph','water_tank','flow_meter')),
  value numeric(18,6) NOT NULL,
  unit text NOT NULL,
  quality text NOT NULL CHECK(quality IN ('valid','estimated','invalid','stale')),
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  metadata_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,device_id,sensor_type,observed_at)
);
CREATE INDEX IF NOT EXISTS farm_sensor_owner_time
  ON mig_farm.farm_sensor_readings(user_id,farm_id,sensor_type,observed_at DESC,id);
CREATE INDEX IF NOT EXISTS farm_sensor_crop_time
  ON mig_farm.farm_sensor_readings(crop_cycle_id,sensor_type,observed_at DESC,id)
  WHERE crop_cycle_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mig_farm.farm_intelligence_snapshots (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  data_freshness_json jsonb NOT NULL DEFAULT '{}',
  intelligence_json jsonb NOT NULL,
  source text NOT NULL DEFAULT 'deterministic_engine' CHECK(source='deterministic_engine')
);
CREATE INDEX IF NOT EXISTS farm_intelligence_owner_latest
  ON mig_farm.farm_intelligence_snapshots(user_id,farm_id,generated_at DESC,id);
