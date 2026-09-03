import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../db/client.mjs';
import { loadEnv } from '../lib/env.mjs';
import { createApp } from './app.mjs';

loadEnv();
const db = createDatabase();
const catalog = JSON.parse(
  await readFile(new URL('../data/products.json', import.meta.url), 'utf8'),
);
const server = createApp({
  db,
  catalog,
  mediaRoot: fileURLToPath(new URL('../public/', import.meta.url)),
});
const port = Number(process.env.PORT || 8787);
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.listen(port, '0.0.0.0', () =>
  console.log('MIG FARM API listening on port ' + port),
);
const stop = () =>
  server.close(() => {
    void db?.close();
  });
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
