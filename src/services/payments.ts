import { API_ORIGIN } from '@/services/catalog';
import { CartItem } from '@/types';

export type CheckoutCustomer = { name: string; email: string; phone: string };
export type ShippingAddress = { emirate: string; city: string; addressLine: string; notes: string };
export type PaymentSession = {
  orderId: string;
  orderToken: string;
  clientSecret: string;
  publishableKey: string;
  amount: number;
  currency: string;
};

export class CheckoutError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

export async function createCheckoutSession(
  cart: CartItem[],
  customer: CheckoutCustomer,
  shippingAddress: ShippingAddress,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_ORIGIN}/api/checkout/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      items: cart.map((item) => ({ productId: item.productId, variantId: item.variant.id, quantity: item.quantity })),
      customer,
      shippingAddress,
    }),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new CheckoutError(data.error || 'checkout_failed', response.status);
  return data as PaymentSession;
}
