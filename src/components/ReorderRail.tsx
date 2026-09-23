import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { SectionTitle } from '@/components/SectionTitle';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { customerService } from '@/services/customer';
import { formatAED, localizedProductTitle, productAvailable } from '@/services/catalog';
import type { Product } from '@/types';

type ReorderCandidate = { product: Product; variant: Product['variants'][number]; previousQuantity: number };

export function ReorderRail({ products }: { products: Product[] }) {
  const { user } = useAuth();
  const { addToCart } = useCommerce();
  const { language, isRTL } = useLanguage();
  const [candidates, setCandidates] = useState<ReorderCandidate[] | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) { setCandidates(null); return; }
    let active = true;
    customerService.orders()
      .then((page) => {
        if (!active) return;
        const seen = new Set<string>();
        const list: ReorderCandidate[] = [];
        for (const order of page.items) {
          if (order.fulfillmentStatus !== 'delivered') continue;
          for (const item of order.items) {
            const key = `${item.productId}:${item.variantId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const product = products.find((candidate) => candidate.id === item.productId);
            const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
            if (!product || !variant) continue;
            list.push({ product, variant, previousQuantity: item.quantity });
          }
        }
        setCandidates(list.slice(0, 10));
      })
      .catch(() => { if (active) setCandidates([]); });
    return () => { active = false; };
  }, [products, user?.id]);

  const items = useMemo(() => candidates || [], [candidates]);
  if (!user || !items.length) return null;

  const add = (candidate: ReorderCandidate) => {
    const key = `${candidate.product.id}:${candidate.variant.id}`;
    addToCart(candidate.product, candidate.variant, candidate.previousQuantity);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setAdded((current) => ({ ...current, [key]: true }));
    setTimeout(() => setAdded((current) => ({ ...current, [key]: false })), 1500);
  };

  return (
    <View style={styles.section}>
      <SectionTitle title={language === 'ar' ? 'اطلب مرة ثانية' : 'Order again'} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {items.map((candidate) => {
          const key = `${candidate.product.id}:${candidate.variant.id}`;
          const title = localizedProductTitle(candidate.product, language);
          const available = productAvailable(candidate.product) && candidate.variant.available !== false;
          return (
            <View key={key} style={[styles.card, shadow]}>
              <View style={styles.imageWrap}>
                {candidate.variant.featured_image?.src || candidate.product.images?.[0]?.src ? (
                  <Image
                    source={{ uri: candidate.variant.featured_image?.src || candidate.product.images[0].src, cache: 'force-cache' }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                ) : <View style={styles.imageWrap} />}
              </View>
              <Text numberOfLines={2} style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
              <Text style={[styles.meta, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? `الكمية السابقة: ${candidate.previousQuantity}` : `Previous qty: ${candidate.previousQuantity}`}</Text>
              <View style={[styles.priceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={styles.price}>{formatAED(candidate.variant.price)}</Text>
                <Text style={[styles.stock, !available && styles.stockMuted]}>{available ? (language === 'ar' ? 'متوفر' : 'Available') : (language === 'ar' ? 'التوفر يحتاج مراجعة' : 'Availability needs review')}</Text>
              </View>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel={language === 'ar' ? 'إضافة للسلة' : 'Add to cart'}
                disabled={!available}
                onPress={() => add(candidate)}
                style={[styles.addButton, !available && styles.addButtonDisabled]}
              >
                {added[key] ? <Check size={16} color="#FFFFFF" /> : <Plus size={16} color="#FFFFFF" />}
                <Text style={styles.addText}>{language === 'ar' ? 'إضافة للسلة' : 'Add to cart'}</Text>
              </MotionPressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  row: { gap: spacing.md, paddingVertical: spacing.xs, paddingEnd: spacing.lg },
  card: { width: 168, padding: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.surface, gap: spacing.xs },
  imageWrap: { width: '100%', aspectRatio: 1.3, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  title: { ...typography.product, color: colors.text, minHeight: 34 },
  meta: { ...typography.caption, color: colors.muted },
  priceRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  price: { ...typography.button, color: colors.primary, writingDirection: 'ltr' },
  stock: { ...typography.caption, fontSize: 10, color: colors.success },
  stockMuted: { color: colors.muted },
  addButton: { minHeight: 38, marginTop: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addButtonDisabled: { backgroundColor: colors.textSubtle, opacity: 0.6 },
  addText: { ...typography.caption, color: '#FFFFFF', fontWeight: '800' },
});
