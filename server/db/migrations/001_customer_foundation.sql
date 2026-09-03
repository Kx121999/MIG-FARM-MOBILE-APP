CREATE SCHEMA IF NOT EXISTS mig_farm;
CREATE TABLE mig_farm.users (
 id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 phone text NOT NULL DEFAULT '', password_hash text, emirate text NOT NULL DEFAULT '',
 language text NOT NULL DEFAULT 'en' CHECK(language IN ('ar','en')),
 avatar_url text, avatar_updated_at timestamptz, email_verified_at timestamptz,
 phone_verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 CHECK(email = lower(btrim(email)))
);
CREATE TABLE mig_farm.sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 family_id uuid NOT NULL, access_hash text NOT NULL UNIQUE, refresh_hash text NOT NULL UNIQUE,
 access_expires_at timestamptz NOT NULL, refresh_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE INDEX sessions_user ON mig_farm.sessions(user_id);
CREATE INDEX sessions_family ON mig_farm.sessions(family_id);
CREATE TABLE mig_farm.password_reset_tokens (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
 used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mig_farm.user_addresses (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 label text NOT NULL, category text NOT NULL DEFAULT 'other', name text NOT NULL DEFAULT '',
 phone text NOT NULL DEFAULT '', emirate text NOT NULL, city text NOT NULL,
 address_line text NOT NULL, unit text NOT NULL DEFAULT '', delivery_notes text NOT NULL DEFAULT '',
 is_default boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX addresses_one_default ON mig_farm.user_addresses(user_id) WHERE is_default;
CREATE INDEX addresses_user ON mig_farm.user_addresses(user_id,created_at,id);
CREATE TABLE mig_farm.user_favorites (
 user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 product_id bigint NOT NULL CHECK(product_id>0), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,product_id)
);
CREATE TABLE mig_farm.notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 order_updates boolean NOT NULL DEFAULT true, offers boolean NOT NULL DEFAULT false,
 new_products boolean NOT NULL DEFAULT false, availability boolean NOT NULL DEFAULT false,
 marketing_consent boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((NOT offers AND NOT new_products) OR marketing_consent)
);
CREATE TABLE mig_farm.notifications (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mig_farm.users(id) ON DELETE CASCADE,
 type text NOT NULL CHECK(type IN ('order','offer','stock','product','system')),
 title text NOT NULL, body text NOT NULL, data_json jsonb NOT NULL DEFAULT '{}',
 read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON mig_farm.notifications(user_id,created_at DESC,id);
CREATE TABLE mig_farm.orders (
 id text PRIMARY KEY, customer_id uuid REFERENCES mig_farm.users(id) ON DELETE SET NULL,
 status text NOT NULL CHECK(status IN ('awaiting_payment','paid','payment_failed','canceled')),
 currency text NOT NULL DEFAULT 'AED', subtotal numeric(14,2) NOT NULL CHECK(subtotal>=0),
 delivery numeric(14,2) NOT NULL CHECK(delivery>=0), total numeric(14,2) NOT NULL CHECK(total>=0),
 customer_snapshot jsonb NOT NULL, shipping_snapshot jsonb NOT NULL,
 access_hash text NOT NULL, payment_intent_id text UNIQUE, payment_status text NOT NULL DEFAULT 'pending',
 checkout_key text UNIQUE, request_hash text, token_nonce text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(total=subtotal+delivery)
);
CREATE INDEX orders_user ON mig_farm.orders(customer_id,created_at DESC,id);
CREATE TABLE mig_farm.order_items (
 id uuid PRIMARY KEY, order_id text NOT NULL REFERENCES mig_farm.orders(id) ON DELETE CASCADE,
 position integer NOT NULL, product_id bigint NOT NULL, variant_id bigint NOT NULL,
 handle text NOT NULL, title text NOT NULL, variant_title text NOT NULL,
 image text, quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 99),
 unit_price numeric(14,2) NOT NULL CHECK(unit_price>=0),
 line_total numeric(14,2) NOT NULL CHECK(line_total>=0),
 UNIQUE(order_id,position), CHECK(line_total=unit_price*quantity)
);
CREATE TABLE mig_farm.stripe_events (
 id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mig_farm.rate_limits (
 key_hash text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL
);

