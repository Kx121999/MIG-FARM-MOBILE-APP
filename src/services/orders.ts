import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ORIGIN } from '@/services/catalog';
import { mapCustomerOrder } from '@/utils/orders';
import { CustomerServiceError } from '@/services/customer';
import type { Product } from '@/types';
import type { CustomerOrder, Page } from '@/types/customer';

const KEY = 'mig_farm_order_refs_v1';
type OrderRef = { id: string; token: string; createdAt: number };
async function references(): Promise<OrderRef[]> {
  const data: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  return data
    .filter((item): item is OrderRef => {
      if (
        !item ||
        typeof item.id !== 'string' ||
        typeof item.token !== 'string' ||
        !/^MIG-[A-Z0-9-]+$/i.test(item.id) ||
        seen.has(item.id)
      )
        return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
}
async function request(path: string, token?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(API_ORIGIN + path, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok)
      throw new CustomerServiceError(
        response.status === 404 ? 'invalid' : 'network',
      );
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}
async function fetchReference(ref: OrderRef) {
  const data = await request(
    '/api/orders/' + encodeURIComponent(ref.id),
    ref.token,
  );
  if (!data || typeof data !== 'object' || !('order' in data))
    throw new CustomerServiceError('invalid');
  return mapCustomerOrder(data.order, API_ORIGIN);
}
export async function getGuestOrder(number: string) {
  const ref = (await references()).find((item) => item.id === number);
  if (!ref) throw new CustomerServiceError('invalid');
  return fetchReference(ref);
}
export async function getGuestOrders(
  cursor = '0',
): Promise<Page<CustomerOrder>> {
  const refs = await references();
  const offset = Math.max(0, Number(cursor) || 0);
  const slice = refs.slice(offset, offset + 5);
  const items: CustomerOrder[] = [];
  for (const ref of slice) items.push(await fetchReference(ref));
  return {
    items,
    nextCursor: offset + 5 < refs.length ? String(offset + 5) : undefined,
  };
}
export async function currentProductsForReorder(): Promise<Product[]> {
  // Intentionally bypass the stale catalog fallback for pricing a new reorder.
  const data = await request('/api/products');
  if (
    !data ||
    typeof data !== 'object' ||
    !('products' in data) ||
    !Array.isArray(data.products)
  )
    throw new CustomerServiceError('invalid');
  return data.products
    .filter(
      (p): p is Product =>
        !!p &&
        typeof p.id === 'number' &&
        typeof p.handle === 'string' &&
        Array.isArray(p.variants) &&
        Array.isArray(p.images),
    )
    .map((product) => ({
      ...product,
      images: product.images.map((image) => ({
        ...image,
        src: new URL(image.src, API_ORIGIN).toString(),
      })),
      variants: product.variants.map((variant) => ({
        ...variant,
        featured_image: variant.featured_image
          ? {
              ...variant.featured_image,
              src: new URL(variant.featured_image.src, API_ORIGIN).toString(),
            }
          : null,
      })),
    }));
}
