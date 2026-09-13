CREATE TABLE IF NOT EXISTS mig_farm.farm_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
  crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
  problem_id uuid REFERENCES mig_farm.farm_problems(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK(event_type IN (
    'farm_created','crop_planned','crop_planted','stage_confirmed','task_completed','task_skipped',
    'irrigation_recorded','operation_recorded','problem_opened','problem_updated','problem_resolved',
    'photo_added','harvest_recorded','expense_added','sale_added','checkin_recorded','note_added'
  )),
  occurred_at timestamptz NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}',
  source text NOT NULL CHECK(source IN ('user_recorded','system_recorded','verified_knowledge')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS farm_events_owner_time ON mig_farm.farm_events(user_id,occurred_at DESC,id);
CREATE INDEX IF NOT EXISTS farm_events_farm_time ON mig_farm.farm_events(farm_id,occurred_at DESC,id);
CREATE INDEX IF NOT EXISTS farm_events_crop_time ON mig_farm.farm_events(crop_cycle_id,occurred_at DESC,id);

ALTER TABLE mig_farm.farm_tasks
  ADD COLUMN IF NOT EXISTS original_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_adjustment_days integer NOT NULL DEFAULT 0;
UPDATE mig_farm.farm_tasks
SET original_due_at=due_at
WHERE original_due_at IS NULL;

ALTER TABLE mig_farm.farm_problems
  ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz;
ALTER TABLE mig_farm.farm_problems
  ALTER COLUMN next_follow_up_at SET DEFAULT (now() + interval '2 days');
UPDATE mig_farm.farm_problems
SET next_follow_up_at=COALESCE(last_follow_up_at,created_at)+interval '2 days'
WHERE deleted_at IS NULL AND status<>'resolved' AND next_follow_up_at IS NULL;
CREATE INDEX IF NOT EXISTS problems_follow_up_due ON mig_farm.farm_problems(user_id,next_follow_up_at,id)
WHERE deleted_at IS NULL AND status<>'resolved';

ALTER TABLE mig_farm.farm_inventory
  ADD COLUMN IF NOT EXISTS minimum_quantity numeric(14,3) CHECK(minimum_quantity IS NULL OR minimum_quantity>=0),
  ADD COLUMN IF NOT EXISTS expires_at date;
CREATE INDEX IF NOT EXISTS inventory_expiry ON mig_farm.farm_inventory(user_id,expires_at,id)
WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS mig_farm.crop_checkins (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES mig_farm.farm_zones(id) ON DELETE SET NULL,
  crop_cycle_id uuid NOT NULL REFERENCES mig_farm.crop_cycles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  answers_json jsonb NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,crop_cycle_id,checkin_date)
);
CREATE INDEX IF NOT EXISTS crop_checkins_owner_date ON mig_farm.crop_checkins(user_id,checkin_date DESC,id);

CREATE TABLE IF NOT EXISTS mig_farm.crop_stage_confirmations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  crop_cycle_id uuid NOT NULL REFERENCES mig_farm.crop_cycles(id) ON DELETE CASCADE,
  stage_key text NOT NULL CHECK(stage_key IN ('seedling','vegetative','flowering','fruit_set','production','harvest','finished')),
  expected_at date,
  confirmed_at timestamptz NOT NULL,
  adjustment_days integer NOT NULL DEFAULT 0,
  source_stage_id uuid REFERENCES mig_farm.crop_growth_stages(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,crop_cycle_id,stage_key)
);
CREATE INDEX IF NOT EXISTS stage_confirmations_crop_time ON mig_farm.crop_stage_confirmations(crop_cycle_id,confirmed_at DESC,id);

CREATE TABLE IF NOT EXISTS mig_farm.farm_sales (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  crop_cycle_id uuid NOT NULL REFERENCES mig_farm.crop_cycles(id) ON DELETE RESTRICT,
  sold_at date NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK(quantity>0),
  unit text NOT NULL,
  unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0),
  total_minor bigint NOT NULL CHECK(total_minor>=0),
  currency char(3) NOT NULL DEFAULT 'AED',
  buyer_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS farm_sales_owner_time ON mig_farm.farm_sales(user_id,sold_at DESC,id);
CREATE INDEX IF NOT EXISTS farm_sales_crop_time ON mig_farm.farm_sales(crop_cycle_id,sold_at DESC,id);

CREATE TABLE IF NOT EXISTS mig_farm.season_reports (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  crop_cycle_id uuid NOT NULL UNIQUE REFERENCES mig_farm.crop_cycles(id) ON DELETE CASCADE,
  report_json jsonb NOT NULL,
  source text NOT NULL DEFAULT 'farm_record_calculation' CHECK(source='farm_record_calculation'),
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS season_reports_owner_time ON mig_farm.season_reports(user_id,generated_at DESC,id);

CREATE TABLE IF NOT EXISTS mig_farm.farm_report_snapshots (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  report_json jsonb NOT NULL,
  source text NOT NULL DEFAULT 'farm_record_calculation' CHECK(source='farm_record_calculation'),
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,farm_id,period_start,period_end)
);

CREATE TABLE IF NOT EXISTS mig_farm.agronomist_escalations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES mig_farm.farms(id) ON DELETE CASCADE,
  crop_cycle_id uuid REFERENCES mig_farm.crop_cycles(id) ON DELETE SET NULL,
  problem_id uuid NOT NULL REFERENCES mig_farm.farm_problems(id) ON DELETE CASCADE,
  case_package_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','submitted','closed')),
  delivery_provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agronomist_escalations_owner_time ON mig_farm.agronomist_escalations(user_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS farm_inventory_status ON mig_farm.farm_inventory(farm_id,expires_at,updated_at DESC,id)
WHERE deleted_at IS NULL;
