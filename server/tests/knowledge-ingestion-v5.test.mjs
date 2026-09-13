import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../db/migrate.mjs';
import { auditKnowledge } from '../knowledge/audit.mjs';
import { importKnowledge, loadProductionPack, stableUuid } from '../knowledge/import.mjs';
import { createKnowledgeService } from '../knowledge/service.mjs';
import { assertSyntheticDevelopmentMode } from '../knowledge/synthetic-load-check.mjs';
import { resolveKnowledgeCandidates } from '../knowledge/resolver.mjs';

const database = async () => {
  const engine = new PGlite();
  const wrap = (client) => ({ query: (sql, values) => values ? client.query(sql, values) : client.exec(sql).then((result) => result.at(-1)) });
  const db = { ...wrap(engine), transaction: (operation) => engine.transaction((tx) => operation(wrap(tx))) };
  await migrate(db);
  return { engine, db };
};

test('V5 production knowledge ingestion is verified, idempotent and source-backed', async (t) => {
  const { engine, db } = await database();
  t.after(() => engine.close());
  const pack = await loadProductionPack();
  assert.equal(pack.sources.length, 30);
  assert.equal(pack.records.length, 215);
  assert.equal(pack.rejected.length, 0);
  assert.equal(pack.manifestReport.excludedSyntheticFiles.length, 6);
  assert.ok(pack.manifestReport.warnings.some((item) => item.code === 'self_hash_not_stable'));

  const first = await importKnowledge(db);
  const second = await importKnowledge(db);
  assert.equal(first.recordsImported, 215);
  assert.equal(first.syntheticFilesExcluded, 6);
  assert.equal(second.duplicateRecords, 215);
  assert.equal(second.recordsImported, 0);

  const unresolved = await db.query(`SELECT count(*)::int count FROM mig_farm.knowledge_records r
    LEFT JOIN mig_farm.knowledge_record_sources rs ON rs.record_id=r.id
    WHERE r.record_type NOT IN ('farm_command_rule','predictive_guardrail','calculator_spec')
    GROUP BY r.id HAVING count(rs.source_id)=0`);
  assert.equal(unresolved.rows.length, 0);
  const audit = await auditKnowledge(db);
  assert.equal(audit.status, 'passed');
  assert.equal(audit.counts.productionVerified, 215);
  assert.equal(audit.counts.synthetic, 0);
});

test('production queries exclude unverified, synthetic and missing-source records', async (t) => {
  const { engine, db } = await database();
  t.after(() => engine.close());
  const sourceId = stableUuid('test-source');
  await db.query(`INSERT INTO mig_farm.knowledge_sources
    (id,external_id,authority,organization,title_ar,title_en,source_url,jurisdiction,status,reviewed_at,production_allowed)
    VALUES($1,'TEST_SOURCE','Test','Test','Test','Test','https://example.test/source','AE','verified',now(),true)`, [sourceId]);
  const insert = async ({ id, reviewStatus, productionAllowed, synthetic, withSource }) => {
    await db.query(`INSERT INTO mig_farm.knowledge_records
      (id,record_type,domain,crop,review_status,production_allowed,synthetic,content_hash,search_text,payload_json)
      VALUES($1,'crop_profile','crop_profile',$1,$2,$3,$4,$5,'forbidden sentinel',$6)`, [
      id, reviewStatus, productionAllowed, synthetic, id.padEnd(64, '0').slice(0, 64), JSON.stringify({ slug: id }),
    ]);
    if (withSource) await db.query('INSERT INTO mig_farm.knowledge_record_sources(record_id,source_id) VALUES($1,$2)', [id, sourceId]);
  };
  await insert({ id: 'draft-record', reviewStatus: 'draft', productionAllowed: true, synthetic: false, withSource: true });
  await insert({ id: 'synthetic-record', reviewStatus: 'verified', productionAllowed: false, synthetic: true, withSource: true });
  await insert({ id: 'missing-source-record', reviewStatus: 'verified', productionAllowed: true, synthetic: false, withSource: false });
  await assert.rejects(
    () => db.query(`INSERT INTO mig_farm.knowledge_records
      (id,record_type,domain,review_status,production_allowed,synthetic,content_hash,payload_json)
      VALUES('unsafe-synthetic','crop_profile','crop_profile','verified',true,true,$1,'{}')`, ['f'.repeat(64)]),
  );
  const service = createKnowledgeService(db);
  const result = await service.search(new URL('/api/knowledge/v5/search?q=forbidden', 'http://request.invalid'));
  assert.deepEqual(result.items, []);
});

test('synthetic load tooling is explicit and blocked in production', () => {
  assert.throws(() => assertSyntheticDevelopmentMode({ NODE_ENV: 'production', SYNTHETIC_DATA_PACK_DIR: 'C:\\test' }), /synthetic_data_disabled_in_production/);
  assert.throws(() => assertSyntheticDevelopmentMode({ NODE_ENV: 'test' }), /synthetic_data_pack_dir_required/);
});

test('source precedence orders context-matched candidates without hiding conflicts', () => {
  const result = resolveKnowledgeCandidates([
    { id:'fao',value:2,reviewStatus:'verified',productionAllowed:true,synthetic:false,country:'AE',sources:[{authorityLevel:'international_authority'}] },
    { id:'uae',value:3,reviewStatus:'verified',productionAllowed:true,synthetic:false,country:'AE',sources:[{authorityLevel:'uae_official_authority'}] },
  ],{country:'AE'});
  assert.equal(result.candidates[0].id,'uae');
  assert.equal(result.conflict,true);
  assert.equal(result.automaticSelection,null);
});
