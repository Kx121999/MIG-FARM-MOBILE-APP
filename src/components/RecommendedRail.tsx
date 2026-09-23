import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ProductRail } from '@/components/ProductRail';
import { SectionTitle } from '@/components/SectionTitle';
import { spacing } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { relatedProducts } from '@/services/productExperience';
import type { Product, StoreCategory } from '@/types';

export function RecommendedRail({
  products,
  categories,
  recentProductIds,
  excludeIds = [],
}: {
  products: Product[];
  categories: StoreCategory[];
  recentProductIds: number[];
  excludeIds?: number[];
}) {
  const { language } = useLanguage();
  const recommended = useMemo(() => {
    const seed = recentProductIds
      .map((id) => products.find((product) => product.id === id))
      .find((product): product is Product => Boolean(product));
    if (!seed) return [];
    const excluded = new Set(excludeIds);
    return relatedProducts(seed, products, categories, undefined, 10).filter((product) => !excluded.has(product.id));
  }, [categories, excludeIds, products, recentProductIds]);

  if (!recommended.length) return null;

  return (
    <View style={styles.section}>
      <SectionTitle title={language === 'ar' ? 'مقترح لك' : 'Recommended for you'} />
      <ProductRail products={recommended} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
});
