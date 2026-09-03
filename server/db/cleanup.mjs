import { pathToFileURL } from 'node:url';
import { createDatabase } from './client.mjs';
import { loadEnv } from '../lib/env.mjs';
export async function cleanup(db) {
  if (!db) throw new Error('database_not_configured');
  // Keep rotated-token evidence until the whole refresh lifetime has expired.
  await db.transaction(async (client) => {
    await client.query(
      'DELETE FROM mig_farm.sessions WHERE refresh_expires_at < now()',
    );
    await client.query(
      "DELETE FROM mig_farm.password_reset_tokens WHERE expires_at < now() OR used_at < now()-interval '1 day'",
    );
    await client.query(
      'DELETE FROM mig_farm.rate_limits WHERE expires_at < now()',
    );
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  loadEnv();
  const db = createDatabase();
  try {
    await cleanup(db);
    console.log('Expired security records cleaned');
  } catch {
    console.error('cleanup_failed');
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
