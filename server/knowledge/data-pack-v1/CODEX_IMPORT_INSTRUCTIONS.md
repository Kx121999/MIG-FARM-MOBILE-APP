# CODEX IMPORT INSTRUCTIONS

You are receiving the MIG FARM AGRI INTELLIGENCE DATA PACK.

## MUST
- Audit current V3/V4 database schema before importing.
- Do not overwrite migrations 006/007.
- Create a new migration only if required by current schema.
- Preserve every `source_id`, `review_status`, `production_allowed`, `last_verified_at`.
- Enforce verified-only production queries.
- Keep `synthetic_dev_only` excluded from production builds, production seeds and user-facing knowledge.
- Build source-aware admin/curation paths rather than hard-coding facts in React components.
- Do not generate missing agricultural values from model memory.
- If a crop calculator needs a missing value, return a structured `verified_data_unavailable` state.
- Pesticides: no dose/PHI/REI/product-crop mapping without UAE registration and verified label.
- Weather: no live risk alert without a real configured provider.
- Vision: no image diagnosis claim without a real configured provider.

## SHOULD
- Store verified knowledge server-side.
- Cache a compact subset on mobile.
- Keep source and verification date visible in detail views.
- Track record supersession/deprecation.
- Add tests that prove unverified/synthetic records cannot reach production advice.
