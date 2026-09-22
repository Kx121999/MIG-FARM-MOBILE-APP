# MIG FARM Storefront V6 - Odoo Data Audit

Audit date: 2026-09-21

## Authority and scope

- Odoo authority remains `product.template.public_categ_ids` plus `product.public.category.parent_id`.
- The last verified read-only production snapshot in this repository is catalog version `odoo:2026-09-08T12:02:09.000Z:654:69`, captured on 2026-09-20 with 654 products and 69 public categories.
- A newer production response could not be fetched from this execution environment, so this report does not claim that Odoo changed after that snapshot.
- No Odoo record, category, stock value, inventory adjustment, order, payment, migration, or production setting was modified.

## MIG FARM seed structured source

Result: **NOT FOUND**

`MIG FARM seed brand field unavailable`

The latest verified public catalog snapshot has `brand: null` and an empty `vendor` for the audited seed candidates. It exposes no dedicated MIG FARM seed public-category subtree or explicit merchandising collection. The application therefore keeps the true Seeds subtree and does not filter by title, SKU, tags, image content, or guessed keywords.

The server is ready to accept a real relational Odoo field when discovered (`product_brand_id`, `brand_id`, `manufacturer_id`, `manufacturer`, or `x_brand_id`), but no such populated source was present in the verified payload.

## Non-MIG-FARM-labelled records inside Seeds

These title labels are an audit list only and are never used by runtime classification:

| Product/template IDs | Label observed | Odoo scope |
| --- | --- | --- |
| 1472-1502 | AGRIMAX / AMC labelled seed records | Seeds subtree, multiple child categories |
| 1523 | Agrimax carrot record | `1 Seeds > 82 Root Vegetable Seeds` |
| 1634 | Elek F1 tomato record | `1 Seeds > 84 Tomato Seeds` |
| 1752, 1850 | KATRINA cucumber records | `1 Seeds > 72 Cucumber Seeds` |
| 1981 | agrimax hobby watermelon record | `1 Seeds > 85 Watermelon Seeds` |

The complete record-by-record list remains in `delivery/STOREFRONT_V5_ODOO_DATA_AUDIT.md` and was not transformed into app filtering.

## Requested product re-check

| Product ID | Template ID | Product name | `public_categ_ids` | Complete lineage | Current storefront department | Result |
| ---: | ---: | --- | --- | --- | --- | --- |
| 1552 | 1552 | طارد الثعابين Buyblocker سعة 1 كجم | `[83]` | `1 Seeds > 83 Squash & Gourd Seeds` | `1 Seeds` | Suspicious structured assignment. Flag for manual Odoo review only. |
| 1634 | 1634 | بذور طماطم Elek F1 طماطم | `[84]` | `1 Seeds > 84 Tomato Seeds` | `1 Seeds` | Valid structured seed assignment, but no trustworthy MIG FARM brand relation. Keep visible and flag brand merchandising for manual Odoo review. |

Adjacent known structured flag retained from the verified snapshot:

| Product ID | Template ID | Product name | `public_categ_ids` | Complete lineage | Current storefront department | Result |
| ---: | ---: | --- | --- | --- | --- | --- |
| 1463 | 1463 | مبيد حشري/أكاروسي ACETAMIPRID 20% SP | `[91]` | `9 Fertilizers & Plant Nutrition > 91 Insecticides & Acaricides` | `9 Fertilizers & Plant Nutrition` | Review category `91` parent or the product assignment in Odoo. No automatic chemical reclassification. |

## Storefront counts from the verified snapshot

| Department ID | Department | Visible subtree count |
| ---: | --- | ---: |
| 1 | Seeds | 215 |
| 9 | Fertilizers & Plant Nutrition | 180 |
| 10 | Irrigation & Hydroponics | 135 |
| 11 | Tools & Equipment | 124 |

At runtime the Home cards and Store count are recalculated from the current catalog response and active ID-based scope; these numbers are not hardcoded into the UI.

## Safety confirmation

- No title/description/image classification was added.
- No Odoo category or product data was changed.
- No stock, inventory, order, quotation, payment, authentication, Neon schema, or My Farm backend logic was changed.
- No migration, deployment, or Git push was performed.
