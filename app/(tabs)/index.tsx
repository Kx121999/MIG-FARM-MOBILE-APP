import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageBackground, Linking, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageCircle, Search, Truck } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActiveOrderCard } from '@/components/ActiveOrderCard';
import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MotionPressable } from '@/components/Motion';
import { ProductRail } from '@/components/ProductRail';
import { ScreenState } from '@/components/ScreenState';
import { SeasonalGrowingTip } from '@/components/SeasonalGrowingTip';
import { SectionTitle } from '@/components/SectionTitle';
import { StoreDepartmentGrid } from '@/components/StoreDepartmentGrid';
import { CategoryId, localizedCategoryName, storefrontHomeSections } from '@/constants/categories';
import { COMPANY } from '@/constants/company';
import { colors, glow, radius, sizes, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProducts } from '@/hooks/useProducts';
import { HomeContentSection, platformService } from '@/services/platform';

function timeGreeting(hour: number, ar: boolean) {
  if (hour < 12) return ar ? 'صباح الخير' : 'Good morning';
  if (hour < 17) return ar ? 'مساء الخير' : 'Good afternoon';
  return ar ? 'مساء الخير' : 'Good evening';
}

const heroSource = require('../../assets/home-farm.webp');
const HOME_CONTENT_CACHE = 'mig_farm_home_content_v1';

export default function HomeScreen() {
  const { language, isRTL, t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { products, categories, loading, error, reload } = useProducts();
  const { recentProductIds } = useCommerce();
  const [remoteSections, setRemoteSections] = useState<HomeContentSection[]>([]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(HOME_CONTENT_CACHE).then((stored) => {
      if (!active || !stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) setRemoteSections(parsed);
    }).catch(() => undefined);
    platformService.home().then((data) => {
      const sections = data.sections || [];
      if (active) setRemoteSections(sections);
      AsyncStorage.setItem(HOME_CONTENT_CACHE, JSON.stringify(sections)).catch(() => undefined);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const departmentSections = useMemo(
    () => storefrontHomeSections(products, categories, 1),
    [categories, products],
  );
  const featuredSection = useMemo(() => remoteSections.find((section) =>
    section.kind === 'featured' &&
    !section.deepLink?.includes('/my-farm') &&
    section.productIds.length > 0), [remoteSections]);
  const picks = useMemo(() => featuredSection
    ? featuredSection.productIds
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is (typeof products)[number] => Boolean(product))
    : [], [featuredSection, products]);
  const recentlyViewed = useMemo(() => recentProductIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is (typeof products)[number] => Boolean(product))
    .slice(0, 10), [recentProductIds, products]);
  const newArrivals = useMemo(() => [...products]
    .filter((product) => Boolean(product.published_at))
    .sort((a, b) => new Date(b.published_at as string).getTime() - new Date(a.published_at as string).getTime())
    .slice(0, 10), [products]);

  const openCategory = (category: number) => router.push({
    pathname: '/(tabs)/catalog',
    params: { category: String(category) },
  });
  const openStore = () => router.push('/(tabs)/catalog');
  const openWhatsApp = () => Linking.openURL(COMPANY.whatsapp)
    .catch(() => router.push('/support'));
  const quickCategories = useMemo<Array<{ id: CategoryId; label: string }>>(() => [
    { id: 'all', label: language === 'ar' ? 'الكل' : 'All' },
    ...departmentSections.map((section) => ({ id: section.category.id, label: localizedCategoryName(section.category, language) })),
  ], [departmentSections, language]);
  const greetingName = user?.name?.split(' ')[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(104, insets.bottom + 92) }]}
      >
        <View style={styles.page}>
          <Text style={[styles.greeting, { textAlign: isRTL ? 'right' : 'left' }]}>
            {greetingName
              ? `${timeGreeting(new Date().getHours(), language === 'ar')}، ${greetingName}`
              : timeGreeting(new Date().getHours(), language === 'ar')}
          </Text>
          <ActiveOrderCard />
          <ImageBackground
            source={heroSource}
            resizeMode="cover"
            style={[styles.hero, { height: 236 + 64 * (Math.min(1.5, Math.max(1, fontScale)) - 1) }]}
            imageStyle={styles.heroImage}
          >
            <LinearGradient
              style={StyleSheet.absoluteFill}
              colors={['rgba(11, 31, 21, 0.05)', 'rgba(11, 31, 21, 0.55)', 'rgba(9, 26, 18, 0.82)']}
              locations={[0, 0.55, 1]}
            />
            <View style={[styles.heroContent, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
              <Text accessibilityRole="header" style={styles.heroBrand}>MIG FARM</Text>
              <Text style={[styles.heroTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                {language === 'ar' ? 'مستلزمات زراعية مختارة\nلمزرعة أكثر إنتاجًا' : 'Better farm essentials\nfor every growing season'}
              </Text>
              <AppButton label={t('shopNow')} onPress={openStore} secondary arrow style={styles.heroButton} />
            </View>
          </ImageBackground>

          <View style={styles.searchFloat}>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={t('search')}
              style={[styles.search, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              onPress={() => router.push('/(tabs)/search')}
            >
              <Search size={20} color={colors.primary} />
              <Text numberOfLines={1} style={[styles.searchText, { textAlign: isRTL ? 'right' : 'left' }]}>{t('search')}</Text>
            </MotionPressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.quickCategories, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {quickCategories.map((item) => (
              <MotionPressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={styles.quickCategoryItem}
                onPress={() => (item.id === 'all' ? openStore() : openCategory(item.id))}
              >
                <CategoryIcon id={item.id} boxSize={54} size={24} />
                <Text numberOfLines={1} style={styles.quickCategoryText}>{item.label}</Text>
              </MotionPressable>
            ))}
          </ScrollView>

          <View style={[styles.delivery, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Truck size={17} color={colors.primary} />
            <Text style={styles.deliveryText}>{language === 'ar' ? 'توصيل لكل الإمارات' : 'Delivery across the UAE'}</Text>
            <View style={styles.deliveryDivider} />
            <Text style={styles.deliveryText}>{language === 'ar' ? 'كتالوج مباشر من Odoo' : 'Live Odoo catalog'}</Text>
          </View>

          <SeasonalGrowingTip />

          <View style={styles.section}>
            <SectionTitle title={language === 'ar' ? 'أقسام المتجر' : 'Store departments'} />
            <ScreenState loading={loading && !departmentSections.length} error={error} empty={!loading && !error && !departmentSections.length} onRetry={reload} />
            {departmentSections.length ? <StoreDepartmentGrid sections={departmentSections} onOpenCategory={openCategory} /> : null}
          </View>

          {picks.length ? (
            <View style={styles.section}>
              <SectionTitle
                title={language === 'ar' ? featuredSection?.titleAr || 'مختارات MIG FARM' : featuredSection?.titleEn || 'MIG FARM Picks'}
                action={t('viewAll')}
                onPress={featuredSection?.deepLink ? () => router.push(featuredSection.deepLink as never) : openStore}
              />
              <ProductRail products={picks} />
            </View>
          ) : null}

          {recentlyViewed.length ? (
            <View style={styles.section}>
              <SectionTitle
                title={language === 'ar' ? 'شوهد مؤخراً' : 'Recently viewed'}
                action={t('viewAll')}
                onPress={() => router.push('/recently-viewed')}
              />
              <ProductRail products={recentlyViewed} />
            </View>
          ) : null}

          {newArrivals.length ? (
            <View style={styles.section}>
              <SectionTitle title={language === 'ar' ? 'وصل حديثًا' : 'New arrivals'} action={t('viewAll')} onPress={openStore} />
              <ProductRail products={newArrivals} />
            </View>
          ) : null}

          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={language === 'ar' ? 'تواصل مع MIG FARM عبر واتساب' : 'Contact MIG FARM on WhatsApp'}
            onPress={openWhatsApp}
            style={[styles.help, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <View style={styles.helpIcon}><MessageCircle size={24} color="#FFFFFF" /></View>
            <View style={styles.helpCopy}>
              <Text style={[styles.helpTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'تحتاج مساعدة زراعية؟' : 'Need agricultural help?'}</Text>
              <Text style={[styles.helpBody, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'تواصل مع فريق MIG FARM عبر واتساب' : 'Talk to the MIG FARM team on WhatsApp'}</Text>
            </View>
            <Text style={styles.helpAction}>{language === 'ar' ? 'تواصل' : 'Chat'}</Text>
          </MotionPressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { backgroundColor: colors.background },
  page: { width: '100%', maxWidth: sizes.page, alignSelf: 'center' },
  searchFloat: { marginHorizontal: spacing.lg, marginTop: -22, marginBottom: spacing.lg },
  search: { minHeight: sizes.input, paddingHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, alignItems: 'center', gap: spacing.md, ...glow },
  searchText: { ...typography.secondary, color: colors.muted, flex: 1 },
  greeting: { ...typography.section, color: colors.text, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  quickCategories: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  quickCategoryItem: { width: 64, alignItems: 'center', gap: spacing.xs },
  quickCategoryText: { ...typography.caption, color: colors.text, fontWeight: '700', textAlign: 'center' },
  hero: { marginHorizontal: spacing.lg, marginTop: spacing.sm, overflow: 'hidden', borderRadius: radius.xl, backgroundColor: colors.primaryDark },
  heroImage: { borderRadius: radius.xl },
  heroContent: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  heroBrand: { ...typography.display, color: colors.surface, writingDirection: 'ltr' },
  heroTitle: { ...typography.section, color: colors.surface, marginTop: spacing.sm, marginBottom: spacing.lg },
  heroButton: { backgroundColor: colors.surface, minWidth: 136 },
  delivery: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  deliveryText: { ...typography.caption, color: colors.muted, flexShrink: 1, textAlign: 'center' },
  deliveryDivider: { width: 1, height: 16, backgroundColor: colors.borderStrong },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  help: { marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.primaryDark, alignItems: 'center', gap: spacing.md, ...glow },
  helpIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  helpCopy: { flex: 1 },
  helpTitle: { ...typography.section, fontSize: 17, color: '#FFFFFF' },
  helpBody: { ...typography.secondary, color: 'rgba(255,255,255,0.76)', marginTop: spacing.xs },
  helpAction: { ...typography.button, color: colors.sun },
});
