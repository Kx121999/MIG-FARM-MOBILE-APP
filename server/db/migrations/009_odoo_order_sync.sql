ALTER TABLE mig_farm.orders
  ADD COLUMN IF NOT EXISTS tax numeric(14,2) NOT NULL DEFAULT 0 CHECK(tax>=0),
  ADD COLUMN IF NOT EXISTS odoo_order_id bigint,
  ADD COLUMN IF NOT EXISTS odoo_order_name text,
  ADD COLUMN IF NOT EXISTS odoo_state text,
  ADD COLUMN IF NOT EXISTS odoo_sync_status text NOT NULL DEFAULT 'pending'
    CHECK(odoo_sync_status IN ('pending','synced','failed','needs_retry')),
  ADD COLUMN IF NOT EXISTS odoo_sync_error text,
  ADD COLUMN IF NOT EXISTS odoo_synced_at timestamptz;

ALTER TABLE mig_farm.orders
  DROP CONSTRAINT IF EXISTS orders_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'mig_farm.orders'::regclass
      AND conname = 'orders_total_reconciled'
  ) THEN
    ALTER TABLE mig_farm.orders
      ADD CONSTRAINT orders_total_reconciled
      CHECK(total=subtotal+tax+delivery);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_odoo_order_unique
  ON mig_farm.orders(odoo_order_id)
  WHERE odoo_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_odoo_sync_status
  ON mig_farm.orders(odoo_sync_status,updated_at DESC)
  WHERE odoo_sync_status <> 'synced';
