import React, { useEffect, useMemo, useState } from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { CategoryId, categories } from '@/constants/categories';
import { colors, radius, shadow } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { API_ORIGIN } from '@/services/catalog';

const localCategoryImages: Partial<Record<CategoryId, ImageSourcePropType>> = {
  seeds: require('../../assets/category-seeds.png'),
  fertilizers: require('../../assets/category-fertilizers.jpg'),
  pest: require('../../assets/category-pest.jpg'),
  irrigation: require('../../assets/category-irrigation.png'),
  tools: require('../../assets/category-tools.png'),
  greenhouses: require('../../assets/category-greenhouses.png'),
};

function remoteUri(value?: string) {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `${API_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`;
}

export function CategoryCard({ id, onPress, image }: { id: CategoryId; onPress: () => void; image?: string }) {
  const { language, isRTL } = useLanguage();
  const item = categories.find((entry) => entry.id === id) ?? categories[0];
  const Arrow = isRTL ? ChevronLeft : ChevronRight;
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [localFailed, setLocalFailed] = useState(false);
  const backendUri = remoteUri(image || item.image);
  const localSource = localCategoryImages[id];
  const usingLocal = imageState === 'error' || !backendUri;
  const source = useMemo(() => localFailed ? null : usingLocal ? localSource : { uri: backendUri, cache: 'force-cache' as const }, [backendUri, localFailed, localSource, usingLocal]);

  useEffect(() => {
    if (backendUri) Image.prefetch(backendUri).catch(() => undefined);
  }, [backendUri]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item[language]}
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadow, pressed && styles.pressed]}
    >
      <View style={styles.imageArea}>
        {imageState === 'loading' ? <View style={styles.skeleton} /> : null}
        {source ? <Image source={source} style={styles.image} resizeMode={item.imageFit || 'contain'} onLoad={() => setImageState('loaded')} onError={() => { if (usingLocal) setLocalFailed(true); else setImageState('error'); }} /> : <View style={styles.neutralFallback} />}
      </View>
      <View style={[styles.footer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text numberOfLines={2} style={[styles.label, { textAlign: isRTL ? 'right' : 'left' }]}>{item[language]}</Text>
        <Arrow size={16} color={item.color} strokeWidth={2.3} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 148, height: 198, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.82 },
  imageArea: { height: 142, margin: 8, marginBottom: 0, overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surfaceMuted, position: 'relative' },
  image: { width: '100%', height: '100%' },
  skeleton: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#E4ECE5' },
  neutralFallback: { flex: 1, backgroundColor: colors.primarySoft },
  footer: { flex: 1, alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 12 },
  label: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '900' },
});
