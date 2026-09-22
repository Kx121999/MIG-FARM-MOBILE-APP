import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CategoryCard } from '@/components/CategoryCard';
import { ProductRail } from '@/components/ProductRail';
import { ScreenState } from '@/components/ScreenState';
import { SectionTitle } from '@/components/SectionTitle';
import { categoryPageSections } from '@/constants/categories';
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
  const { language } = useLanguage();
  const sections = categoryPageSections(products, categories, categoryId);
  if (!sections.length) {
    return (
      <ScreenState
        empty
        emptyTitle={language === 'ar' ? 'لا توجد منتجات متاحة حالياً' : 'No products currently available'}
      />
    );
  }
  const childSections = sections.filter((section) => section.kind === 'child');
  const directSections = sections.filter((section) => section.kind === 'direct');
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      {childSections.length ? (
        <View style={styles.grid}>
          {childSections.map((section) => (
            <CategoryCard
              key={`${section.kind}-${section.category.id}`}
              category={section.category}
              image={section.category.image}
              onPress={() => onOpenCategory(section.category.id)}
            />
          ))}
        </View>
      ) : null}
      {directSections.map((section) => (
        <View key={`${section.kind}-${section.category.id}`} style={styles.section}>
          <SectionTitle
            title={language === 'ar' ? 'منتجات القسم المباشرة' : 'Other / Direct products'}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl, overflow: 'visible' },
});
