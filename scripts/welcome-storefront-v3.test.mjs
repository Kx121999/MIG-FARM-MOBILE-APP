import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('welcome remains user-controlled and switches localized artwork immediately', async () => {
  const [launch, entry] = await Promise.all([
    readFile(new URL('../src/components/LocalizedLaunchScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/AppEntry.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(launch, /source=\{launchImages\[language\]\}/);
  assert.match(launch, /onLanguageChange\('ar'\)/);
  assert.match(launch, /onLanguageChange\('en'\)/);
  assert.match(launch, /language === 'ar' \? 'ابدأ الآن' : 'Start Now'/);
  assert.match(launch, /writingDirection: language === 'ar' \? 'rtl' : 'ltr'/);
  assert.doesNotMatch(launch, /\[launchLanguage\]|setTimeout|autoDismiss/);
  assert.match(entry, /onLanguageChange=\{setLanguage\}/);
  assert.match(entry, /onComplete=\{enterApp\}/);
  assert.doesNotMatch(entry, /setTimeout|onboarding.*router|router\.replace/);
});

test('welcome artwork uses a non-overlapping full-height responsive stage', async () => {
  const launch = await readFile(new URL('../src/components/LocalizedLaunchScreen.tsx', import.meta.url), 'utf8');
  assert.match(launch, /resizeMode="contain"/);
  assert.match(launch, /imageStage: \{ flex: 1, minHeight: 0/);
  assert.match(launch, /image: \{ width: '100%', height: '100%'/);
  const actionStyle = launch.slice(launch.indexOf('actionArea:'), launch.indexOf('startButton:'));
  assert.doesNotMatch(actionStyle, /position: 'absolute'/);
  assert.match(launch, /useSafeAreaInsets/);
});

test('storefront home resolves exactly four live Odoo roots and isolates their previews', async () => {
  const {
    categorySubtreeIds,
    productsInCategoryTree,
    storefrontHomeSections,
  } = await loadTypeScriptModule('../src/constants/categories.ts');
  const categories = [
    { id: 1, name: 'Seeds', parentId: null, sequence: 1 },
    { id: 70, name: 'Vegetable Seeds', parentId: 1, sequence: 1 },
    { id: 84, name: 'Tomato Seeds', parentId: 70, sequence: 1 },
    { id: 2, name: 'Legacy Empty', parentId: null, sequence: 2 },
    { id: 9, name: 'Fertilizers & Plant Nutrition', parentId: null, sequence: 3 },
    { id: 86, name: 'Plant Nutrition', parentId: 9, sequence: 1 },
    { id: 10, name: 'Irrigation & Hydroponics', parentId: null, sequence: 4 },
    { id: 102, name: 'Controllers', parentId: 10, sequence: 1 },
    { id: 11, name: 'Tools & Equipment', parentId: null, sequence: 5 },
    { id: 114, name: 'Handling', parentId: 11, sequence: 1 },
  ];
  const product = (id, assigned) => ({ id, title: `Product ${id}`, categories: assigned });
  const products = [
    product(1, [categories[0]]),
    product(2, [categories[2]]),
    product(3, [categories[5]]),
    product(4, [categories[7]]),
    product(5, [categories[9]]),
    product(6, [categories[2], categories[5]]),
    ...Array.from({ length: 12 }, (_, index) => product(20 + index, [categories[2]])),
  ];
  const sections = storefrontHomeSections(products, categories);
  assert.deepEqual(sections.map((section) => section.category.id), [1, 9, 10, 11]);
  assert.ok(sections.every((section) => section.products.length > 0 && section.products.length <= 10));
  assert.deepEqual(productsInCategoryTree(products, categories, 10).map((item) => item.id), [4]);
  assert.ok(sections[0].products.some((item) => item.id === 1), 'direct root products stay visible');
  assert.ok(sections[0].products.some((item) => item.id === 2), 'deep products stay in their root preview');
  assert.equal(sections[0].products.some((item) => item.id === 3), false, 'sibling roots never leak');
  assert.ok(categorySubtreeIds(1, categories).has(84));

  const renamed = categories.map((category) => category.id === 1 ? { ...category, name: 'Renamed Seeds' } : category);
  assert.equal(storefrontHomeSections(products, renamed)[0].category.id, 1);
  const moved = categories.map((category) => category.id === 70 ? { ...category, parentId: 9 } : category);
  assert.equal(productsInCategoryTree(products, moved, 1).some((item) => item.id === 2), false);
  assert.equal(productsInCategoryTree(products, moved, 9).some((item) => item.id === 2), true);
});

test('storefront stays single-fetch, ID-driven, brand-honest, and release-safe', async () => {
  const [catalog, storefront, categories, tabs, odoo] = await Promise.all([
    readFile(new URL('../app/(tabs)/catalog.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/StorefrontHome.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/constants/categories.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../server/services/odoo.mjs', import.meta.url), 'utf8'),
  ]);
  assert.equal((catalog.match(/useProducts\(\)/g) || []).length, 1);
  assert.match(catalog, /storefrontHomeSections\(products, categories\)/);
  assert.match(catalog, /productsInCategoryTree\(products, categories, category\)/);
  assert.match(storefront, /onOpenCategory\(section\.category\.id\)/);
  assert.match(storefront, /categoryId=\{section\.category\.id\}/);
  assert.doesNotMatch(`${storefront}\n${categories}`, /fetch\(|product\.(?:title|vendor|description).*includes|vendor\s*===/);
  assert.match(odoo, /vendor: 'MIG FARM'/);
  assert.match(tabs, /name="my-farm" options=\{\{ href: null \}\}/);
  assert.doesNotMatch(`${catalog}\n${storefront}\n${categories}`, /stock\.quant|action_confirm|PaymentIntent|\/api\/orders/);
});
