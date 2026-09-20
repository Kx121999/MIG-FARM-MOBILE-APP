import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ProductCardSkeleton } from '@/components/ProductCard';
import { ProductRail } from '@/components/ProductRail';
import { ScreenState } from '@/components/ScreenState';
import { SectionTitle } from '@/components/SectionTitle';
import type { StorefrontSection } from '@/constants/categories';
import { colors, spacing } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizedCategoryName } from '@/constants/categories';
import { StoreDepartmentGrid } from '@/components/StoreDepartmentGrid';

function SectionSkeleton() {
  return (
    <View style={styles.section}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonRail}>
        <ProductCardSkeleton wide />
        <ProductCardSkeleton wide />
      </View>
    </View>
  );
}

export function StorefrontHome({
  sections,
  loading,
  error,
  onRetry,
  onOpenCategory,
  bottomPadding = 96,
}: {
  sections: StorefrontSection[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenCategory: (categoryId: number) => void;
  bottomPadding?: number;
}) {
  const { language, t } = useLanguage();
  if (loading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {Array.from({ length: 4 }).map((_, index) => <SectionSkeleton key={index} />)}
      </ScrollView>
    );
  }
  if (error || !sections.length) {
    return (
      <ScreenState
        error={error}
        empty={!error}
        onRetry={onRetry}
        emptyTitle={language === 'ar' ? 'لا توجد أقسام متاحة حالياً' : 'No store sections are available'}
      />
    );
  }
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.departments}>
        <SectionTitle title={language === 'ar' ? 'أقسام المتجر' : 'Store departments'} />
        <StoreDepartmentGrid sections={sections} onOpenCategory={onOpenCategory} />
      </View>
      {sections.filter((section) => section.products.length > 0).map((section) => (
        <View key={section.category.id} style={styles.section}>
          <SectionTitle
            title={localizedCategoryName(section.category, language)}
            action={t('viewAll')}
            onPress={() => onOpenCategory(section.category.id)}
          />
          <ProductRail products={section.products} categoryId={section.category.id} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  departments: { marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  skeletonTitle: { width: 150, height: 20, borderRadius: 4, backgroundColor: colors.surfaceMuted, marginBottom: spacing.md },
  skeletonRail: { flexDirection: 'row', gap: spacing.md, overflow: 'hidden' },
});
