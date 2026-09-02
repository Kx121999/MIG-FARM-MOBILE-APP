import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Clock3, GitCompareArrows, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { ScreenState } from '@/components/ScreenState';
import { CategoryId, categories } from '@/constants/categories';
import { colors, radius } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCommerce } from '@/contexts/CommerceContext';
import { useProducts } from '@/hooks/useProducts';
import { filterProducts, localizedProductTitle, productAvailable, productPriceNumber, ProductSort, sortProducts, textDirection } from '@/services/catalog';

const SEARCHES_KEY = 'mig_farm_recent_searches_v1';

export default function CatalogScreen({ searchMode = false }: { searchMode?: boolean } = {}) {
  const params = useLocalSearchParams<{ category?: string; query?: string; favorites?: string }>();
  const { language, isRTL, t } = useLanguage();
  const { favorites, compareIds } = useCommerce();
  const { products, loading, error, reload } = useProducts();
  const [query, setQuery] = useState(params.query || '');
  const [category, setCategory] = useState<CategoryId>((params.category as CategoryId) || 'all');
  const [sort, setSort] = useState<ProductSort>('popular');
  const [brand, setBrand] = useState('all');
  const [productType, setProductType] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState<CategoryId>(category);
  const [draftBrand, setDraftBrand] = useState('all');
  const [draftProductType, setDraftProductType] = useState('all');
  const [draftMinPrice, setDraftMinPrice] = useState('');
  const [draftMaxPrice, setDraftMaxPrice] = useState('');
  const [draftSort, setDraftSort] = useState<ProductSort>(sort);
  const [draftOnlyAvailable, setDraftOnlyAvailable] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [shownCount, setShownCount] = useState(20);
  const categoryListRef = useRef<ScrollView>(null);

  useEffect(() => {
    AsyncStorage.getItem(SEARCHES_KEY).then((stored) => {
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) setRecentSearches(parsed.filter((value): value is string => typeof value === 'string').slice(0, 6));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (params.category && categories.some((item) => item.id === params.category)) setCategory(params.category as CategoryId);
    if (typeof params.query === 'string') setQuery(params.query);
  }, [params.category, params.query]);

  const brands = useMemo(() => Array.from(new Set(products.map((product) => product.vendor.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [products]);
  const productTypes = useMemo(() => Array.from(new Set(products.map((product) => product.product_type.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [products]);
  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return products.filter((product) => [product.title, product.title_ar, product.title_en, product.vendor, product.product_type, product.product_type_ar, product.product_type_en, product.tags.join(' ')].join(' ').toLowerCase().includes(normalized)).slice(0, 5);
  }, [products, query]);
  const featuredPreview = useMemo(() => products.slice(0, 4), [products]);

  useEffect(() => {
    setShownCount(20);
  }, [query, category, brand, productType, minPrice, maxPrice, onlyAvailable, sort]);

  const visible = useMemo(() => {
    const filtered = filterProducts(products, query, category)
      .filter((product) => !onlyAvailable || productAvailable(product))
      .filter((product) => brand === 'all' || product.vendor === brand)
      .filter((product) => productType === 'all' || product.product_type === productType)
      .filter((product) => !minPrice || productPriceNumber(product) >= Number(minPrice))
      .filter((product) => !maxPrice || productPriceNumber(product) <= Number(maxPrice));
    const favoritesOnly = params.favorites === '1' ? filtered.filter((product) => favorites.includes(product.id)) : filtered;
    return sortProducts(favoritesOnly, sort);
  }, [products, query, category, params.favorites, favorites, onlyAvailable, sort, brand, productType, minPrice, maxPrice]);

  const saveSearch = (value: string) => {
    const clean = value.trim();
    if (clean.length < 2) return;
    const next = [clean, ...recentSearches.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
    setRecentSearches(next);
    AsyncStorage.setItem(SEARCHES_KEY, JSON.stringify(next)).catch(() => undefined);
  };

  const openFilters = () => {
    setDraftCategory(category);
    setDraftBrand(brand);
    setDraftProductType(productType);
    setDraftMinPrice(minPrice);
    setDraftMaxPrice(maxPrice);
    setDraftSort(sort);
    setDraftOnlyAvailable(onlyAvailable);
    setFiltersOpen(true);
  };

  const resetFilters = () => {
    setCategory('all');
    setBrand('all');
    setProductType('all');
    setMinPrice('');
    setMaxPrice('');
    setSort('popular');
    setOnlyAvailable(false);
    setDraftCategory('all');
    setDraftBrand('all');
    setDraftProductType('all');
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setDraftSort('popular');
    setDraftOnlyAvailable(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader compact />
      <View style={styles.page}>
        <View style={[styles.titleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View>
            <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{searchMode ? t('searchTab') : t('store')}</Text>
            <Text style={[styles.count, { textAlign: isRTL ? 'right' : 'left' }]}>{visible.length} {language === 'ar' ? 'منتج' : 'products'}</Text>
          </View>
        </View>

        <View style={[styles.search, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Search color={colors.primary} size={20} strokeWidth={2.2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search')}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, { textAlign: isRTL ? 'right' : 'left' }]}
            autoCorrect={false}
            returnKeyType="search"
            autoFocus={searchMode}
            onSubmitEditing={() => saveSearch(query)}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} style={({ pressed }) => pressed && styles.pressed} onPress={() => setQuery('')}>
              <X color={colors.muted} size={19} />
            </Pressable>
          ) : null}
        </View>

        {searchMode && !query.trim() ? (
          <View style={styles.discoveryPanel}>
            {recentSearches.length ? (
              <View>
                <View style={[styles.discoveryHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.discoveryTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('recentSearches')}</Text>
                  <Pressable accessibilityRole="button" onPress={() => { setRecentSearches([]); AsyncStorage.removeItem(SEARCHES_KEY).catch(() => undefined); }}><Text style={styles.clearRecent}>{t('clearRecent')}</Text></Pressable>
                </View>
                <View style={[styles.recentSearchList, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {recentSearches.map((item) => <Pressable key={item} onPress={() => setQuery(item)} style={styles.recentSearch}><Clock3 size={13} color={colors.muted} /><Text numberOfLines={1} style={styles.recentSearchText}>{item}</Text></Pressable>)}
                </View>
              </View>
            ) : null}
            <Text style={[styles.discoveryTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('featuredProducts')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.discoveryProducts, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {featuredPreview.map((product) => {
                const title = localizedProductTitle(product, language);
                const direction = textDirection(title, language);
                return <Pressable key={product.id} onPress={() => { saveSearch(title); router.push({ pathname: '/product/[handle]', params: { handle: product.handle } }); }} style={styles.discoveryProduct}>
                  <Text numberOfLines={2} style={[styles.discoveryProductText, { textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }]}>{title}</Text>
                  <Text style={styles.discoveryProductPrice}>{productPriceNumber(product) > 0 ? `${productPriceNumber(product)} AED` : 'MIG FARM'}</Text>
                </Pressable>;
              })}
            </ScrollView>
          </View>
        ) : null}

        {searchMode && query.trim() && suggestions.length ? (
          <View style={styles.suggestionPanel}>
            <Text style={[styles.discoveryTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('searchSuggestions')}</Text>
            {suggestions.map((product) => {
              const title = localizedProductTitle(product, language);
              const direction = textDirection(title, language);
              return <Pressable key={product.id} onPress={() => { saveSearch(title); router.push({ pathname: '/product/[handle]', params: { handle: product.handle } }); }} style={[styles.suggestionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Search size={15} color={colors.muted} /><Text numberOfLines={1} style={[styles.suggestionText, { textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }]}>{title}</Text>
              </Pressable>;
            })}
          </View>
        ) : null}

        <View style={[styles.controlRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.resultHint, { textAlign: isRTL ? 'right' : 'left' }]}>{onlyAvailable ? t('availableOnly') : sort === 'newest' ? t('newestSort') : sort === 'popular' ? t('popularSort') : sort === 'price_asc' ? t('priceLow') : sort === 'price_desc' ? t('priceHigh') : t('availableFirst')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('filters')} onPress={openFilters} style={({ pressed }) => [styles.filterChip, pressed && styles.pressed]}>
            <SlidersHorizontal size={15} color={colors.primary} />
            <Text style={styles.filterChipText}>{t('filters')}</Text>
          </Pressable>
        </View>

        {!searchMode ? <ScrollView
          ref={categoryListRef}
          horizontal
          style={styles.categoryScroller}
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => isRTL && categoryListRef.current?.scrollToEnd({ animated: false })}
          contentContainerStyle={[styles.categoryList, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          {categories.map((item) => {
            const active = category === item.id;
            return (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => setCategory(item.id)} style={({ pressed }) => [styles.categoryPill, active && styles.categoryPillActive, pressed && styles.pressed]}>
                <CategoryIcon id={item.id} size={15} boxSize={28} inverse={active} />
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item[language]}</Text>
              </Pressable>
            );
          })}
        </ScrollView> : null}

        {compareIds.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/compare')} style={({ pressed }) => [styles.compareBar, pressed && styles.pressed]}>
            <GitCompareArrows size={17} color="#FFFFFF" />
            <Text style={styles.compareBarText}>{t('compare')} ({compareIds.length}/3)</Text>
            <Text style={styles.compareBarAction}>{language === 'ar' ? 'فتح' : 'Open'}</Text>
          </Pressable>
        ) : null}

        {loading ? <View style={styles.skeletonGrid}>{Array.from({ length: 6 }).map((_, index) => <ProductCardSkeleton key={index} />)}</View> : <ScreenState error={error} empty={!error && !visible.length} onRetry={reload} />}
        {!loading && !error && visible.length ? (
          <FlatList
            data={visible.slice(0, shownCount)}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={styles.productRow}
            contentContainerStyle={styles.products}
            style={styles.productList}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            onEndReached={() => setShownCount((current) => Math.min(visible.length, current + 20))}
            onEndReachedThreshold={0.65}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <ProductCard product={item} />}
          />
        ) : null}
      </View>
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.filterSheet} contentContainerStyle={styles.filterSheetContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.sheetHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.sheetTitle}>{t('filters')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={() => setFiltersOpen(false)} style={styles.closeButton}><X size={19} color={colors.primaryDark} /></Pressable>
            </View>
            <Text style={[styles.sheetLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('sort')}</Text>
            <View style={styles.sortOptions}>
              {([
                ['popular', t('popularSort')],
                ['newest', t('newestSort')],
                ['price_asc', t('priceLow')],
                ['price_desc', t('priceHigh')],
                ['available', t('availableFirst')],
              ] as Array<[ProductSort, string]>).map(([value, label]) => (
                <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: draftSort === value }} onPress={() => setDraftSort(value)} style={[styles.sortOption, draftSort === value && styles.sortOptionActive, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.radio, draftSort === value && styles.radioActive]}>{draftSort === value ? <Check size={13} color="#FFFFFF" /> : null}</View>
                  <Text style={[styles.sortText, draftSort === value && styles.sortTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.sheetLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('chooseCategory')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.sheetChips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {categories.map((item) => <Pressable key={item.id} onPress={() => setDraftCategory(item.id)} style={[styles.sheetChip, draftCategory === item.id && styles.sheetChipActive]}><Text style={[styles.sheetChipText, draftCategory === item.id && styles.sheetChipTextActive]}>{item[language]}</Text></Pressable>)}
            </ScrollView>
            <Text style={[styles.sheetLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('brands')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.sheetChips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {[['all', t('allBrands')], ...brands.map((item) => [item, item])].map(([value, label]) => <Pressable key={value} onPress={() => setDraftBrand(value)} style={[styles.sheetChip, draftBrand === value && styles.sheetChipActive]}><Text numberOfLines={1} style={[styles.sheetChipText, draftBrand === value && styles.sheetChipTextActive]}>{label}</Text></Pressable>)}
            </ScrollView>
            {productTypes.length ? <><Text style={[styles.sheetLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('productType')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.sheetChips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>{[['all', t('allTypes')], ...productTypes.map((item) => [item, item])].map(([value, label]) => <Pressable key={value} onPress={() => setDraftProductType(value)} style={[styles.sheetChip, draftProductType === value && styles.sheetChipActive]}><Text numberOfLines={1} style={[styles.sheetChipText, draftProductType === value && styles.sheetChipTextActive]}>{label}</Text></Pressable>)}</ScrollView></> : null}
            <Text style={[styles.sheetLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('priceRange')}</Text>
            <View style={[styles.priceInputs, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TextInput value={draftMinPrice} onChangeText={setDraftMinPrice} placeholder={t('minPrice')} placeholderTextColor={colors.textSubtle} keyboardType="decimal-pad" style={[styles.priceInput, { textAlign: isRTL ? 'right' : 'left' }]} />
              <TextInput value={draftMaxPrice} onChangeText={setDraftMaxPrice} placeholder={t('maxPrice')} placeholderTextColor={colors.textSubtle} keyboardType="decimal-pad" style={[styles.priceInput, { textAlign: isRTL ? 'right' : 'left' }]} />
            </View>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: draftOnlyAvailable }} onPress={() => setDraftOnlyAvailable((current) => !current)} style={[styles.availableToggle, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.checkbox, draftOnlyAvailable && styles.checkboxActive]}>{draftOnlyAvailable ? <Check size={14} color="#FFFFFF" /> : null}</View>
              <Text style={styles.availableText}>{t('availableOnly')}</Text>
            </Pressable>
            <View style={[styles.sheetActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.resetButton}><Text style={styles.resetText}>{t('resetFilters')}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setCategory(draftCategory); setBrand(draftBrand); setProductType(draftProductType); setMinPrice(draftMinPrice); setMaxPrice(draftMaxPrice); setSort(draftSort); setOnlyAvailable(draftOnlyAvailable); setFiltersOpen(false); }} style={styles.applyButton}><Text style={styles.applyText}>{t('applyFilters')}</Text></Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  titleRow: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 12, justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 27, fontWeight: '900' },
  count: { color: colors.muted, fontSize: 12, marginTop: 3 },
  search: { height: 50, marginHorizontal: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', paddingHorizontal: 14, gap: 9 },
  input: { flex: 1, height: '100%', color: colors.text, fontSize: 14 },
  pressed: { opacity: 0.7 },
  controlRow: { minHeight: 38, marginHorizontal: 16, alignItems: 'center', justifyContent: 'space-between' },
  resultHint: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  filterChip: { minHeight: 34, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterChipText: { color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  discoveryPanel: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  discoveryHeader: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  discoveryTitle: { color: colors.text, fontSize: 11, fontWeight: '900' },
  clearRecent: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  recentSearchList: { flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  recentSearch: { maxWidth: 150, minHeight: 30, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, flexDirection: 'row', alignItems: 'center', gap: 5 },
  recentSearchText: { flexShrink: 1, color: colors.muted, fontSize: 10, fontWeight: '700' },
  discoveryProducts: { gap: 8, paddingTop: 8 },
  discoveryProduct: { width: 140, minHeight: 56, padding: 9, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  discoveryProductText: { color: colors.text, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  discoveryProductPrice: { color: colors.primary, fontSize: 10, fontWeight: '900', marginTop: 5 },
  suggestionPanel: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  suggestionRow: { minHeight: 36, alignItems: 'center', gap: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionText: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '700' },
  compareBar: { minHeight: 42, marginHorizontal: 16, marginBottom: 7, paddingHorizontal: 13, borderRadius: radius.md, backgroundColor: colors.primaryDark, flexDirection: 'row', alignItems: 'center', gap: 7, position: 'relative', zIndex: 20, elevation: 6 },
  compareBarText: { flex: 1, color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  compareBarAction: { color: colors.sun, fontSize: 10, fontWeight: '900' },
  categoryScroller: { flexGrow: 0, flexShrink: 0, height: 68 },
  categoryList: { paddingHorizontal: 16, paddingVertical: 13, gap: 8 },
  categoryPill: { height: 42, paddingHorizontal: 8, paddingEnd: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  categoryPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  categoryTextActive: { color: '#FFFFFF' },
  products: { paddingHorizontal: 14, paddingBottom: 30 },
  productRow: { justifyContent: 'space-between' },
  productList: { flex: 1 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 14, gap: 12 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8, 27, 17, 0.34)' },
  filterSheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  filterSheetContent: { padding: 18, paddingBottom: 28 },
  sheetHeader: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', marginBottom: 8 },
  sortOptions: { gap: 8 },
  sortOption: { minHeight: 44, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', gap: 9 },
  sortOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  sortText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  sortTextActive: { color: colors.primaryDark },
  availableToggle: { minHeight: 46, marginTop: 14, alignItems: 'center', gap: 9 },
  checkbox: { width: 23, height: 23, borderRadius: 6, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  availableText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  sheetChips: { gap: 7, paddingBottom: 14 },
  sheetChip: { maxWidth: 180, minHeight: 34, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  sheetChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  sheetChipText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  sheetChipTextActive: { color: colors.primaryDark },
  priceInputs: { gap: 8, marginBottom: 5 },
  priceInput: { flex: 1, height: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, color: colors.text, fontSize: 12 },
  sheetActions: { gap: 9, marginTop: 16 },
  resetButton: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  resetText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  applyButton: { flex: 1.5, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
