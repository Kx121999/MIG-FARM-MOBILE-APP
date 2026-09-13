CREATE TABLE IF NOT EXISTS mig_farm.knowledge_sources (
  id uuid PRIMARY KEY,
  authority text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  source_url text NOT NULL UNIQUE,
  jurisdiction text NOT NULL DEFAULT 'global',
  published_at date,
  reviewed_at timestamptz NOT NULL,
  version_label text,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mig_farm.crop_profiles (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  scientific_name text,
  aliases jsonb NOT NULL DEFAULT '[]',
  summary_ar text NOT NULL DEFAULT '',
  summary_en text NOT NULL DEFAULT '',
  production_systems jsonb NOT NULL DEFAULT '[]',
  climate_tags jsonb NOT NULL DEFAULT '[]',
  source_id uuid REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crop_profiles_status_name ON mig_farm.crop_profiles(status,name_en,slug);

CREATE TABLE IF NOT EXISTS mig_farm.crop_spacing_profiles (
  id uuid PRIMARY KEY,
  crop_profile_id uuid NOT NULL REFERENCES mig_farm.crop_profiles(id) ON DELETE CASCADE,
  production_system text NOT NULL,
  planting_method text NOT NULL,
  row_spacing_cm numeric(10,3) NOT NULL CHECK(row_spacing_cm>0),
  plant_spacing_cm numeric(10,3) NOT NULL CHECK(plant_spacing_cm>0),
  plants_per_station integer NOT NULL DEFAULT 1 CHECK(plants_per_station>0),
  usable_area_percent numeric(5,2) NOT NULL DEFAULT 100 CHECK(usable_area_percent>0 AND usable_area_percent<=100),
  notes_ar text NOT NULL DEFAULT '',
  notes_en text NOT NULL DEFAULT '',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crop_spacing_verified ON mig_farm.crop_spacing_profiles(crop_profile_id,production_system,status);

CREATE TABLE IF NOT EXISTS mig_farm.crop_growth_stages (
  id uuid PRIMARY KEY,
  crop_profile_id uuid NOT NULL REFERENCES mig_farm.crop_profiles(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  start_day integer NOT NULL CHECK(start_day>=0),
  end_day integer NOT NULL CHECK(end_day>=start_day),
  checks_ar jsonb NOT NULL DEFAULT '[]',
  checks_en jsonb NOT NULL DEFAULT '[]',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated')),
  UNIQUE(crop_profile_id,stage_key,source_id)
);

CREATE TABLE IF NOT EXISTS mig_farm.crop_irrigation_profiles (
  id uuid PRIMARY KEY,
  crop_profile_id uuid NOT NULL REFERENCES mig_farm.crop_profiles(id) ON DELETE CASCADE,
  production_system text NOT NULL,
  growth_stage_key text,
  method text NOT NULL,
  parameters jsonb NOT NULL,
  constraints_json jsonb NOT NULL DEFAULT '{}',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated'))
);

CREATE TABLE IF NOT EXISTS mig_farm.crop_season_profiles (
  id uuid PRIMARY KEY,
  crop_profile_id uuid NOT NULL REFERENCES mig_farm.crop_profiles(id) ON DELETE CASCADE,
  emirate text NOT NULL DEFAULT 'UAE',
  production_system text NOT NULL,
  planting_months jsonb NOT NULL,
  harvest_months jsonb NOT NULL DEFAULT '[]',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated'))
);

CREATE TABLE IF NOT EXISTS mig_farm.crop_varieties (
  id uuid PRIMARY KEY,
  crop_profile_id uuid NOT NULL REFERENCES mig_farm.crop_profiles(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  traits_json jsonb NOT NULL DEFAULT '{}',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated')),
  UNIQUE(crop_profile_id,slug)
);

CREATE TABLE IF NOT EXISTS mig_farm.crop_task_templates (
  id uuid PRIMARY KEY,
  crop_profile_id uuid NOT NULL REFERENCES mig_farm.crop_profiles(id) ON DELETE CASCADE,
  production_system text NOT NULL,
  planting_method text NOT NULL,
  growth_stage_key text,
  task_type text NOT NULL CHECK(task_type IN ('irrigation','fertilization','crop_inspection','pest_inspection','disease_inspection','planting','transplanting','pruning','training','treatment','maintenance','harvest','soil_test','water_test','problem_follow_up','custom')),
  offset_days integer NOT NULL CHECK(offset_days>=0),
  due_time_local time NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated'))
);
CREATE INDEX IF NOT EXISTS crop_task_templates_lookup ON mig_farm.crop_task_templates(crop_profile_id,production_system,planting_method,status);

CREATE TABLE IF NOT EXISTS mig_farm.crop_recommendation_rules (
  id uuid PRIMARY KEY,
  crop_profile_id uuid NOT NULL REFERENCES mig_farm.crop_profiles(id) ON DELETE CASCADE,
  emirate text NOT NULL DEFAULT 'UAE',
  production_system text NOT NULL,
  constraints_json jsonb NOT NULL,
  rationale_ar text NOT NULL,
  rationale_en text NOT NULL,
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated'))
);

CREATE TABLE IF NOT EXISTS mig_farm.crop_yield_profiles (
  id uuid PRIMARY KEY,
  crop_profile_id uuid NOT NULL REFERENCES mig_farm.crop_profiles(id) ON DELETE CASCADE,
  production_system text NOT NULL,
  unit text NOT NULL,
  min_per_m2 numeric(14,4) NOT NULL CHECK(min_per_m2>=0),
  max_per_m2 numeric(14,4) NOT NULL CHECK(max_per_m2>=min_per_m2),
  constraints_json jsonb NOT NULL DEFAULT '{}',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated'))
);

CREATE TABLE IF NOT EXISTS mig_farm.knowledge_articles (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  kind text NOT NULL CHECK(kind IN ('crop','soil','water','irrigation','pest','disease','nutrition','farm_management','safety')),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  summary_ar text NOT NULL,
  summary_en text NOT NULL,
  body_ar jsonb NOT NULL DEFAULT '[]',
  body_en jsonb NOT NULL DEFAULT '[]',
  tags jsonb NOT NULL DEFAULT '[]',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_articles_status_kind ON mig_farm.knowledge_articles(status,kind,title_en);

CREATE TABLE IF NOT EXISTS mig_farm.pests (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  scientific_name text,
  identifiers_ar jsonb NOT NULL DEFAULT '[]',
  identifiers_en jsonb NOT NULL DEFAULT '[]',
  affected_crops jsonb NOT NULL DEFAULT '[]',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated'))
);

CREATE TABLE IF NOT EXISTS mig_farm.diseases (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  pathogen text,
  identifiers_ar jsonb NOT NULL DEFAULT '[]',
  identifiers_en jsonb NOT NULL DEFAULT '[]',
  affected_crops jsonb NOT NULL DEFAULT '[]',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated'))
);

CREATE TABLE IF NOT EXISTS mig_farm.symptom_rules (
  id uuid PRIMARY KEY,
  crop_profile_id uuid REFERENCES mig_farm.crop_profiles(id) ON DELETE CASCADE,
  cause_type text NOT NULL CHECK(cause_type IN ('pest','disease','nutrition','water','soil','environment','unknown')),
  cause_id uuid,
  symptom_keys jsonb NOT NULL,
  possible_cause_ar text NOT NULL,
  possible_cause_en text NOT NULL,
  inspection_checks_ar jsonb NOT NULL DEFAULT '[]',
  inspection_checks_en jsonb NOT NULL DEFAULT '[]',
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated'))
);
CREATE INDEX IF NOT EXISTS symptom_rules_verified_crop ON mig_farm.symptom_rules(status,crop_profile_id);

CREATE TABLE IF NOT EXISTS mig_farm.uae_regulations (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  category text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  summary_ar text NOT NULL,
  summary_en text NOT NULL,
  effective_at date,
  source_id uuid NOT NULL REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','verified','review_required','deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uae_regulations_verified ON mig_farm.uae_regulations(status,category,title_en);

CREATE TABLE IF NOT EXISTS mig_farm.crop_plans (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
  crop_profile_id uuid NOT NULL REFERENCES mig_farm.crop_profiles(id) ON DELETE RESTRICT,
  spacing_profile_id uuid REFERENCES mig_farm.crop_spacing_profiles(id) ON DELETE RESTRICT,
  crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
  planting_date date NOT NULL,
  area_m2 numeric(14,3) NOT NULL CHECK(area_m2>0),
  production_system text NOT NULL,
  planting_method text NOT NULL,
  calculation_json jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','completed','cancelled')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crop_plans_owner ON mig_farm.crop_plans(user_id,updated_at DESC,id);

ALTER TABLE mig_farm.farm_tasks
  ADD COLUMN IF NOT EXISTS crop_plan_id uuid REFERENCES mig_farm.crop_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS farm_tasks_crop_plan ON mig_farm.farm_tasks(crop_plan_id,due_at,id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS mig_farm.farm_cost_records (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
  crop_plan_id uuid REFERENCES mig_farm.crop_plans(id) ON DELETE SET NULL,
  category text NOT NULL CHECK(category IN ('seed','seedling','fertilizer','treatment','water','energy','labor','equipment','transport','other')),
  amount_minor bigint NOT NULL CHECK(amount_minor>=0),
  currency char(3) NOT NULL DEFAULT 'AED',
  occurred_at date NOT NULL,
  notes text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'user_recorded' CHECK(source='user_recorded'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS farm_costs_owner_time ON mig_farm.farm_cost_records(user_id,occurred_at DESC,id);

CREATE TABLE IF NOT EXISTS mig_farm.farm_calculations (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  crop_plan_id uuid REFERENCES mig_farm.crop_plans(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('area','planting','greenhouse_layout','irrigation_runtime','growth_stage')),
  inputs_json jsonb NOT NULL,
  result_json jsonb NOT NULL,
  data_origin text NOT NULL CHECK(data_origin IN ('verified_profile','user_supplied','farm_record')),
  source_id uuid REFERENCES mig_farm.knowledge_sources(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO mig_farm.knowledge_sources
  (id,authority,title_ar,title_en,source_url,jurisdiction,published_at,reviewed_at,version_label,status)
VALUES
  ('81000000-0000-4000-8000-000000000001','UAE Legislation','قانون اتحادي بشأن المبيدات','Federal Law Regarding Pesticides','https://uaelegislation.gov.ae/en/legislations/1463','UAE',NULL,'2026-09-12T00:00:00Z','Federal Law No. 10 of 2020','verified'),
  ('81000000-0000-4000-8000-000000000002','UAE Legislation','اللائحة الفنية للحدود القصوى لمتبقيات المبيدات','Technical Regulations for Maximum Residue Limits for Pesticides','https://uaelegislation.gov.ae/en/legislations/2688','UAE','2024-10-22','2026-09-12T00:00:00Z','Cabinet Resolution No. 116 of 2024','verified'),
  ('81000000-0000-4000-8000-000000000003','UAE Legislation','قانون اتحادي بشأن الحجر الزراعي','Federal Law Regarding Agricultural Quarantine','https://uaelegislation.gov.ae/en/legislations/3995','UAE',NULL,'2026-09-12T00:00:00Z','Federal Law No. 7 of 2025','verified')
ON CONFLICT (id) DO NOTHING;

INSERT INTO mig_farm.uae_regulations
  (id,slug,category,title_ar,title_en,summary_ar,summary_en,effective_at,source_id,reviewed_at,status)
VALUES
  ('82000000-0000-4000-8000-000000000001','uae-pesticides-law-10-2020','pesticides','قانون اتحادي رقم 10 لسنة 2020 في شأن المبيدات','Federal Law No. 10 of 2020 Regarding Pesticides','ينظم تسجيل المبيدات واستيرادها وتداولها واستخدامها والتعامل الآمن معها داخل دولة الإمارات. راجع النص الرسمي قبل اتخاذ أي إجراء.','Regulates pesticide registration, import, circulation, use and safe handling in the UAE. Consult the official text before taking action.',NULL,'81000000-0000-4000-8000-000000000001','2026-09-12T00:00:00Z','verified'),
  ('82000000-0000-4000-8000-000000000002','uae-pesticide-mrl-116-2024','food_safety','قرار مجلس الوزراء رقم 116 لسنة 2024','Cabinet Resolution No. 116 of 2024','يقرر تطبيق اللائحة الفنية الإلزامية للحدود القصوى لمتبقيات المبيدات في المنتجات الزراعية والغذائية داخل دولة الإمارات.','Applies the mandatory technical regulation for maximum pesticide residue limits in agricultural and food products in the UAE.','2024-11-01','81000000-0000-4000-8000-000000000002','2026-09-12T00:00:00Z','verified'),
  ('82000000-0000-4000-8000-000000000003','uae-agricultural-quarantine-7-2025','quarantine','قانون اتحادي رقم 7 لسنة 2025 بشأن الحجر الزراعي','Federal Law No. 7 of 2025 Regarding Agricultural Quarantine','ينظم ضوابط الحجر الزراعي واستيراد وتصدير الإرساليات الزراعية. راجع المتطلبات الرسمية السارية قبل الشحن أو الاستيراد.','Regulates agricultural quarantine and controls for importing and exporting agricultural consignments. Check current official requirements before shipping or importing.',NULL,'81000000-0000-4000-8000-000000000003','2026-09-12T00:00:00Z','verified')
ON CONFLICT (id) DO NOTHING;
