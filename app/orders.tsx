import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIconButton } from '@/components/AppIconButton';
import { AppButton } from '@/components/AppButton';
import { MotionPressable } from '@/components/Motion';
import { EmptyState, ScreenState } from '@/components/ScreenState';
import { OrderThumbnail } from '@/components/account/OrderItems';
import { Notice, ui } from '@/components/account/AccountUI';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { customerService } from '@/services/customer';
import { getGuestOrders } from '@/services/orders';
import { formatAED } from '@/services/catalog';
import { orderStatusLabel } from '@/utils/orders';
import type { CustomerOrder } from '@/types/customer';

export default function OrdersScreen() {
  const { user } = useAuth();
  return <OrdersContent key={user?.id || 'guest'} />;
}

function OrdersContent() {
  const { user } = useAuth();
  const { isRTL: ar } = useLanguage();
  const [items, setItems] = useState<CustomerOrder[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [cursor, setCursor] = useState<string>();
  const load = useCallback(
    async (next?: string) => {
      setLoading(true);
      setError(false);
      try {
        const page = user
          ? await customerService.orders(next)
          : await getGuestOrders(next);
        setItems((current) =>
          next
            ? [
                ...current,
                ...page.items.filter(
                  (item) =>
                    !current.some(
                      (previous) => previous.number === item.number,
                    ),
                ),
              ]
            : page.items,
        );
        setCursor(page.nextCursor);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );
  useEffect(() => {
    setItems([]);
    void load();
  }, [load]);
  return (
    <SafeAreaView style={ui.safe} edges={['top', 'bottom']}>
      <View style={[ui.top, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <AppIconButton
          icon={ar ? ArrowRight : ArrowLeft}
          label={ar ? 'رجوع' : 'Back'}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/(tabs)/account')
          }
        />
        <Text style={[ui.pageTitle, { textAlign: ar ? 'right' : 'left' }]}>
          {ar ? 'طلباتي' : 'My orders'}
        </Text>
        <AppIconButton
          icon={RefreshCw}
          label={ar ? 'تحديث الطلبات' : 'Refresh orders'}
          onPress={() => {
            if (!loading) void load();
          }}
        />
      </View>
      {!user ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Notice
            text={
              ar
                ? 'طلبات هذا الجهاز. سجل الطلبات عبر الأجهزة يحتاج خدمة حسابات غير متاحة حاليًا.'
                : 'Orders from this device. Cross-device history requires an account service that is not available yet.'
            }
          />
        </View>
      ) : null}
      {loading && !items.length ? (
        <View style={{ padding: 16 }}>
          <ScreenState loading />
        </View>
      ) : error && !items.length ? (
        <ScreenState error="network" onRetry={() => load()} />
      ) : !items.length ? (
        <EmptyState
          title={ar ? 'ما عندك طلبات بعد' : 'No orders yet'}
          body={
            ar
              ? 'طلباتك المكتملة على هذا الجهاز ستظهر هنا.'
              : 'Orders completed on this device will appear here.'
          }
          action={ar ? 'ابدأ التسوق' : 'Start shopping'}
          onAction={() => router.push('/(tabs)/catalog')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.number}
          contentContainerStyle={{
            padding: 16,
            width: '100%',
            maxWidth: 680,
            alignSelf: 'center',
            gap: 12,
          }}
          initialNumToRender={5}
          renderItem={({ item }) => (
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={
                (ar ? 'تفاصيل الطلب ' : 'Order details ') + item.number
              }
              style={ui.card}
              onPress={() =>
                router.push({
                  pathname: '/order-detail',
                  params: { number: item.number },
                })
              }
            >
              <Text style={[ui.label, { textAlign: ar ? 'right' : 'left' }]}>
                {item.number}
              </Text>
              <Text style={[ui.caption, { textAlign: ar ? 'right' : 'left' }]}>
                {new Date(item.createdAt).toLocaleDateString(
                  ar ? 'ar-AE' : 'en-AE',
                )}{' '}
                ·{' '}
                {item.items.reduce((sum, product) => sum + product.quantity, 0)}{' '}
                {ar ? 'قطعة' : 'items'}
              </Text>
              <View
                style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8 }}
              >
                {item.items.slice(0, 3).map((product, index) => (
                  <OrderThumbnail key={index} uri={product.image} />
                ))}
              </View>
              <Text style={[ui.label, { textAlign: ar ? 'right' : 'left' }]}>
                {orderStatusLabel(item.status, ar)}
              </Text>
              <Text style={[ui.label, { textAlign: ar ? 'right' : 'left' }]}>
                {formatAED(item.total)}
              </Text>
            </MotionPressable>
          )}
          ListFooterComponent={
            error ? (
              <ScreenState error="network" onRetry={() => load(cursor)} />
            ) : cursor ? (
              <AppButton
                secondary
                disabled={loading}
                label={ar ? 'عرض المزيد' : 'Load more'}
                onPress={() => load(cursor)}
              />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
