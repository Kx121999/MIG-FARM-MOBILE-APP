import type { CartItem, Product, SavedAddress } from '@/types';
import type {
  CustomerOrderItem,
  GuestSnapshot,
  NotificationPreference,
  ProfileAvatar,
} from '@/types/customer';

export const EMIRATES = [
  ['Dubai', 'دبي'],
  ['Abu Dhabi', 'أبوظبي'],
  ['Sharjah', 'الشارقة'],
  ['Ajman', 'عجمان'],
  ['RAK', 'رأس الخيمة'],
  ['Fujairah', 'الفجيرة'],
  ['Umm Al Quwain', 'أم القيوين'],
] as const;
export function validEmail(value: string) {
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim()) &&
    value.trim().length <= 254
  );
}
export function normalizePhone(value: string) {
  let phone = value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (/^0[2-9]\d{7,8}$/.test(phone)) phone = '+971' + phone.slice(1);
  else if (/^971\d+$/.test(phone)) phone = '+' + phone;
  phone = phone.replace(/^\+9710/, '+971');
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
export const unionIds = (local: number[], remote: number[], limit = 500) =>
  [...new Set([...local, ...remote])]
    .filter((id) => Number.isSafeInteger(id) && id > 0)
    .slice(0, limit);
export function mergeCarts(local: CartItem[], remote: CartItem[]) {
  const merged = new Map(remote.map((item) => [item.key, item]));
  // A merge is idempotent; repeating a login must not double quantities.
  for (const item of local) {
    const existing = merged.get(item.key);
    merged.set(
      item.key,
      existing
        ? { ...item, quantity: Math.max(existing.quantity, item.quantity) }
        : item,
    );
  }
  return [...merged.values()];
}
export function mergeGuestSnapshot(
  local: GuestSnapshot,
  remote: GuestSnapshot,
): GuestSnapshot {
  return {
    favorites: unionIds(local.favorites, remote.favorites),
    recentProductIds: unionIds(
      local.recentProductIds,
      remote.recentProductIds,
      8,
    ),
    cart: mergeCarts(local.cart, remote.cart),
    preferences: remote.preferences,
  };
}
export function upsertAddress(current: SavedAddress[], address: SavedAddress) {
  const exists = current.some((item) => item.id === address.id);
  const next = exists
    ? current.map((item) => (item.id === address.id ? address : item))
    : [...current, address];
  const defaultId = address.isDefault
    ? address.id
    : next.find((item) => item.isDefault)?.id || next[0]?.id;
  return next.map((item) => ({ ...item, isDefault: item.id === defaultId }));
}
export function withoutAddress(current: SavedAddress[], id: string) {
  const remaining = current.filter((item) => item.id !== id);
  if (remaining.length && !remaining.some((item) => item.isDefault))
    remaining[0] = { ...remaining[0], isDefault: true };
  return remaining;
}
export function avatarSource(avatar?: ProfileAvatar | null) {
  if (!avatar?.avatarUrl) return undefined;
  try {
    const url = new URL(avatar.avatarUrl);
    if (url.protocol !== 'https:') return undefined;
    // Signed storage URLs must be versioned by the server, not modified here.
    if (avatar.avatarUpdatedAt && !url.search)
      url.searchParams.set('v', avatar.avatarUpdatedAt);
    return url.toString();
  } catch {
    return undefined;
  }
}
export const defaultNotificationPreferences: NotificationPreference = {
  orderUpdates: true,
  offers: false,
  newProducts: false,
  availability: false,
  farmingTips: false,
  marketingConsent: false,
};
export function readNotificationPreferences(
  value: unknown,
): NotificationPreference {
  const data =
    value && typeof value === 'object'
      ? (value as Partial<NotificationPreference>)
      : {};
  const consent = data.marketingConsent === true;
  return {
    orderUpdates: data.orderUpdates !== false,
    offers: consent && data.offers === true,
    newProducts: consent && data.newProducts === true,
    availability: data.availability === true,
    farmingTips: consent && data.farmingTips === true,
    marketingConsent: consent,
  };
}
export function planReorder(items: CustomerOrderItem[], products: Product[]) {
  const available: Array<{
    product: Product;
    variant: Product['variants'][number];
    quantity: number;
  }> = [];
  const unavailable: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.productId}:${item.variantId}`;
    if (seen.has(key)) {
      const previous = available.find(
        (entry) =>
          entry.product.id === item.productId &&
          entry.variant.id === item.variantId,
      );
      if (previous)
        previous.quantity = Math.min(
          99,
          previous.quantity + Math.max(1, Math.floor(item.quantity)),
        );
      continue;
    }
    seen.add(key);
    const product = products.find((entry) => entry.id === item.productId);
    const variant = product?.variants.find(
      (entry) => entry.id === item.variantId,
    );
    if (
      !product ||
      !variant ||
      variant.available === false ||
      !Number.isFinite(Number(variant.price))
    )
      unavailable.push(item.title);
    else
      available.push({
        product,
        variant,
        quantity: Math.min(99, Math.max(1, Math.floor(item.quantity))),
      });
  }
  return { available, unavailable };
}
