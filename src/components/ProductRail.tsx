import React from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { ProductCard } from '@/components/ProductCard';
import { sizes, spacing } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { Product } from '@/types';

export function ProductRail({ products, categoryId }: { products: Product[]; categoryId?: number }) {
  const { isRTL } = useLanguage();
  const { width } = useWindowDimensions();
  const railWidth = Math.min(width, sizes.page) - spacing.lg * 2;
  const cardWidth = Math.max(136, Math.min(180, (railWidth - spacing.md) / 2));
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + spacing.md}
      decelerationRate="fast"
      style={[styles.list, { direction: isRTL ? 'rtl' : 'ltr' }]}
      contentContainerStyle={styles.content}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          wide
          cardWidth={cardWidth}
          categoryId={categoryId}
        />
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  list: { flexGrow: 0, flexShrink: 0 },
  content: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    paddingBottom: spacing.xs,
    paddingStart: spacing.xs,
    paddingEnd: spacing.xs,
  },
});
