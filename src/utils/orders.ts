import type { CustomerOrder } from '@/types/customer';
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, max = 300) =>
  typeof value === 'string' ? value.slice(0, max) : '';
const amount = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error('invalid_order');
  return value;
};
export function mapCustomerOrder(
  value: unknown,
  origin: string,
): CustomerOrder {
  const raw = record(value);
  if (
    !/^MIG-[A-Z0-9-]+$/i.test(text(raw.id)) ||
    !Array.isArray(raw.items) ||
    !Number.isFinite(Date.parse(text(raw.createdAt)))
  )
    throw new Error('invalid_order');
  const address = record(raw.shippingAddress);
  const status =
    raw.status === 'paid' ||
    raw.status === 'awaiting_payment' ||
    raw.status === 'payment_failed' ||
    raw.status === 'canceled'
      ? raw.status
      : 'unknown';
  return {
    number: text(raw.id),
    status,
    createdAt: text(raw.createdAt),
    subtotal: amount(raw.subtotal),
    delivery: amount(raw.delivery),
    total: amount(raw.total),
    currency: text(raw.currency, 3) || 'AED',
    address: {
      emirate: text(address.emirate),
      city: text(address.city),
      addressLine: text(address.addressLine),
      notes: text(address.notes),
    },
    items: raw.items.map((value) => {
      const item = record(value);
      let image: string | null = null;
      try {
        const url = new URL(text(item.image, 2048), origin);
        if (url.protocol === 'https:' && text(item.image))
          image = url.toString();
      } catch {}
      return {
        productId: amount(item.productId),
        variantId: amount(item.variantId),
        handle: text(item.handle),
        title: text(item.title),
        image,
        quantity: Math.max(1, Math.floor(amount(item.quantity))),
        unitPrice: amount(item.unitPrice),
        lineTotal: amount(item.lineTotal),
      };
    }),
  };
}
export function orderStatusLabel(status: CustomerOrder['status'], ar: boolean) {
  const labels = {
    awaiting_payment: ['بانتظار الدفع', 'Awaiting payment'],
    paid: ['تم الدفع', 'Paid'],
    payment_failed: ['لم يكتمل الدفع', 'Payment failed'],
    canceled: ['ملغي', 'Canceled'],
    unknown: ['الحالة غير متاحة', 'Status unavailable'],
  };
  return labels[status][ar ? 0 : 1];
}
