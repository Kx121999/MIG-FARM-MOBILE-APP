import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryId, productMatchesCategory } from '@/constants/categories';
import { Product, ProductImage, ProductVariant, ProductVariantOption, StoreCategory } from '@/types';

const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export const API_ORIGIN = (env.EXPO_PUBLIC_API_URL || 'https://mig-farm-api.onrender.com').replace(/\/+$/, '');
export const APP_ORIGIN = (env.EXPO_PUBLIC_APP_URL || API_ORIGIN).replace(/\/+$/, '');

const PRODUCTS_CACHE_KEY = 'mig_farm_catalog_cache_v3';
const CACHE_TTL_MS = 60 * 1000;

type CatalogSnapshot = { products: Product[]; categories: StoreCategory[] };
type CachedCatalog = CatalogSnapshot & { updatedAt: number };
type RawProduct = Omit<Product, 'tags' | 'images' | 'variants' | 'categories'> & {
  tags?: string[] | string | null;
  images?: ProductImage[] | null;
  variants?: ProductVariant[] | null;
  categories?: StoreCategory[] | null;
};

function parseTags(tags: RawProduct['tags']) {
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function mediaUrl(value?: string | null) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  return `${API_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`;
}

function normalizeImage(image: ProductImage): ProductImage {
  return { ...image, src: mediaUrl(image.src) };
}

function normalizeCategory(value: StoreCategory): StoreCategory | null {
  const id = Number(value?.id);
  const name = typeof value?.name === 'string' ? value.name.trim() : '';
  if (!Number.isSafeInteger(id) || id <= 0 || !name) return null;
  const parent = Number(value.parentId);
  const sequence = Number(value.sequence);
  return {
    id,
    name,
    name_ar: typeof value.name_ar === 'string' ? value.name_ar.trim() || null : null,
    name_en: typeof value.name_en === 'string' ? value.name_en.trim() || null : null,
    parentId: Number.isSafeInteger(parent) && parent > 0 ? parent : null,
    ...(Number.isFinite(sequence) ? { sequence } : {}),
    ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}),
    image: mediaUrl(value.image),
  };
}

function normalizeVariantOption(value: ProductVariantOption): ProductVariantOption | null {
  const templateValueId = Number(value?.templateValueId);
  const attributeId = Number(value?.attributeId);
  const valueId = Number(value?.valueId);
  const attributeName = typeof value?.attributeName === 'string' ? value.attributeName.trim() : '';
  const optionValue = typeof value?.value === 'string' ? value.value.trim() : '';
  if (![templateValueId, attributeId, valueId].every((id) => Number.isSafeInteger(id) && id > 0)) return null;
  if (!attributeName || !optionValue) return null;
  return { templateValueId, attributeId, attributeName, valueId, value: optionValue };
}

function normalizeProduct(product: RawProduct): Product {
  return {
    id: product.id,
    title: product.title || '',
    title_ar: product.title_ar || null,
    title_en: product.title_en || null,
    handle: product.handle || '',
    body_html: product.body_html || '',
    body_html_ar: product.body_html_ar || null,
    body_html_en: product.body_html_en || null,
    vendor: product.vendor || '',
    brand: product.brand || null,
    product_type: product.product_type || '',
    product_type_ar: product.product_type_ar || null,
    product_type_en: product.product_type_en || null,
    tags: parseTags(product.tags),
    images: Array.isArray(product.images) ? product.images.map(normalizeImage) : [],
    variants: Array.isArray(product.variants) ? product.variants.map((variant) => ({
      ...variant,
      options: Array.isArray(variant.options)
        ? variant.options.map(normalizeVariantOption).filter((item): item is ProductVariantOption => Boolean(item))
        : [],
      featured_image: variant.featured_image ? normalizeImage(variant.featured_image) : null,
    })) : [],
    categories: Array.isArray(product.categories)
      ? product.categories.map(normalizeCategory).filter((item): item is StoreCategory => Boolean(item))
      : [],
    category_paths: Array.isArray(product.category_paths) ? product.category_paths : [],
    available: product.available,
    stock_state: product.stock_state,
    odoo_template_id: product.odoo_template_id,
    catalog_source: product.catalog_source,
    category: product.category ? normalizeCategory(product.category) : null,
    internal_category: product.internal_category,
    published_at: product.published_at,
    updated_at: product.updated_at,
  };
}

async function requestJson<T>(path: string, signal?: AbortSignal, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, timeoutMs);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`catalog_request_failed_${response.status}`);
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

async function readCatalogCache(allowExpired = false): Promise<CatalogSnapshot | null> {
  try {
    const cached = await AsyncStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as Partial<CachedCatalog>;
    if (!Array.isArray(parsed.products)) return null;
    if (!Array.isArray(parsed.categories)) return null;
    if (!allowExpired && Date.now() - Number(parsed.updatedAt) > CACHE_TTL_MS) return null;
    return {
      products: (parsed.products as RawProduct[]).map(normalizeProduct),
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.map(normalizeCategory).filter((item): item is StoreCategory => Boolean(item))
        : [],
    };
  } catch {
    return null;
  }
}

async function writeCatalogCache(catalog: CatalogSnapshot) {
  try {
    await AsyncStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), ...catalog }));
  } catch {
    // Catalog remains usable even if local persistence is unavailable.
  }
}

export async function fetchCatalog(force = false, signal?: AbortSignal): Promise<CatalogSnapshot> {
  if (!force) {
    const cached = await readCatalogCache();
    if (cached) return cached;
  }
  try {
    const data = await requestJson<{ products?: RawProduct[]; categories?: StoreCategory[] }>(
      force ? '/api/products?refresh=1' : '/api/products',
      signal,
    );
    const products = (data.products || []).map(normalizeProduct).filter((product) => product.handle);
    const categories = (data.categories || [])
      .map(normalizeCategory)
      .filter((item): item is StoreCategory => Boolean(item));
    const catalog = { products, categories };
    await writeCatalogCache(catalog);
    return catalog;
  } catch (error) {
    const stale = await readCatalogCache(true);
    if (stale) return stale;
    throw error;
  }
}

export async function fetchAllProducts(force = false, signal?: AbortSignal) {
  return (await fetchCatalog(force, signal)).products;
}

export async function fetchProduct(handle: string, signal?: AbortSignal) {
  const safeHandle = encodeURIComponent(handle);
  try {
    const data = await requestJson<{ product?: RawProduct }>(`/api/products/${safeHandle}`, signal, 7000);
    if (data.product) return normalizeProduct(data.product);
  } catch {
    // The cached catalog below keeps product pages available during a brief API outage.
  }
  const products = await fetchAllProducts(false, signal);
  const product = products.find((item) => item.handle === handle);
  if (!product) throw new Error('product_not_found');
  return product;
}

export function productImage(product: Product) {
  return product.images?.[0]?.src || product.variants?.find((variant) => variant.featured_image?.src)?.featured_image?.src || null;
}

export function productPrice(product: Product) {
  const variant = product.variants.find((item) => item.available === true) || product.variants[0];
  return variant?.price || '0';
}

export function productPriceNumber(product: Product) {
  return Number(productPrice(product)) || 0;
}

export function productAvailable(product: Product) {
  return productStockState(product) === 'in_stock';
}

export function productStockState(product: Product) {
  if (
    product.stock_state === 'in_stock' ||
    product.variants.some((variant) => variant.available === true || variant.stock_state === 'in_stock')
  ) return 'in_stock' as const;
  if (
    product.stock_state === 'out_of_stock' ||
    (product.variants.length > 0 &&
      product.variants.every((variant) => variant.available === false || variant.stock_state === 'out_of_stock'))
  ) return 'out_of_stock' as const;
  return 'unknown' as const;
}

type LocalizedTitle = Pick<Product, 'title' | 'title_ar' | 'title_en'>;

export function localizedProductTitle(product: LocalizedTitle, language: 'ar' | 'en') {
  return (language === 'ar' ? product.title_ar : product.title_en)?.trim() || product.title;
}

export function localizedProductType(product: Product, language: 'ar' | 'en') {
  return (language === 'ar' ? product.product_type_ar : product.product_type_en)?.trim() || product.product_type;
}

export function localizedProductDescription(product: Product, language: 'ar' | 'en') {
  return (language === 'ar' ? product.body_html_ar : product.body_html_en)?.trim() || product.body_html;
}

export function textDirection(text: string, fallbackLanguage: 'ar' | 'en'): 'rtl' | 'ltr' {
  if (/[\u0600-\u06FF]/.test(text)) return 'rtl';
  if (/[A-Za-z]/.test(text)) return 'ltr';
  return fallbackLanguage === 'ar' ? 'rtl' : 'ltr';
}

export function formatAED(value?: string | number | null) {
  if (value == null || String(value).trim() === '') return 'AED --';
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'AED --';
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export type DescriptionBlock = { kind: 'heading' | 'paragraph' | 'item'; text: string };

export function productDescriptionBlocks(html: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  const pattern = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    const text = stripHtml(match[2]);
    if (!text) continue;
    const tag = match[1].toLowerCase();
    blocks.push({ kind: tag.startsWith('h') ? 'heading' : tag === 'li' ? 'item' : 'paragraph', text });
  }

  if (!blocks.length) {
    const text = stripHtml(html);
    if (text) blocks.push({ kind: 'paragraph', text });
  }
  return blocks;
}

export function filterProducts(products: Product[], query: string, category: CategoryId) {
  const normalizedQuery = query.trim().toLowerCase();
  return products.filter((product) => {
    if (!productMatchesCategory(product, category)) return false;
    if (!normalizedQuery) return true;
    return [product.title, product.title_ar, product.title_en, product.vendor, product.product_type, product.product_type_ar, product.product_type_en, product.tags.join(' '), stripHtml(product.body_html), stripHtml(product.body_html_ar || ''), stripHtml(product.body_html_en || '')]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export type ProductSort = 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'available';

export function sortProducts(products: Product[], sort: ProductSort) {
  if (sort === 'price_asc') return [...products].sort((a, b) => productPriceNumber(a) - productPriceNumber(b));
  if (sort === 'price_desc') return [...products].sort((a, b) => productPriceNumber(b) - productPriceNumber(a));
  if (sort === 'available') return [...products].sort((a, b) => Number(productAvailable(b)) - Number(productAvailable(a)));
  if (sort === 'newest') return [...products].sort((a, b) => Date.parse(b.published_at || b.updated_at || '') - Date.parse(a.published_at || a.updated_at || ''));
  return products;
}
