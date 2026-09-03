import { existsSync } from 'node:fs';
export function loadEnv() {
  const path = new URL('../../.env', import.meta.url);
  if (existsSync(path)) process.loadEnvFile(path);
}
