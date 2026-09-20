import React, { useEffect, useState } from 'react';
import { ImageBackground, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { API_ORIGIN } from '@/services/catalog';
import { localizedCategoryName, storefrontDepartmentDescription, type StorefrontSection } from '@/constants/categories';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

const fallbackImages: Record<number, ImageSourcePropType> = {
  1: require('../../assets/category-seeds.webp'),
  9: require('../../assets/category-fertilizers.webp'),
  10: require('../../assets/category-irrigation.webp'),
  11: require('../../assets/category-tools.webp'),
};

function DepartmentCard({ section, onPress }: { section: StorefrontSection; onPress: () => void }) {
  const { language, isRTL } = useLanguage();
  const [remoteFailed, setRemoteFailed] = useState(false);
  const remote = section.category.image
    ? (/^https?:\/\//i.test(section.category.image)
      ? section.category.image
      : `${API_ORIGIN}${section.category.image.startsWith('/') ? '' : '/'}${section.category.image}`)
    : '';
  useEffect(() => setRemoteFailed(false), [remote]);
  const source: ImageSourcePropType = remote && !remoteFailed
    ? { uri: remote, cache: 'force-cache' }
    : fallbackImages[section.category.id];
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const title = localizedCategoryName(section.category, language);
  const description = storefrontDepartmentDescription(section.category.id, language);
  return (
    <MotionPressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={[styles.card, shadow]}>
      <ImageBackground source={source} resizeMode="cover" style={styles.image} imageStyle={styles.imageRadius} onError={() => setRemoteFailed(true)}>
        <View style={styles.overlay} />
        <View style={styles.topRow}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{section.productCount}</Text>
          </View>
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={2} style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
          <Text numberOfLines={2} style={[styles.description, { textAlign: isRTL ? 'right' : 'left' }]}>{description}</Text>
          <View style={[styles.cta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={styles.ctaText}>{language === 'ar' ? 'تصفح القسم' : 'Explore'}</Text>
            <Arrow size={15} color="#FFFFFF" />
          </View>
        </View>
      </ImageBackground>
    </MotionPressable>
  );
}

export function StoreDepartmentGrid({ sections, onOpenCategory }: {
  sections: StorefrontSection[];
  onOpenCategory: (categoryId: number) => void;
}) {
  return (
    <View style={styles.grid}>
      {sections.map((section) => (
        <DepartmentCard key={section.category.id} section={section} onPress={() => onOpenCategory(section.category.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  card: { width: '47.5%', aspectRatio: 0.88, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.primaryDark },
  image: { flex: 1, justifyContent: 'space-between' },
  imageRadius: { borderRadius: radius.md },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(10, 36, 24, 0.48)' },
  topRow: { minHeight: 38, padding: spacing.sm, alignItems: 'flex-end' },
  countBadge: { minWidth: 30, height: 26, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  countText: { ...typography.caption, color: colors.primaryDark, fontWeight: '700', writingDirection: 'ltr' },
  copy: { padding: spacing.md, paddingTop: spacing.xl },
  title: { ...typography.section, fontSize: 17, lineHeight: 23, color: '#FFFFFF', fontWeight: '700' },
  description: { ...typography.caption, color: 'rgba(255,255,255,0.82)', marginTop: spacing.xs, minHeight: 36 },
  cta: { minHeight: 32, marginTop: spacing.sm, alignItems: 'center', gap: spacing.xs },
  ctaText: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
});
