import React, { useEffect, useState } from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CategoryId, categories } from '@/constants/categories';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { API_ORIGIN } from '@/services/catalog';
import { MotionPressable } from '@/components/Motion';
import { Skeleton } from '@/components/Skeleton';

const localCategoryImages: Partial<Record<CategoryId, ImageSourcePropType>> = {
  seeds: require('../../assets/category-seeds.webp'),
  fertilizers: require('../../assets/category-fertilizers.webp'),
  pest: require('../../assets/category-pest.webp'),
  irrigation: require('../../assets/category-irrigation.webp'),
  tools: require('../../assets/category-tools.webp'),
  greenhouses: require('../../assets/category-greenhouses.webp'),
};
export function CategoryCard({ id, onPress, image }: { id: CategoryId; onPress: () => void; image?: string }) {
  const { language, isRTL } = useLanguage();
  const { fontScale } = useWindowDimensions();
  const item = categories.find((entry) => entry.id === id) ?? categories[0];
  const value = image || item.image;
  const remote = value ? (/^https?:\/\//i.test(value) ? value : `${API_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`) : '';
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [localFailed, setLocalFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setRemoteFailed(false); setLocalFailed(false); setLoaded(false); }, [id, remote]);
  const usingLocal = remoteFailed || !remote;
  const source = usingLocal ? (localFailed ? null : localCategoryImages[id]) : { uri: remote, cache: 'force-cache' as const };
  return <MotionPressable accessibilityRole="button" accessibilityLabel={item[language]} onPress={onPress} style={[styles.card, { height: 144 + 42 * Math.min(1.6, Math.max(1, fontScale)) }]}>
    <View style={styles.imageArea}>
      {!loaded && source ? <Skeleton style={StyleSheet.absoluteFill} /> : null}
      {source ? <Image source={source} style={styles.image} resizeMode={item.imageFit || 'contain'} onLoad={() => setLoaded(true)} onError={() => { if (usingLocal) setLocalFailed(true); else setRemoteFailed(true); }} />
        : <Text style={styles.fallback}>MIG FARM</Text>}
    </View>
    <Text maxFontSizeMultiplier={1.6} numberOfLines={2} style={[styles.label, { textAlign: isRTL ? 'right' : 'left' }]}>{item[language]}</Text>
  </MotionPressable>;
}
const styles = StyleSheet.create({
  card: { width: 132, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  imageArea: { height: 124, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, marginBottom: spacing.sm, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  fallback: { ...typography.caption, color: colors.muted },
  label: { ...typography.product, color: colors.text },
});
