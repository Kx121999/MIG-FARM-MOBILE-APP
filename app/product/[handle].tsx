import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Truck,
  GitCompareArrows,
  type LucideIcon,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '@/constants/theme';
import { ProductCard } from '@/components/ProductCard';
import { SectionTitle } from '@/components/SectionTitle';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  APP_ORIGIN,
  fetchProduct,
  formatAED,
  localizedProductDescription,
  localizedProductTitle,
  productDescriptionBlocks,
  productImage,
  textDirection,
} from '@/services/catalog';
import { Product, ProductVariant } from '@/types';
import { useProducts } from '@/hooks/useProducts';

export default function ProductScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { width } = useWindowDimensions();
  const { addToCart, isFavorite, toggleFavorite, isCompared, toggleCompare, recordRecentProduct } = useCommerce();
  const { language, isRTL, t } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [variant, setVariant] = useState<ProductVariant | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { products: allProducts } = useProducts();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wide = width >= 960;
  const related = useMemo(() => product ? allProducts.filter((item) => item.id !== product.id && (item.product_type === product.product_type || item.vendor === product.vendor)).slice(0, 6) : [], [allProducts, product]);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    setError(false);
    fetchProduct(handle)
      .then((data) => {
        const firstVariant = data.variants.find((item) => item.available !== false) || data.variants[0];
        setProduct(data);
        setVariant(firstVariant);
        setSelectedImage(firstVariant?.featured_image?.src || productImage(data));
        recordRecentProduct(data.id);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [handle, recordRecentProduct]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const productTitle = useMemo(() => product ? localizedProductTitle(product, language) : '', [language, product]);
  const titleDirection = textDirection(productTitle, language);
  const descriptionBlocks = useMemo(() => {
    if (!product) return [];
    const blocks = productDescriptionBlocks(localizedProductDescription(product, language));
    return blocks.filter((block, index) => {
      if (index !== 0 || block.kind !== 'heading') return true;
      return block.text.toLocaleLowerCase() !== productTitle.toLocaleLowerCase();
    });
  }, [language, product, productTitle]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>{t('loading')}</Text></View>;
  }

  if (error || !product || !variant) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}><RotateCcw size={28} color={colors.primary} /></View>
        <Text style={styles.error}>{t('chatError')}</Text>
        <Pressable accessibilityRole="button" style={styles.backToStore} onPress={() => router.replace('/(tabs)/catalog')}>
          <Text style={styles.backToStoreText}>{t('continueShopping')}</Text>
        </Pressable>
      </View>
    );
  }

  const available = variant.available !== false;
  const currentImage = selectedImage || variant.featured_image?.src || productImage(product);
  const currentImageMeta = product.images.find((item) => item.src === currentImage) || variant.featured_image || null;
  const imageIsWide = Boolean(currentImageMeta?.width && currentImageMeta?.height && currentImageMeta.width / currentImageMeta.height > 1.25);
  const galleryHeight = wide ? 440 : Math.round(Math.min(348, Math.max(286, (width - 32) * (imageIsWide ? 0.74 : 0.88))));
  const favorite = isFavorite(product.id);
  const currentPrice = Number(variant.price || 0);
  const comparePrice = Number(variant.compare_at_price || 0);
  const compared = isCompared(product.id);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const ForwardIcon = isRTL ? ChevronLeft : ChevronRight;

  const chooseVariant = (item: ProductVariant) => {
    setVariant(item);
    if (item.featured_image?.src) {
      setSelectedImage(item.featured_image.src);
      setImageFailed(false);
    }
    Haptics.selectionAsync().catch(() => undefined);
  };

  const add = () => {
    if (!available) return;
    addToCart(product, variant, quantity);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setAdded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdded(false), 1500);
  };

  const askProduct = () => {
    const context = {
      name: productTitle,
      sku: variant.sku || '',
      external_id: String(product.id),
      product_id: product.id,
      price: variant.price,
      currency: 'AED',
      availability: available ? 'Available' : 'Needs review',
      url: `${APP_ORIGIN}/product/${product.handle}`,
      image: currentImage || '',
      truth: { current: true, source: 'mig_farm_catalog' },
    };
    router.push({ pathname: '/(tabs)/assistant', params: { product: JSON.stringify(context) } });
  };

  const shareProduct = () => Share.share({
    title: productTitle,
    message: `${productTitle}\n${APP_ORIGIN}/product/${product.handle}`,
    url: `${APP_ORIGIN}/product/${product.handle}`,
  }).catch(() => undefined);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.topBarInner}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={() => router.back()}>
            <BackIcon size={21} color={colors.primaryDark} strokeWidth={2.3} />
          </Pressable>
          <Text numberOfLines={1} style={styles.topBarTitle}>{t('productDetails')}</Text>
          <View style={styles.topBarActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Share product" style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={shareProduct}>
              <Share2 size={19} color={colors.primaryDark} strokeWidth={2.1} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Favorite" style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={() => toggleFavorite(product.id)}>
              <Heart size={20} color={favorite ? colors.orange : colors.primaryDark} fill={favorite ? colors.orange : 'transparent'} strokeWidth={2.1} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('compare')} style={({ pressed }) => [styles.iconButton, compared && styles.compareButtonActive, pressed && styles.pressed]} onPress={() => toggleCompare(product.id)}>
              <GitCompareArrows size={19} color={compared ? '#FFFFFF' : colors.primaryDark} strokeWidth={2.1} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, !wide && styles.contentMobile]}>
        <View style={[styles.page, wide && styles.pageWide, wide && { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={styles.galleryColumn}>
            <View style={[styles.imagePanel, { height: galleryHeight }, shadow]}>
              {currentImage && !imageFailed ? <Image source={{ uri: currentImage, cache: 'force-cache' }} style={styles.image} resizeMode="contain" onError={() => setImageFailed(true)} /> : <Sprout size={64} color={colors.leaf} strokeWidth={1.4} />}
              <View style={styles.imageBadge}><ShieldCheck size={14} color={colors.primary} /><Text style={styles.imageBadgeText}>MIG FARM</Text></View>
            </View>

            {!!product.images?.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
                {product.images.slice(0, 7).map((item) => {
                  const active = currentImage === item.src;
                  return (
                    <Pressable key={item.id} accessibilityRole="button" onPress={() => { setSelectedImage(item.src); setImageFailed(false); }} style={[styles.thumbButton, active && styles.thumbButtonActive]}>
                      <Image source={{ uri: item.src }} style={styles.thumb} resizeMode="contain" />
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={styles.detailsColumn}>
            <Text style={[styles.vendor, { textAlign: isRTL ? 'right' : 'left' }]}>{product.vendor || 'MIG FARM'}</Text>
            <Text numberOfLines={3} style={[styles.title, { textAlign: titleDirection === 'rtl' ? 'right' : 'left', writingDirection: titleDirection }]}>{productTitle}</Text>

            <View style={[styles.priceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.priceCopy, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={styles.price}>{formatAED(variant.price)}</Text>
                {comparePrice > currentPrice ? <Text style={styles.comparePrice}>{formatAED(comparePrice)}</Text> : null}
              </View>
              <View style={[styles.stock, !available && styles.stockMuted]}>
                <Check size={14} color={available ? colors.primary : colors.muted} strokeWidth={2.5} />
                <Text style={[styles.stockText, !available && styles.stockTextMuted]}>{available ? t('available') : t('unavailable')}</Text>
              </View>
            </View>

            <View style={styles.serviceBand}>
              <ServiceBadge icon={Truck} text={language === 'ar' ? 'توصيل لكل الإمارات' : 'UAE delivery'} />
              <ServiceBadge icon={ShieldCheck} text={language === 'ar' ? 'دفع آمن' : 'Secure payment'} />
            </View>

            {product.variants.length > 1 && (
              <View style={styles.section}>
                <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left' }]}>{t('chooseVariant')}</Text>
                <View style={[styles.variants, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {product.variants.map((item) => (
                    <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: variant.id === item.id }} onPress={() => chooseVariant(item)} style={[styles.variant, variant.id === item.id && styles.variantActive]}>
                      <Text style={[styles.variantText, variant.id === item.id && styles.variantTextActive]}>{item.title}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={[styles.qtyRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View>
                <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left' }]}>{t('quantity')}</Text>
                <Text style={styles.qtyHint}>{language === 'ar' ? 'اختر الكمية المطلوبة' : 'Choose the required quantity'}</Text>
              </View>
              <View style={styles.qtyControl}>
                <Pressable accessibilityRole="button" accessibilityLabel="Decrease quantity" style={({ pressed }) => [styles.qtyButton, pressed && styles.pressed]} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                  <Minus size={17} color={colors.primary} strokeWidth={2.5} />
                </Pressable>
                <Text style={styles.qty}>{quantity}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" style={({ pressed }) => [styles.qtyButton, pressed && styles.pressed]} onPress={() => setQuantity(quantity + 1)}>
                  <Plus size={17} color={colors.primary} strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>

            {wide ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: !available }} disabled={!available} style={({ pressed }) => [styles.add, added && styles.added, !available && styles.disabled, pressed && available && styles.primaryPressed]} onPress={add}>
              {added ? <Check size={19} color="#FFFFFF" strokeWidth={2.7} /> : <ShoppingBag size={19} color="#FFFFFF" strokeWidth={2.3} />}
              <Text style={styles.addText}>{added ? t('added') : t('addToCart')}</Text>
            </Pressable> : null}

            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.ask, pressed && styles.pressed]} onPress={askProduct}>
              <Bot size={20} color={colors.primary} strokeWidth={2.1} />
              <View style={styles.askCopy}>
                <Text style={[styles.askHint, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'مش متأكد إن المنتج مناسب؟' : 'Not sure this product is right?'}</Text>
                <Text style={[styles.askText, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'اسأل مهندس MIG FARM' : 'Ask a MIG FARM engineer'}</Text>
              </View>
              <ForwardIcon size={17} color={colors.primary} strokeWidth={2.3} />
            </Pressable>
          </View>
        </View>

        {!!descriptionBlocks.length && (
          <View style={styles.descriptionBand}>
            <View style={styles.descriptionInner}>
              <Text style={[styles.descriptionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('productDetails')}</Text>
              <View style={styles.descriptionBlocks}>
                {descriptionBlocks.map((block, index) => {
                  const direction = textDirection(block.text, language);
                  if (block.kind === 'heading') return <Text key={`${block.kind}-${index}`} style={[styles.descriptionHeading, { textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }]}>{block.text}</Text>;
                  if (block.kind === 'item') return <View key={`${block.kind}-${index}`} style={[styles.descriptionItem, { direction, flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }]}><View style={styles.descriptionBullet} /><Text style={[styles.descriptionText, styles.descriptionItemText, { textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }]}>{block.text}</Text></View>;
                  return <Text key={`${block.kind}-${index}`} style={[styles.descriptionText, { textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }]}>{block.text}</Text>;
                })}
              </View>
            </View>
          </View>
        )}
        {!!related.length && (
          <View style={styles.relatedBand}>
            <View style={styles.relatedInner}>
              <SectionTitle title={language === 'ar' ? 'منتجات ممكن تعجبك' : 'You may also like'} action={language === 'ar' ? 'عرض الكل' : 'View all'} onPress={() => router.push('/(tabs)/catalog')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedList}>
                {related.map((item) => <ProductCard key={item.id} product={item} wide />)}
              </ScrollView>
            </View>
          </View>
        )}
      </ScrollView>
      {!wide ? (
        <View style={[styles.stickyPurchase, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}> 
          <View style={[styles.stickyPriceCopy, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text style={styles.stickyPriceLabel}>{t('subtotal')}</Text>
            <Text style={styles.stickyPrice}>{formatAED(currentPrice * quantity)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !available }} disabled={!available} style={({ pressed }) => [styles.stickyAdd, added && styles.added, !available && styles.disabled, pressed && available && styles.primaryPressed]} onPress={add}>
            {added ? <Check size={18} color="#FFFFFF" strokeWidth={2.7} /> : <ShoppingBag size={18} color="#FFFFFF" strokeWidth={2.3} />}
            <Text numberOfLines={1} style={styles.stickyAddText}>{added ? t('added') : available ? t('addToCart') : t('unavailable')}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ServiceBadge({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <View style={styles.serviceBadge}><Icon size={17} color={colors.primary} strokeWidth={2.2} /><Text style={styles.serviceText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 12 },
  errorIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  backToStore: { height: 44, borderRadius: radius.md, paddingHorizontal: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  backToStoreText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  topBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  topBarInner: { width: '100%', maxWidth: 980, minHeight: 62, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  topBarTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '900', textAlign: 'center', marginHorizontal: 8 },
  topBarActions: { flexDirection: 'row', gap: 7 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  compareButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.68 },
  primaryPressed: { opacity: 0.82 },
  content: { paddingBottom: 36 },
  contentMobile: { paddingBottom: 24 },
  page: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 16, gap: 20 },
  pageWide: { alignItems: 'flex-start', gap: 30, paddingTop: 24 },
  galleryColumn: { flex: 1, width: '100%', minWidth: 0 },
  imagePanel: { width: '100%', maxHeight: 460, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '97%', height: '97%' },
  imageBadge: { position: 'absolute', left: 12, bottom: 12, height: 30, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 5, alignItems: 'center' },
  imageBadgeText: { color: colors.primaryDark, fontSize: 9, fontWeight: '900' },
  thumbs: { paddingTop: 10, gap: 8 },
  thumbButton: { width: 64, height: 64, borderRadius: radius.md, padding: 3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  thumbButtonActive: { borderColor: colors.primary, borderWidth: 2 },
  thumb: { width: '100%', height: '100%', borderRadius: radius.sm },
  detailsColumn: { flex: 1, width: '100%', minWidth: 0, paddingTop: 2 },
  vendor: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  title: { color: colors.text, fontSize: 22, lineHeight: 30, fontWeight: '800', marginTop: 6 },
  priceRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  priceCopy: { gap: 2 },
  price: { color: colors.primary, fontSize: 23, fontWeight: '900' },
  comparePrice: { color: colors.textSubtle, fontSize: 12, textDecorationLine: 'line-through' },
  stock: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, paddingHorizontal: 10, borderRadius: radius.pill },
  stockMuted: { backgroundColor: colors.surfaceMuted },
  stockText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  stockTextMuted: { color: colors.muted },
  serviceBand: { marginTop: 17, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, gap: 10 },
  serviceBadge: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  section: { marginTop: 20 },
  label: { color: colors.text, fontSize: 14, fontWeight: '900' },
  variants: { flexWrap: 'wrap', gap: 8, marginTop: 10 },
  variant: { paddingHorizontal: 13, minHeight: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  variantActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  variantText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  variantTextActive: { color: colors.primary, fontWeight: '900' },
  qtyRow: { marginTop: 20, alignItems: 'center', justifyContent: 'space-between' },
  qtyHint: { color: colors.textSubtle, fontSize: 10, marginTop: 3 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', height: 42, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  qtyButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  qty: { width: 36, textAlign: 'center', color: colors.text, fontSize: 14, fontWeight: '900' },
  add: { height: 54, marginTop: 21, paddingHorizontal: 15, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  added: { backgroundColor: colors.success },
  disabled: { backgroundColor: colors.textSubtle },
  addText: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  ask: { minHeight: 62, marginTop: 10, paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  askCopy: { flex: 1, minWidth: 0, gap: 2 },
  askHint: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  askText: { color: colors.primary, fontSize: 12, lineHeight: 17, fontWeight: '900' },
  descriptionBand: { width: '100%', borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  descriptionInner: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 17, paddingVertical: 22 },
  descriptionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 13 },
  descriptionBlocks: { gap: 9 },
  descriptionHeading: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '900', marginTop: 5 },
  descriptionText: { color: colors.muted, fontSize: 13, lineHeight: 22 },
  descriptionItem: { alignItems: 'flex-start', gap: 9 },
  descriptionItemText: { flex: 1 },
  descriptionBullet: { width: 5, height: 5, borderRadius: 3, marginTop: 9, backgroundColor: colors.primary },
  relatedBand: { width: '100%', borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  relatedInner: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 16 },
  relatedList: { paddingBottom: 8 },
  stickyPurchase: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', gap: 12 },
  stickyPriceCopy: { width: 96 },
  stickyPriceLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  stickyPrice: { color: colors.primary, fontSize: 16, fontWeight: '900', marginTop: 2 },
  stickyAdd: { flex: 1, minWidth: 0, height: 50, borderRadius: radius.md, backgroundColor: colors.primary, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stickyAddText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
