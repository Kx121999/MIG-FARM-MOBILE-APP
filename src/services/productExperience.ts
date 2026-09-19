import { categoryLineage, directChildCategories } from '@/constants/categories';
import type { Product, ProductVariant, StoreCategory } from '@/types';

export type VariantSelection = Record<number, number>;
export type ProductOptionGroup = {
  id: number;
  name: string;
  values: Array<{ id: number; label: string }>;
};

export function variantOptionGroups(variants: ProductVariant[]): ProductOptionGroup[] {
  const groups = new Map<number, { id: number; name: string; values: Map<number, string> }>();
  for (const variant of variants) {
    for (const option of variant.options || []) {
      const group = groups.get(option.attributeId) || {
        id: option.attributeId,
        name: option.attributeName,
        values: new Map<number, string>(),
      };
      if (!group.values.has(option.valueId)) group.values.set(option.valueId, option.value);
      groups.set(option.attributeId, group);
    }
  }
  return [...groups.values()].map((group) => ({
    id: group.id,
    name: group.name,
    values: [...group.values].map(([id, label]) => ({ id, label })),
  }));
}

export function variantSelection(variant: ProductVariant | null): VariantSelection {
  return Object.fromEntries((variant?.options || []).map((option) => [option.attributeId, option.valueId]));
}

export function resolveVariant(variants: ProductVariant[], selection: VariantSelection) {
  const selected = Object.entries(selection).map(([attributeId, valueId]) => [Number(attributeId), valueId] as const);
  if (!selected.length) return variants.length === 1 ? variants[0] : null;
  return variants.find((variant) => selected.every(([attributeId, valueId]) =>
    (variant.options || []).some((option) => option.attributeId === attributeId && option.valueId === valueId))) || null;
}

export function selectVariantOption(
  variants: ProductVariant[],
  current: ProductVariant,
  attributeId: number,
  valueId: number,
) {
  return resolveVariant(variants, { ...variantSelection(current), [attributeId]: valueId });
}

export function preferredProductCategory(
  product: Product,
  categories: StoreCategory[],
  preferredCategoryId?: number | null,
) {
  const assignedIds = new Set((product.categories || []).map((category) => category.id));
  const byId = new Map(categories.map((category) => [category.id, category]));
  if (preferredCategoryId && assignedIds.has(preferredCategoryId)) {
    return byId.get(preferredCategoryId) || product.categories.find((category) => category.id === preferredCategoryId) || null;
  }
  return (product.categories || [])
    .map((assigned) => byId.get(assigned.id) || assigned)
    .sort((left, right) =>
      categoryLineage(right.id, categories).length - categoryLineage(left.id, categories).length || left.id - right.id)[0] || null;
}

export function productCategoryPath(
  product: Product,
  categories: StoreCategory[],
  preferredCategoryId?: number | null,
) {
  const selected = preferredProductCategory(product, categories, preferredCategoryId);
  if (!selected) return [];
  const path = categoryLineage(selected.id, categories);
  return path.length ? path : [selected];
}

function categorySubtreeIds(categoryId: number, categories: StoreCategory[]) {
  const ids = new Set<number>();
  const pending = [categoryId];
  while (pending.length) {
    const current = pending.shift();
    if (!current || ids.has(current)) continue;
    ids.add(current);
    pending.push(...directChildCategories(categories, current).map((category) => category.id));
  }
  return ids;
}

export function relatedProducts(
  product: Product,
  products: Product[],
  categories: StoreCategory[],
  preferredCategoryId?: number | null,
  limit = 6,
) {
  const selected = preferredProductCategory(product, categories, preferredCategoryId);
  if (!selected || limit <= 0) return [];
  const result: Product[] = [];
  const added = new Set([product.id]);
  const candidates = [...products].sort((left, right) => left.id - right.id);
  const addMatching = (categoryIds: Set<number>) => {
    for (const candidate of candidates) {
      if (result.length >= limit) return;
      if (added.has(candidate.id)) continue;
      if (!(candidate.categories || []).some((category) => categoryIds.has(category.id))) continue;
      added.add(candidate.id);
      result.push(candidate);
    }
  };

  addMatching(new Set([selected.id]));
  const path = categoryLineage(selected.id, categories);
  for (let index = path.length - 2; index >= 0 && result.length < limit; index -= 1) {
    addMatching(categorySubtreeIds(path[index].id, categories));
  }
  return result;
}
