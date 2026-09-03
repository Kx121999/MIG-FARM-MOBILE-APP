import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDatabase } from './client.mjs';
import { loadEnv } from '../lib/env.mjs';
export async function migrate(db) {
  if (!db) throw new Error('database_not_configured');
  await db.transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(694731205)');
    await client.query('CREATE SCHEMA IF NOT EXISTS mig_farm');
    await client.query(
      'CREATE TABLE IF NOT EXISTS mig_farm.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const dir = new URL('./migrations/', import.meta.url);
    for (const name of (await readdir(dir))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort()) {
      const sql = await readFile(new URL(name, dir), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = (
        await client.query(
          'SELECT checksum FROM mig_farm.schema_migrations WHERE name=$1',
          [name],
        )
      ).rows[0];
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error('migration_checksum_mismatch');
        continue;
      }
      await client.query(sql);
      await client.query(
        'INSERT INTO mig_farm.schema_migrations(name,checksum) VALUES($1,$2)',
        [name, checksum],
      );
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  loadEnv();
  const db = createDatabase(
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  );
  try {
    await migrate(db);
    console.log('Customer migrations applied');
  } catch {
    console.error(
      'migration_failed: check server database configuration and migration compatibility',
    );
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
