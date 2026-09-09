ALTER TABLE mig_farm.users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer'
    CHECK(role IN ('customer','admin','support')),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','suspended','deleted'));

CREATE INDEX IF NOT EXISTS users_role_status
  ON mig_farm.users(role,status,created_at DESC);

ALTER TABLE mig_farm.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE mig_farm.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK(type IN ('order','offer','stock','product','my_farm','system'));

CREATE TABLE IF NOT EXISTS mig_farm.recently_viewed (
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  product_id bigint NOT NULL CHECK(product_id>0),
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,product_id)
);

CREATE INDEX IF NOT EXISTS recently_viewed_user
  ON mig_farm.recently_viewed(user_id,viewed_at DESC);

CREATE TABLE IF NOT EXISTS mig_farm.user_cart_items (
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  product_id bigint NOT NULL CHECK(product_id>0),
  variant_id bigint NOT NULL CHECK(variant_id>0),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 99),
  payload_json jsonb NOT NULL DEFAULT '{}',
  guest_updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,item_key)
);

CREATE INDEX IF NOT EXISTS user_cart_items_user
  ON mig_farm.user_cart_items(user_id,server_updated_at DESC);

CREATE TABLE IF NOT EXISTS mig_farm.guest_farm_snapshots (
  user_id uuid PRIMARY KEY REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  snapshot_json jsonb NOT NULL DEFAULT '{}',
  guest_updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mig_farm.push_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_value text NOT NULL,
  platform text NOT NULL CHECK(platform IN ('ios','android','web','unknown')),
  device_id text NOT NULL DEFAULT '',
  locale text NOT NULL DEFAULT 'en' CHECK(locale IN ('ar','en')),
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user
  ON mig_farm.push_tokens(user_id,enabled,last_seen_at DESC);

CREATE TABLE IF NOT EXISTS mig_farm.home_content (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK(kind IN ('hero','announcement','promo','featured','new_arrivals','popular','recommended')),
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  deep_link text NOT NULL DEFAULT '',
  product_ids bigint[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 100,
  visible boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS home_content_active
  ON mig_farm.home_content(visible,sort_order,created_at DESC);

CREATE TABLE IF NOT EXISTS mig_farm.offers (
  id uuid PRIMARY KEY,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  banner_url text NOT NULL DEFAULT '',
  discount text NOT NULL DEFAULT '',
  cta_ar text NOT NULL DEFAULT '',
  cta_en text NOT NULL DEFAULT '',
  deep_link text NOT NULL DEFAULT '',
  product_ids bigint[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','inactive','scheduled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offers_active
  ON mig_farm.offers(status,starts_at,ends_at,created_at DESC);

CREATE TABLE IF NOT EXISTS mig_farm.push_campaigns (
  id uuid PRIMARY KEY,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  body_ar text NOT NULL,
  body_en text NOT NULL,
  target text NOT NULL CHECK(target IN ('all','ar','en','customers')),
  deep_link text NOT NULL DEFAULT '',
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','ready','sending','sent','failed')),
  delivery_json jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES mig_farm.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_campaigns_status
  ON mig_farm.push_campaigns(status,scheduled_at,created_at DESC);
