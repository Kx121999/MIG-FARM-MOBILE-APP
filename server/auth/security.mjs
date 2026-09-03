import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fail } from '../lib/validation.mjs';
const derive = promisify(scrypt);
export const token = () => randomBytes(32).toString('base64url');
export const hashToken = (value) =>
  createHash('sha256').update(String(value)).digest('hex');
let hashing = 0;
async function key(password, salt) {
  if (hashing >= 2) throw fail(503, 'temporarily_unavailable');
  hashing++;
  try {
    return await derive(password, salt, 64, {
      N: 131072,
      r: 8,
      p: 1,
      maxmem: 192 * 1024 * 1024,
    });
  } finally {
    hashing--;
  }
}
export async function hashPassword(value) {
  const salt = randomBytes(16).toString('hex');
  return 'scrypt1$' + salt + '$' + (await key(value, salt)).toString('hex');
}
export async function verifyPassword(value, encoded) {
  if (typeof value !== 'string' || value.length > 128) return false;
  const parts = (
    encoded || 'scrypt1$00000000000000000000000000000000$' + '00'.repeat(64)
  ).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt1') return false;
  const actual = await key(value, parts[1]),
    expected = Buffer.from(parts[2], 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function bearer(request) {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer ([a-zA-Z0-9_-]{32,256})$/.exec(header);
  if (!match) throw fail(401, 'unauthorized');
  return match[1];
}
