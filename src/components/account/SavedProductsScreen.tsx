import React, { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { AppIconButton } from '@/components/AppIconButton';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState, ScreenState } from '@/components/ScreenState';
import { useProducts } from '@/hooks/useProducts';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ConfirmSheet, ui } from './AccountUI';
import type { Product } from '@/types';

export function SavedProductsScreen({ recent = false }: { recent?: boolean }) {
  const { products, loading, error, reload } = useProducts();
  const { favorites, recentProductIds, clearRecentProducts, hydrated } =
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
      <View style={[ui.top, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <AppIconButton
          icon={ar ? ArrowRight : ArrowLeft}
          label={ar ? 'رجوع' : 'Back'}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/(tabs)/account')
          }
        />
        <Text style={[ui.pageTitle, { textAlign: ar ? 'right' : 'left' }]}>
          {title}
        </Text>
        {recent && ids.length ? (
          <AppIconButton
            icon={Trash2}
            label={ar ? 'مسح السجل' : 'Clear history'}
            onPress={() => setClear(true)}
          />
        ) : null}
      </View>
      {loading || !hydrated ? (
        <View style={{ padding: 16 }}>
          <ScreenState loading />
        </View>
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
