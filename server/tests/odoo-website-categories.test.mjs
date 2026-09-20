import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOdooCatalog } from '../services/odoo.mjs';

const ENV = {
  NODE_ENV: 'production',
  ODOO_BASE_URL: 'https://odoo-categories.example.test',
  ODOO_API_KEY: 'category-test-secret',
  ODOO_MIN_REQUEST_INTERVAL_MS: '0',
};

const fields = {
  'product.template': [
    'id', 'name', 'active', 'sale_ok', 'list_price', 'categ_id',
    'public_categ_ids', 'is_published', 'write_date',
  ],
  'product.product': [
    'id', 'name', 'active', 'sale_ok', 'product_tmpl_id', 'lst_price',
    'free_qty', 'write_date',
  ],
  'product.category': ['id', 'name', 'complete_name'],
  'product.public.category': ['id', 'name', 'parent_id', 'sequence', 'write_date'],
  'product.template.attribute.value': ['id', 'name'],
};

function websiteCategoryMock() {
  const categories = [
    { id: 1, name: 'Seeds', parent_id: false, sequence: 1, write_date: '2026-09-01 00:00:00' },
    { id: 2, name: 'Vegetable Seeds', parent_id: [1, 'Seeds'], sequence: 1, write_date: '2026-09-01 00:00:00' },
    { id: 5, name: 'Tomato', parent_id: [2, 'Vegetable Seeds'], sequence: 1, write_date: '2026-09-01 00:00:00' },
    { id: 6, name: 'Cherry Tomato', parent_id: [5, 'Tomato'], sequence: 1, write_date: '2026-09-01 00:00:00' },
    { id: 3, name: 'Fertilizers', parent_id: false, sequence: 2, write_date: '2026-09-01 00:00:00' },
    { id: 4, name: 'Tools', parent_id: false, sequence: 3, write_date: '2026-09-01 00:00:00' },
  ];
  const assignments = [
    ['Tomato', [1]],
    ['Cucumber', [1]],
    ['NPK', [3]],
    ['Drill', [4]],
    ['Shared product', [1, 3]],
    ['Lettuce', [2]],
    ['Cherry Tomato packet', [6]],
    ['Seed words but unassigned', []],
  ];
  const templates = assignments.map(([name, categoryIds], index) => ({
    id: index + 1,
    name,
    active: true,
    sale_ok: true,
    list_price: 10 + index,
    categ_id: [90, 'Internal accounting'],
    public_categ_ids: categoryIds,
    is_published: true,
    write_date: '2026-09-01 00:00:00',
  }));
  const variants = templates.map((template) => ({
    id: 100 + template.id,
    name: template.name,
    active: true,
    sale_ok: true,
    product_tmpl_id: [template.id, template.name],
    lst_price: template.list_price,
    free_qty: 5,
    write_date: '2026-09-01 00:00:00',
  }));
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const match = /\/json\/2\/([^/]+)\/([^/?]+)/.exec(String(url));
    const model = decodeURIComponent(match?.[1] || '');
    const method = decodeURIComponent(match?.[2] || '');
    const body = JSON.parse(options.body || '{}');
    calls.push({ model, method, body });
    if (method === 'fields_get')
      return Response.json(Object.fromEntries((fields[model] || []).map((field) => [field, { type: 'mock' }])));
    let records = {
      'product.template': templates,
      'product.product': variants,
      'product.category': [{ id: 90, name: 'Internal accounting', complete_name: 'Internal accounting' }],
      'product.public.category': categories,
      'product.template.attribute.value': [],
    }[model] || [];
    const ids = body.domain?.find((term) => Array.isArray(term) && term[0] === 'id' && term[1] === 'in')?.[2];
    if (ids) records = records.filter((record) => ids.includes(record.id));
    const templateIds = body.domain?.find((term) => Array.isArray(term) && term[0] === 'product_tmpl_id' && term[1] === 'in')?.[2];
    if (templateIds) records = records.filter((record) => templateIds.includes(record.product_tmpl_id[0]));
    records = records.slice(body.offset || 0, (body.offset || 0) + (body.limit || 200));
    if (body.context?.lang === 'ar_001')
      records = records.map((record) => ({ ...record, name: record.name ? `AR ${record.name}` : record.name }));
    return Response.json(records);
  };
  return { categories, templates, calls, fetchImpl };
}

const productNames = (catalog, categoryId) => catalog.products
  .filter((product) => product.categories.some((category) => category.id === categoryId))
  .map((product) => product.title)
  .sort();

test('Odoo website categories remain isolated, hierarchical and live', async () => {
  const mock = websiteCategoryMock();
  const service = createOdooCatalog({ env: ENV, fetchImpl: mock.fetchImpl, logger: null });
  const first = await service.list();

  assert.deepEqual(productNames(first, 1), ['Cucumber', 'Shared product', 'Tomato']);
  assert.deepEqual(productNames(first, 3), ['NPK', 'Shared product']);
  assert.deepEqual(productNames(first, 4), ['Drill']);
  assert.deepEqual(productNames(first, 2), ['Lettuce']);
  assert.deepEqual(productNames(first, 6), ['Cherry Tomato packet']);
  assert.equal(productNames(first, 1).includes('Lettuce'), false);
  assert.equal(productNames(first, 2).includes('Cherry Tomato packet'), false);
  assert.deepEqual(
    first.products.find((product) => product.title === 'Shared product').categories.map((category) => category.id),
    [1, 3],
  );
  assert.deepEqual(
    first.products.find((product) => product.title === 'Seed words but unassigned').categories,
    [],
  );
  assert.equal(first.products.find((product) => product.title === 'Seed words but unassigned').category, null);
  assert.equal(first.categories.find((category) => category.id === 2).parentId, 1);
  assert.equal(first.categories.find((category) => category.id === 5).parentId, 2);
  assert.equal(first.categories.find((category) => category.id === 6).parentId, 5);
  assert.equal(first.categories.find((category) => category.id === 1).name_ar, 'AR Seeds');
  assert.equal(first.categories.find((category) => category.id === 1).name_en, 'Seeds');
  assert.deepEqual(
    first.products.find((product) => product.title === 'Cherry Tomato packet').category_paths[0].lineage.map((item) => item.id),
    [1, 2, 5, 6],
  );

  mock.categories[0].name = 'Seed Collection';
  mock.categories[0].write_date = '2026-09-02 00:00:00';
  mock.categories.find((category) => category.id === 2).parent_id = [3, 'Fertilizers'];
  mock.categories.find((category) => category.id === 2).write_date = '2026-09-02 00:00:00';
  mock.templates.find((product) => product.name === 'NPK').public_categ_ids = [4];
  const refreshed = await service.list({ force: true, allowStale: false });
  assert.equal(refreshed.categories.find((category) => category.id === 1).name, 'Seed Collection');
  assert.equal(refreshed.categories.find((category) => category.id === 2).parentId, 3);
  assert.deepEqual(
    refreshed.products.find((product) => product.title === 'Tomato').categories.map((category) => category.id),
    [1],
  );
  assert.equal(productNames(refreshed, 3).includes('NPK'), false);
  assert.equal(productNames(refreshed, 4).includes('NPK'), true);

  const categoryReads = mock.calls.filter((call) =>
    call.model === 'product.public.category' && call.method === 'search_read');
  assert.equal(categoryReads.length, 6);
  assert.equal(categoryReads.filter((call) => !call.body.context).length, 2);
  assert.ok(mock.calls.every((call) => ['fields_get', 'search_read'].includes(call.method)));
});
