ALTER TABLE mig_farm.users
  ADD COLUMN google_id text;

CREATE UNIQUE INDEX users_google_id_unique
  ON mig_farm.users(google_id)
  WHERE google_id IS NOT NULL AND deleted_at IS NULL;
