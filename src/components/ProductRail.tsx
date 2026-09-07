import React, { useCallback } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ProductCard } from '@/components/ProductCard';
import { sizes, spacing } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { Product } from '@/types';

function RailSeparator() {
  return <View style={styles.separator} />;
}

export function ProductRail({ products }: { products: Product[] }) {
  const { isRTL } = useLanguage();
  const { width } = useWindowDimensions();
  const railWidth = Math.min(width, sizes.page) - spacing.lg * 2;
  const cardWidth = Math.max(136, Math.min(180, (railWidth - spacing.md) / 2));
  const renderItem = useCallback(({ item }: { item: Product }) => <ProductCard product={item} wide cardWidth={cardWidth} />, [cardWidth]);
  return <FlatList horizontal inverted={isRTL} data={products} keyExtractor={(item) => String(item.id)} renderItem={renderItem}
    showsHorizontalScrollIndicator={false} initialNumToRender={3} maxToRenderPerBatch={3} windowSize={3}
    ItemSeparatorComponent={RailSeparator} snapToInterval={cardWidth + spacing.md} decelerationRate="fast"
    style={styles.list} contentContainerStyle={styles.content} />;
}
const styles = StyleSheet.create({ list: { flexGrow: 0 }, content: { paddingBottom: 4 }, separator: { width: spacing.md } });
