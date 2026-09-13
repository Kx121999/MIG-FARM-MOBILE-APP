# MIG FARM AGRI INTELLIGENCE DATA PACK V1

Generated: 2026-09-12T23:59:00+04:00

## Purpose
This pack is designed to be supplied to Codex together with the next MIG FARM development prompt.

It deliberately separates:
1. **verified_core/** — production-eligible facts that have a traceable authoritative source.
2. **rules/** — deterministic product/guardrail rules; these are application logic, not agricultural facts.
3. **data_acquisition/** — official external datasets that should be pulled in a controlled ingestion job when internet access is available.
4. **synthetic_dev_only/** — large fake datasets for performance, pagination, anomaly-engine and UI testing. NEVER use this folder for agricultural advice.

## Golden rule
NO SOURCE = NO PRODUCTION AGRONOMIC NUMBER.

A null/missing field means:
**the pack does not currently contain a verified value. Do not infer or fill it from model memory.**

## Production filters
A production knowledge query should enforce:
- `review_status == "verified"`
- `production_allowed == true`
- source exists in `source_registry/sources.json`
- crop/region/production-system context matches the user case
- pesticide / fertilizer product data additionally require local registration + verified product label

## Legal content
UAE regulation/service records are informational summaries and MUST link to the official authority.
Never present them as legal advice and never suppress the `last_verified_at` timestamp.

## Irrigation
Use the FAO method only when the necessary verified/live inputs are available.
Do not fabricate Kc, ETo, emitter flow, irrigation efficiency or crop-stage values.

## Synthetic data
`synthetic_dev_only/` exists to help Codex build:
- large-list performance
- pagination
- caching
- anomaly detection
- event timelines
- reports
- charts
- offline sync tests

Every synthetic record contains `synthetic: true` and `production_allowed: false`.

## Recommended import order
1. source registry
2. schemas
3. UAE crop calendar
4. UAE crop guide facts
5. FAO water/irrigation facts
6. diagnosis records
7. deterministic rules
8. application migration/seed job
9. synthetic data ONLY in local/test environments

## Important
This is a curated starter corpus, not a claim that every crop/condition is covered.
The app must fail closed when a verified numeric input is missing.
