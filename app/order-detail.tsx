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
import { orderStatusLabel } from '@/utils/orders';
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
          <AccountHeading>{orderStatusLabel(order.status, ar)}</AccountHeading>
          <View style={[ui.row, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
            <Check size={20} />
            <Text style={ui.body}>
              {ar ? 'تم إنشاء الطلب' : 'Order created'}
            </Text>
          </View>
          <View style={[ui.row, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
            {order.status === 'paid' ? (
              <Check size={20} />
            ) : (
              <Circle size={20} />
            )}
            <Text style={ui.body}>{orderStatusLabel(order.status, ar)}</Text>
          </View>
          {order.status === 'paid' ? (
            <Notice
              text={
                ar
                  ? 'تحديثات التجهيز والتوصيل غير متاحة بعد. تواصل مع الدعم لمتابعة الشحنة.'
                  : 'Preparation and delivery updates are not available yet. Contact support to track delivery.'
              }
            />
          ) : null}
          <OrderItems items={order.items} />
          <AccountHeading>{ar ? 'ملخص الطلب' : 'Order summary'}</AccountHeading>
          {[
            [ar ? 'المنتجات' : 'Subtotal', order.subtotal],
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
