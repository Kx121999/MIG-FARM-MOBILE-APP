CREATE TABLE mig_farm.farms (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 name text NOT NULL, type text NOT NULL CHECK(type IN ('farm','greenhouse','home_garden','rooftop','project','other')),
 emirate text NOT NULL DEFAULT '', region text NOT NULL DEFAULT '', area_m2 numeric(14,3) CHECK(area_m2 IS NULL OR area_m2>=0),
 display_area numeric(14,3) CHECK(display_area IS NULL OR display_area>=0), area_unit text CHECK(area_unit IS NULL OR area_unit IN ('m2','hectare','acre')),
 latitude numeric(10,7), longitude numeric(10,7), notes text NOT NULL DEFAULT '', main_image_url text,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 CHECK((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
CREATE INDEX farms_user_active ON mig_farm.farms(user_id,updated_at DESC,id) WHERE deleted_at IS NULL;

CREATE TABLE mig_farm.farm_zones (
 id uuid PRIMARY KEY, farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 name text NOT NULL, type text NOT NULL CHECK(type IN ('open_field','greenhouse','shade_house','garden','nursery','raised_bed','pots','other')),
 area_m2 numeric(14,3) CHECK(area_m2 IS NULL OR area_m2>=0), display_area numeric(14,3) CHECK(display_area IS NULL OR display_area>=0),
 area_unit text CHECK(area_unit IS NULL OR area_unit IN ('m2','hectare','acre')),
 soil_type text CHECK(soil_type IS NULL OR soil_type IN ('sandy','clay','loam','mixed','unknown')),
 irrigation_system text CHECK(irrigation_system IS NULL OR irrigation_system IN ('drip','sprinkler','manual','pivot','other')),
 water_source text CHECK(water_source IS NULL OR water_source IN ('network','well','tank','treated','other')),
 notes text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX zones_farm_active ON mig_farm.farm_zones(farm_id,created_at,id) WHERE deleted_at IS NULL;

CREATE TABLE mig_farm.crop_cycles (
 id uuid PRIMARY KEY, farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL, crop_name text NOT NULL,
 crop_catalog_id text, variety text NOT NULL DEFAULT '', variety_id text, planting_date date,
 transplant_date date, expected_harvest_date date, actual_harvest_date date,
 area_m2 numeric(14,3) CHECK(area_m2 IS NULL OR area_m2>=0), display_area numeric(14,3) CHECK(display_area IS NULL OR display_area>=0),
 area_unit text CHECK(area_unit IS NULL OR area_unit IN ('m2','hectare','acre')), plant_count integer CHECK(plant_count IS NULL OR plant_count>=0),
 growth_stage text NOT NULL DEFAULT 'seedling' CHECK(growth_stage IN ('seedling','vegetative','flowering','fruit_set','production','harvest','finished')),
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','planted','active','harvesting','completed','stopped')),
 notes text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX crops_farm_active ON mig_farm.crop_cycles(farm_id,status,updated_at DESC,id) WHERE deleted_at IS NULL;
CREATE INDEX crops_zone_active ON mig_farm.crop_cycles(zone_id,updated_at DESC,id) WHERE deleted_at IS NULL;

CREATE TABLE mig_farm.farm_tasks (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
 crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
 problem_id uuid, type text NOT NULL CHECK(type IN ('irrigation','fertilization','crop_inspection','pest_inspection','disease_inspection','planting','transplanting','pruning','training','treatment','maintenance','harvest','soil_test','water_test','problem_follow_up','custom')),
 title text NOT NULL, description text NOT NULL DEFAULT '', due_at timestamptz NOT NULL,
 completed_at timestamptz, completion_notes text NOT NULL DEFAULT '', actual_minutes integer CHECK(actual_minutes IS NULL OR actual_minutes>=0), result text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','due','completed','missed','cancelled')),
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','important','urgent')),
 recurrence_rule jsonb, source text NOT NULL DEFAULT 'user' CHECK(source IN ('user','problem_follow_up','system')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX tasks_user_due ON mig_farm.farm_tasks(user_id,due_at,id) WHERE deleted_at IS NULL;
CREATE INDEX tasks_farm_due ON mig_farm.farm_tasks(farm_id,due_at,id) WHERE deleted_at IS NULL;

CREATE TABLE mig_farm.irrigation_records (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 zone_id uuid NOT NULL REFERENCES mig_farm.farm_zones(id) ON DELETE RESTRICT,
 crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
 started_at timestamptz NOT NULL, duration_minutes integer CHECK(duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 10080),
 water_volume_liters numeric(14,3) CHECK(water_volume_liters IS NULL OR water_volume_liters>=0),
 method text NOT NULL CHECK(method IN ('drip','sprinkler','manual','pivot','other')),
 notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX irrigations_user_time ON mig_farm.irrigation_records(user_id,started_at DESC,id);

CREATE TABLE mig_farm.farm_operations (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
 crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
 type text NOT NULL CHECK(type IN ('irrigation','fertilization','spraying','pruning','harvest','inspection','planting','maintenance','note','other')),
 performed_at timestamptz NOT NULL, product_id bigint, product_name_snapshot text,
 quantity numeric(14,3) CHECK(quantity IS NULL OR quantity>=0), unit text, application_method text,
 notes text NOT NULL DEFAULT '', source text NOT NULL DEFAULT 'user_recorded' CHECK(source IN ('user_recorded','mig_farm_verified')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operations_user_time ON mig_farm.farm_operations(user_id,performed_at DESC,id);
CREATE INDEX operations_crop_time ON mig_farm.farm_operations(crop_cycle_id,performed_at DESC,id);

CREATE TABLE mig_farm.farm_problems (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
 crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
 category text NOT NULL CHECK(category IN ('crop','soil','irrigation','water','pest','disease','nutrition','growth','equipment','other')),
 title text NOT NULL, description text NOT NULL DEFAULT '', severity text NOT NULL CHECK(severity IN ('mild','medium','severe')),
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','investigating','action_required','monitoring','improving','resolved','reopened')),
 first_observed_at timestamptz NOT NULL, last_follow_up_at timestamptz, resolved_at timestamptz,
 suspected_cause text, verified_cause text, confirmed_by text, confirmed_at timestamptz,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX problems_user_active ON mig_farm.farm_problems(user_id,status,updated_at DESC,id) WHERE deleted_at IS NULL;
ALTER TABLE mig_farm.farm_tasks ADD CONSTRAINT tasks_problem_fk FOREIGN KEY(problem_id) REFERENCES mig_farm.farm_problems(id) ON DELETE SET NULL;

CREATE TABLE mig_farm.farm_problem_updates (
 id uuid PRIMARY KEY, problem_id uuid NOT NULL REFERENCES mig_farm.farm_problems(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 condition text NOT NULL CHECK(condition IN ('better','same','worse','note','resolved','reopened')),
 notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX problem_updates_time ON mig_farm.farm_problem_updates(problem_id,created_at DESC,id);

CREATE TABLE mig_farm.farm_media (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
 crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
 problem_id uuid REFERENCES mig_farm.farm_problems(id) ON DELETE SET NULL,
 type text NOT NULL CHECK(type IN ('farm','crop','problem','follow_up','harvest','analysis','note')),
 url text NOT NULL, thumbnail_url text, captured_at timestamptz NOT NULL,
 notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX farm_media_owner_time ON mig_farm.farm_media(user_id,created_at DESC,id);

CREATE TABLE mig_farm.diagnosis_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
 crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
 problem_id uuid REFERENCES mig_farm.farm_problems(id) ON DELETE SET NULL,
 observations jsonb NOT NULL DEFAULT '[]', questions jsonb NOT NULL DEFAULT '[]', answers jsonb NOT NULL DEFAULT '{}',
 possible_causes jsonb NOT NULL DEFAULT '[]', recommended_inspections jsonb NOT NULL DEFAULT '[]',
 verified_diagnosis text, confirmed_by text, confirmed_at timestamptz,
 review_status text NOT NULL DEFAULT 'waiting_review' CHECK(review_status IN ('waiting_review','reviewed','needs_more_information','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX diagnosis_owner_time ON mig_farm.diagnosis_sessions(user_id,created_at DESC,id);

CREATE TABLE mig_farm.farm_inventory (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 product_id bigint, product_name_snapshot text NOT NULL, category text NOT NULL,
 quantity numeric(14,3) CHECK(quantity IS NULL OR quantity>=0), unit text, notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX inventory_farm_active ON mig_farm.farm_inventory(farm_id,updated_at DESC,id) WHERE deleted_at IS NULL;

CREATE TABLE mig_farm.harvest_records (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
 crop_cycle_id uuid NOT NULL REFERENCES mig_farm.crop_cycles(id) ON DELETE RESTRICT,
 harvested_at timestamptz NOT NULL, quantity numeric(14,3) NOT NULL CHECK(quantity>=0),
 unit text NOT NULL CHECK(unit IN ('kg','ton','box','piece','custom')), custom_unit text,
 quality_notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((unit='custom' AND custom_unit IS NOT NULL AND length(btrim(custom_unit))>0) OR (unit<>'custom' AND custom_unit IS NULL))
);
CREATE INDEX harvest_crop_time ON mig_farm.harvest_records(crop_cycle_id,harvested_at DESC,id);

CREATE TABLE mig_farm.soil_water_analyses (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
 type text NOT NULL CHECK(type IN ('soil','water')), sampled_at date NOT NULL, lab_name text,
 results jsonb NOT NULL DEFAULT '{}', notes text NOT NULL DEFAULT '', document_url text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analyses_farm_time ON mig_farm.soil_water_analyses(farm_id,sampled_at DESC,id);

CREATE TABLE mig_farm.farm_notes (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
 zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
 crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
 problem_id uuid REFERENCES mig_farm.farm_problems(id) ON DELETE SET NULL,
 body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_owner_time ON mig_farm.farm_notes(user_id,created_at DESC,id);

CREATE TABLE mig_farm.agronomic_references (
 id uuid PRIMARY KEY, source_type text NOT NULL, source_name text NOT NULL, source_url text,
 country text, crop text, product_id bigint, published_at date, reviewed_at timestamptz,
 reviewed_by text, data_json jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mig_farm.farm_request_keys (
 user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 request_key text NOT NULL, method text NOT NULL, path text NOT NULL, response_json jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,request_key)
);
