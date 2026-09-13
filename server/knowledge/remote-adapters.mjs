import { readFile } from 'node:fs/promises';

export async function loadRemoteAdapterRegistry(manifestUrl = new URL('./data-pack-v1/data_acquisition/remote_authoritative_datasets.json', import.meta.url)) {
  const records = JSON.parse(await readFile(manifestUrl, 'utf8'));
  if (!Array.isArray(records)) throw new Error('invalid_remote_dataset_manifest');
  return records.map((record) => ({
    id: record.id,
    provider: record.provider || record.id,
    url: record.url,
    purpose: record.purpose || [],
    importPolicy: record.import_policy || 'manual_review_required',
    status: 'not_imported',
    automaticImportEnabled: false,
    requiresLicenseReview: true,
    requiresSourceValidation: true,
  }));
}

export function createRemoteKnowledgeAdapter(config) {
  return {
    id: config.id,
    provider: config.provider,
    status: async () => ({ status: 'not_configured', automaticImportEnabled: false }),
    fetch: async () => ({
      status: 'not_configured',
      records: [],
      reason: 'remote_import_requires_explicit_credentials_license_review_and_mapping',
    }),
  };
}
