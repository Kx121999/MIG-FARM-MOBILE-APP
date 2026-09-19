import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Circle } from 'lucide-react-native';
import {
  AccountPage,
  AccountHeading,
  Notice,
  ui,
} from '@/components/account/AccountUI';
import { OrderItems } from '@/components/account/OrderItems';
import { AppButton } from '@/components/AppButton';
import { ScreenState } from '@/components/ScreenState';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCommerce } from '@/contexts/CommerceContext';
import { customerService, customerError } from '@/services/customer';
import { currentProductsForReorder, getGuestOrder } from '@/services/orders';
import { fulfillmentStatusLabel, paymentStatusLabel } from '@/utils/orders';
import { planReorder } from '@/utils/customer';
import { formatAED } from '@/services/catalog';
import type { CustomerOrder } from '@/types/customer';

export default function OrderDetailScreen() {
  const { user } = useAuth();
  const { number } = useLocalSearchParams<{ number?: string }>();
  return <OrderDetailContent key={`${user?.id || 'guest'}:${number || ''}`} />;
}

function OrderDetailContent() {
  const { number } = useLocalSearchParams<{ number?: string }>();
  const { user } = useAuth();
  const { isRTL: ar } = useLanguage();
  const { addToCart } = useCommerce();
  const [order, setOrder] = useState<CustomerOrder | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [plan, setPlan] = useState<ReturnType<typeof planReorder> | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (!number) throw new Error('missing');
      setOrder(
        user
          ? await customerService.order(number)
          : await getGuestOrder(number),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [number, user?.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const prepare = async () => {
    if (!order || busy) return;
    setBusy(true);
    setMessage('');
    setPlan(null);
    try {
      setPlan(planReorder(order.items, await currentProductsForReorder()));
    } catch (e) {
      setMessage(customerError(e, ar));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AccountPage title={ar ? 'تفاصيل الطلب' : 'Order details'}>
      {loading ? (
        <ScreenState loading />
      ) : error ? (
        <ScreenState error="request" onRetry={load} />
      ) : order ? (
        <>
          <Text style={ui.label}>{order.number}</Text>
          <Text style={ui.caption}>
            {new Date(order.createdAt).toLocaleDateString(
              ar ? 'ar-AE' : 'en-AE',
            )}
          </Text>
          <AccountHeading>{ar ? 'حالة الطلب' : 'Order status'}</AccountHeading>
          <Text style={[ui.label, { textAlign: ar ? 'right' : 'left' }]}>
            {fulfillmentStatusLabel(order.fulfillmentStatus, ar)}
          </Text>
          {(['received', 'preparing', 'out_for_delivery', 'delivered'] as const).map((step) => {
            const positions = ['received', 'preparing', 'out_for_delivery', 'delivered'];
            const done = positions.indexOf(step) <= positions.indexOf(order.fulfillmentStatus);
            return (
              <View key={step} style={[ui.row, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
                {done ? <Check size={20} /> : <Circle size={20} />}
                <Text style={ui.body}>{fulfillmentStatusLabel(step, ar)}</Text>
              </View>
            );
          })}
          <AccountHeading>{ar ? 'الدفع' : 'Payment'}</AccountHeading>
          <Text style={[ui.body, { textAlign: ar ? 'right' : 'left' }]}>
            {paymentStatusLabel(order.paymentStatus, ar)}
          </Text>
          {order.odooOrderName ? <Text style={[ui.caption, { textAlign: ar ? 'right' : 'left' }]}>{ar ? 'مرجع الطلب: ' : 'Order reference: '}{order.odooOrderName}</Text> : null}
          <OrderItems items={order.items} />
          <AccountHeading>{ar ? 'ملخص الطلب' : 'Order summary'}</AccountHeading>
          {[
            [ar ? 'المنتجات' : 'Subtotal', order.subtotal],
            [ar ? 'الضريبة' : 'VAT', order.tax],
            [ar ? 'التوصيل' : 'Delivery', order.delivery],
            [ar ? 'الإجمالي' : 'Total', order.total],
          ].map(([label, value]) => (
            <View
              key={label}
              style={[
                ui.row,
                {
                  flexDirection: ar ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                },
              ]}
            >
              <Text style={ui.label}>{label}</Text>
              <Text style={ui.label}>{formatAED(value)}</Text>
            </View>
          ))}
          <AccountHeading>
            {ar ? 'عنوان التوصيل' : 'Delivery address'}
          </AccountHeading>
          <Text style={[ui.body, { textAlign: ar ? 'right' : 'left' }]}>
            {order.address.addressLine}
            {'\n'}
            {order.address.city}, {order.address.emirate}
            {'\n'}
            {order.address.notes}
          </Text>
          {order.status === 'paid' ? (
            <AppButton
              disabled={busy}
              label={
                busy
                  ? ar
                    ? 'جارٍ مراجعة المنتجات...'
                    : 'Checking products...'
                  : ar
                    ? 'اطلب مرة ثانية'
                    : 'Order again'
              }
              onPress={prepare}
            />
          ) : null}
          {plan ? (
            <>
              <Notice
                text={
                  plan.unavailable.length
                    ? ar
                      ? 'بعض المنتجات غير متوفرة حالياً'
                      : 'Some products are currently unavailable'
                    : ar
                      ? 'المنتجات متاحة بالأسعار الحالية.'
                      : 'Products are available at current prices.'
                }
              />
              {plan.unavailable.map((title, index) => (
                <Text key={index} style={ui.body}>
                  {title}
                </Text>
              ))}
              {plan.available.map((item) => (
                <Text key={item.variant.id} style={ui.body}>
                  {item.product.title} · {item.quantity} ×{' '}
                  {formatAED(item.variant.price)}
                </Text>
              ))}
              {plan.available.length ? (
                <AppButton
                  label={
                    ar
                      ? 'إضافة المنتجات المتاحة للسلة'
                      : 'Add available products to cart'
                  }
                  onPress={() => {
                    plan.available.forEach((item) =>
                      addToCart(item.product, item.variant, item.quantity),
                    );
                    setPlan(null);
                    setMessage(
                      ar
                        ? 'تمت إضافة المنتجات المتاحة إلى السلة.'
                        : 'Available products added to cart.',
                    );
                  }}
                />
              ) : null}
            </>
          ) : null}
          {message ? <Notice text={message} /> : null}
          <AppButton
            secondary
            label={ar ? 'الدعم' : 'Support'}
            onPress={() => router.push('/support')}
          />
        </>
      ) : null}
    </AccountPage>
  );
}
