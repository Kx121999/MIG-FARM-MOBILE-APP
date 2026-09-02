import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Box, RefreshCw, Truck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { API_ORIGIN, formatAED } from '@/services/catalog';

const ORDER_REFS_KEY = 'mig_farm_order_refs_v1';
type OrderRef = { id: string; token: string; createdAt: number };
type Order = { id: string; status: string; createdAt: string; total: number; currency: string; items: Array<{ title: string; quantity: number }> };

export default function OrdersScreen() {
  const { language, isRTL } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const refs = JSON.parse(await AsyncStorage.getItem(ORDER_REFS_KEY) || '[]') as OrderRef[];
      const results = await Promise.all(refs.map(async (ref) => {
        const response = await fetch(`${API_ORIGIN}/api/orders/${encodeURIComponent(ref.id)}`, { headers: { Authorization: `Bearer ${ref.token}` } });
        if (!response.ok) return null;
        return (await response.json()).order as Order;
      }));
      setOrders(results.filter((order): order is Order => Boolean(order)));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}><Pressable style={styles.back} onPress={() => router.back()}><BackIcon size={21} color={colors.primaryDark} /></Pressable><Text style={styles.title}>{language === 'ar' ? 'طلباتي' : 'My orders'}</Text><Pressable style={styles.refresh} onPress={load}><RefreshCw size={18} color={colors.primary} /></Pressable></View>
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>{language === 'ar' ? 'بنراجع طلباتك…' : 'Loading your orders…'}</Text></View> : error ? <View style={styles.center}><RefreshCw size={30} color={colors.muted} /><Text style={styles.stateText}>{language === 'ar' ? 'تعذر تحميل الطلبات' : 'Orders could not be loaded'}</Text></View> : !orders.length ? <View style={styles.center}><View style={styles.emptyIcon}><Box size={38} color={colors.primary} /></View><Text style={styles.emptyTitle}>{language === 'ar' ? 'ما عندكش طلبات لسه' : 'No orders yet'}</Text><Text style={styles.stateText}>{language === 'ar' ? 'طلباتك المدفوعة هتظهر هنا.' : 'Your paid orders will appear here.'}</Text></View> : (
        <FlatList data={orders} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.order}><View style={[styles.orderTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}><View><Text style={[styles.orderId, { textAlign: isRTL ? 'right' : 'left' }]}>{item.id}</Text><Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-AE')}</Text></View><View style={styles.status}><Truck size={14} color={colors.primary} /><Text style={styles.statusText}>{statusLabel(item.status, language)}</Text></View></View><Text style={[styles.items, { textAlign: isRTL ? 'right' : 'left' }]}>{item.items.map((product) => `${product.quantity} × ${product.title}`).join('\n')}</Text><Text style={[styles.total, { textAlign: isRTL ? 'right' : 'left' }]}>{formatAED(item.total)}</Text></View>} />
      )}
    </SafeAreaView>
  );
}

function statusLabel(status: string, language: 'ar' | 'en') {
  const labels: Record<string, [string, string]> = { awaiting_payment: ['بانتظار الدفع', 'Awaiting payment'], paid: ['تم الدفع', 'Paid'], payment_failed: ['فشل الدفع', 'Payment failed'], canceled: ['ملغي', 'Canceled'] };
  return labels[status]?.[language === 'ar' ? 0 : 1] || status;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { minHeight: 62, paddingHorizontal: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  refresh: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  stateText: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 16 },
  list: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 14, gap: 10 },
  order: { padding: 15, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  orderTop: { alignItems: 'center', justifyContent: 'space-between' },
  orderId: { color: colors.text, fontSize: 13, fontWeight: '900' },
  orderDate: { color: colors.muted, fontSize: 9, marginTop: 3 },
  status: { minHeight: 32, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  items: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 13 },
  total: { color: colors.primary, fontSize: 17, fontWeight: '900', marginTop: 11 },
});
