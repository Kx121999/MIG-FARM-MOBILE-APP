import type { CartItem, Product, ProductVariant } from '@/types';

export const CART_QUANTITY_MIN = 1;
export const CART_QUANTITY_MAX = 99;

export function cartLineKey(productId: number, variantId: number) {
  return `${productId}:${variantId}`;
}

export function clampCartQuantity(value: number) {
  const quantity = Number.isFinite(value) ? Math.floor(value) : CART_QUANTITY_MIN;
  return Math.min(CART_QUANTITY_MAX, Math.max(CART_QUANTITY_MIN, quantity));
}

export function mergeCartLine(
  current: CartItem[],
  product: Product,
  variant: ProductVariant,
  quantity = CART_QUANTITY_MIN,
  image: string | null = null,
) {
  const key = cartLineKey(product.id, variant.id);
  const safeQuantity = clampCartQuantity(quantity);
  const existing = current.find((item) => item.key === key);
  if (existing) {
    return current.map((item) => item.key === key
      ? {
          ...item,
          variant,
          image: variant.featured_image?.src || image || item.image,
          quantity: clampCartQuantity(item.quantity + safeQuantity),
        }
      : item);
  }
  return [...current, {
    key,
    productId: product.id,
    handle: product.handle,
    title: product.title,
    title_ar: product.title_ar,
    title_en: product.title_en,
    image: variant.featured_image?.src || image,
    variant,
    quantity: safeQuantity,
  }];
}
