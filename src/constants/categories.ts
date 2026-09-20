import type { Product, StoreCategory } from '@/types';

export type CategoryId = 'all' | number;

// These are the four verified production product.public.category department IDs.
// Names remain server-driven and may be renamed without changing storefront identity.
export const STOREFRONT_DEPARTMENT_IDS = [1, 9, 10, 11] as const;

const STOREFRONT_DEPARTMENT_COPY: Record<number, {
  ar: string;
  en: string;
  descriptionAr: string;
  descriptionEn: string;
}> = {
  1: {
    ar: 'البذور',
    en: 'Seeds',
    descriptionAr: 'بذور مختارة لمواسم ومحاصيل متنوعة',
    descriptionEn: 'Seed collections for diverse crops and seasons',
  },
  9: {
    ar: 'الأسمدة وتغذية النباتات',
    en: 'Fertilizers & Plant Nutrition',
    descriptionAr: 'حلول تغذية وعناية للنبات والتربة',
    descriptionEn: 'Plant nutrition and soil care solutions',
  },
  10: {
    ar: 'الري والزراعة المائية',
    en: 'Irrigation & Hydroponics',
    descriptionAr: 'مستلزمات ري وإدارة مياه أكثر كفاءة',
    descriptionEn: 'Efficient irrigation and water management',
  },
  11: {
    ar: 'الأدوات والمعدات',
    en: 'Tools & Equipment',
    descriptionAr: 'أدوات عملية للعمل اليومي في المزرعة',
    descriptionEn: 'Practical tools for everyday farm work',
  },
};

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

export function storefrontDepartments(categories: StoreCategory[]) {
  const byId = new Map(validStoreCategories(categories).map((category) => [category.id, category]));
  return STOREFRONT_DEPARTMENT_IDS
    .map((id) => byId.get(id))
    .filter((category): category is StoreCategory => Boolean(category));
}

export function missingStorefrontDepartmentIds(categories: StoreCategory[]) {
  const ids = new Set(validStoreCategories(categories).map((category) => category.id));
  return STOREFRONT_DEPARTMENT_IDS.filter((id) => !ids.has(id));
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

export function localizedCategoryName(category: StoreCategory, language: 'ar' | 'en') {
  const department = STOREFRONT_DEPARTMENT_COPY[category.id];
  if (department) return department[language];
  return (language === 'ar' ? category.name_ar : category.name_en)?.trim() || category.name;
}

export function storefrontDepartmentDescription(categoryId: number, language: 'ar' | 'en') {
  const department = STOREFRONT_DEPARTMENT_COPY[categoryId];
  if (!department) return '';
  return language === 'ar' ? department.descriptionAr : department.descriptionEn;
}

export function categoryDisplayName(category: StoreCategory, categories: StoreCategory[], language: 'ar' | 'en' = 'en') {
  const lineage = categoryLineage(category.id, categories);
  return (lineage.length ? lineage : [category]).map((item) => localizedCategoryName(item, language)).join(' / ');
}

export function productMatchesCategory(product: Product, category: CategoryId) {
  if (category === 'all') return true;
  return (product.categories || []).some((assigned) => assigned.id === category);
}

export function categorySubtreeIds(categoryId: number, categories: StoreCategory[]) {
  const children = categoryChildren(categories);
  const ids = new Set<number>();
  const pending = [categoryId];
  while (pending.length) {
    const current = pending.shift();
    if (!current || ids.has(current)) continue;
    ids.add(current);
    pending.push(...(children.get(current) || []).map((category) => category.id));
  }
  return ids;
}

export function productsInCategoryTree(
  products: Product[],
  categories: StoreCategory[],
  categoryId: number,
) {
  const ids = categorySubtreeIds(categoryId, categories);
  return products.filter((product) =>
    (product.categories || []).some((assigned) => ids.has(assigned.id)));
}

export type StorefrontSection = {
  category: StoreCategory;
  products: Product[];
  productCount: number;
  kind?: 'department' | 'direct' | 'child';
};

export function storefrontHomeSections(
  products: Product[],
  categories: StoreCategory[],
  previewLimit = 10,
) {
  const safePreviewLimit = Math.max(1, Math.min(10, Math.floor(previewLimit)));
  return storefrontDepartments(categories)
    .map((category): StorefrontSection => {
      const matching = productsInCategoryTree(products, categories, category.id);
      return {
      category,
      products: matching.slice(0, safePreviewLimit),
      productCount: matching.length,
      kind: 'department',
    }; });
}

export function categoryPageSections(
  products: Product[],
  categories: StoreCategory[],
  categoryId: number,
  previewLimit = 10,
) {
  const selected = categories.find((category) => category.id === categoryId);
  if (!selected) return [];
  const safeLimit = Math.max(1, Math.min(10, Math.floor(previewLimit)));
  const direct = products.filter((product) => productMatchesCategory(product, categoryId));
  const sections: StorefrontSection[] = [];
  if (direct.length) {
    sections.push({ category: selected, products: direct.slice(0, safeLimit), productCount: direct.length, kind: 'direct' });
  }
  for (const child of directChildCategories(categories, categoryId)) {
    const matching = productsInCategoryTree(products, categories, child.id);
    sections.push({ category: child, products: matching.slice(0, safeLimit), productCount: matching.length, kind: 'child' });
  }
  return sections;
}

export function categoryAssignmentPaths(product: Product, categories: StoreCategory[]) {
  return (product.categories || []).map((assigned) => ({
    categoryId: assigned.id,
    lineage: categoryLineage(assigned.id, categories).map(({ id, name }) => ({ id, name })),
  }));
}

export function filterSeedsByTrustedBrand(products: Product[], brandId?: number | null) {
  if (!Number.isSafeInteger(brandId) || Number(brandId) <= 0) {
    return { configured: false as const, products: [] as Product[] };
  }
  return {
    configured: true as const,
    products: products.filter((product) => product.brand?.id === brandId),
  };
}
