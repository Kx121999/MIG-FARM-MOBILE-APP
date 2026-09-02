import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Check, GitCompareArrows, Heart, Plus, Sprout } from 'lucide-react-native';
import { colors, radius } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAED, localizedProductTitle, productImage, productPrice, textDirection } from '@/services/catalog';
import { Product } from '@/types';

export function ProductCard({ product, wide = false }: { product: Product; wide?: boolean }) {
  const { addToCart, isFavorite, toggleFavorite, isCompared, toggleCompare } = useCommerce();
  const { language, isRTL, t } = useLanguage();
  const [added, setAdded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const image = productImage(product);
  const variant = product.variants.find((item) => item.available !== false) || product.variants[0];
  const favorite = isFavorite(product.id);
  const compared = isCompared(product.id);
  const available = Boolean(variant && variant.available !== false);
  const title = localizedProductTitle(product, language);
  const titleDirection = textDirection(title, language);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const add = () => {
    if (!available || !variant) return;
    addToCart(product, variant, 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setAdded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdded(false), 1300);
  };

  const toggle = () => {
    toggleFavorite(product.id);
    Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <View style={[styles.card, wide ? styles.wide : styles.grid]}>
      <Pressable accessibilityRole="button" style={styles.productTap} onPress={() => router.push({ pathname: '/product/[handle]', params: { handle: product.handle } })}>
        <View style={styles.imageWrap}>
          {!imageLoaded && !imageFailed ? <View style={styles.imageSkeleton} /> : null}
          {image && !imageFailed ? <Image source={{ uri: image, cache: 'force-cache' }} style={styles.image} resizeMode="contain" onLoad={() => setImageLoaded(true)} onError={() => setImageFailed(true)} /> : <View style={styles.imageFallback}><Sprout size={32} color={colors.leaf} strokeWidth={1.5} /></View>}
        </View>
        <Text numberOfLines={2} style={[styles.name, { textAlign: titleDirection === 'rtl' ? 'right' : 'left', writingDirection: titleDirection }]}>{title}</Text>
        <View style={[styles.priceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.price, { textAlign: isRTL ? 'right' : 'left' }]}>{formatAED(variant?.price || productPrice(product))}</Text>
          {variant && Number(variant.compare_at_price || 0) > Number(variant.price || 0) ? <Text style={styles.oldPrice}>{formatAED(variant.compare_at_price)}</Text> : null}
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Favorite" hitSlop={8} style={({ pressed }) => [styles.favorite, pressed && styles.iconPressed]} onPress={toggle}>
        <Heart size={18} color={favorite ? colors.orange : colors.muted} fill={favorite ? colors.orange : 'transparent'} strokeWidth={2} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('compare')} hitSlop={8} style={({ pressed }) => [styles.compare, compared && styles.compareActive, pressed && styles.iconPressed]} onPress={() => toggleCompare(product.id)}>
        <GitCompareArrows size={16} color={compared ? '#FFFFFF' : colors.primaryDark} strokeWidth={2.1} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !available }} disabled={!available} onPress={add} style={({ pressed }) => [styles.addButton, added && styles.added, !available && styles.disabled, pressed && available && styles.buttonPressed]}>
        {added ? <Check size={16} color="#FFFFFF" strokeWidth={2.5} /> : <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />}
        <Text numberOfLines={1} style={styles.addText}>{added ? t('added') : available ? t('addToCart') : t('unavailable')}</Text>
      </Pressable>
    </View>
  );
}

export function ProductCardSkeleton() {
  return (
    <View style={[styles.card, styles.grid, styles.skeletonCard]}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLineShort} />
      <View style={styles.skeletonButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { height: 304, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 8, overflow: 'hidden' },
  grid: { width: '48.4%', marginBottom: 12 },
  wide: { width: 174, marginEnd: 12 },
  productTap: { flex: 1 },
  imageWrap: { height: 164, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden', position: 'relative' },
  image: { width: '96%', height: '96%' },
  imageSkeleton: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#E4ECE5' },
  imageFallback: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  favorite: { position: 'absolute', zIndex: 2, top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  compare: { position: 'absolute', zIndex: 2, top: 16, left: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  compareActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  iconPressed: { opacity: 0.68, transform: [{ scale: 0.94 }] },
  name: { height: 38, color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  priceRow: { height: 28, alignItems: 'center', gap: 7, marginTop: 3, overflow: 'hidden' },
  price: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  oldPrice: { color: colors.textSubtle, fontSize: 10, fontWeight: '700', textDecorationLine: 'line-through' },
  addButton: { height: 38, marginTop: 8, marginHorizontal: 1, paddingHorizontal: 8, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  added: { backgroundColor: colors.success },
  disabled: { backgroundColor: colors.textSubtle },
  buttonPressed: { opacity: 0.78 },
  addText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  skeletonCard: { gap: 8 },
  skeletonImage: { height: 164, borderRadius: radius.md, backgroundColor: '#E4ECE5' },
  skeletonLineWide: { width: '82%', height: 12, borderRadius: 6, backgroundColor: '#E4ECE5', marginTop: 4 },
  skeletonLineShort: { width: '42%', height: 12, borderRadius: 6, backgroundColor: '#E4ECE5' },
  skeletonButton: { height: 38, borderRadius: radius.md, backgroundColor: '#E4ECE5', marginTop: 'auto' },
});
