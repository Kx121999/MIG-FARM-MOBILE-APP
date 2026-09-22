import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('V5 department identity, localization, counts, and hierarchy remain ID-driven', async () => {
  const {
    STOREFRONT_DEPARTMENT_IDS,
    categoryPageSections,
    localizedCategoryName,
    storefrontDepartmentDescription,
    storefrontHomeSections,
  } = await loadTypeScriptModule('../src/constants/categories.ts');
  const categories = [
    { id: 500, name: 'Unrelated', parentId: null, sequence: 0 },
    { id: 1, name: 'Renamed Seeds', parentId: null, sequence: 9 },
    { id: 70, name: 'Tomato', name_ar: 'بذور الطماطم', parentId: 1, sequence: 1 },
    { id: 71, name: 'Cherry', parentId: 70, sequence: 1 },
    { id: 9, name: 'Nutrition', parentId: null, sequence: 8 },
    { id: 10, name: 'Water', parentId: null, sequence: 7 },
    { id: 11, name: 'Equipment', parentId: null, sequence: 6 },
  ];
  const product = (id, category) => ({ id, title: `Exact Odoo title ${id}`, categories: [category] });
  const products = [product(1, categories[1]), product(2, categories[2]), product(3, categories[3])];
  assert.deepEqual(STOREFRONT_DEPARTMENT_IDS, [1, 9, 10, 11]);
  assert.deepEqual(storefrontHomeSections(products, categories).map((section) => section.category.id), [1, 9, 10, 11]);
  assert.equal(storefrontHomeSections(products, categories)[0].productCount, 3);
  assert.equal(localizedCategoryName(categories[1], 'ar'), 'البذور');
  assert.equal(localizedCategoryName(categories[4], 'ar'), 'الأسمدة وتغذية النباتات');
  assert.equal(localizedCategoryName(categories[5], 'en'), 'Irrigation & Hydroponics');
  assert.match(storefrontDepartmentDescription(11, 'ar'), /أدوات/);
  const sections = categoryPageSections(products, categories, 1);
  assert.equal(sections[0].kind, 'direct');
  assert.equal(sections[0].products[0].title, 'Exact Odoo title 1');
  assert.deepEqual(sections[1].products.map((item) => item.id), [2, 3]);
});

test('V6 Home and Store use separate architectures with trusted curation only', async () => {
  const [home, catalog, departmentGrid] = await Promise.all([
    source('../app/(tabs)/index.tsx'),
    source('../app/(tabs)/catalog.tsx'),
    source('../src/components/StoreDepartmentGrid.tsx'),
  ]);
  assert.match(home, /<StoreDepartmentGrid sections=\{departmentSections\}/);
  assert.match(home, /heroSource/);
  assert.match(home, /COMPANY\.whatsapp/);
  assert.doesNotMatch(catalog, /StorefrontHome|isStorefrontHome|heroSource|COMPANY\.whatsapp/);
  assert.match(catalog, /numColumns=\{2\}/);
  assert.match(catalog, /!showCategorySections && !loading/);
  assert.match(departmentGrid, /width: '47\.5%'/);
  assert.match(departmentGrid, /department-seeds\.png/);
  assert.match(departmentGrid, /department-fertilizers\.png/);
  assert.match(departmentGrid, /department-irrigation\.png/);
  assert.match(departmentGrid, /department-tools\.png/);
  assert.match(home, /section\.kind === 'featured'/);
  assert.match(home, /featuredSection\.productIds/);
  assert.doesNotMatch(home, /sortProducts\(|slice\(0, 6\)|MIG FARM selection/);
  assert.match(catalog, /visible\.length/);
});

test('V5 category and product surfaces preserve RTL bounds, exact names, variants, and safe padding', async () => {
  const [catalog, sections, card, rail, tabs] = await Promise.all([
    source('../app/(tabs)/catalog.tsx'),
    source('../src/components/CategorySections.tsx'),
    source('../src/components/ProductCard.tsx'),
    source('../src/components/ProductRail.tsx'),
    source('../app/(tabs)/_layout.tsx'),
  ]);
  assert.match(catalog, /paddingStart: 16, paddingEnd: 16/);
  assert.doesNotMatch(catalog, /onContentSizeChange|scrollToEnd|inverted=\{isRTL\}/);
  assert.match(catalog, /Math\.max\(104, insets\.bottom \+ 92\)/);
  assert.match(sections, /Other \/ Direct products/);
  assert.match(sections, /categoryPageSections\(products, categories, categoryId\)/);
  assert.match(card, /const title = localizedProductTitle\(product, language\)/);
  assert.equal((card.match(/\{title\}<\/Text>/g) || []).length, 1);
  assert.match(card, /product\.variants\.length > 1/);
  assert.match(card, /addToCart\(product, variant, 1\)/);
  assert.match(card, /resizeMode="contain"/);
  assert.doesNotMatch(rail, /inverted=\{isRTL\}/);
  assert.doesNotMatch(rail, /FlatList/);
  assert.match(rail, /<ScrollView/);
  assert.doesNotMatch(rail, /height\s*:/);
  assert.match(tabs, /name="my-farm" options=\{\{ href: null \}\}/);
});

test('V5 brand safety never guesses from title, SKU, or images', async () => {
  const [categories, odoo, product] = await Promise.all([
    source('../src/constants/categories.ts'),
    source('../server/services/odoo.mjs'),
    source('../app/product/[handle].tsx'),
  ]);
  assert.match(categories, /product\.brand\?\.id === brandId/);
  assert.doesNotMatch(categories, /AGRIMAX|KATRINA|product\.title|sku|image/);
  assert.doesNotMatch(odoo, /vendor: 'MIG FARM'/);
  assert.doesNotMatch(product, /product\.vendor \|\| 'MIG FARM'/);
});
