# MIG FARM Storefront V5 - Odoo Data Audit

Audit date: 2026-09-20

## Scope and authority

- Read-only source: `https://mig-farm-api.onrender.com/api/products`
- Catalog version observed: `odoo:2026-09-08T12:02:09.000Z:654:69`
- Product/category authority: `product.template.public_categ_ids` and `product.public.category.parent_id`
- Audited catalog: 654 products and 69 public categories.
- No Odoo record, inventory value, order, payment, migration, or production configuration was modified.

## Storefront departments

The mobile storefront is scoped by stable Odoo IDs only:

| ID | Odoo department | Visible product count |
| ---: | --- | ---: |
| 1 | Seeds | 215 |
| 9 | Fertilizers & Plant Nutrition | 180 |
| 10 | Irrigation & Hydroponics | 135 |
| 11 | Tools & Equipment | 124 |

Counts include each department's full `parent_id` subtree and use the products visible in the current catalog response.

## MIG FARM seed filtering

No trustworthy structured MIG FARM seed identifier is exposed by the current public catalog payload:

- `brand` is `null` for the audited seed candidates.
- `vendor` is empty.
- No dedicated MIG FARM public-category subtree or explicit merchandising collection is present.
- Product titles, SKU/tag text, and images are not safe classification sources.

Therefore the app does **not** filter seeds by title, SKU, tag text, or image. To enable a MIG FARM-only seed collection safely, Odoo must expose a stable relational brand/manufacturer ID, a dedicated public category, or another explicit structured collection.

The following records are non-MIG-FARM-labelled candidates currently assigned to the official Seeds subtree. This list is for manual Odoo review only; title text is not used by runtime filtering.

| Product/template ID | Current title | Public category path |
| ---: | --- | --- |
| 1472 | بذور ملفوف وكرنب AGRIMAX CAN ملفوف WISCONSIN HOLLANDER | 1 Seeds > 70 Cabbage & Brassica Seeds |
| 1473 | بذور ورقيات وأعشاب AGRIMAX CAN كرفس | 1 Seeds > 76 Leafy & Herb Seeds |
| 1474 | بذور ورقيات وأعشاب AGRIMAX CAN كزبرة | 1 Seeds > 76 Leafy & Herb Seeds |
| 1475 | بذور باذنجان AGRIMAX CAN باذنجان أسود BEAUTY | 1 Seeds > 73 Eggplant Seeds |
| 1476 | AGRIMAX CAN طويل فاصوليا لوبيا | 1 Seeds > 71 Corn & Legume Seeds |
| 1477 | بذور خضروات جذرية AGRIMAX CAN طويل أبيض فجل | 1 Seeds > 82 Root Vegetable Seeds |
| 1478 | بذور ورقيات وأعشاب AGRIMAX CAN بقدونس SUPER TRIPLE | 1 Seeds > 76 Leafy & Herb Seeds |
| 1479 | بذور AGRIMAX CAN PURSIANE | 1 Seeds > 80 Other Seeds |
| 1480 | بذور خضروات جذرية AGRIMAX CAN فجل LEAVES | 1 Seeds > 82 Root Vegetable Seeds |
| 1481 | بذور خضروات جذرية AGRIMAX CAN أحمر فجل CHAMPION | 1 Seeds > 82 Root Vegetable Seeds |
| 1482 | بذور ورقيات وأعشاب AGRIMAX CAN THYME | 1 Seeds > 76 Leafy & Herb Seeds |
| 1483 | بذور طماطم AGRIMAX CAN طماطم ROMA VF | 1 Seeds > 84 Tomato Seeds |
| 1484 | بذور خيار AGRIMAX خيار EZZ F1 | 1 Seeds > 72 Cucumber Seeds |
| 1485 | بذور باذنجان AGRIMAX HOBBY أسود EEGGPLANT | 1 Seeds > 73 Eggplant Seeds |
| 1486 | بذور خضروات جذرية AGRIMAX HOBBY CARROTS | 1 Seeds > 82 Root Vegetable Seeds |
| 1487 | بذور باذنجان AGRIMAX HOBBY طويل أبيض باذنجان | 1 Seeds > 73 Eggplant Seeds |
| 1488 | بذور باذنجان AGRIMAX HOBBY PURPLE باذنجان | 1 Seeds > 73 Eggplant Seeds |
| 1489 | بذور ورقيات وأعشاب AGRIMAX HOBBY ROMAN خس | 1 Seeds > 76 Leafy & Herb Seeds |
| 1490 | بذور فراولة AGRIMAX HOBBY | 1 Seeds > 80 Other Seeds |
| 1491 | بذور كوسة وقرعيات AGRIMAX HOBBY SUMMER كوسة | 1 Seeds > 83 Squash & Gourd Seeds |
| 1492 | بذور ذرة وبقوليات AGRIMAX HOBBY حلو أصفر ذرة | 1 Seeds > 71 Corn & Legume Seeds |
| 1493 | بذور بامية AGRIMAX هجين بامية TURBO LADY FINGER F1 250 جم | 1 Seeds > 78 Okra Seeds |
| 1494 | بذور بصل وكراث AGRIMAX هجين أحمر ROCK بصل F1 | 1 Seeds > 79 Onion & Leek Seeds |
| 1495 | بذور بصل وكراث AGRIMAX هجين أبيض SNOW بصل F1 | 1 Seeds > 79 Onion & Leek Seeds |
| 1496 | بذور شمام وكنتالوب AGRIMAX شمام JONAN F1 | 1 Seeds > 77 Melon & Cantaloupe Seeds |
| 1497 | AGRIMAX شمام LION F1 500 بذور | 1 Seeds > 77 Melon & Cantaloupe Seeds |
| 1498 | AGRIMAX MOMBASA بذور 1 كجم | 1 Seeds > 75 Forage & Grass Seeds |
| 1499 | AGRIMAX أحمر LADY STAR PAPAYA f1 (25 بذور) | 1 Seeds > 80 Other Seeds |
| 1500 | بذور كوسة وقرعيات AGRIMAX كوسة | 1 Seeds > 83 Squash & Gourd Seeds |
| 1501 | بذور أعلاف وحشائش AGRIMAX SUPER MOMBACA F1 (PAANICUM) | 1 Seeds > 75 Forage & Grass Seeds |
| 1502 | AGRIMAX مياه شمام FAHED F1 500 بذور | 1 Seeds > 85 Watermelon Seeds |
| 1503 | AMC خيار بذور- BANAN 500 بذور/عبوة | 1 Seeds > 72 Cucumber Seeds |
| 1523 | بذور خضروات جذرية Agrimax جزر youbeel F1 | 1 Seeds > 82 Root Vegetable Seeds |
| 1634 | بذور طماطم Elek F1 طماطم | 1 Seeds > 84 Tomato Seeds |
| 1752 | KATRINA- بيت محمي 500 بذور/PKT | 1 Seeds > 72 Cucumber Seeds |
| 1850 | عضوي KATRINA-خيار بذور 500 بذور | 1 Seeds > 72 Cucumber Seeds |
| 1981 | بذور بطيخ agrimax hobby قرمزي بطيخ | 1 Seeds > 85 Watermelon Seeds |

## Suspicious public-category assignments

These are review flags, not automatic chemical classifications:

| Product/template ID | Product title | Current public category | Why it needs Odoo review |
| ---: | --- | --- | --- |
| 1463 | مبيد حشري/أكاروسي ACETAMIPRID 20% SP | 9 Fertilizers & Plant Nutrition > 91 Insecticides & Acaricides | The child category is nested under the nutrition storefront department, so the item appears in that department despite the child label. Review the `parent_id` of category 91 or the product's `public_categ_ids`. |
| 1552 | طارد الثعابين Buyblocker سعة 1 كجم | 1 Seeds > 83 Squash & Gourd Seeds | The current public-category relationship places a repellent in a seed child category. Review product 1552 `public_categ_ids`. |

## Product names and variants

- Cards render the localized Odoo product title exactly once. The app no longer prepends category names.
- Repeated source phrases such as `بذور طماطم طماطم` remain visible when they are part of the Odoo title itself; correction belongs in the Odoo product translation/name.
- The current Seeds payload has no product template with more than one exposed variant. Similar 30-seed and 500-seed packs are separate Odoo templates and were not merged.

## MIG FARM Picks

The app renders this rail only when the trusted platform home-content source returns a `featured` section with explicit product IDs. No random, newest-product, title-based, or image-based fallback curation is used.

