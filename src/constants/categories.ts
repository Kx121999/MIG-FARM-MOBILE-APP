import type { Product, StoreCategory } from '@/types';

export type CategoryId = 'all' | number;

const categoryOrder = (left: StoreCategory, right: StoreCategory) => {
  const leftSequence = Number.isFinite(left.sequence) ? Number(left.sequence) : Number.MAX_SAFE_INTEGER;
  const rightSequence = Number.isFinite(right.sequence) ? Number(right.sequence) : Number.MAX_SAFE_INTEGER;
  return leftSequence - rightSequence || left.name.localeCompare(right.name) || left.id - right.id;
};

export function orderedStoreCategories(categories: StoreCategory[]) {
  const valid = categories.filter((category) =>
    Number.isSafeInteger(category.id) && category.id > 0 && category.name.trim());
  const byId = new Map(valid.map((category) => [category.id, category]));
  const children = new Map<number | null, StoreCategory[]>();
  for (const category of valid) {
    const parentId = category.parentId && byId.has(category.parentId)
      ? category.parentId
      : null;
    children.set(parentId, [...(children.get(parentId) || []), category]);
  }
  for (const items of children.values()) items.sort(categoryOrder);
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
  const byId = new Map(categories.map((item) => [item.id, item]));
  const names = [category.name];
  const visited = new Set([category.id]);
  let parentId = category.parentId;
  while (parentId && !visited.has(parentId) && names.length < 8) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join(' / ');
}

export function productMatchesCategory(product: Product, category: CategoryId) {
  if (category === 'all') return true;
  return (product.categories || []).some((assigned) => assigned.id === category);
}
