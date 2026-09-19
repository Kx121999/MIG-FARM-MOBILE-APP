import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

async function loadProductExperience() {
  const categorySource = await readFile(new URL('../src/constants/categories.ts', import.meta.url), 'utf8');
  const categoryUrl = dataModule(transpile(categorySource));
  const productSource = await readFile(new URL('../src/services/productExperience.ts', import.meta.url), 'utf8');
  const output = transpile(productSource).replaceAll("'@/constants/categories'", `'${categoryUrl}'`);
  return import(dataModule(output));
}

const option = (templateValueId, attributeId, attributeName, valueId, value) => ({
  templateValueId, attributeId, attributeName, valueId, value,
});

test('real Odoo option IDs resolve single and multi-attribute variants', async () => {
  const { resolveVariant, selectVariantOption, variantOptionGroups, variantSelection } = await loadProductExperience();
  const variants = [
    { id: 11, title: 'A', price: '10.00', sku: 'SKU-11', options: [option(1001, 10, 'Weight', 101, '250 g'), option(2001, 20, 'Container', 201, 'Single')] },
    { id: 12, title: 'B', price: '18.00', sku: 'SKU-12', options: [option(1002, 10, 'Weight', 102, '500 g'), option(2001, 20, 'Container', 201, 'Single')] },
    { id: 13, title: 'C', price: '48.00', sku: 'SKU-13', options: [option(1001, 10, 'Weight', 101, '250 g'), option(2002, 20, 'Container', 202, 'Box')] },
    { id: 14, title: 'D', price: '88.00', sku: 'SKU-14', options: [option(1002, 10, 'Weight', 102, '500 g'), option(2002, 20, 'Container', 202, 'Box')] },
  ];
  assert.deepEqual(variantOptionGroups(variants), [
    { id: 10, name: 'Weight', values: [{ id: 101, label: '250 g' }, { id: 102, label: '500 g' }] },
    { id: 20, name: 'Container', values: [{ id: 201, label: 'Single' }, { id: 202, label: 'Box' }] },
  ]);
  assert.deepEqual(variantSelection(variants[0]), { 10: 101, 20: 201 });
  assert.equal(resolveVariant(variants, { 10: 102, 20: 202 }).id, 14);
  const selected = selectVariantOption(variants, variants[1], 20, 202);
  assert.equal(selected.id, 14);
  assert.equal(selected.price, '88.00');
  assert.equal(selected.sku, 'SKU-14');
  assert.equal(resolveVariant([{ id: 99, title: 'Only', price: '9.00' }], {}).id, 99);
});

test('breadcrumbs and related products use only the live category ID tree', async () => {
  const { productCategoryPath, preferredProductCategory, relatedProducts } = await loadProductExperience();
  const categories = [
    { id: 1, name: 'Root A', parentId: null, sequence: 1 },
    { id: 2, name: 'Child A', parentId: 1, sequence: 1 },
    { id: 3, name: 'Sibling A', parentId: 1, sequence: 2 },
    { id: 4, name: 'Root B', parentId: null, sequence: 2 },
    { id: 5, name: 'Deep A', parentId: 2, sequence: 1 },
  ];
  const product = { id: 100, title: 'Unrelated display words', categories: [categories[4], categories[3]] };
  assert.deepEqual(productCategoryPath(product, categories).map((item) => item.id), [1, 2, 5]);
  assert.deepEqual(productCategoryPath(product, categories, 4).map((item) => item.id), [4]);
  assert.equal(preferredProductCategory(product, categories, 999).id, 5);

  const exact = { id: 101, title: 'Exact', categories: [categories[4]] };
  const exactTwo = { id: 102, title: 'Exact two', categories: [categories[4], categories[3]] };
  const sibling = { id: 103, title: 'Sibling', categories: [categories[2]] };
  const otherRoot = { id: 104, title: 'Deep A words', categories: [categories[3]] };
  assert.deepEqual(relatedProducts(product, [otherRoot, sibling, exactTwo, product, exact], categories, 5, 2).map((item) => item.id), [101, 102]);
  assert.deepEqual(relatedProducts(product, [otherRoot, sibling, exactTwo, product, exact], categories, 5, 3).map((item) => item.id), [101, 102, 103]);
  assert.equal(relatedProducts(product, [product, exact], categories, 5, 6).some((item) => item.id === product.id), false);

  const renamed = categories.map((category) => category.id === 5 ? { ...category, name: 'Renamed' } : category);
  assert.deepEqual(productCategoryPath(product, renamed).map((item) => item.id), [1, 2, 5]);
});

test('product browsing remains order, payment, stock-write and hardcoding safe', async () => {
  const [screen, experience, commerce, cart, env, odoo] = await Promise.all([
    readFile(new URL('../app/product/[handle].tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/productExperience.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/contexts/CommerceContext.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/cart.ts', import.meta.url), 'utf8'),
    readFile(new URL('../.env.example', import.meta.url), 'utf8'),
    readFile(new URL('../server/services/odoo.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(screen, /variantOptionGroups\(product\.variants\)/);
  assert.match(screen, /No description is currently available/);
  assert.match(screen, /Image unavailable/);
  assert.doesNotMatch(`${screen}\n${experience}`, /Pepper Seeds|250g|500g|product\.title\.includes|product\.description\.includes/);
  assert.doesNotMatch(screen, /\/api\/orders\/prepare|confirmPayment|PaymentIntent|action_confirm/);
  assert.match(cart, /return `\$\{productId\}:\$\{variantId\}`/);
  assert.match(commerce, /mergeCartLine\(current, product, variant/);
  assert.match(commerce, /variant,/);
  assert.match(env, /^EXPO_PUBLIC_ORDER_PREPARE_ENABLED=false$/m);
  assert.doesNotMatch(odoo, /stock\.quant|qty_available\s*=|free_qty\s*=/);
  const prepareQuotation = odoo.slice(
    odoo.indexOf('async function prepareQuotation'),
    odoo.indexOf('async function confirmQuotation'),
  );
  assert.doesNotMatch(prepareQuotation, /action_confirm/);
  assert.match(odoo, /async function confirmQuotation[\s\S]*action_confirm/);
});
