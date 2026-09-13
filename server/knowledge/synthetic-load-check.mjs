import { access, open } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SYNTHETIC_FILES = ['farm_events.jsonl','weather_snapshots.jsonl','diagnostic_cases.jsonl','sensor_readings.jsonl'];

export function assertSyntheticDevelopmentMode(env = process.env) {
  if (env.NODE_ENV === 'production') throw new Error('synthetic_data_disabled_in_production');
  if (!env.SYNTHETIC_DATA_PACK_DIR) throw new Error('synthetic_data_pack_dir_required');
  return resolve(env.SYNTHETIC_DATA_PACK_DIR);
}

export async function inspectSyntheticLoadPack(env = process.env) {
  const packRoot = assertSyntheticDevelopmentMode(env);
  const directory = join(packRoot, 'synthetic_dev_only');
  await access(join(directory, 'DO_NOT_USE_FOR_AGRONOMIC_ADVICE.txt'));
  const files = [];
  for (const name of SYNTHETIC_FILES) {
    const handle = await open(join(directory, name), 'r');
    try {
      const stats = await handle.stat();
      files.push({ name, bytes: stats.size, productionImportAllowed: false });
    } finally {
      await handle.close();
    }
  }
  return { status: 'development_load_pack_available', productionImportAllowed: false, databaseImportPerformed: false, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  inspectSyntheticLoadPack().then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => {
    console.error(JSON.stringify({ status: 'blocked', code: error.message }));
    process.exitCode = 1;
  });
}
