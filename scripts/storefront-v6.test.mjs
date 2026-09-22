import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import ts from 'typescript';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

async function loadTypeScriptModule(path) {
  const input = await source(path);
  const output = ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('V6 keeps Home discovery and Store catalog architectures separate', async () => {
  const [home, catalog] = await Promise.all([
    source('../app/(tabs)/index.tsx'),
    source('../app/(tabs)/catalog.tsx'),
  ]);
  assert.match(home, /<ImageBackground/);
  assert.match(home, /<StoreDepartmentGrid/);
  assert.match(home, /COMPANY\.whatsapp/);
  assert.doesNotMatch(home, /numColumns=\{2\}/);
  assert.doesNotMatch(catalog, /StorefrontHome|isStorefrontHome|<ImageBackground|COMPANY\.whatsapp/);
  assert.match(catalog, /<CategorySections/);
  assert.match(catalog, /numColumns=\{2\}/);
  assert.match(catalog, /showCategorySections && selectedCategory/);
  assert.match(catalog, /!showCategorySections && !loading && !error && visible\.length/);
});

test('V6 maps the four supplied square assets to exact Odoo department IDs in a 2x2 grid', async () => {
  const [categories, grid] = await Promise.all([
    loadTypeScriptModule('../src/constants/categories.ts'),
    source('../src/components/StoreDepartmentGrid.tsx'),
  ]);
  assert.deepEqual(categories.STOREFRONT_DEPARTMENT_IDS, [1, 9, 10, 11]);
  const expected = new Map([
    [1, 'department-seeds.png'],
    [9, 'department-fertilizers.png'],
    [10, 'department-irrigation.png'],
    [11, 'department-tools.png'],
  ]);
  for (const [id, file] of expected) {
    assert.match(grid, new RegExp(`${id}: require\\('\\.\\.\\/\\.\\.\\/assets\\/storefront\\/${file.replace('.', '\\.')}\\'\\)`));
    const url = new URL(`../assets/storefront/${file}`, import.meta.url);
    assert.ok((await stat(url)).size > 100_000);
    const metadata = await sharp(await readFile(url)).metadata();
    assert.equal(metadata.width, metadata.height);
  }
  assert.match(grid, /flexWrap: 'wrap'/);
  assert.match(grid, /width: '47\.5%'/);
  assert.match(grid, /aspectRatio: 1/);
  assert.doesNotMatch(grid, /API_ORIGIN|remoteFailed|category-(?:seeds|fertilizers|irrigation|tools)\.webp/);
});

test('V6 parent sections and leaf grids are mutually exclusive and ID-driven', async () => {
  const [catalog, sections, helpers] = await Promise.all([
    source('../app/(tabs)/catalog.tsx'),
    source('../src/components/CategorySections.tsx'),
    loadTypeScriptModule('../src/constants/categories.ts'),
  ]);
  const categories = [
    { id: 1, name: 'Seeds', parentId: null, sequence: 1 },
    { id: 20, name: 'Tomato', parentId: 1, sequence: 1 },
    { id: 21, name: 'Cherry', parentId: 20, sequence: 1 },
  ];
  const products = [
    { id: 100, title: 'Exact root title', categories: [categories[0]] },
    { id: 101, title: 'Exact child title', categories: [categories[1]] },
    { id: 102, title: 'Exact deep title', categories: [categories[2]] },
  ];
  const parent = helpers.categoryPageSections(products, categories, 1);
  assert.equal(parent[0].kind, 'direct');
  assert.deepEqual(parent[0].products.map((product) => product.id), [100]);
  assert.deepEqual(parent[1].products.map((product) => product.id), [101, 102]);
  assert.deepEqual(helpers.directChildCategories(categories, 21), []);
  assert.match(catalog, /Boolean\(selectedCategory && childCategories\.length\)/);
  assert.match(sections, /categoryPageSections\(products, categories, categoryId\)/);
  assert.doesNotMatch(helpers.productMatchesCategory.toString(), /title|description|name/);
});

test('V6 rails measure their cards naturally and deterministic card regions cannot overlap', async () => {
  const [rail, sections, card] = await Promise.all([
    source('../src/components/ProductRail.tsx'),
    source('../src/components/CategorySections.tsx'),
    source('../src/components/ProductCard.tsx'),
  ]);
  assert.match(rail, /<ScrollView/);
  assert.doesNotMatch(rail, /FlatList|position:\s*'absolute'|height\s*:/);
  assert.match(sections, /marginBottom: spacing\.xl/);
  assert.match(sections, /overflow: 'visible'/);
  assert.match(card, /numberOfLines=\{2\}/);
  assert.match(card, /height: metrics\.titleHeight/);
  assert.match(card, /height: metrics\.priceHeight/);
  assert.match(card, /height: metrics\.metaHeight/);
  assert.match(card, /actions: \{ height: sizes\.touch/);
  assert.match(card, /resizeMode="contain"/);
  assert.match(card, /Image unavailable/);
  assert.match(card, /const title = localizedProductTitle\(product, language\)/);
  assert.doesNotMatch(card, /category.*\+.*title|title.*\+.*category/i);
});

test('V6 preserves RTL edge padding, safe bottom spacing, variants, and truthful brand handling', async () => {
  const [home, catalog, rail, card, helpers, odoo, cache] = await Promise.all([
    source('../app/(tabs)/index.tsx'),
    source('../app/(tabs)/catalog.tsx'),
    source('../src/components/ProductRail.tsx'),
    source('../src/components/ProductCard.tsx'),
    source('../src/constants/categories.ts'),
    source('../server/services/odoo.mjs'),
    source('../src/services/catalog.ts'),
  ]);
  assert.match(catalog, /paddingStart: 16, paddingEnd: 16/);
  assert.match(catalog, /direction: isRTL \? 'rtl' : 'ltr'/);
  assert.match(rail, /paddingStart: spacing\.xs/);
  assert.match(rail, /paddingEnd: spacing\.xs/);
  assert.match(rail, /direction: isRTL \? 'rtl' : 'ltr'/);
  assert.doesNotMatch(`${catalog}\n${rail}`, /inverted=\{isRTL\}/);
  assert.match(home, /Math\.max\(104, insets\.bottom \+ 92\)/);
  assert.match(catalog, /Math\.max\(104, insets\.bottom \+ 92\)/);
  assert.match(card, /addToCart\(product, variant, 1\)/);
  assert.match(card, /product\.variants\.length > 1/);
  assert.match(helpers, /product\.brand\?\.id === brandId/);
  assert.doesNotMatch(helpers, /AGRIMAX|KATRINA|product\.title|sku|image/);
  assert.match(odoo, /BRAND_FIELD_CANDIDATES/);
  assert.match(odoo, /public_categ_ids/);
  assert.match(cache, /mig_farm_catalog_cache_v6/);
});
