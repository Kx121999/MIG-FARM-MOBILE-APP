import { createHmac, timingSafeEqual } from 'node:crypto';
import { fail } from '../lib/validation.mjs';
export function stripeGateway(env = process.env) {
  const mode = env.STRIPE_MODE === 'live' ? 'live' : 'test';
  const secretKey = env.STRIPE_SECRET_KEY || '';
  const publishableKey = env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET || '';
  const expectedSecretPrefix = mode === 'live' ? 'sk_live_' : 'sk_test_';
  const expectedPublishablePrefix = mode === 'live' ? 'pk_live_' : 'pk_test_';
  const configurationStatus = !secretKey || !publishableKey || !webhookSecret
    ? 'missing_credentials'
    : !secretKey.startsWith(expectedSecretPrefix) ||
        !publishableKey.startsWith(expectedPublishablePrefix) ||
        !webhookSecret.startsWith('whsec_')
      ? 'credential_mode_mismatch'
      : 'configured';
  async function request(path, init = {}) {
    const response = await fetch('https://api.stripe.com/v1/' + path, {
      ...init,
      headers: {
        Authorization: 'Bearer ' + secretKey,
        ...init.headers,
      },
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok || !data.id) throw fail(502, 'payment_provider_error');
    return data;
  }
  async function createIntent(order, idempotencyKey) {
    const form = new URLSearchParams({
      amount: String(Math.round(Number(order.total) * 100)),
      currency: 'aed',
      'automatic_payment_methods[enabled]': 'true',
      receipt_email: order.customer_snapshot.email,
      description: 'MIG FARM order ' + order.id,
      'metadata[order_id]': order.id,
      'metadata[odoo_order_id]': String(order.odoo_order_id),
    });
    return request('payment_intents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body: form,
    });
  }
  return {
    get configured() {
      return configurationStatus === 'configured';
    },
    get configurationStatus() {
      return configurationStatus;
    },
    get mode() {
      return mode;
    },
    get publishableKey() {
      return publishableKey;
    },
    async intent(order) {
      if (order.payment_intent_id) {
        const existing = await request(
          'payment_intents/' + encodeURIComponent(order.payment_intent_id),
        );
        if (existing.status !== 'canceled') return existing;
        return createIntent(
          order,
          `${order.id}:retry:${order.payment_intent_id}`,
        );
      }
      return createIntent(order, `${order.id}:payment:v1`);
    },
    verify(raw, header) {
      if (!webhookSecret || typeof header !== 'string')
        return false;
      const fields = header.split(',').map((value) => value.trim().split('='));
      const stamp = fields.find(([key]) => key === 't')?.[1];
      if (
        !stamp ||
        !Number.isFinite(Number(stamp)) ||
        Math.abs(Date.now() / 1000 - Number(stamp)) > 300
      )
        return false;
      const expected = createHmac('sha256', webhookSecret)
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
