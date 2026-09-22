import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { localizedCategoryName, storefrontDepartmentDescription, type StorefrontSection } from '@/constants/categories';
import { colors, glow, radius, sizes, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

export const STOREFRONT_DEPARTMENT_IMAGE_FILES = {
  1: 'department-seeds.png',
  9: 'department-fertilizers.png',
  10: 'department-irrigation.png',
  11: 'department-tools.png',
} as const;

const departmentImages: Record<number, ImageSourcePropType> = {
  1: require('../../assets/storefront/department-seeds.png'),
  9: require('../../assets/storefront/department-fertilizers.png'),
  10: require('../../assets/storefront/department-irrigation.png'),
  11: require('../../assets/storefront/department-tools.png'),
};

function DepartmentCard({ section, onPress }: { section: StorefrontSection; onPress: () => void }) {
  const { language, isRTL } = useLanguage();
  const { width } = useWindowDimensions();
  const imageSize = (Math.min(width, sizes.page) - spacing.lg * 2) * 0.475;
  const source = departmentImages[section.category.id];
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const title = localizedCategoryName(section.category, language);
  const description = storefrontDepartmentDescription(section.category.id, language);
  return (
    <MotionPressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={[styles.card, glow]}>
      <View style={[styles.imageFrame, { height: imageSize }]}>
        <Image source={source} resizeMode="cover" style={[styles.image, { height: imageSize }]} />
        <View style={styles.topRow}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{section.productCount}</Text>
          </View>
        </View>
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={2} style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
        <Text numberOfLines={2} style={[styles.description, { textAlign: isRTL ? 'right' : 'left' }]}>{description}</Text>
        <View style={[styles.cta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={styles.ctaText}>{language === 'ar' ? 'تصفح القسم' : 'Explore'}</Text>
          <Arrow size={15} color={colors.primary} />
        </View>
      </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: spacing.md, rowGap: spacing.md },
  card: { width: '47.5%', borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface },
  imageFrame: { width: '100%', aspectRatio: 1, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  image: { width: '100%' },
  topRow: { position: 'absolute', top: 0, right: 0, left: 0, minHeight: 38, padding: spacing.sm, alignItems: 'flex-end' },
  countBadge: { minWidth: 30, height: 26, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  countText: { ...typography.caption, color: colors.primaryDark, fontWeight: '700', writingDirection: 'ltr' },
  copy: { minHeight: 138, padding: spacing.md, backgroundColor: colors.surface },
  title: { ...typography.section, height: 40, fontSize: 15, lineHeight: 20, color: colors.text, fontWeight: '700' },
  description: { ...typography.caption, height: 30, lineHeight: 15, color: colors.muted, marginTop: spacing.xs },
  cta: { minHeight: 32, marginTop: spacing.sm, alignItems: 'center', gap: spacing.xs },
  ctaText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
