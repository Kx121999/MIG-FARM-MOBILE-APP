import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ProductRail } from '@/components/ProductRail';
import { ScreenState } from '@/components/ScreenState';
import { SectionTitle } from '@/components/SectionTitle';
import { categoryPageSections, localizedCategoryName } from '@/constants/categories';
import { spacing } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Product, StoreCategory } from '@/types';

export function CategorySections({
  categoryId,
  products,
  categories,
  bottomPadding,
  onOpenCategory,
}: {
  categoryId: number;
  products: Product[];
  categories: StoreCategory[];
  bottomPadding: number;
  onOpenCategory: (categoryId: number) => void;
}) {
  const { language, t } = useLanguage();
  const sections = categoryPageSections(products, categories, categoryId);
  if (!sections.length) {
    return (
      <ScreenState
        empty
        emptyTitle={language === 'ar' ? 'لا توجد منتجات متاحة حالياً' : 'No products currently available'}
      />
    );
  }
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      {sections.map((section) => (
        <View key={`${section.kind}-${section.category.id}`} style={styles.section}>
          <SectionTitle
            title={section.kind === 'direct'
              ? (language === 'ar' ? 'منتجات مختارة' : 'Featured products')
              : localizedCategoryName(section.category, language)}
            action={section.kind === 'child' ? t('viewAll') : undefined}
            onPress={section.kind === 'child' ? () => onOpenCategory(section.category.id) : undefined}
          />
          <ProductRail products={section.products} categoryId={section.category.id} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  section: { marginBottom: spacing.xl },
});
