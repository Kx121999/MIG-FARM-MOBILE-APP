import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, GitCompareArrows, Heart, ImageOff, Plus } from 'lucide-react-native';
import { colors, glow, radius, shadow, sizes, spacing, typography } from '@/constants/theme';
import { MotionPressable } from '@/components/Motion';
import { Skeleton } from '@/components/Skeleton';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAED, localizedProductTitle, productImage, productPrice, textDirection } from '@/services/catalog';
import { Product } from '@/types';

function useCardMetrics() {
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(1.6, Math.max(1, fontScale));
  return {
    titleHeight: 42 * scale,
    priceHeight: 44 * scale,
    metaHeight: 24 * scale,
  };
}

export function ProductCard({ product, wide = false, cardWidth, categoryId }: { product: Product; wide?: boolean; cardWidth?: number; categoryId?: number }) {
  const { addToCart, isFavorite, toggleFavorite, isCompared, toggleCompare } = useCommerce();
  const { language, isRTL, t } = useLanguage();
  const metrics = useCardMetrics();
  const [added, setAdded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uri = productImage(product);
  const variant = product.variants.find((item) => item.available === true) || product.variants[0];
  const favorite = isFavorite(product.id);
  const compared = isCompared(product.id);
  const available = Boolean(variant && variant.available === true);
  const title = localizedProductTitle(product, language);
  const titleDirection = textDirection(title, language);
  const discounted = variant && Number(variant.compare_at_price || 0) > Number(variant.price || 0);
  useEffect(() => { setImageLoaded(false); setImageFailed(false); }, [uri]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const add = () => {
    if (!available || !variant) return;
    addToCart(product, variant, 1);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setAdded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdded(false), 1500);
  };

  return <View testID="product-card" style={[styles.card, shadow, wide ? styles.wide : styles.grid, cardWidth ? { width: cardWidth } : null]}>
    <MotionPressable accessibilityRole="button" accessibilityLabel={title} style={styles.productTap} onPress={() => router.push({ pathname: '/product/[handle]', params: { handle: product.handle, ...(categoryId ? { category: String(categoryId) } : {}) } })}>
      <View style={styles.imageWrap}>
        {!imageLoaded && !imageFailed && uri ? <Skeleton style={StyleSheet.absoluteFill} /> : null}
        {uri && !imageFailed ? <Image accessibilityLabel={title} source={{ uri, cache: 'force-cache' }} style={styles.image} resizeMode="contain" onLoad={() => setImageLoaded(true)} onError={() => setImageFailed(true)} />
          : <View style={styles.fallback}><ImageOff size={28} color={colors.textSubtle} strokeWidth={1.5} /><Text numberOfLines={2} style={styles.fallbackText}>{language === 'ar' ? 'الصورة غير متاحة' : 'Image unavailable'}</Text></View>}
      </View>
      <Text maxFontSizeMultiplier={1.6} numberOfLines={2} style={[styles.name, { height: metrics.titleHeight, textAlign: titleDirection === 'rtl' ? 'right' : 'left', writingDirection: titleDirection }]}>{title}</Text>
      <View style={[styles.priceArea, { height: metrics.priceHeight, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={styles.priceBadge}>
          <Text maxFontSizeMultiplier={1.6} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.price}>{formatAED(variant?.price || productPrice(product))}</Text>
        </View>
        {discounted ? <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={styles.oldPrice}>{formatAED(variant.compare_at_price)}</Text> : null}
      </View>
      <View style={[styles.meta, { height: metrics.metaHeight, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text numberOfLines={1} style={[styles.stock, available && styles.stockAvailable]}>{available ? t('available') : t('unavailable')}</Text>
        {product.variants.length > 1 ? <Text numberOfLines={1} style={styles.variantCount}>{language === 'ar' ? `${product.variants.length} خيارات` : `${product.variants.length} options`}</Text> : null}
      </View>
    </MotionPressable>
    <MotionPressable accessibilityRole="button" accessibilityLabel={favorite ? (language === 'ar' ? 'إزالة من المفضلة' : 'Remove from favorites') : t('favorites')} accessibilityState={{ selected: favorite }}
      style={[styles.favorite, isRTL ? { left: 8 } : { right: 8 }]} onPress={() => toggleFavorite(product.id)}>
      <Heart size={20} color={favorite ? colors.primary : colors.muted} fill={favorite ? colors.primary : 'transparent'} strokeWidth={1.7} />
    </MotionPressable>
    <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <MotionPressable accessibilityRole="button" accessibilityLabel={t('compare')} accessibilityState={{ selected: compared }} style={[styles.compare, compared && styles.compareActive]} onPress={() => toggleCompare(product.id)}>
        <GitCompareArrows size={20} color={compared ? colors.primary : colors.muted} />
      </MotionPressable>
      <MotionPressable accessibilityRole="button" accessibilityLabel={added ? t('added') : t('addToCart')} accessibilityState={{ disabled: !available }} disabled={!available} onPress={add} style={[styles.addButton, !available && styles.disabled]}>
        {!available ? null : (
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={[colors.leaf, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        {added ? <Check size={20} color={colors.surface} /> : <Plus size={20} color={colors.surface} />}
      </MotionPressable>
    </View>
    <Text accessibilityLiveRegion="polite" style={styles.srOnly}>{added ? (language === 'ar' ? 'تمت إضافة المنتج إلى السلة' : 'Product added to cart') : ''}</Text>
  </View>;
}

export function ProductCardSkeleton({ wide = false }: { wide?: boolean }) {
  const metrics = useCardMetrics();
  return <View testID="product-skeleton" style={[styles.card, wide ? styles.wide : styles.grid]}>
    <Skeleton style={styles.imageWrap} />
    <View style={{ height: metrics.titleHeight, gap: 8, paddingTop: 4 }}><Skeleton style={{ height: 12, width: '92%' }} /><Skeleton style={{ height: 12, width: '66%' }} /></View>
    <View style={{ height: metrics.priceHeight, paddingTop: 8 }}><Skeleton style={{ height: 16, width: '48%' }} /></View>
    <View style={{ height: metrics.metaHeight }} />
    <Skeleton style={{ height: sizes.touch, marginTop: spacing.sm }} />
  </View>;
}
const styles = StyleSheet.create({
  card: { minWidth: 0, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.sm, overflow: 'hidden' },
  grid: { width: '48.4%', marginBottom: spacing.md },
  wide: { width: 180 },
  productTap: { minWidth: 0 },
  imageWrap: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, marginBottom: spacing.sm, overflow: 'hidden', borderRadius: radius.sm },
  image: { width: '100%', height: '100%' },
  fallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, gap: spacing.sm },
  fallbackText: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  favorite: { position: 'absolute', top: 8, width: sizes.touch, height: sizes.touch, borderRadius: sizes.touch / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  name: { ...typography.product, color: colors.text },
  priceArea: { alignItems: 'center', marginTop: spacing.xs, gap: spacing.xs },
  priceBadge: { backgroundColor: colors.primaryDark, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 3 },
  price: { fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: 0, color: colors.surface, writingDirection: 'ltr' },
  oldPrice: { ...typography.caption, color: colors.textSubtle, textDecorationLine: 'line-through', writingDirection: 'ltr' },
  meta: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, overflow: 'hidden' },
  stock: { ...typography.caption, fontSize: 10, color: colors.muted, flexShrink: 1 },
  stockAvailable: { color: colors.success },
  variantCount: { ...typography.caption, fontSize: 10, color: colors.muted, flexShrink: 1 },
  actions: { height: sizes.touch, alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.sm },
  compare: { width: sizes.touch, height: sizes.touch, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  compareActive: { backgroundColor: colors.primarySoft },
  addButton: { width: sizes.touch, height: sizes.touch, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...glow },
  disabled: { backgroundColor: colors.textSubtle, opacity: 0.5 },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
