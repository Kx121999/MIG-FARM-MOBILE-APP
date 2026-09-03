import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CartItem, CustomerProfile, Product, ProductVariant, SavedAddress } from '@/types';
import { productImage } from '@/services/catalog';
import { upsertAddress, withoutAddress } from '@/utils/customer';

const CART_KEY = 'mig_farm_cart_v1';
const FAVORITES_KEY = 'mig_farm_favorites_v1';
const COMPARE_KEY = 'mig_farm_compare_v1';
const RECENT_KEY = 'mig_farm_recent_v1';
const PROFILE_KEY = 'mig_farm_profile_v1';
const ADDRESSES_KEY = 'mig_farm_addresses_v1';
const LOCATION_KEY = 'mig_farm_location_v1';

type CommerceValue = {
  hydrated: boolean;
  cart: CartItem[];
  favorites: number[];
  compareIds: number[];
  recentProductIds: number[];
  profile: CustomerProfile;
  addresses: SavedAddress[];
  deliveryEmirate: string;
  cartCount: number;
  subtotal: number;
  addToCart: (product: Product, variant: ProductVariant, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  isFavorite: (productId: number) => boolean;
  toggleFavorite: (productId: number) => void;
  isCompared: (productId: number) => boolean;
  toggleCompare: (productId: number) => void;
  clearCompare: () => void;
  recordRecentProduct: (productId: number) => void;
  clearRecentProducts: () => void;
  setProfile: (profile: CustomerProfile) => void;
  saveAddress: (address: Omit<SavedAddress, 'id'> & { id?: string }) => void;
  setDefaultAddress: (id: string) => void;
  removeAddress: (id: string) => void;
  setDeliveryEmirate: (emirate: string) => void;
};

const CommerceContext = createContext<CommerceValue | null>(null);

export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [recentProductIds, setRecentProductIds] = useState<number[]>([]);
  const [profile, setProfileState] = useState<CustomerProfile>({ name: '', email: '', phone: '' });
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [deliveryEmirate, setDeliveryEmirateState] = useState('Dubai');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CART_KEY),
      AsyncStorage.getItem(FAVORITES_KEY),
      AsyncStorage.getItem(COMPARE_KEY),
      AsyncStorage.getItem(RECENT_KEY),
      AsyncStorage.getItem(PROFILE_KEY),
      AsyncStorage.getItem(ADDRESSES_KEY),
      AsyncStorage.getItem(LOCATION_KEY),
    ])
      .then(([storedCart, storedFavorites, storedCompare, storedRecent, storedProfile, storedAddresses, storedLocation]) => {
        if (storedCart) setCart(JSON.parse(storedCart));
        if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
        if (storedCompare) setCompareIds(JSON.parse(storedCompare));
        if (storedRecent) setRecentProductIds(JSON.parse(storedRecent));
        if (storedProfile) setProfileState(JSON.parse(storedProfile));
        if (storedAddresses) setAddresses(JSON.parse(storedAddresses));
        if (storedLocation) setDeliveryEmirateState(storedLocation);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(CART_KEY, JSON.stringify(cart)).catch(() => undefined);
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)).catch(() => undefined);
  }, [favorites, hydrated]);

  useEffect(() => { if (hydrated) AsyncStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds)).catch(() => undefined); }, [compareIds, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(RECENT_KEY, JSON.stringify(recentProductIds)).catch(() => undefined); }, [recentProductIds, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)).catch(() => undefined); }, [profile, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses)).catch(() => undefined); }, [addresses, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(LOCATION_KEY, deliveryEmirate).catch(() => undefined); }, [deliveryEmirate, hydrated]);

  const value = useMemo<CommerceValue>(() => ({
    hydrated,
    cart,
    favorites,
    compareIds,
    recentProductIds,
    profile,
    addresses,
    deliveryEmirate,
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: cart.reduce((sum, item) => sum + Number(item.variant.price || 0) * item.quantity, 0),
    addToCart: (product, variant, quantity = 1) => {
      const key = `${product.id}:${variant.id}`;
      setCart((current) => {
        const existing = current.find((item) => item.key === key);
        if (existing) return current.map((item) => item.key === key ? { ...item, variant, quantity: item.quantity + quantity } : item);
        return [...current, {
          key,
          productId: product.id,
          handle: product.handle,
          title: product.title,
          title_ar: product.title_ar,
          title_en: product.title_en,
          image: variant.featured_image?.src || productImage(product),
          variant,
          quantity,
        }];
      });
    },
    setQuantity: (key, quantity) => setCart((current) => quantity <= 0
      ? current.filter((item) => item.key !== key)
      : current.map((item) => item.key === key ? { ...item, quantity } : item)),
    removeFromCart: (key) => setCart((current) => current.filter((item) => item.key !== key)),
    clearCart: () => setCart([]),
    isFavorite: (productId) => favorites.includes(productId),
    toggleFavorite: (productId) => setFavorites((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]),
    isCompared: (productId) => compareIds.includes(productId),
    toggleCompare: (productId) => setCompareIds((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : current.length >= 3 ? current : [...current, productId]),
    clearCompare: () => setCompareIds([]),
    recordRecentProduct: (productId) => setRecentProductIds((current) => {
      const next = [productId, ...current.filter((id) => id !== productId)].slice(0, 8);
      return current.length === next.length && current.every((id, index) => id === next[index]) ? current : next;
    }),
    setProfile: (next) => setProfileState(next),
    clearRecentProducts: () => setRecentProductIds([]),
    saveAddress: (address) => setAddresses((current) => upsertAddress(current, { ...address, id: address.id || `address-${Date.now()}-${Math.random().toString(36).slice(2,8)}` })),
    setDefaultAddress: (id) => setAddresses((current) => current.some((item) => item.id === id) ? current.map((item) => ({ ...item, isDefault: item.id === id })) : current),
    removeAddress: (id) => setAddresses((current) => withoutAddress(current,id)),
    setDeliveryEmirate: (emirate) => setDeliveryEmirateState(emirate),
  }), [addresses, cart, compareIds, deliveryEmirate, favorites, profile, recentProductIds, hydrated]);

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const value = useContext(CommerceContext);
  if (!value) throw new Error('useCommerce must be used inside CommerceProvider');
  return value;
}
