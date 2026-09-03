import type { CartItem, Language, SavedAddress } from '@/types';

export type ProfileAvatar = {
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | null;
};
export type UserProfile = ProfileAvatar & {
  id: string;
  name: string;
  phone: string;
  email: string;
  emirate?: string;
  language: Language;
};
export type ProfileDraft = Omit<
  UserProfile,
  'id' | 'avatarUrl' | 'avatarUpdatedAt'
>;
export type AvatarSelection = {
  uri: string;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
};
export type AuthSession = {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};
export type UserAddress = SavedAddress;
export type FavoriteRecord = { productId: number; savedAt?: number };
export type RecentlyViewedRecord = { productId: number; viewedAt: number };
export type NotificationCategory =
  | 'orders'
  | 'offers'
  | 'availability'
  | 'newProducts'
  | 'important';
export type NotificationRecord = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  orderId?: string;
};
export type NotificationPreference = {
  orderUpdates: boolean;
  offers: boolean;
  newProducts: boolean;
  availability: boolean;
  farmingTips: boolean;
  marketingConsent: boolean;
};
export type CustomerPreference = {
  language: Language;
  personalization: boolean;
  notifications: NotificationPreference;
};
export type GuestSnapshot = {
  favorites: number[];
  recentProductIds: number[];
  cart: CartItem[];
  preferences: CustomerPreference;
};
export type CustomerOrderItem = {
  productId: number;
  variantId: number;
  handle: string;
  title: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
export type CustomerOrder = {
  number: string;
  status:
    | 'awaiting_payment'
    | 'paid'
    | 'payment_failed'
    | 'canceled'
    | 'unknown';
  createdAt: string;
  subtotal: number;
  delivery: number;
  total: number;
  currency: string;
  items: CustomerOrderItem[];
  address: {
    emirate: string;
    city: string;
    addressLine: string;
    notes: string;
  };
};
export type Page<T> = { items: T[]; nextCursor?: string };
