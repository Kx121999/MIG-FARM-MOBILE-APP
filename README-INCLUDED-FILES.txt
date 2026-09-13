MIG FARM SMART FARM OS V3 + FARM COMMAND CENTER V4
Combined source patch - 2026-09-13

PURPOSE
This archive is an overlay for the current MIG FARM project. It is not a complete
standalone project and must not be applied to an older project snapshot.

APPLY ORDER
1. Back up the current project and database.
2. Copy the files from this archive over the matching project paths.
3. Apply database migrations in this exact order:
   server/db/migrations/006_smart_farm_knowledge.sql
   server/db/migrations/007_farm_command_center.sql
4. Deploy the updated server before enabling V4 screens against production.
5. Run npm test, npm run typecheck, and npx expo config --json.

FILE MANIFEST
[NEW]     README-INCLUDED-FILES.txt
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
[REPLACE] src/components/AppButton.tsx
[NEW]     src/components/farm/SmartFarmUI.tsx
[NEW]     src/components/farm/FarmCommandUI.tsx
[NEW]     src/hooks/useFarmToday.ts
[REPLACE] src/services/farm.ts
[NEW]     src/services/smartFarm.ts
[NEW]     src/services/farmCommand.ts
[REPLACE] src/types/farm.ts
[NEW]     server/db/migrations/006_smart_farm_knowledge.sql
[NEW]     server/db/migrations/007_farm_command_center.sql
[NEW]     server/smart-farm/calculators.mjs
[NEW]     server/smart-farm/service.mjs
[NEW]     server/farm-command/engine.mjs
[NEW]     server/farm-command/weather.mjs
[NEW]     server/farm-command/service.mjs
[REPLACE] server/services/farms.mjs
[REPLACE] server/src/app.mjs
[NEW]     server/tests/smart-farm-calculators.test.mjs
[NEW]     server/tests/smart-farm-knowledge-api.test.mjs
[NEW]     server/tests/farm-command-engine.test.mjs
[NEW]     server/tests/farm-command-api.test.mjs
[REPLACE] server/tests/my-farm-api.test.mjs

SAFETY AND DATA BOUNDARIES
- Weather stays unavailable until a real provider is configured.
- Agronomist escalation prepares a private case but does not claim delivery when
  no provider is configured.
- Irrigation never invents quantities; it only flags recording gaps from real
  history unless a verified crop profile exists.
- Growth and harvest states use confirmed records and verified profiles only.
- Store links are contextual discovery, not treatment prescriptions.
- Reports, expenses, sales, yield, and margin use recorded customer data only.

VALIDATION COMPLETED
- npm test: 84 passed, 0 failed.
- npm run typecheck: passed.
- npx expo config --json: passed.
- Expo web export: passed.
- Mobile visual QA: Arabic launch, main navigation, Home, and guest My Farm at
  small-phone and iPhone Pro Max viewport sizes.

EXCLUDED
This archive intentionally excludes node_modules, build output, Expo caches,
.git, APK/AAB files, environment files, credentials, and secrets.
