import { createHmac, timingSafeEqual } from 'node:crypto';
import { fail } from '../lib/validation.mjs';
export function stripeGateway(env = process.env) {
  async function request(path, init = {}) {
    const response = await fetch('https://api.stripe.com/v1/' + path, {
      ...init,
      headers: {
        Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
        ...init.headers,
      },
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok || !data.id) throw fail(502, 'payment_provider_error');
    return data;
  }
  return {
    get configured() {
      return (
        !!env.STRIPE_SECRET_KEY && !!env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
      );
    },
    get publishableKey() {
      return env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    },
    async intent(order) {
      if (order.payment_intent_id)
        return request(
          'payment_intents/' + encodeURIComponent(order.payment_intent_id),
        );
      const form = new URLSearchParams({
        amount: String(Math.round(Number(order.total) * 100)),
        currency: 'aed',
        'automatic_payment_methods[enabled]': 'true',
        receipt_email: order.customer_snapshot.email,
        description: 'MIG FARM order ' + order.id,
        'metadata[order_id]': order.id,
      });
      return request('payment_intents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': order.id,
        },
        body: form,
      });
    },
    verify(raw, header) {
      if (!env.STRIPE_WEBHOOK_SECRET || typeof header !== 'string')
        return false;
      const fields = header.split(',').map((value) => value.trim().split('='));
      const stamp = fields.find(([key]) => key === 't')?.[1];
      if (
        !stamp ||
        !Number.isFinite(Number(stamp)) ||
        Math.abs(Date.now() / 1000 - Number(stamp)) > 300
      )
        return false;
      const expected = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
        .update(stamp + '.')
        .update(raw)
        .digest();
      return fields
        .filter(([key]) => key === 'v1')
        .some(([, value]) => {
          const actual = Buffer.from(value || '', 'hex');
          return (
            actual.length === expected.length &&
            timingSafeEqual(actual, expected)
          );
        });
    },
  };
}
