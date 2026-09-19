export type PrepareCartItem = {
  productId: number;
  variant: { id: number };
  quantity: number;
};

export type PrepareCustomer = { name: string; email: string; phone: string };
export type PrepareShippingAddress = {
  emirate: string;
  city: string;
  addressLine: string;
  notes: string;
};

export type PreparedOrder = {
  orderId: string;
  orderToken: string;
  status: 'awaiting_payment';
  currency: string;
  subtotal: number;
  tax: number;
  delivery: number;
  total: number;
  odoo: {
    orderId: number;
    orderName: string;
    state: 'draft';
  };
};

export type PrepareOrderBody = {
  items: Array<{ productId: number; variantId: number; quantity: number }>;
  customer: PrepareCustomer;
  shippingAddress: PrepareShippingAddress;
};

type RequestOptions = {
  method: 'POST';
  body: PrepareOrderBody;
  auth: 'optional';
  signal?: AbortSignal;
  timeout: number;
  headers: { 'Idempotency-Key': string };
};

type PrepareOrderDependencies = {
  enabled: boolean;
  idempotencyKey: (body: PrepareOrderBody) => Promise<string>;
  request: (path: string, options: RequestOptions) => Promise<unknown>;
};

export class OrderPrepareDisabledError extends Error {
  code = 'order_prepare_disabled';
}

export function orderPrepareFeatureEnabled(value?: string) {
  return value?.trim().toLowerCase() === 'true';
}

export function prepareOrderBody(
  cart: PrepareCartItem[],
  customer: PrepareCustomer,
  shippingAddress: PrepareShippingAddress,
): PrepareOrderBody {
  if (!cart.length || cart.length > 100) throw new Error('cart_is_empty');
  for (const item of cart) {
    if (
      !Number.isSafeInteger(item.productId) || item.productId <= 0 ||
      !Number.isSafeInteger(item.variant.id) || item.variant.id <= 0 ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99
    ) throw new Error('invalid_cart_item');
  }
  return {
    items: cart.map((item) => ({
      productId: item.productId,
      variantId: item.variant.id,
      quantity: item.quantity,
    })),
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
    shippingAddress: {
      emirate: shippingAddress.emirate,
      city: shippingAddress.city,
      addressLine: shippingAddress.addressLine,
      notes: shippingAddress.notes,
    },
  };
}

function mappedNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('invalid_prepared_order');
  return parsed;
}

export function mapPreparedOrder(value: unknown): PreparedOrder {
  const order = value as Partial<PreparedOrder> | null;
  if (
    !order ||
    typeof order.orderId !== 'string' ||
    typeof order.orderToken !== 'string' ||
    order.status !== 'awaiting_payment' ||
    typeof order.currency !== 'string' ||
    !order.odoo ||
    order.odoo.state !== 'draft' ||
    typeof order.odoo.orderName !== 'string'
  ) throw new Error('invalid_prepared_order');
  return {
    orderId: order.orderId,
    orderToken: order.orderToken,
    status: order.status,
    currency: order.currency,
    subtotal: mappedNumber(order.subtotal),
    tax: mappedNumber(order.tax),
    delivery: mappedNumber(order.delivery),
    total: mappedNumber(order.total),
    odoo: {
      orderId: mappedNumber(order.odoo.orderId),
      orderName: order.odoo.orderName,
      state: order.odoo.state,
    },
  };
}

export function createPrepareOrderClient(dependencies: PrepareOrderDependencies) {
  let inflight: Promise<PreparedOrder> | null = null;
  return async (
    cart: PrepareCartItem[],
    customer: PrepareCustomer,
    shippingAddress: PrepareShippingAddress,
    signal?: AbortSignal,
  ) => {
    if (!dependencies.enabled) throw new OrderPrepareDisabledError();
    if (inflight) return inflight;
    inflight = (async () => {
      const body = prepareOrderBody(cart, customer, shippingAddress);
      const key = await dependencies.idempotencyKey(body);
      const response = await dependencies.request('/api/orders/prepare', {
        method: 'POST',
        body,
        auth: 'optional',
        signal,
        timeout: 30000,
        headers: { 'Idempotency-Key': key },
      });
      return mapPreparedOrder(response);
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}
