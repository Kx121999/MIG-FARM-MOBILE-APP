import { readFile, readdir } from 'node:fs/promises';
import { createDatabase } from './client.mjs';
import { createOrders } from '../services/orders.mjs';
import { loadEnv } from '../lib/env.mjs';
loadEnv();
const db = createDatabase(),
  directory = process.argv[2] === '--' ? process.argv[3] : process.argv[2];
if (!directory || !db)
  throw new Error('Provide a legacy order export directory and DATABASE_URL');
try {
  const { resolve, join } = await import('node:path');
  const root = resolve(directory),
    orders = createOrders(db, [], {});
  let imported = 0;
  for (const name of (await readdir(root)).filter((name) =>
    /^MIG-[A-Z0-9-]+\.json$/i.test(name),
  )) {
    if (
      await orders.importLegacy(
        JSON.parse(await readFile(join(root, name), 'utf8')),
      )
    )
      imported++;
  }
  console.log('Legacy order import complete: ' + imported);
} catch {
  console.error('legacy_order_import_failed');
  process.exitCode = 1;
} finally {
  await db.close();
}
