import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Beaker, Calculator, GitCompareArrows, LayoutGrid, Waves, type LucideIcon } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { SectionTitle } from '@/components/SectionTitle';

type QuickAction = { icon: LucideIcon; labelAr: string; labelEn: string; route: string };

const actions: QuickAction[] = [
  { icon: Calculator, labelAr: 'حاسبة الزراعة', labelEn: 'Planting calculator', route: '/my-farm/planting-calculator' },
  { icon: Waves, labelAr: 'احسب احتياج الري', labelEn: 'Irrigation planner', route: '/my-farm/irrigation-planner' },
  { icon: LayoutGrid, labelAr: 'تخطيط الصوبة', labelEn: 'Greenhouse layout', route: '/my-farm/greenhouse-layout' },
  { icon: Beaker, labelAr: 'جودة مياه الري', labelEn: 'Water quality', route: '/my-farm/water-quality' },
  { icon: GitCompareArrows, labelAr: 'قارن المنتجات', labelEn: 'Compare products', route: '/compare' },
];

export function QuickActionsRail() {
  const { language, isRTL } = useLanguage();
  return (
    <View style={styles.section}>
      <SectionTitle title={language === 'ar' ? 'أدوات زراعية سريعة' : 'Quick agricultural tools'} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <MotionPressable
              key={action.route}
              accessibilityRole="button"
              accessibilityLabel={language === 'ar' ? action.labelAr : action.labelEn}
              onPress={() => router.push(action.route as never)}
              style={[styles.card, shadow]}
            >
              <View style={styles.icon}><Icon size={22} color={colors.primary} strokeWidth={2} /></View>
              <Text numberOfLines={2} style={[styles.label, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? action.labelAr : action.labelEn}</Text>
            </MotionPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  row: { gap: spacing.md, paddingVertical: spacing.xs, paddingEnd: spacing.lg },
  card: { width: 128, minHeight: 112, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, gap: spacing.sm },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.caption, color: colors.text, fontWeight: '800', lineHeight: 16 },
});
