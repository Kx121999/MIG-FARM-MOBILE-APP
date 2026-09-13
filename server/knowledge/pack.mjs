import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PACK_DIR = fileURLToPath(new URL('./data-pack-v1/', import.meta.url));

export class DataPackError extends Error {
  constructor(code, report) {
    super(code);
    this.name = 'DataPackError';
    this.code = code;
    this.report = report;
  }
}

export function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const contentHash = (value) => sha256(canonicalStringify(value));

export async function readPackJson(packDir, relativePath) {
  const absolute = safePackPath(packDir, relativePath);
  try {
    return JSON.parse(await readFile(absolute, 'utf8'));
  } catch (error) {
    throw new DataPackError('malformed_pack_file', {
      errors: [{ path: relativePath, code: error instanceof SyntaxError ? 'invalid_json' : 'unreadable_file' }],
      warnings: [],
    });
  }
}

export async function validateDataPack(packDir = DEFAULT_PACK_DIR, { includeSynthetic = false } = {}) {
  const manifestPath = safePackPath(packDir, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    throw new DataPackError('manifest_invalid', { errors: [{ path: 'manifest.json', code: 'missing_or_invalid' }], warnings: [] });
  }
  const errors = [];
  const warnings = [];
  const verifiedFiles = [];
  const excludedSyntheticFiles = [];
  if (!manifest || typeof manifest.pack !== 'string' || !Array.isArray(manifest.files)) {
    throw new DataPackError('manifest_invalid', { errors: [{ path: 'manifest.json', code: 'invalid_structure' }], warnings });
  }
  for (const entry of manifest.files) {
    if (!entry || typeof entry.path !== 'string' || !Number.isInteger(entry.size_bytes) || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) {
      errors.push({ path: entry?.path || 'unknown', code: 'invalid_manifest_entry' });
      continue;
    }
    const synthetic = entry.path.startsWith('synthetic_dev_only/');
    if (synthetic && !includeSynthetic) {
      excludedSyntheticFiles.push(entry.path);
      continue;
    }
    const absolute = safePackPath(packDir, entry.path);
    try {
      await access(absolute);
    } catch {
      errors.push({ path: entry.path, code: 'missing_file' });
      continue;
    }
    const bytes = await readFile(absolute);
    const details = await stat(absolute);
    const actualHash = sha256(bytes);
    if (entry.path === 'manifest.json') {
      if (details.size !== entry.size_bytes || actualHash !== entry.sha256) {
        warnings.push({ path: entry.path, code: 'self_hash_not_stable', expectedBytes: entry.size_bytes, actualBytes: details.size });
      }
    } else {
      if (details.size !== entry.size_bytes) errors.push({ path: entry.path, code: 'size_mismatch', expected: entry.size_bytes, actual: details.size });
      if (actualHash !== entry.sha256) errors.push({ path: entry.path, code: 'hash_mismatch' });
    }
    if (entry.path.endsWith('.json')) {
      try { JSON.parse(bytes.toString('utf8')); }
      catch { errors.push({ path: entry.path, code: 'invalid_json' }); }
    }
    if (entry.path.endsWith('.jsonl') && !synthetic) {
      const lines = bytes.toString('utf8').split(/\r?\n/).filter(Boolean);
      for (let index = 0; index < lines.length; index += 1) {
        try { JSON.parse(lines[index]); }
        catch { errors.push({ path: entry.path, code: 'invalid_jsonl', line: index + 1 }); break; }
      }
    }
    verifiedFiles.push(entry.path);
  }
  const report = {
    pack: manifest.pack,
    generatedAt: manifest.generated_at || null,
    manifestHash: sha256(await readFile(manifestPath)),
    verifiedFiles,
    excludedSyntheticFiles,
    errors,
    warnings,
  };
  if (errors.length) throw new DataPackError('pack_validation_failed', report);
  return { manifest, report };
}

function safePackPath(packDir, relativePath) {
  const root = path.resolve(packDir);
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new DataPackError('invalid_pack_path', { errors: [{ path: relativePath, code: 'path_escape' }], warnings: [] });
  }
  return absolute;
}
