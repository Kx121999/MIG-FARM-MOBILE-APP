import type { Product, StoreCategory } from '@/types';

export type CategoryId = 'all' | number;

const categoryOrder = (left: StoreCategory, right: StoreCategory) => {
  const leftSequence = Number.isFinite(left.sequence) ? Number(left.sequence) : Number.MAX_SAFE_INTEGER;
  const rightSequence = Number.isFinite(right.sequence) ? Number(right.sequence) : Number.MAX_SAFE_INTEGER;
  return leftSequence - rightSequence || left.name.localeCompare(right.name) || left.id - right.id;
};

const validStoreCategories = (categories: StoreCategory[]) => categories.filter((category) =>
  Number.isSafeInteger(category.id) && category.id > 0 && category.name.trim());

const categoryChildren = (categories: StoreCategory[]) => {
  const children = new Map<number | null, StoreCategory[]>();
  for (const category of validStoreCategories(categories)) {
    const parentId = category.parentId === null ? null : category.parentId;
    children.set(parentId, [...(children.get(parentId) || []), category]);
  }
  for (const items of children.values()) items.sort(categoryOrder);
  return children;
};

export function rootStoreCategories(categories: StoreCategory[]) {
  return categoryChildren(categories).get(null) || [];
}

export function directChildCategories(categories: StoreCategory[], parentId: number) {
  return categoryChildren(categories).get(parentId) || [];
}

export function categoryLineage(categoryId: number, categories: StoreCategory[]) {
  const byId = new Map(validStoreCategories(categories).map((category) => [category.id, category]));
  const lineage: StoreCategory[] = [];
  const visited = new Set<number>();
  let current = byId.get(categoryId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    lineage.unshift(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return lineage;
}

export function orderedStoreCategories(categories: StoreCategory[]) {
  const valid = validStoreCategories(categories);
  const children = categoryChildren(valid);
  const output: StoreCategory[] = [];
  const visited = new Set<number>();
  const visit = (category: StoreCategory) => {
    if (visited.has(category.id)) return;
    visited.add(category.id);
    output.push(category);
    for (const child of children.get(category.id) || []) visit(child);
  };
  for (const root of children.get(null) || []) visit(root);
  for (const category of [...valid].sort(categoryOrder)) visit(category);
  return output;
}

export function categoryDisplayName(category: StoreCategory, categories: StoreCategory[]) {
  const lineage = categoryLineage(category.id, categories);
  return (lineage.length ? lineage : [category]).map((item) => item.name).join(' / ');
}

export function productMatchesCategory(product: Product, category: CategoryId) {
  if (category === 'all') return true;
  return (product.categories || []).some((assigned) => assigned.id === category);
}
