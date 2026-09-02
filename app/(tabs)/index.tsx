import React, { useMemo, useRef } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Headphones,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { CategoryCard } from '@/components/CategoryCard';
import { ProductCard } from '@/components/ProductCard';
import { ScreenState } from '@/components/ScreenState';
import { SectionTitle } from '@/components/SectionTitle';
import { CategoryId } from '@/constants/categories';
import { colors, radius, spacing } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProducts } from '@/hooks/useProducts';
import { useCommerce } from '@/contexts/CommerceContext';

const heroSource = require('../../assets/home-hero-farm-2027.png');
const homeCategoryIds: CategoryId[] = ['seeds', 'greenhouses', 'fertilizers', 'irrigation', 'tools'];

export default function HomeScreen() {
  const { language, isRTL, t } = useLanguage();
  const { products, loading, error, reload } = useProducts();
  const { recentProductIds } = useCommerce();
  const featured = products.slice(0, 10);
  const recent = useMemo(() => recentProductIds.map((id) => products.find((item) => item.id === id)).filter(Boolean).slice(0, 6), [products, recentProductIds]);
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const categoryListRef = useRef<ScrollView>(null);
  const productListRef = useRef<ScrollView>(null);
  const recentListRef = useRef<ScrollView>(null);
  const openCategory = (category: CategoryId) => router.push({ pathname: '/(tabs)/catalog', params: { category } });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.shippingBand}>
          <Truck size={14} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.shippingText}>{t('freeShipping')}</Text>
          <Text style={styles.uae}>UAE</Text>
        </View>

        <View style={styles.page}>
          <View style={[styles.searchRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.searchBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/catalog')}
            >
              <Search size={20} color={colors.primary} strokeWidth={2.2} />
              <Text numberOfLines={1} style={[styles.searchText, { textAlign: isRTL ? 'right' : 'left' }]}>{t('search')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Filters" style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/catalog')}>
              <SlidersHorizontal size={20} color={colors.primaryDark} strokeWidth={2.1} />
            </Pressable>
          </View>

          <ImageBackground source={heroSource} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover">
            <View style={styles.heroOverlay}>
              <View style={[styles.heroCopy, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <View style={[styles.eyebrow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <MapPin size={13} color={colors.sun} fill={colors.sun} />
                  <Text style={styles.eyebrowText}>MIG FARM · UAE</Text>
                </View>
                <Text style={[styles.heroTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('welcome')}</Text>
                <Text style={[styles.heroBody, { textAlign: isRTL ? 'right' : 'left' }]}>{t('heroBody')}</Text>
                <View style={[styles.heroActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.darkPressed]} onPress={() => router.push('/(tabs)/catalog')}>
                    <Text style={styles.primaryButtonText}>{t('shopNow')}</Text>
                    <Arrow size={16} color={colors.primaryDark} strokeWidth={2.5} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('askEngineer')} style={({ pressed }) => [styles.aiButton, pressed && styles.darkPressed]} onPress={() => router.push('/(tabs)/assistant')}>
                    <Sparkles size={18} color="#FFFFFF" strokeWidth={2.2} />
                  </Pressable>
                </View>
              </View>
            </View>
          </ImageBackground>

          <View style={styles.serviceRow}>
            <ServiceItem icon={Truck} title={language === 'ar' ? 'توصيل الإمارات' : 'UAE delivery'} />
            <ServiceItem icon={ShieldCheck} title={language === 'ar' ? 'منتجات موثوقة' : 'Trusted products'} />
            <ServiceItem icon={Headphones} title={language === 'ar' ? 'دعم زراعي' : 'Growing support'} />
          </View>

          <SectionTitle title={t('categories')} action={t('viewAll')} onPress={() => router.push('/(tabs)/catalog')} />
          <ScrollView
            ref={categoryListRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() => isRTL && categoryListRef.current?.scrollToEnd({ animated: false })}
            contentContainerStyle={[styles.categoryList, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            {homeCategoryIds.map((id) => <CategoryCard key={id} id={id} onPress={() => openCategory(id)} />)}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.aiBand, { flexDirection: isRTL ? 'row-reverse' : 'row' }, pressed && styles.tilePressed]}
            onPress={() => router.push('/(tabs)/assistant')}
          >
            <Text numberOfLines={2} style={[styles.aiTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'مش عارف تختار؟ اسأل مهندس MIG FARM' : 'Not sure what to choose? Ask a MIG FARM engineer'}</Text>
            <Arrow size={20} color={colors.primary} strokeWidth={2.2} />
          </Pressable>

          <SectionTitle title={t('featured')} action={t('viewAll')} onPress={() => router.push('/(tabs)/catalog')} />
          <ScreenState loading={loading} error={error} empty={!loading && !error && !featured.length} onRetry={reload} />
          {featured.length ? (
            <ScrollView
              ref={productListRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onContentSizeChange={() => isRTL && productListRef.current?.scrollToEnd({ animated: false })}
              contentContainerStyle={[styles.horizontalProducts, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              {featured.map((product) => <ProductCard key={product.id} product={product} wide />)}
            </ScrollView>
          ) : null}

          {recent.length ? (
            <View style={styles.recentSection}>
              <SectionTitle title={t('recentlyViewed')} action={t('viewAll')} onPress={() => router.push('/(tabs)/catalog')} />
              <ScrollView
                ref={recentListRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={() => isRTL && recentListRef.current?.scrollToEnd({ animated: false })}
                contentContainerStyle={[styles.horizontalProducts, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                {recent.map((product) => <ProductCard key={product!.id} product={product!} wide />)}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceItem({ icon: Icon, title }: { icon: typeof Truck; title: string }) {
  return (
    <View style={styles.serviceItem}>
      <Icon size={18} color={colors.primary} strokeWidth={2.1} />
      <Text numberOfLines={2} style={styles.serviceText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xxl, backgroundColor: colors.background },
  shippingBand: { height: 30, backgroundColor: colors.primaryDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  shippingText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  uae: { color: colors.sun, fontSize: 10, fontWeight: '900' },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.lg },
  searchRow: { alignItems: 'center', gap: 9, marginTop: spacing.sm, marginBottom: spacing.md },
  searchBar: { flex: 1, height: 50, alignItems: 'center', gap: 9, paddingHorizontal: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  searchText: { flex: 1, color: colors.muted, fontSize: 13 },
  filterButton: { width: 50, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
  hero: { height: 236, overflow: 'hidden', borderRadius: radius.xl, backgroundColor: colors.primaryDark },
  heroImage: { borderRadius: radius.xl },
  heroOverlay: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: 'rgba(3, 34, 20, 0.48)' },
  heroCopy: { width: '78%', maxWidth: 410 },
  eyebrow: { alignItems: 'center', gap: 5, marginBottom: 10 },
  eyebrowText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  heroTitle: { color: '#FFFFFF', fontSize: 29, lineHeight: 37, fontWeight: '900' },
  heroBody: { color: '#E8F2EB', fontSize: 13, lineHeight: 20, marginTop: 8 },
  heroActions: { alignItems: 'center', gap: 8, marginTop: 18 },
  primaryButton: { minWidth: 128, height: 44, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.sun, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  aiButton: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  darkPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  serviceRow: { minHeight: 66, flexDirection: 'row', alignItems: 'stretch', marginVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  serviceItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 5, paddingVertical: 12 },
  serviceText: { color: colors.text, fontSize: 10, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  categoryList: { gap: 10, paddingBottom: 22 },
  tilePressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  aiBand: { minHeight: 58, alignItems: 'center', gap: 10, marginBottom: 18, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  aiTitle: { flex: 1, color: colors.primaryDark, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  horizontalProducts: { paddingBottom: 8 },
  recentSection: { marginTop: 16 },
});
