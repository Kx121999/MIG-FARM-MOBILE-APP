import React, { useCallback } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { ProductCard } from '@/components/ProductCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { Product } from '@/types';

export function ProductRail({ products }: { products: Product[] }) {
  const { isRTL } = useLanguage();
  const renderItem = useCallback(({ item }: { item: Product }) => <ProductCard product={item} wide />, []);
  return <FlatList horizontal inverted={isRTL} data={products} keyExtractor={(item) => String(item.id)} renderItem={renderItem}
    showsHorizontalScrollIndicator={false} initialNumToRender={3} maxToRenderPerBatch={3} windowSize={3}
    style={styles.list} contentContainerStyle={styles.content} />;
}
const styles = StyleSheet.create({ list: { flexGrow: 0 }, content: { paddingBottom: 4 } });
