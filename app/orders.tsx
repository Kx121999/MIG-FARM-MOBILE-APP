import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { MotionPressable } from '@/components/Motion';
import { EmptyState, ScreenState } from '@/components/ScreenState';
import { OrderThumbnail } from '@/components/account/OrderItems';
import { AccountHeaderBar, Notice, ui } from '@/components/account/AccountUI';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { customerService } from '@/services/customer';
import { getGuestOrders } from '@/services/orders';
import { formatAED } from '@/services/catalog';
import { fulfillmentStatusLabel, paymentStatusLabel } from '@/utils/orders';
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
      <AccountHeaderBar
        title={ar ? 'طلباتي' : 'My orders'}
        right={
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={ar ? 'تحديث الطلبات' : 'Refresh orders'}
            style={ui.glassIcon}
            onPress={() => {
              if (!loading) void load();
            }}
          >
            <RefreshCw size={18} color="#FFFFFF" />
          </MotionPressable>
        }
      />
      {!user ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Notice
            text={
              ar
                ? 'طلبات الضيف محفوظة بأمان على هذا الجهاز. سجّل الدخول لمزامنة الطلبات الجديدة عبر أجهزتك.'
                : 'Guest orders are kept securely on this device. Sign in to sync new orders across devices.'
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
              ? 'طلباتك ستظهر هنا بعد تجهيزها.'
              : 'Your orders will appear here after checkout.'
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
                {fulfillmentStatusLabel(item.fulfillmentStatus, ar)}
              </Text>
              <Text style={[ui.caption, { textAlign: ar ? 'right' : 'left' }]}>
                {paymentStatusLabel(item.paymentStatus, ar)}
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
