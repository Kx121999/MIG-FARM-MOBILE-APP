import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StoreCategory } from '@/types';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { API_ORIGIN } from '@/services/catalog';
import { MotionPressable } from '@/components/Motion';
import { Skeleton } from '@/components/Skeleton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { localizedCategoryName } from '@/constants/categories';

export function CategoryCard({ category, onPress, image }: { category: StoreCategory; onPress: () => void; image?: string | null }) {
  const { isRTL, language } = useLanguage();
  const { fontScale } = useWindowDimensions();
  const remote = image
    ? (/^https?:\/\//i.test(image) ? image : `${API_ORIGIN}${image.startsWith('/') ? '' : '/'}${image}`)
    : '';
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setFailed(false); setLoaded(false); }, [category.id, remote]);
  const source = remote && !failed ? { uri: remote, cache: 'force-cache' as const } : null;
  const scale = Math.min(1.6, Math.max(1, fontScale));
  const label = localizedCategoryName(category, language);
  return <MotionPressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.card, shadow, { height: 136 + 38 * scale }]}>
    <View style={styles.imageArea}>
      {!loaded && source ? <Skeleton style={StyleSheet.absoluteFill} /> : null}
      {source ? <Image source={source} style={styles.image} resizeMode="contain" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
        : <CategoryIcon id={category.id} size={34} boxSize={62} />}
    </View>
    <Text maxFontSizeMultiplier={1.6} numberOfLines={2} style={[styles.label, { height: 38 * scale, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
  </MotionPressable>;
}

const styles = StyleSheet.create({
  card: { width: 136, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  imageArea: { height: 112, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, marginBottom: spacing.sm, overflow: 'hidden', borderRadius: radius.sm },
  image: { width: '100%', height: '100%' },
  label: { ...typography.product, color: colors.text },
});
