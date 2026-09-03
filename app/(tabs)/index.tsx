import React, { useMemo } from 'react';
import { FlatList, ImageBackground, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, MessageCircle, Search, Truck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { CategoryCard } from '@/components/CategoryCard';
import { ProductRail } from '@/components/ProductRail';
import { ScreenState } from '@/components/ScreenState';
import { SectionTitle } from '@/components/SectionTitle';
import { MotionPressable } from '@/components/Motion';
import { categories, CategoryId } from '@/constants/categories';
import { colors, sizes, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProducts } from '@/hooks/useProducts';
import { useCommerce } from '@/contexts/CommerceContext';
import { sortProducts } from '@/services/catalog';
import { Product } from '@/types';
import { useRetention } from '@/contexts/RetentionContext';
import { useAuth } from '@/contexts/AuthContext';
import { categories as discoveryCategories, productMatchesCategory } from '@/constants/categories';

const heroSource = require('../../assets/home-farm.webp');
const homeCategories = categories.filter((item) => item.id !== 'all');

export default function HomeScreen() {
  const { language, isRTL, t } = useLanguage();
  const { fontScale } = useWindowDimensions();
  const { products, loading, error, reload } = useProducts();
  const { recentProductIds } = useCommerce();
  const { personalization } = useRetention();
  const { user } = useAuth();
  const arrivals = useMemo(() => sortProducts(products, 'newest').slice(0, 6), [products]);
  const selected = useMemo(() => products.filter((product) => !arrivals.some((item) => item.id === product.id)).slice(0, 6), [products, arrivals]);
  const recent = useMemo(() => recentProductIds.map((id) => products.find((item) => item.id === id)).filter((item): item is Product => Boolean(item)).slice(0, 4), [products, recentProductIds]);
  const personalized = useMemo(() => {
    if (!personalization || !recent.length) return [];
    const category = discoveryCategories.find(item => item.id !== 'all' && productMatchesCategory(recent[0],item.id));
    return category ? products.filter(item => !recentProductIds.includes(item.id) && productMatchesCategory(item,category.id)).slice(0,4) : [];
  }, [personalization,recent,products,recentProductIds]);
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const openCategory = (category: CategoryId) => router.push({ pathname: '/(tabs)/catalog', params: { category } });
  const openStore = () => router.push('/(tabs)/catalog');

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <AppHeader />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.page}>
        {user ? <Text style={[styles.deliveryText,{textAlign:isRTL?'right':'left',paddingHorizontal:16,paddingTop:8}]}>{language==='ar'?`مرحباً، ${user.name.split(' ')[0]}`:`Hello, ${user.name.split(' ')[0]}`}</Text> : null}
        <MotionPressable accessibilityRole="button" accessibilityLabel={t('search')} style={[styles.search, { flexDirection: isRTL ? 'row-reverse' : 'row' }]} onPress={() => router.push('/(tabs)/search')}>
          <Search size={20} color={colors.muted} /><Text numberOfLines={1} style={[styles.searchText, { textAlign: isRTL ? 'right' : 'left' }]}>{t('search')}</Text>
        </MotionPressable>
        <ImageBackground source={heroSource} resizeMode="cover" style={[styles.hero, { height: 260 + 140 * (Math.min(1.6, Math.max(1, fontScale)) - 1) }]}>
          <View style={[styles.heroContent, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={styles.heroBrand}>MIG FARM</Text>
            <Text maxFontSizeMultiplier={1.4} style={[styles.heroTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'كل احتياجات زراعتك\nفي مكان واحد' : 'Everything you need\nto grow, in one place'}</Text>
            <AppButton label={t('shopNow')} onPress={openStore} secondary arrow style={styles.heroButton} />
          </View>
        </ImageBackground>
        <View style={[styles.delivery, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Truck size={17} color={colors.primary} /><Text style={styles.deliveryText}>{language === 'ar' ? 'توصيل داخل الإمارات' : 'Delivery across the UAE'}</Text>
          <View style={styles.deliveryDivider} /><Text style={styles.deliveryText}>{language === 'ar' ? 'منتجات زراعية مختارة' : 'Selected growing essentials'}</Text>
        </View>
        <View style={styles.section}>
          <SectionTitle title={t('categories')} action={t('viewAll')} onPress={openStore} />
          <FlatList horizontal inverted={isRTL} data={homeCategories} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false}
            style={styles.categoryRail} contentContainerStyle={styles.categories} initialNumToRender={4}
            renderItem={({ item }) => <CategoryCard id={item.id} onPress={() => openCategory(item.id)} />} />
        </View>
        <View style={styles.section}>
          <SectionTitle title={t('featured')} action={t('viewAll')} onPress={openStore} />
          <ScreenState loading={loading && !arrivals.length} error={error} empty={!loading && !error && !arrivals.length} onRetry={reload} />
          {arrivals.length ? <ProductRail products={arrivals} /> : null}
        </View>
        {selected.length ? <View style={styles.section}>
          <SectionTitle title={personalized.length?(language==='ar'?'قد يعجبك':'You may like'):(language === 'ar' ? 'مختارات ميغ فارم' : 'MIG FARM selection')} action={t('viewAll')} onPress={openStore} />
          <ProductRail products={personalized.length?personalized:selected} />
        </View> : null}
        <MotionPressable accessibilityRole="button" accessibilityLabel={language === 'ar' ? 'مساعد ميغ فارم' : 'MIG FARM assistant'} onPress={() => router.push('/(tabs)/assistant')}
          style={[styles.assistant, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <MessageCircle size={24} color={colors.primary} strokeWidth={1.6} />
          <View style={styles.assistantCopy}>
            <Text style={[styles.assistantTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'مساعد ميغ فارم' : 'MIG FARM assistant'}</Text>
            <Text style={[styles.assistantBody, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'اسأل عن المنتج أو الاستخدام المناسب' : 'Ask about products or how to use them'}</Text>
          </View>
          <Arrow size={20} color={colors.primary} />
        </MotionPressable>
        {recent.length ? <View style={styles.section}><SectionTitle title={t('recentlyViewed')} /><ProductRail products={recent} /></View> : null}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { backgroundColor: colors.background, paddingBottom: spacing.xl },
  page: { width: '100%', maxWidth: sizes.page, alignSelf: 'center' },
  search: { minHeight: sizes.input, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg, paddingHorizontal: spacing.lg, backgroundColor: colors.surfaceMuted, borderRadius: 8, alignItems: 'center', gap: spacing.md },
  searchText: { ...typography.secondary, color: colors.muted, flex: 1 },
  hero: { height: 260, overflow: 'hidden', backgroundColor: colors.primaryDark },
  heroContent: { flex: 1, padding: spacing.xl, backgroundColor: 'rgba(18, 30, 19, 0.32)', justifyContent: 'center' },
  heroBrand: { ...typography.display, color: colors.surface, writingDirection: 'ltr' },
  heroTitle: { ...typography.section, color: colors.surface, marginTop: spacing.sm, marginBottom: spacing.lg },
  heroButton: { backgroundColor: colors.surface, minWidth: 136 },
  delivery: { paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  deliveryText: { ...typography.caption, color: colors.muted, flexShrink: 1, textAlign: 'center' },
  deliveryDivider: { width: 1, height: 16, backgroundColor: colors.borderStrong },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  categoryRail: { flexGrow: 0 },
  categories: { gap: spacing.md },
  assistant: { marginHorizontal: spacing.lg, marginTop: spacing.xl, paddingVertical: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center', gap: spacing.md },
  assistantCopy: { flex: 1, gap: spacing.xs },
  assistantTitle: { ...typography.section, fontSize: 17, color: colors.text },
  assistantBody: { ...typography.secondary, color: colors.muted },
});
