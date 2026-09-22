import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageBackground, Linking, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageCircle, Search, Truck } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { MotionPressable } from '@/components/Motion';
import { ProductRail } from '@/components/ProductRail';
import { ScreenState } from '@/components/ScreenState';
import { SectionTitle } from '@/components/SectionTitle';
import { StoreDepartmentGrid } from '@/components/StoreDepartmentGrid';
import { storefrontHomeSections } from '@/constants/categories';
import { COMPANY } from '@/constants/company';
import { colors, glow, radius, sizes, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProducts } from '@/hooks/useProducts';
import { HomeContentSection, platformService } from '@/services/platform';

const heroSource = require('../../assets/home-farm.webp');
const HOME_CONTENT_CACHE = 'mig_farm_home_content_v1';

export default function HomeScreen() {
  const { language, isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { products, categories, loading, error, reload } = useProducts();
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

  const openCategory = (category: number) => router.push({
    pathname: '/(tabs)/catalog',
    params: { category: String(category) },
  });
  const openStore = () => router.push('/(tabs)/catalog');
  const openWhatsApp = () => Linking.openURL(COMPANY.whatsapp)
    .catch(() => router.push('/support'));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(104, insets.bottom + 92) }]}
      >
        <View style={styles.page}>
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

          <View style={[styles.delivery, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Truck size={17} color={colors.primary} />
            <Text style={styles.deliveryText}>{language === 'ar' ? 'توصيل لكل الإمارات' : 'Delivery across the UAE'}</Text>
            <View style={styles.deliveryDivider} />
            <Text style={styles.deliveryText}>{language === 'ar' ? 'كتالوج مباشر من Odoo' : 'Live Odoo catalog'}</Text>
          </View>

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
  help: { marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.primaryDark, alignItems: 'center', gap: spacing.md },
  helpIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  helpCopy: { flex: 1 },
  helpTitle: { ...typography.section, fontSize: 17, color: '#FFFFFF' },
  helpBody: { ...typography.secondary, color: 'rgba(255,255,255,0.76)', marginTop: spacing.xs },
  helpAction: { ...typography.button, color: colors.sun },
});
