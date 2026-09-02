import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryId, productMatchesCategory } from '@/constants/categories';
import { Product, ProductImage, ProductVariant } from '@/types';

const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export const API_ORIGIN = (env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
export const APP_ORIGIN = (env.EXPO_PUBLIC_APP_URL || 'http://127.0.0.1:8081').replace(/\/+$/, '');

const PRODUCTS_CACHE_KEY = 'mig_farm_catalog_cache_v2';
const CACHE_TTL_MS = 10 * 60 * 1000;

type CachedProducts = { updatedAt: number; products: Product[] };
type RawProduct = Omit<Product, 'tags' | 'images' | 'variants'> & {
  tags?: string[] | string | null;
  images?: ProductImage[] | null;
  variants?: ProductVariant[] | null;
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
    vendor: product.vendor || 'MIG FARM',
    product_type: product.product_type || '',
    product_type_ar: product.product_type_ar || null,
    product_type_en: product.product_type_en || null,
    tags: parseTags(product.tags),
    images: Array.isArray(product.images) ? product.images.map(normalizeImage) : [],
    variants: Array.isArray(product.variants) ? product.variants.map((variant) => ({
      ...variant,
      featured_image: variant.featured_image ? normalizeImage(variant.featured_image) : null,
    })) : [],
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

async function readProductCache(allowExpired = false) {
  try {
    const cached = await AsyncStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as CachedProducts;
    if (!Array.isArray(parsed.products)) return null;
    if (!allowExpired && Date.now() - parsed.updatedAt > CACHE_TTL_MS) return null;
    return parsed.products;
  } catch {
    return null;
  }
}

async function writeProductCache(products: Product[]) {
  try {
    await AsyncStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), products }));
  } catch {
    // Catalog remains usable even if local persistence is unavailable.
  }
}

export async function fetchAllProducts(force = false, signal?: AbortSignal) {
  if (!force) {
    const cached = await readProductCache();
    if (cached) return cached;
  }
  try {
    const data = await requestJson<{ products?: RawProduct[] }>('/api/products', signal);
    const products = (data.products || []).map(normalizeProduct).filter((product) => product.handle);
    await writeProductCache(products);
    return products;
  } catch (error) {
    const stale = await readProductCache(true);
    if (stale) return stale;
    throw error;
  }
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
  const variant = product.variants.find((item) => item.available !== false) || product.variants[0];
  return variant?.price || '0';
}

export function productPriceNumber(product: Product) {
  return Number(productPrice(product)) || 0;
}

export function productAvailable(product: Product) {
  return product.variants.some((variant) => variant.available !== false);
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
