# MIG FARM Storefront V4 - Odoo Findings

Read-only catalog audit date: 2026-09-19 (Asia/Dubai).

## Live catalog

- Source: Odoo through `https://mig-farm-api.onrender.com`
- Products: 654
- Public categories: 69
- Catalog version observed: `odoo:2026-09-08T12:02:09.000Z:654:69`

## Fixed storefront departments

The app now identifies the storefront only by these verified stable IDs:

1. `1` - Seeds
2. `9` - Fertilizers & Plant Nutrition
3. `10` - Irrigation & Hydroponics
4. `11` - Tools & Equipment

Unrelated roots `2` through `8` are not selected merely because they are root categories.

## Current direct children

### 1 - Seeds (215 subtree products, 0 direct)

`70` Cabbage & Brassica Seeds; `71` Corn & Legume Seeds; `72` Cucumber Seeds; `73` Eggplant Seeds; `74` Flower Seeds; `75` Forage & Grass Seeds; `76` Leafy & Herb Seeds; `77` Melon & Cantaloupe Seeds; `78` Okra Seeds; `79` Onion & Leek Seeds; `80` Other Seeds; `81` Pepper Seeds; `82` Root Vegetable Seeds; `83` Squash & Gourd Seeds; `84` Tomato Seeds; `85` Watermelon Seeds.

### 9 - Fertilizers & Plant Nutrition (180 subtree products, 0 direct)

`86` Calcium Magnesium & Sulfur; `87` Fungicides; `88` General Fertilizers; `89` Herbicides; `90` Humic Fulvic & Organic Fertilizers; `91` Insecticides & Acaricides; `92` Micronutrients & Chelates; `93` NPK & Water-Soluble Fertilizers; `94` Organic Pest Control; `95` Other Plant Care; `96` Other Plant Protection; `97` Repellents & Deterrents; `98` Rodenticides & Baits; `99` Seaweed Amino & Biostimulants; `100` Soil Conditioners & Growing Media; `101` pH & Spray Adjuvants.

### 10 - Irrigation & Hydroponics (135 subtree products, 0 direct)

`102` Controllers & Timers; `103` Drip Irrigation; `104` Hose Fittings & Connectors; `105` Hoses; `106` Meters & Testers; `107` Other Irrigation & Hydroponics; `108` Pipes & PVC Fittings; `109` Pumps; `110` Spray Nozzles & Guns; `111` Sprinklers & Foggers; `112` Valves & Filters; `113` Watering Cans & Accessories.

### 11 - Tools & Equipment (124 subtree products, 0 direct)

`114` Carts & Handling; `115` Electrical & Control Components; `116` Fasteners & Hardware; `117` Greenhouse Equipment; `118` Hand Tools; `119` Measuring & Testing Tools; `120` Nets Covers & Ropes; `121` Other Tools & Equipment; `122` Pest Traps & Monitoring; `123` Plant Support & Tying; `124` Pots Crates & Containers; `125` Power Tools; `126` Pruning & Cutting Tools; `127` Sprayers & Fogging Machines.

## Brand and MIG FARM Seeds

The deployed public payload currently overwrites every product vendor with `MIG FARM`, so it cannot prove a real brand relation. No local production Odoo credentials were present to inspect the live `fields_get` response directly.

The patch removes that false default and dynamically accepts only an actually discovered Odoo brand/manufacturer field (`product_brand_id`, `brand_id`, `manufacturer_id`, `manufacturer`, or `x_brand_id`). It returns an empty vendor when none exists. The MIG FARM Seeds filter therefore remains safely unconfigured until Odoo supplies a stable brand relation/ID or a dedicated MIG FARM Seeds category subtree. No title, SKU, AI, or product-ID guessing is used.

Obvious AGRIMAX assignments currently inside the Seeds subtree include product IDs `1472-1502`, `1523`, and `1981`. Their current child assignments span Cabbage, Corn/Legume, Cucumber, Eggplant, Forage, Leafy/Herb, Melon, Okra, Onion, Other Seeds, Root Vegetable, Squash/Gourd, Tomato, and Watermelon. These assignments must be corrected or tagged with a trustworthy brand relation in Odoo before a MIG FARM-only filter can be enabled.

## Suspicious structured assignments

- Product `1463`, `ACETAMIPRID 20% SP`: `9 Fertilizers & Plant Nutrition > 91 Insecticides & Acaricides`.
- Product `1552`, snake repellent: `1 Seeds > 83 Squash & Gourd Seeds`.

The app does not silently reclassify either product. Odoo `public_categ_ids` and `parent_id` remain authoritative.

## Localization

The backend now performs bulk Odoo reads with `ar_001` and `en_US` contexts for product names/descriptions and public category names. Missing or unchanged Arabic values remain null and fall back to the default name; no runtime machine translation is used. Translation coverage can only be confirmed after the patched backend is deployed against Odoo.

## Safety

No stock logic, inventory, payment, order, customer authentication, My Farm backend, database migration, production data, push, or deployment was changed by this patch.
