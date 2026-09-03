import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  randomUUID,
  digestStringAsync,
  CryptoDigestAlgorithm,
} from 'expo-crypto';
import {
  apiRequest,
  apiSession,
  CustomerServiceError,
} from '@/services/apiClient';
import { CartItem } from '@/types';

export type CheckoutCustomer = { name: string; email: string; phone: string };
export type ShippingAddress = {
  emirate: string;
  city: string;
  addressLine: string;
  notes: string;
};
export type PaymentSession = {
  orderId: string;
  orderToken: string;
  clientSecret: string;
  publishableKey: string;
  amount: number;
  currency: string;
};
export class CheckoutError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
const ATTEMPT_KEY = 'mig_farm_checkout_attempt_v1';
let pending: Promise<unknown> = Promise.resolve();
type Attempt = { digest: string; key: string };
let cached: Attempt | null = null;
async function attemptKey(body: unknown) {
  const digest = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    JSON.stringify([apiSession.get()?.user.id || 'guest', body]),
  );
  const work = pending
    .catch(() => undefined)
    .then(async () => {
      if (!cached) {
        try {
          cached = JSON.parse(
            (await AsyncStorage.getItem(ATTEMPT_KEY)) || 'null',
          );
        } catch {
          /* Use a new attempt if storage is unavailable. */
        }
      }
      if (!cached || cached.digest !== digest) {
        cached = { digest, key: randomUUID() };
        await AsyncStorage.setItem(ATTEMPT_KEY, JSON.stringify(cached)).catch(
          () => undefined,
        );
      }
      return cached.key;
    });
  pending = work;
  return work;
}
export async function completeCheckoutAttempt() {
  await pending.catch(() => undefined);
  cached = null;
  await AsyncStorage.removeItem(ATTEMPT_KEY).catch(() => undefined);
}
export async function createCheckoutSession(
  cart: CartItem[],
  customer: CheckoutCustomer,
  shippingAddress: ShippingAddress,
  signal?: AbortSignal,
) {
  const body = {
    items: cart.map((item) => ({
      productId: item.productId,
      variantId: item.variant.id,
      quantity: item.quantity,
    })),
    customer,
    shippingAddress,
  };
  const key = await attemptKey(body);
  try {
    return await apiRequest<PaymentSession>('/api/checkout/session', {
      method: 'POST',
      body,
      auth: 'optional',
      signal,
      timeout: 30000,
      headers: { 'Idempotency-Key': key },
    });
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      if (error.code === 'order_already_completed')
        await completeCheckoutAttempt();
      throw new CheckoutError(error.code, error.status);
    }
    throw error;
  }
}
