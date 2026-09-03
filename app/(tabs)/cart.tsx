import React from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Trash2,
  Truck,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/ScreenState';
import { colors, radius, shadow } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAED, localizedProductTitle, textDirection } from '@/services/catalog';
import { CartItem } from '@/types';

export default function CartScreen() {
  const { cart, cartCount, subtotal, setQuantity, removeFromCart, clearCart } = useCommerce();
  const { language, isRTL, t } = useLanguage();
  const ForwardIcon = isRTL ? ArrowLeft : ArrowRight;
  const RowIcon = isRTL ? ChevronLeft : ChevronRight;

  const checkout = () => router.push('/checkout');

  const confirmClear = () => Alert.alert(
    t('clearCart'),
    language === 'ar' ? 'متأكد إنك عايز تمسح كل المنتجات؟' : 'Remove all products from your cart?',
    [
      { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
      { text: t('clearCart'), style: 'destructive', onPress: clearCart },
    ],
  );

  const renderItem = ({ item }: { item: CartItem }) => {
    const title = localizedProductTitle(item, language);
    const direction = textDirection(title, language);
    return (
    <View style={[styles.item, shadow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}> 
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.imageButton, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/product/[handle]', params: { handle: item.handle } })}>
        {item.image ? <Image source={{ uri: item.image, cache: 'force-cache' }} style={styles.image} resizeMode="contain" /> : <Sprout size={34} color={colors.leaf} strokeWidth={1.7} />}
      </Pressable>
      <View style={styles.itemCopy}>
        <View style={[styles.itemTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Pressable accessibilityRole="button" style={styles.titleButton} onPress={() => router.push({ pathname: '/product/[handle]', params: { handle: item.handle } })}>
            <Text numberOfLines={2} style={[styles.itemTitle, { textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }]}>{title}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('remove')} hitSlop={8} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]} onPress={() => removeFromCart(item.key)}>
            <Trash2 size={17} color={colors.danger} strokeWidth={2} />
          </Pressable>
        </View>
        {item.variant.title !== 'Default Title' ? <Text style={[styles.variant, { textAlign: isRTL ? 'right' : 'left' }]}>{item.variant.title}</Text> : null}
        <Text style={[styles.unitPrice, { textAlign: isRTL ? 'right' : 'left' }]}>{formatAED(item.variant.price)} / {language === 'ar' ? 'قطعة' : 'item'}</Text>
        <View style={[styles.bottomRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={styles.qtyControl}>
            <Pressable accessibilityRole="button" accessibilityLabel="Decrease quantity" style={({ pressed }) => [styles.qtyButton, pressed && styles.pressed]} onPress={() => setQuantity(item.key, item.quantity - 1)}>
              <Minus size={15} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.qty}>{item.quantity}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" style={({ pressed }) => [styles.qtyButton, pressed && styles.pressed]} onPress={() => setQuantity(item.key, item.quantity + 1)}>
              <Plus size={15} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          </View>
          <Text style={styles.lineTotal}>{formatAED(Number(item.variant.price) * item.quantity)}</Text>
        </View>
      </View>
    </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader compact />
      <View style={styles.page}>
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View>
            <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t('cart')}</Text>
            <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{cartCount} {language === 'ar' ? 'قطعة' : cartCount === 1 ? 'item' : 'items'}</Text>
          </View>
          {!!cart.length && (
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]} onPress={confirmClear}>
              <Trash2 size={15} color={colors.danger} strokeWidth={2} />
              <Text style={styles.clear}>{t('clearCart')}</Text>
            </Pressable>
          )}
        </View>

        {!cart.length ? (
          <View style={styles.empty}>
            <EmptyState icon={ShoppingBag} title={t('emptyCart')} body={t('emptyCartBody')} action={t('continueShopping')} onAction={() => router.push('/(tabs)/catalog')} />
          </View>
        ) : (
          <FlatList
            data={cart}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={<CheckoutSteps language={language} />}
            ListFooterComponent={(
              <View style={styles.summary}>
                <View style={[styles.summaryTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.summaryTitle}>{language === 'ar' ? 'ملخص الطلب' : 'Order summary'}</Text>
                  <PackageCheck size={20} color={colors.primary} strokeWidth={2.1} />
                </View>
                <View style={styles.divider} />
                <View style={[styles.totalRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.totalLabel}>{t('subtotal')}</Text>
                  <Text style={styles.total}>{formatAED(subtotal)}</Text>
                </View>
                <View style={[styles.summaryLine, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.summaryLineLabel}>{language === 'ar' ? 'الشحن والخصومات' : 'Shipping and discounts'}</Text>
                  <Text style={styles.summaryLineValue}>{language === 'ar' ? 'عند الدفع' : 'At checkout'}</Text>
                </View>
                <Pressable accessibilityRole="button" style={({ pressed }) => [styles.checkout, pressed && styles.primaryPressed]} onPress={checkout}>
                  <LockKeyhole size={18} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.checkoutText}>{t('checkout')}</Text>
                  <ForwardIcon size={17} color="#FFFFFF" strokeWidth={2.5} />
                </Pressable>
                <View style={[styles.secureRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <ShieldCheck size={14} color={colors.success} strokeWidth={2.2} />
                  <Text style={styles.secureText}>{language === 'ar' ? 'دفع آمن ومشفّر داخل التطبيق' : 'Secure encrypted in-app payment'}</Text>
                </View>
                <Pressable accessibilityRole="button" style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/catalog')}>
                  <Text style={styles.continueText}>{language === 'ar' ? 'إضافة منتجات أخرى' : 'Add more products'}</Text>
                  <RowIcon size={16} color={colors.primary} strokeWidth={2.3} />
                </Pressable>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function CheckoutSteps({ language }: { language: 'ar' | 'en' }) {
  return (
    <View style={styles.steps}>
      <View style={styles.stepActive}><CheckCircle2 size={16} color="#FFFFFF" /><Text style={styles.stepActiveText}>{language === 'ar' ? 'السلة' : 'Cart'}</Text></View>
      <View style={styles.stepLine} />
      <View style={styles.step}><Truck size={16} color={colors.textSubtle} /><Text style={styles.stepText}>{language === 'ar' ? 'التوصيل' : 'Delivery'}</Text></View>
      <View style={styles.stepLine} />
      <View style={styles.step}><LockKeyhole size={16} color={colors.textSubtle} /><Text style={styles.stepText}>{language === 'ar' ? 'الدفع' : 'Payment'}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 11, alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 27, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  clearButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: '#F0D4D1', backgroundColor: '#FFF7F6', flexDirection: 'row', alignItems: 'center', gap: 6 },
  clear: { color: colors.danger, fontSize: 11, fontWeight: '900' },
  list: { paddingHorizontal: 14, paddingBottom: 28, gap: 10 },
  steps: { minHeight: 58, marginBottom: 4, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepActive: { height: 34, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepActiveText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  step: { alignItems: 'center', gap: 3 },
  stepText: { color: colors.textSubtle, fontSize: 8, fontWeight: '800' },
  stepLine: { width: 28, height: 1, marginHorizontal: 6, backgroundColor: colors.borderStrong },
  item: { backgroundColor: colors.surface, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: 11 },
  imageButton: { width: 92, height: 106, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  itemCopy: { flex: 1, minHeight: 106 },
  itemTop: { alignItems: 'flex-start', gap: 5 },
  titleButton: { flex: 1 },
  itemTitle: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  removeButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF7F6', alignItems: 'center', justifyContent: 'center' },
  variant: { color: colors.muted, fontSize: 10, marginTop: 2 },
  unitPrice: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  bottomRow: { marginTop: 'auto', alignItems: 'center', justifyContent: 'space-between' },
  qtyControl: { flexDirection: 'row', height: 34, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden', alignItems: 'center' },
  qtyButton: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
  qty: { width: 28, textAlign: 'center', color: colors.text, fontSize: 12, fontWeight: '900' },
  lineTotal: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  summary: { marginTop: 4, padding: 16, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  summaryTitleRow: { alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 13 },
  totalRow: { alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  total: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  summaryLine: { alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  summaryLineLabel: { color: colors.muted, fontSize: 10 },
  summaryLineValue: { color: colors.text, fontSize: 10, fontWeight: '800' },
  checkout: { height: 52, marginTop: 15, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  checkoutText: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  secureRow: { marginTop: 10, alignItems: 'center', justifyContent: 'center', gap: 5 },
  secureText: { color: colors.muted, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  continueButton: { height: 42, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  continueText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  empty: { flex: 1, justifyContent: 'center' },
  pressed: { opacity: 0.68 },
  primaryPressed: { opacity: 0.82 },
});
