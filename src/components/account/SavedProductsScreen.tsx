import React, { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { MotionPressable } from '@/components/Motion';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState, ScreenState } from '@/components/ScreenState';
import { useProducts } from '@/hooks/useProducts';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AccountHeaderBar, ConfirmSheet, ui } from './AccountUI';
import type { Product } from '@/types';

export function SavedProductsScreen({ recent = false }: { recent?: boolean }) {
  const { products, loading, error, reload } = useProducts();
  const { favorites, recentProductIds, clearRecentProducts, hydrated, favoritesError, favoritesLoading, retryFavorites } =
    useCommerce();
  const { isRTL: ar } = useLanguage();
  const [limit, setLimit] = useState(16),
    [clear, setClear] = useState(false);
  const ids = recent ? recentProductIds : favorites;
  const selected = useMemo(
    () =>
      ids
        .map((id) => products.find((item) => item.id === id))
        .filter((item): item is Product => !!item),
    [ids, products],
  );
  const title = recent
    ? ar
      ? 'شوهد مؤخراً'
      : 'Recently viewed'
    : ar
      ? 'المفضلة'
      : 'Favorites';
  return (
    <SafeAreaView style={ui.safe} edges={['top', 'bottom']}>
      <AppHeader compact />
      <AccountHeaderBar
        title={title}
        right={
          recent && ids.length ? (
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={ar ? 'مسح السجل' : 'Clear history'}
              style={ui.glassIcon}
              onPress={() => setClear(true)}
            >
              <Trash2 size={18} color="#FFFFFF" />
            </MotionPressable>
          ) : undefined
        }
      />
      {loading || !hydrated || (!recent && favoritesLoading) ? (
        <View style={{ padding: 16 }}>
          <ScreenState loading />
        </View>
      ) : !recent && favoritesError ? (
        <ScreenState error={favoritesError} onRetry={retryFavorites} />
      ) : error ? (
        <ScreenState error={error} onRetry={reload} />
      ) : !selected.length ? (
        <EmptyState
          title={
            recent
              ? ar
                ? 'لم تشاهد منتجات بعد'
                : 'No recently viewed products'
              : ar
                ? 'ما عندك منتجات محفوظة بعد'
                : 'No favorites yet'
          }
          body={
            recent
              ? undefined
              : ar
                ? 'احفظ المنتجات اللي تعجبك علشان ترجع لها بسهولة.'
                : 'Save products you like to find them easily later.'
          }
          action={ar ? 'استكشف المنتجات' : 'Explore products'}
          onAction={() => router.push('/(tabs)/catalog')}
        />
      ) : (
        <FlatList
          data={selected.slice(0, limit)}
          numColumns={2}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            padding: 16,
            width: '100%',
            maxWidth: 680,
            alignSelf: 'center',
          }}
          columnWrapperStyle={{
            justifyContent: 'space-between',
            flexDirection: ar ? 'row-reverse' : 'row',
          }}
          renderItem={({ item }) => <ProductCard product={item} />}
          initialNumToRender={6}
          windowSize={5}
          maxToRenderPerBatch={6}
          onEndReached={() => setLimit((value) => value + 16)}
          onEndReachedThreshold={0.4}
        />
      )}
      <ConfirmSheet
        visible={clear}
        title={ar ? 'مسح السجل' : 'Clear history'}
        body={
          ar
            ? 'سيتم مسح المنتجات المشاهدة من هذا الجهاز.'
            : 'Clear viewed products from this device?'
        }
        onCancel={() => setClear(false)}
        onConfirm={() => {
          clearRecentProducts();
          setClear(false);
        }}
      />
    </SafeAreaView>
  );
}
