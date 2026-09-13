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
    orderedStoreCategories,
    productMatchesCategory,
  } = await loadTypeScriptModule('../src/constants/categories.ts');
  const categories = [
    { id: 1, name: 'Seeds', parentId: null, sequence: 1 },
    { id: 2, name: 'Vegetable Seeds', parentId: 1, sequence: 1 },
    { id: 3, name: 'Fertilizers', parentId: null, sequence: 2 },
    { id: 4, name: 'Tools', parentId: null, sequence: 3 },
  ];
  const products = [
    { title: 'Tomato', categories: [categories[0]] },
    { title: 'Cucumber', categories: [categories[0]] },
    { title: 'NPK', categories: [categories[2]] },
    { title: 'Drill', categories: [categories[3]] },
    { title: 'Shared', categories: [categories[0], categories[2]] },
    { title: 'Seed name without assignment', categories: [] },
  ];
  const names = (id) => products.filter((product) => productMatchesCategory(product, id)).map((product) => product.title);
  assert.deepEqual(names(1), ['Tomato', 'Cucumber', 'Shared']);
  assert.deepEqual(names(3), ['NPK', 'Shared']);
  assert.deepEqual(names(4), ['Drill']);
  assert.equal(names(1).includes('NPK'), false);
  assert.equal(names(3).includes('Tomato'), false);
  assert.equal(names(1).includes('Seed name without assignment'), false);
  assert.equal(productMatchesCategory(products[4], 1), true);
  assert.equal(productMatchesCategory(products[4], 3), true);
  assert.equal(productMatchesCategory(products[4], 4), false);
  assert.equal(productMatchesCategory(products[5], 'all'), true);

  const renamed = { ...categories[0], name: 'Seed Collection' };
  const renamedProduct = { title: 'Tomato', categories: [renamed] };
  assert.equal(productMatchesCategory(renamedProduct, 1), true);
  assert.equal(categoryDisplayName(categories[1], categories), 'Seeds / Vegetable Seeds');
  assert.deepEqual(orderedStoreCategories([...categories].reverse()).map((category) => category.id), [1, 2, 3, 4]);
});
