ALTER TABLE mig_farm.users
  ADD COLUMN odoo_partner_id bigint,
  ADD COLUMN odoo_sync_status text NOT NULL DEFAULT 'pending'
    CHECK (odoo_sync_status IN ('pending', 'synced', 'failed')),
  ADD COLUMN odoo_synced_at timestamptz,
  ADD COLUMN odoo_sync_error text,
  ADD COLUMN avatar_key text;

CREATE UNIQUE INDEX users_odoo_partner_unique
  ON mig_farm.users(odoo_partner_id)
  WHERE odoo_partner_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE mig_farm.user_addresses
  ADD COLUMN odoo_partner_id bigint,
  ADD COLUMN odoo_sync_status text NOT NULL DEFAULT 'pending'
    CHECK (odoo_sync_status IN ('pending', 'synced', 'failed')),
  ADD COLUMN odoo_synced_at timestamptz,
  ADD COLUMN odoo_sync_error text;

CREATE UNIQUE INDEX addresses_odoo_partner_unique
  ON mig_farm.user_addresses(odoo_partner_id)
  WHERE odoo_partner_id IS NOT NULL;
