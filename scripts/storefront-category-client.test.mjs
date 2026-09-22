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

test('mobile storefront filters exclusively by stable Odoo website category IDs', async () => {
  const {
    categoryDisplayName,
    categoryPageSections,
    categoryLineage,
    directChildCategories,
    orderedStoreCategories,
    productMatchesCategory,
    rootStoreCategories,
    storefrontDepartments,
    filterSeedsByTrustedBrand,
    localizedCategoryName,
  } = await loadTypeScriptModule('../src/constants/categories.ts');
  const categories = [
    { id: 1, name: 'Seeds', parentId: null, sequence: 2 },
    { id: 2, name: 'Tomato', parentId: 1, sequence: 1 },
    { id: 5, name: 'Cherry Tomato', parentId: 2, sequence: 1 },
    { id: 6, name: 'UAE Selection', parentId: 5, sequence: 1 },
    { id: 7, name: 'Pepper', parentId: 1, sequence: 2 },
    { id: 3, name: 'Fertilizers', parentId: null, sequence: 1 },
    { id: 4, name: 'Tools', parentId: null, sequence: 3 },
  ];
  const products = [
    { title: 'Tomato packet', categories: [categories[1]] },
    { title: 'Pepper packet', categories: [categories[4]] },
    { title: 'NPK', categories: [categories[5]] },
    { title: 'Drill', categories: [categories[6]] },
    { title: 'Shared', categories: [categories[1], categories[5]] },
    { title: 'Seed name without assignment', categories: [] },
    { title: 'Root assignment', categories: [categories[0]] },
    { title: 'Deep product', categories: [categories[3]] },
  ];
  const names = (id) => products.filter((product) => productMatchesCategory(product, id)).map((product) => product.title);
  assert.deepEqual(names(1), ['Root assignment']);
  assert.deepEqual(names(2), ['Tomato packet', 'Shared']);
  assert.deepEqual(names(7), ['Pepper packet']);
  assert.deepEqual(names(3), ['NPK', 'Shared']);
  assert.deepEqual(names(4), ['Drill']);
  assert.equal(names(2).includes('Pepper packet'), false);
  assert.equal(names(2).includes('NPK'), false);
  assert.equal(names(3).includes('Tomato packet'), false);
  assert.equal(names(1).includes('Seed name without assignment'), false);
  assert.equal(productMatchesCategory(products[4], 2), true);
  assert.equal(productMatchesCategory(products[4], 3), true);
  assert.equal(productMatchesCategory(products[4], 4), false);
  assert.equal(productMatchesCategory(products[5], 'all'), true);

  assert.deepEqual(rootStoreCategories([...categories].reverse()).map((category) => category.id), [3, 1, 4]);
  assert.deepEqual(directChildCategories(categories, 1).map((category) => category.id), [2, 7]);
  assert.deepEqual(directChildCategories(categories, 2).map((category) => category.id), [5]);
  assert.deepEqual(categoryLineage(6, categories).map((category) => category.id), [1, 2, 5, 6]);
  assert.equal(categoryDisplayName(categories[3], categories), 'Seeds / Tomato / Cherry Tomato / UAE Selection');
  assert.deepEqual(orderedStoreCategories([...categories].reverse()).map((category) => category.id), [3, 1, 2, 5, 6, 7, 4]);

  const renamed = { ...categories[1], name: 'Tomato Collection' };
  assert.equal(productMatchesCategory({ title: 'Tomato packet', categories: [renamed] }, 2), true);
  const moved = categories.map((category) => category.id === 2 ? { ...category, parentId: 3 } : category);
  assert.deepEqual(directChildCategories(moved, 1).map((category) => category.id), [7]);
  assert.deepEqual(directChildCategories(moved, 3).map((category) => category.id), [2]);

  const deep = Array.from({ length: 16 }, (_, index) => ({
    id: 100 + index,
    name: `Level ${index + 1}`,
    parentId: index ? 99 + index : null,
    sequence: index,
  }));
  assert.equal(categoryLineage(115, deep).length, 16);
  assert.equal(categoryDisplayName(deep[15], deep).split(' / ').length, 16);

  const productionRoots = [
    { id: 50, name: 'Unrelated', parentId: null, sequence: 0 },
    { id: 9, name: 'Nutrition', name_ar: 'التغذية', parentId: null, sequence: 8 },
    { id: 11, name: 'Tools', parentId: null, sequence: 9 },
    { id: 1, name: 'Seeds', parentId: null, sequence: 10 },
    { id: 10, name: 'Irrigation', parentId: null, sequence: 11 },
  ];
  assert.deepEqual(storefrontDepartments(productionRoots).map((item) => item.id), [1, 9, 10, 11]);
  assert.equal(localizedCategoryName(productionRoots[1], 'ar'), 'الأسمدة وتغذية النباتات');
  assert.equal(localizedCategoryName(productionRoots[1], 'en'), 'Fertilizers & Plant Nutrition');

  const sections = categoryPageSections(products, categories, 1);
  assert.equal(sections[0].kind, 'direct');
  assert.deepEqual(sections.filter((section) => section.kind === 'child').map((section) => section.category.id), [2, 7]);
  assert.deepEqual(sections.find((section) => section.category.id === 2).products.map((item) => item.title), ['Tomato packet', 'Shared', 'Deep product']);
  assert.equal(sections.find((section) => section.category.id === 2).products.some((item) => item.title === 'Pepper packet'), false);

  const seedProducts = [{ brand: { id: 8, name: 'MIG FARM', sourceField: 'product_brand_id' } }, { brand: { id: 9, name: 'AGRIMAX', sourceField: 'product_brand_id' } }];
  assert.deepEqual(filterSeedsByTrustedBrand(seedProducts, null), { configured: false, products: [] });
  assert.deepEqual(filterSeedsByTrustedBrand(seedProducts, 8).products, [seedProducts[0]]);
});

test('Home and Store consume the dynamic hierarchy without text classification', async () => {
  const [home, catalog, helpers] = await Promise.all([
    readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/(tabs)/catalog.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/constants/categories.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(home, /storefrontHomeSections\(products, categories, 1\)/);
  assert.doesNotMatch(home, /orderedStoreCategories\(categories\)/);
  assert.match(catalog, /directChildCategories\(categories, selectedCategory\.id\)/);
  assert.match(catalog, /storefrontDepartments\(categories\)/);
  assert.match(catalog, /productsInCategoryTree\(storefrontProducts, categories, category\)/);
  assert.match(catalog, /CategorySections/);
  assert.doesNotMatch(helpers, /product\.(?:title|description)|categoryName\.includes/);
  assert.doesNotMatch(helpers, /rootStoreCategories\(categories\)[\s\S]*slice\(0,\s*4\)/);
});

test('RTL rails, category fallbacks, and tab-safe content remain production-safe', async () => {
  const [home, catalog, rail, card, product] = await Promise.all([
    readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/(tabs)/catalog.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ProductRail.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/CategoryCard.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/product/[handle].tsx', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(`${home}\n${rail}`, /inverted=\{isRTL\}/);
  assert.match(home, /flexDirection: isRTL \? 'row-reverse' : 'row'/);
  assert.match(rail, /paddingStart: spacing\.xs/);
  assert.match(rail, /paddingEnd: spacing\.xs/);
  assert.doesNotMatch(rail, /FlatList/);
  assert.match(home, /Math\.max\(104, insets\.bottom \+ 92\)/);
  assert.match(catalog, /Math\.max\(104, insets\.bottom \+ 92\)/);
  assert.match(card, /<CategoryIcon id=\{category\.id\}/);
  assert.doesNotMatch(card, />MIG FARM<\/Text>/);
  assert.doesNotMatch(product, /product\.vendor \|\| 'MIG FARM'/);
});
