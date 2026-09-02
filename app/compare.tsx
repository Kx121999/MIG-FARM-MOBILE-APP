import React, { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, GitCompareArrows, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAED, localizedProductTitle, localizedProductType, productAvailable, productImage, productPrice, textDirection } from '@/services/catalog';
import { useProducts } from '@/hooks/useProducts';
import { Product } from '@/types';

export default function CompareScreen() {
  const { compareIds, toggleCompare, clearCompare } = useCommerce();
  const { language, isRTL } = useLanguage();
  const { products, loading } = useProducts();
  const selected = useMemo(() => compareIds.map((id) => products.find((item) => item.id === id)).filter((item): item is Product => Boolean(item)), [compareIds, products]);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}><BackIcon size={21} color={colors.primaryDark} /></Pressable>
        <Text style={styles.title}>{language === 'ar' ? 'مقارنة المنتجات' : 'Compare products'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear comparison" onPress={clearCompare} style={styles.iconButton}><X size={19} color={colors.danger} /></Pressable>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : !selected.length ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}><GitCompareArrows size={36} color={colors.primary} /></View>
          <Text style={styles.emptyTitle}>{language === 'ar' ? 'اختار منتجات للمقارنة' : 'Choose products to compare'}</Text>
          <Text style={styles.emptyBody}>{language === 'ar' ? 'اضغط أيقونة المقارنة على المنتجات، ويمكنك اختيار 3 منتجات.' : 'Tap the compare icon on products. You can select up to 3.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/catalog')} style={styles.primaryButton}><Text style={styles.primaryText}>{language === 'ar' ? 'استكشف المنتجات' : 'Browse products'}</Text></Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={[styles.intro, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'قارن السعر والتوفر والمواصفات بسرعة.' : 'Compare price, availability and key details at a glance.'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columns}>
            {selected.map((product) => {
              const productTitle = localizedProductTitle(product, language);
              const direction = textDirection(productTitle, language);
              return (
              <View style={styles.column} key={product.id}>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/product/[handle]', params: { handle: product.handle } })} style={styles.imageWrap}>
                  {productImage(product) ? <Image source={{ uri: productImage(product) || undefined }} style={styles.image} resizeMode="contain" /> : null}
                </Pressable>
                <View style={styles.columnBody}>
                  <Text numberOfLines={3} style={[styles.productTitle, { textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }]}>{productTitle}</Text>
                  <Text style={styles.price}>{formatAED(productPrice(product))}</Text>
                  <CompareRow label={language === 'ar' ? 'التوفر' : 'Availability'} value={productAvailable(product) ? (language === 'ar' ? 'متوفر' : 'Available') : (language === 'ar' ? 'غير متوفر' : 'Unavailable')} available={productAvailable(product)} />
                  <CompareRow label={language === 'ar' ? 'الماركة' : 'Brand'} value={product.vendor || 'MIG FARM'} />
                  <CompareRow label={language === 'ar' ? 'القسم' : 'Category'} value={localizedProductType(product, language) || '-'} />
                  <Pressable accessibilityRole="button" accessibilityLabel={language === 'ar' ? 'إزالة من المقارنة' : 'Remove from comparison'} onPress={() => toggleCompare(product.id)} style={styles.removeButton}><X size={14} color={colors.danger} /><Text style={styles.removeText}>{language === 'ar' ? 'إزالة' : 'Remove'}</Text></Pressable>
                </View>
              </View>
              );
            })}
          </ScrollView>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CompareRow({ label, value, available }: { label: string; value: string; available?: boolean }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><View style={styles.rowValue}>{available ? <Check size={13} color={colors.success} /> : null}<Text style={[styles.rowText, available === false && styles.unavailable]}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { minHeight: 62, paddingHorizontal: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 16 },
  emptyBody: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', maxWidth: 300, marginTop: 7 },
  primaryButton: { height: 48, marginTop: 19, paddingHorizontal: 21, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  content: { padding: 14, paddingBottom: 28 },
  intro: { color: colors.muted, fontSize: 12, lineHeight: 19, marginBottom: 13 },
  columns: { gap: 10, alignItems: 'flex-start' },
  column: { width: 210, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  imageWrap: { height: 156, margin: 9, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  columnBody: { padding: 11, paddingTop: 0 },
  productTitle: { minHeight: 55, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  price: { color: colors.primary, fontSize: 18, fontWeight: '900', marginTop: 7 },
  row: { minHeight: 49, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8, justifyContent: 'center' },
  rowLabel: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rowText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  unavailable: { color: colors.danger },
  removeButton: { height: 38, marginTop: 8, borderRadius: radius.md, backgroundColor: '#FFF6F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  removeText: { color: colors.danger, fontSize: 10, fontWeight: '900' },
});
