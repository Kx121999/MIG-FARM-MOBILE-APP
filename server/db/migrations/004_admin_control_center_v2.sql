ALTER TABLE mig_farm.orders
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'new'
    CHECK(delivery_status IN ('new','processing','ready','shipped','delivered','cancelled'));

CREATE INDEX IF NOT EXISTS orders_admin_search
  ON mig_farm.orders(created_at DESC,status,payment_status,delivery_status);

ALTER TABLE mig_farm.offers
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'percentage'
    CHECK(discount_type IN ('percentage','fixed')),
  ADD COLUMN IF NOT EXISTS discount_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS target text NOT NULL DEFAULT 'all_products'
    CHECK(target IN ('all_products','category','product')),
  ADD COLUMN IF NOT EXISTS target_ref text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS offers_admin_search
  ON mig_farm.offers(deleted_at,status,created_at DESC);

ALTER TABLE mig_farm.home_content
  ADD COLUMN IF NOT EXISTS cta_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS home_content_admin_order
  ON mig_farm.home_content(deleted_at,sort_order,created_at DESC);
