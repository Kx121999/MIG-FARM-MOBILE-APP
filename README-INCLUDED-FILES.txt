MIG FARM SMART FARM OS V3 + FARM COMMAND CENTER V4 + VERIFIED FARM INTELLIGENCE V5
Combined repository-relative source patch - 2026-09-13

PURPOSE
This archive is an overlay for the current MIG FARM project. It contains every
required V3, V4, and V5 patch file in repository-relative structure. It is not a
standalone project and must not be applied to an older project snapshot.

DEPLOYMENT ORDER
1. Back up the current project and the production Neon database.
2. Copy this archive over the matching paths in the latest MIG FARM project.
3. Install dependencies from the existing lockfile with the project's normal
   package-manager command. V5 adds scripts only and no new package dependency.
4. Configure DATABASE_URL_UNPOOLED or DATABASE_URL on the backend host.
5. Apply migrations in the exact order listed under MIGRATION ORDER.
6. Run npm run knowledge:import once migration 008 is present.
7. Run npm run knowledge:audit and stop deployment if it reports failed.
8. Deploy the updated Node backend to Render.
9. Verify /health, public knowledge/calculator routes, authenticated My Farm
   ownership, and provider status from the deployed backend.
10. Run npm run typecheck, npm test, and npx expo config --json.
11. Build and deploy the Expo app through the existing EAS profiles.

MIGRATION ORDER
1. server/db/migrations/001_customer_foundation.sql (existing, not in archive)
2. server/db/migrations/002_my_farm_os.sql (existing, not in archive)
3. server/db/migrations/003_customer_platform_admin.sql (existing, not in archive)
4. server/db/migrations/004_admin_control_center_v2.sql (existing, not in archive)
5. server/db/migrations/006_smart_farm_knowledge.sql
6. server/db/migrations/007_farm_command_center.sql
7. server/db/migrations/008_verified_farm_intelligence.sql

There is no 005 migration in the current worktree. Do not invent or rename one.
The existing migration runner applies filenames in lexical order.

KNOWLEDGE IMPORT
- npm run knowledge:import
- npm run knowledge:audit
- Production ingestion accepts only verified, production-allowed, non-synthetic
  records whose source references resolve to active source-registry entries.
- The bundled starter pack contains 30 sources and 215 accepted records.
- Import is idempotent through stable identifiers and content hashes.
- Manifest presence, structure, byte size, SHA-256, JSON, and JSONL validity are
  checked before import. The manifest's own self-hash is reported as a warning.
- Remote dataset entries are acquisition manifests only. Nothing is downloaded,
  scraped, or activated automatically.

SYNTHETIC DATA
- All six synthetic_dev_only files from the supplied pack are excluded from this
  archive and from production knowledge tables.
- npm run test:synthetic-load only inspects an explicitly supplied external pack.
- It requires SYNTHETIC_DATA_PACK_DIR and fails when NODE_ENV=production.
- It never imports records into the database.

ENVIRONMENT VARIABLES
Existing backend/database environment variables remain unchanged.
Optional provider contracts added by V5:
- FARM_WEATHER_PROVIDER
- FARM_WEATHER_API_KEY
- FARM_VISION_PROVIDER
- FARM_VISION_API_KEY
- FARM_SENSOR_PROVIDER
- FARM_SENSOR_API_KEY
- SYNTHETIC_DATA_PACK_DIR (development/test inspection only)

No provider secret belongs in Expo or any frontend environment. No live weather,
vision, or sensor adapter is enabled in this patch. Missing credentials return
not_configured; configured but unsupported providers return unavailable.

FILE MANIFEST (99 FILES)
[REPLACE] README-INCLUDED-FILES.txt
[REPLACE] package.json
[REPLACE] app/(tabs)/index.tsx
[REPLACE] app/my-farm/_layout.tsx
[REPLACE] app/my-farm/index.tsx
[REPLACE] app/my-farm/setup.tsx
[NEW]     app/my-farm/planting-calculator.tsx
[NEW]     app/my-farm/irrigation-planner.tsx
[NEW]     app/my-farm/greenhouse-layout.tsx
[NEW]     app/my-farm/library.tsx
[NEW]     app/my-farm/diagnose.tsx
[NEW]     app/my-farm/plan-crop.tsx
[REPLACE] app/my-farm/crop/[id].tsx
[REPLACE] app/my-farm/problem/[id].tsx
[REPLACE] app/my-farm/inventory.tsx
[NEW]     app/my-farm/finance.tsx
[NEW]     app/my-farm/weekly-report.tsx
[NEW]     app/my-farm/season-history.tsx
[REPLACE] app/my-farm/analyses.tsx
[NEW]     app/my-farm/intelligence.tsx
[NEW]     app/my-farm/risks.tsx
[NEW]     app/my-farm/water-quality.tsx
[NEW]     app/my-farm/regulations.tsx
[REPLACE] src/components/AppButton.tsx
[NEW]     src/components/farm/SmartFarmUI.tsx
[NEW]     src/components/farm/FarmCommandUI.tsx
[NEW]     src/components/farm/FarmIntelligenceUI.tsx
[NEW]     src/hooks/useFarmToday.ts
[NEW]     src/hooks/useFarmIntelligence.ts
[REPLACE] src/services/farm.ts
[NEW]     src/services/smartFarm.ts
[NEW]     src/services/farmCommand.ts
[NEW]     src/services/farmIntelligence.ts
[REPLACE] src/types/farm.ts
[NEW]     server/db/migrations/006_smart_farm_knowledge.sql
[NEW]     server/db/migrations/007_farm_command_center.sql
[NEW]     server/db/migrations/008_verified_farm_intelligence.sql
[NEW]     server/smart-farm/calculators.mjs
[NEW]     server/smart-farm/service.mjs
[NEW]     server/farm-command/engine.mjs
[NEW]     server/farm-command/weather.mjs
[NEW]     server/farm-command/service.mjs
[NEW]     server/farm-intelligence/anomaly-engine.mjs
[NEW]     server/farm-intelligence/confidence.mjs
[NEW]     server/farm-intelligence/crop-state.mjs
[NEW]     server/farm-intelligence/engine.mjs
[NEW]     server/farm-intelligence/forecast-engine.mjs
[NEW]     server/farm-intelligence/irrigation-engine.mjs
[NEW]     server/farm-intelligence/providers.mjs
[NEW]     server/farm-intelligence/risk-engine.mjs
[NEW]     server/farm-intelligence/service.mjs
[NEW]     server/knowledge/audit.mjs
[NEW]     server/knowledge/import.mjs
[NEW]     server/knowledge/pack.mjs
[NEW]     server/knowledge/remote-adapters.mjs
[NEW]     server/knowledge/resolver.mjs
[NEW]     server/knowledge/service.mjs
[NEW]     server/knowledge/synthetic-load-check.mjs
[REPLACE] server/services/farms.mjs
[REPLACE] server/src/app.mjs
[NEW]     server/tests/smart-farm-calculators.test.mjs
[NEW]     server/tests/smart-farm-knowledge-api.test.mjs
[NEW]     server/tests/farm-command-engine.test.mjs
[NEW]     server/tests/farm-command-api.test.mjs
[REPLACE] server/tests/my-farm-api.test.mjs
[NEW]     server/tests/knowledge-ingestion-v5.test.mjs
[NEW]     server/tests/farm-intelligence-engine-v5.test.mjs
[NEW]     server/tests/farm-intelligence-api-v5.test.mjs
[NEW]     server/knowledge/data-pack-v1/README.md
[NEW]     server/knowledge/data-pack-v1/CODEX_IMPORT_INSTRUCTIONS.md
[NEW]     server/knowledge/data-pack-v1/manifest.json
[NEW]     server/knowledge/data-pack-v1/calculators/calculator_specs.json
[NEW]     server/knowledge/data-pack-v1/calculators/test_vectors.json
[NEW]     server/knowledge/data-pack-v1/data_acquisition/remote_authoritative_datasets.json
[NEW]     server/knowledge/data-pack-v1/rules/farm_command_rules.json
[NEW]     server/knowledge/data-pack-v1/rules/predictive_intelligence_guardrails.json
[NEW]     server/knowledge/data-pack-v1/schemas/crop_profile.schema.json
[NEW]     server/knowledge/data-pack-v1/schemas/diagnosis_record.schema.json
[NEW]     server/knowledge/data-pack-v1/schemas/fact_record.schema.json
[NEW]     server/knowledge/data-pack-v1/schemas/knowledge_source.schema.json
[NEW]     server/knowledge/data-pack-v1/source_registry/sources.csv
[NEW]     server/knowledge/data-pack-v1/source_registry/sources.json
[NEW]     server/knowledge/data-pack-v1/verified_core/crops/crop_profiles_uae.json
[NEW]     server/knowledge/data-pack-v1/verified_core/crops/crop_profiles_uae.jsonl
[NEW]     server/knowledge/data-pack-v1/verified_core/crops/uae_crop_guide_facts.json
[NEW]     server/knowledge/data-pack-v1/verified_core/crops/uae_crop_guide_facts.jsonl
[NEW]     server/knowledge/data-pack-v1/verified_core/diagnosis/diagnosis_records.json
[NEW]     server/knowledge/data-pack-v1/verified_core/diagnosis/diagnosis_records.jsonl
[NEW]     server/knowledge/data-pack-v1/verified_core/diagnosis/symptom_decision_rules.json
[NEW]     server/knowledge/data-pack-v1/verified_core/facts/facts.json
[NEW]     server/knowledge/data-pack-v1/verified_core/facts/facts.jsonl
[NEW]     server/knowledge/data-pack-v1/verified_core/irrigation/fao_crop_salinity_tolerance.csv
[NEW]     server/knowledge/data-pack-v1/verified_core/irrigation/fao_crop_salinity_tolerance.json
[NEW]     server/knowledge/data-pack-v1/verified_core/irrigation/fao_cropwat_engine_spec.json
[NEW]     server/knowledge/data-pack-v1/verified_core/irrigation/fao_water_salinity_classes.json
[NEW]     server/knowledge/data-pack-v1/verified_core/uae/planting_calendar_moccae.csv
[NEW]     server/knowledge/data-pack-v1/verified_core/uae/planting_calendar_moccae.json
[NEW]     server/knowledge/data-pack-v1/verified_core/uae/regulations.json
[NEW]     server/knowledge/data-pack-v1/verified_core/uae/services.json

PROVIDER AND SAFETY BOUNDARIES
- Risk is never returned as a confirmed diagnosis.
- Anomaly means a difference from the user's own recorded pattern, not an
  agronomic conclusion.
- ETc requires real/verified ETo, a verified Kc, and an available crop stage.
- Irrigation runtime requires known liters, emitter flow/layout, and efficiency.
- Yield and harvest forecasts stop with insufficient_data when evidence is weak.
- Crop-protection recommendations fail closed unless every required label and
  UAE registration field is present.
- Weather, vision, sensors, push delivery, external expert chat, and automated
  greenhouse control are not claimed as live.
- Guest My Farm exposes verified public tools while private records and personal
  intelligence continue to require authentication.

VALIDATION COMPLETED
- npm test: 96 passed, 0 failed.
- V5 focused tests: 12 passed, 0 failed.
- npm run typecheck: passed.
- npx expo config --json: passed.
- Expo web export: passed.
- PGlite migrations 001, 002, 003, 004, 006, 007, and 008: passed.
- PGlite knowledge import: 215 verified records; repeat import: 215 duplicates.
- Knowledge audit: passed; 0 synthetic production records.
- Mobile visual QA: Arabic/English launch, Home, five primary tabs, and guest
  My Farm tools; no horizontal overflow and no browser console errors.

EXCLUDED
This archive intentionally excludes .git, node_modules, build output, Expo and
Metro caches, APK/AAB files, .env files, credentials, secrets, and all six
synthetic_dev_only files.
