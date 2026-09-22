import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Clock3, GitCompareArrows, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '@/components/AppHeader';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { ScreenState } from '@/components/ScreenState';
import { CategorySections } from '@/components/CategorySections';
import { StoreDepartmentGrid } from '@/components/StoreDepartmentGrid';
import { CategoryId, categoryDisplayName, categoryLineage, categorySubtreeIds, directChildCategories, localizedCategoryName, orderedStoreCategories, productMatchesCategory, productsInCategoryTree, storefrontDepartments, type StorefrontSection } from '@/constants/categories';
import { colors, glow, radius, shadow, sizes, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCommerce } from '@/contexts/CommerceContext';
import { useProducts } from '@/hooks/useProducts';
import { filterProducts, localizedProductTitle, productAvailable, productPriceNumber, ProductSort, sortProducts, textDirection } from '@/services/catalog';

const SEARCHES_KEY = 'mig_farm_recent_searches_v1';
const categoryIdFromParam = (value?: string): CategoryId => {
  if (!value || value === 'all') return 'all';
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 'all';
};

export default function CatalogScreen({ searchMode = false }: { searchMode?: boolean } = {}) {
  const params = useLocalSearchParams<{ category?: string; query?: string; favorites?: string }>();
  const { language, isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { favorites, compareIds } = useCommerce();
  const { products, categories: rawCategories, loading, error, reload } = useProducts();
  const [query, setQuery] = useState(params.query || '');
  const [category, setCategory] = useState<CategoryId>(categoryIdFromParam(params.category));
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
  const categories = useMemo(() => orderedStoreCategories(rawCategories), [rawCategories]);
  const departments = useMemo(() => storefrontDepartments(categories), [categories]);
  const storefrontCategoryIds = useMemo(() => {
    const ids = new Set<number>();
    for (const department of departments) {
      for (const id of categorySubtreeIds(department.id, categories)) ids.add(id);
    }
    return ids;
  }, [categories, departments]);
  const storefrontProducts = useMemo(() => products.filter((product) =>
    product.categories.some((assigned) => storefrontCategoryIds.has(assigned.id))), [products, storefrontCategoryIds]);
  const departmentSections = useMemo<StorefrontSection[]>(
    () => departments.map((department) => ({
      category: department,
      products: [],
      productCount: productsInCategoryTree(storefrontProducts, categories, department.id).length,
      kind: 'department',
    })),
    [categories, departments, storefrontProducts],
  );
  const selectedCategory = useMemo(() => category === 'all' || !storefrontCategoryIds.has(category)
    ? null
    : categories.find((item) => item.id === category) || null, [categories, category, storefrontCategoryIds]);
  const childCategories = useMemo(() => selectedCategory
    ? directChildCategories(categories, selectedCategory.id)
    : departments, [categories, departments, selectedCategory]);
  const lineage = useMemo(() => selectedCategory ? categoryLineage(selectedCategory.id, categories) : [], [categories, selectedCategory]);
  const categoryItems = useMemo<Array<{ id: CategoryId; label: string }>>(() => [
    { id: 'all', label: language === 'ar' ? 'كل المنتجات' : 'All products' },
    ...categories.filter((item) => storefrontCategoryIds.has(item.id)).map((item) => ({
      id: item.id,
      label: categoryDisplayName(item, categories, language),
    })),
  ], [categories, language, storefrontCategoryIds]);

  useEffect(() => {
    AsyncStorage.getItem(SEARCHES_KEY).then((stored) => {
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) setRecentSearches(parsed.filter((value): value is string => typeof value === 'string').slice(0, 6));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const requested = categoryIdFromParam(params.category);
    if (requested === 'all' || storefrontCategoryIds.has(requested)) {
      setCategory(requested);
    } else if (categories.length) {
      setCategory('all');
    }
    if (typeof params.query === 'string') setQuery(params.query);
  }, [categories, params.category, params.query, storefrontCategoryIds]);

  const categoryScopeProducts = useMemo(() => category === 'all'
    ? storefrontProducts
    : productsInCategoryTree(storefrontProducts, categories, category), [categories, storefrontProducts, category]);
  const categoryProducts = categoryScopeProducts;
  const brands = useMemo(() => Array.from(new Set(categoryProducts.map((product) => product.vendor.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [categoryProducts]);
  const productTypes = useMemo(() => Array.from(new Set(categoryProducts.map((product) => product.product_type.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [categoryProducts]);
  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return categoryProducts.filter((product) => [product.title, product.title_ar, product.title_en, product.vendor, product.product_type, product.product_type_ar, product.product_type_en, product.tags.join(' ')].join(' ').toLowerCase().includes(normalized)).slice(0, 5);
  }, [categoryProducts, query]);

  useEffect(() => {
    setShownCount(20);
  }, [query, category, brand, productType, minPrice, maxPrice, onlyAvailable, sort]);

  const visible = useMemo(() => {
    const filtered = filterProducts(categoryProducts, query, 'all')
      .filter((product) => !onlyAvailable || productAvailable(product))
      .filter((product) => brand === 'all' || product.vendor === brand)
      .filter((product) => productType === 'all' || product.product_type === productType)
      .filter((product) => !minPrice || productPriceNumber(product) >= Number(minPrice))
      .filter((product) => !maxPrice || productPriceNumber(product) <= Number(maxPrice));
    const favoritesOnly = params.favorites === '1' ? filtered.filter((product) => favorites.includes(product.id)) : filtered;
    return sortProducts(favoritesOnly, sort);
  }, [categoryProducts, query, params.favorites, favorites, onlyAvailable, sort, brand, productType, minPrice, maxPrice]);

  const saveSearch = (value: string) => {
    const clean = value.trim();
    if (clean.length < 2) return;
    const next = [clean, ...recentSearches.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
    setRecentSearches(next);
    AsyncStorage.setItem(SEARCHES_KEY, JSON.stringify(next)).catch(() => undefined);
  };

  const selectCategory = (next: CategoryId) => {
    setCategory(next);
    setDraftCategory(next);
    router.setParams({ category: String(next) });
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
    selectCategory('all');
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
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const TrailIcon = isRTL ? ChevronLeft : ChevronRight;
  const hasActiveFilters = brand !== 'all' || productType !== 'all' || minPrice !== '' || maxPrice !== '' || onlyAvailable || sort !== 'popular';
  const showCategorySections = !searchMode && Boolean(selectedCategory && childCategories.length) && !query.trim() && params.favorites !== '1' && !hasActiveFilters;
  const showTopLevelDepartments = !searchMode && !selectedCategory && !query.trim() && params.favorites !== '1' && !hasActiveFilters;
  const showSearchLanding = searchMode && !query.trim();
  const bottomPadding = Math.max(104, insets.bottom + 92);
  const searchField = (
    <View style={[styles.search, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Search color={colors.primary} size={20} strokeWidth={2.2} />
      <TextInput
        accessibilityLabel={t('search')}
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
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader compact />
      <View style={styles.page}>
        <LinearGradient
          colors={[colors.leaf, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBand}
        >
          <View style={[styles.titleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View>
              <Text numberOfLines={2} style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{searchMode ? t('searchTab') : selectedCategory ? localizedCategoryName(selectedCategory, language) : t('store')}</Text>
              <Text style={[styles.count, { textAlign: isRTL ? 'right' : 'left' }]}>{visible.length} {language === 'ar' ? 'منتج' : 'products'}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.searchFloat}>{searchField}</View>

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
            <Text style={[styles.discoveryTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'تصفح حسب القسم' : 'Browse by category'}</Text>
            {departmentSections.length ? (
              <StoreDepartmentGrid
                sections={departmentSections}
                onOpenCategory={(categoryId) => router.push({ pathname: '/(tabs)/catalog', params: { category: String(categoryId) } })}
              />
            ) : null}
          </View>
        ) : null}

        {searchMode && query.trim() && suggestions.length ? (
          <View style={styles.suggestionPanel}>
            <Text style={[styles.discoveryTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('searchSuggestions')}</Text>
            {suggestions.map((product) => {
              const title = localizedProductTitle(product, language);
              const direction = textDirection(title, language);
              return <Pressable key={product.id} onPress={() => { saveSearch(title); router.push({ pathname: '/product/[handle]', params: { handle: product.handle, ...(category !== 'all' ? { category: String(category) } : {}) } }); }} style={[styles.suggestionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Search size={15} color={colors.muted} /><Text numberOfLines={1} style={[styles.suggestionText, { textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }]}>{title}</Text>
              </Pressable>;
            })}
          </View>
        ) : null}

        {!showSearchLanding ? (
          <View style={[styles.controlRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.resultHint, { textAlign: isRTL ? 'right' : 'left' }]}>{onlyAvailable ? t('availableOnly') : sort === 'newest' ? t('newestSort') : sort === 'popular' ? t('popularSort') : sort === 'price_asc' ? t('priceLow') : sort === 'price_desc' ? t('priceHigh') : t('availableFirst')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('filters')} onPress={openFilters} style={({ pressed }) => [styles.filterChip, pressed && styles.pressed]}>
              <SlidersHorizontal size={15} color={colors.primary} />
              <Text style={styles.filterChipText}>{t('filters')}</Text>
            </Pressable>
          </View>
        ) : null}

        {!searchMode ? <View style={styles.categoryNavigation}>
          {selectedCategory ? <View style={[styles.breadcrumbRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={language === 'ar' ? 'العودة إلى التصنيف السابق' : 'Back to parent category'}
              onPress={() => selectCategory(selectedCategory.parentId ?? 'all')}
              style={({ pressed }) => [styles.categoryBack, pressed && styles.pressed]}
            >
              <BackIcon size={18} color={colors.primaryDark} />
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.breadcrumbList, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Pressable accessibilityRole="button" onPress={() => selectCategory('all')} style={styles.breadcrumbItem}>
                <Text style={styles.breadcrumbText}>{language === 'ar' ? 'كل المنتجات' : 'All products'}</Text>
              </Pressable>
              {lineage.map((item, index) => <React.Fragment key={item.id}>
                <TrailIcon size={13} color={colors.textSubtle} />
                <Pressable accessibilityRole="button" onPress={() => selectCategory(item.id)} style={styles.breadcrumbItem}>
                  <Text numberOfLines={1} style={[styles.breadcrumbText, index === lineage.length - 1 && styles.breadcrumbCurrent]}>{localizedCategoryName(item, language)}</Text>
                </Pressable>
              </React.Fragment>)}
            </ScrollView>
          </View> : null}
          {childCategories.length ? <ScrollView
            horizontal
            style={[styles.categoryScroller, { direction: isRTL ? 'rtl' : 'ltr' }]}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            {childCategories.map((item) => <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={localizedCategoryName(item, language)}
              onPress={() => selectCategory(item.id)}
              style={({ pressed }) => [styles.categoryPill, { flexDirection: isRTL ? 'row-reverse' : 'row' }, pressed && styles.pressed]}
            >
              <CategoryIcon id={item.id} size={15} boxSize={28} />
              <Text numberOfLines={1} style={styles.categoryText}>{localizedCategoryName(item, language)}</Text>
              <TrailIcon size={13} color={colors.muted} />
            </Pressable>)}
          </ScrollView> : null}
        </View> : null}

        {compareIds.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/compare')} style={({ pressed }) => [styles.compareBar, pressed && styles.pressed]}>
            <GitCompareArrows size={17} color="#FFFFFF" />
            <Text style={styles.compareBarText}>{t('compare')} ({compareIds.length}/3)</Text>
            <Text style={styles.compareBarAction}>{language === 'ar' ? 'فتح' : 'Open'}</Text>
          </Pressable>
        ) : null}

        {showSearchLanding ? null : showTopLevelDepartments ? (
          <ScrollView style={styles.productList} contentContainerStyle={[styles.products, { paddingBottom: bottomPadding }]} showsVerticalScrollIndicator={false}>
            <ScreenState loading={loading && !departmentSections.length} error={error} empty={!loading && !error && !departmentSections.length} onRetry={reload} />
            {departmentSections.length ? <StoreDepartmentGrid sections={departmentSections} onOpenCategory={selectCategory} /> : null}
          </ScrollView>
        ) : showCategorySections && selectedCategory ? <CategorySections
          categoryId={selectedCategory.id}
          products={storefrontProducts}
          categories={categories}
          bottomPadding={bottomPadding}
          onOpenCategory={selectCategory}
        /> : loading ? <View accessibilityLabel={t('loading')} style={styles.skeletonGrid}>{Array.from({ length: 4 }).map((_, index) => <ProductCardSkeleton key={index} />)}</View> : error || !visible.length ? <ScrollView style={styles.productList} contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomPadding }}><ScreenState error={error} empty={!error && !visible.length} onRetry={reload}
          emptyTitle={query ? (language === 'ar' ? 'لم نجد نتائج مطابقة' : 'No matching results') : (language === 'ar' ? 'لا توجد منتجات متاحة حالياً' : 'No products currently available')}
          emptyAction={query ? (language === 'ar' ? 'مسح البحث' : 'Clear search') : selectedCategory ? (language === 'ar' ? 'كل المنتجات' : 'All products') : t('resetFilters')}
          onEmptyAction={() => { if (query) setQuery(''); else if (selectedCategory) selectCategory('all'); else resetFilters(); }} /></ScrollView> : null}
        {!showSearchLanding && !showTopLevelDepartments && !showCategorySections && !loading && !error && visible.length ? (
          <FlatList
            data={visible.slice(0, shownCount)}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={[styles.productRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            contentContainerStyle={[styles.products, { paddingBottom: bottomPadding }]}
            style={styles.productList}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            onEndReached={() => setShownCount((current) => Math.min(visible.length, current + 20))}
            onEndReachedThreshold={0.65}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <ProductCard product={item} categoryId={category === 'all' ? undefined : category} />}
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
              {categoryItems.map((item) => <Pressable key={item.id} onPress={() => setDraftCategory(item.id)} style={[styles.sheetChip, draftCategory === item.id && styles.sheetChipActive]}><Text style={[styles.sheetChipText, draftCategory === item.id && styles.sheetChipTextActive]}>{item.label}</Text></Pressable>)}
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
              <Pressable accessibilityRole="button" onPress={() => { selectCategory(draftCategory); setBrand(draftBrand); setProductType(draftProductType); setMinPrice(draftMinPrice); setMaxPrice(draftMaxPrice); setSort(draftSort); setOnlyAvailable(draftOnlyAvailable); setFiltersOpen(false); }} style={styles.applyButton}>
                <LinearGradient style={StyleSheet.absoluteFill} colors={[colors.leaf, colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <Text style={styles.applyText}>{t('applyFilters')}</Text>
              </Pressable>
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
  heroBand: { paddingTop: 6, paddingBottom: 30, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  titleRow: { paddingHorizontal: 16, paddingTop: 9, paddingBottom: 4, justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.page, color: '#FFFFFF' },
  count: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 3 },
  searchFloat: { marginHorizontal: 16, marginTop: -22, marginBottom: 12 },
  search: { height: sizes.input, backgroundColor: colors.surface, borderRadius: radius.lg, alignItems: 'center', paddingHorizontal: 14, gap: 9, ...glow },
  input: { flex: 1, height: '100%', color: colors.text, fontSize: 14 },
  pressed: { opacity: 0.7 },
  controlRow: { minHeight: 38, marginHorizontal: 16, alignItems: 'center', justifyContent: 'space-between' },
  resultHint: { ...typography.caption, color: colors.muted },
  filterChip: { minHeight: sizes.touch, paddingHorizontal: 10, borderRadius: radius.lg, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 5, ...shadow },
  filterChipText: { ...typography.caption, color: colors.primaryDark },
  discoveryPanel: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  discoveryHeader: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  discoveryTitle: { ...typography.secondary, color: colors.text, fontWeight: '600' },
  clearRecent: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  recentSearchList: { flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  recentSearch: { maxWidth: 150, minHeight: 30, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, flexDirection: 'row', alignItems: 'center', gap: 5 },
  recentSearchText: { flexShrink: 1, color: colors.muted, fontSize: 10, fontWeight: '700' },
  discoveryProducts: { gap: 8, paddingTop: 8 },
  discoveryProduct: { width: 140, minHeight: 56, padding: 9, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  discoveryProductText: { color: colors.text, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  discoveryProductPrice: { color: colors.primary, fontSize: 10, fontWeight: '900', marginTop: 5 },
  suggestionPanel: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  suggestionRow: { minHeight: 36, alignItems: 'center', gap: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionText: { ...typography.secondary, flex: 1, color: colors.text },
  compareBar: { minHeight: 42, marginHorizontal: 16, marginBottom: 7, paddingHorizontal: 13, borderRadius: radius.lg, backgroundColor: colors.primaryDark, flexDirection: 'row', alignItems: 'center', gap: 7, position: 'relative', zIndex: 20, elevation: 6, ...glow },
  compareBarText: { flex: 1, color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  compareBarAction: { color: colors.sun, fontSize: 10, fontWeight: '900' },
  categoryNavigation: { flexShrink: 0 },
  breadcrumbRow: { minHeight: 38, marginHorizontal: 16, alignItems: 'center', gap: 7 },
  categoryBack: { width: 32, height: 32, flexShrink: 0, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  breadcrumbList: { alignItems: 'center', gap: 5, paddingEnd: 8 },
  breadcrumbItem: { minHeight: 30, maxWidth: 170, justifyContent: 'center' },
  breadcrumbText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  breadcrumbCurrent: { color: colors.primaryDark, fontWeight: '900' },
  categoryScroller: { flexGrow: 0, flexShrink: 0, height: 68 },
  categoryList: { flexDirection: 'row', paddingStart: 16, paddingEnd: 16, paddingVertical: 13, gap: 8 },
  categoryPill: { maxWidth: 220, height: 42, paddingHorizontal: 8, paddingEnd: 12, alignItems: 'center', gap: 6, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  categoryPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { maxWidth: 160, flexShrink: 1, color: colors.text, fontSize: 11, fontWeight: '800' },
  categoryTextActive: { color: '#FFFFFF' },
  products: { paddingHorizontal: 16, paddingBottom: 30 },
  productRow: { justifyContent: 'space-between', gap: 12 },
  productList: { flex: 1 },
  skeletonGrid: { flex: 1, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8, 27, 17, 0.34)' },
  filterSheet: { maxHeight: '88%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface },
  filterSheetContent: { padding: 18, paddingBottom: 28 },
  sheetHeader: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', marginBottom: 8 },
  sortOptions: { gap: 8 },
  sortOption: { minHeight: 44, paddingHorizontal: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', gap: 9 },
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
  priceInput: { flex: 1, height: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.background, color: colors.text, fontSize: 12 },
  sheetActions: { gap: 9, marginTop: 16 },
  resetButton: { flex: 1, height: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  resetText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  applyButton: { flex: 1.5, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...glow },
  applyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
