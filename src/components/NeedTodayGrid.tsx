import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FlaskConical, Search, Sprout, Stethoscope, Droplets, type LucideIcon } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { SectionTitle } from '@/components/SectionTitle';

type NeedAction = { icon: LucideIcon; labelAr: string; labelEn: string; onPress: () => void };

function categoryRoute(categoryId: string) {
  return { pathname: '/(tabs)/catalog' as const, params: { category: categoryId } };
}

export function NeedTodayGrid() {
  const { language, isRTL } = useLanguage();

  const actions: NeedAction[] = [
    { icon: Sprout, labelAr: 'أريد زراعة محصول', labelEn: 'I want to plant a crop', onPress: () => router.push(categoryRoute('1')) },
    { icon: Stethoscope, labelAr: 'عندي مشكلة في النبات', labelEn: 'My plant has a problem', onPress: () => router.push('/my-farm/diagnose') },
    { icon: FlaskConical, labelAr: 'أحتاج سماد', labelEn: 'I need fertilizer', onPress: () => router.push(categoryRoute('9')) },
    { icon: Droplets, labelAr: 'أحتاج نظام ري', labelEn: 'I need an irrigation system', onPress: () => router.push(categoryRoute('10')) },
    { icon: Search, labelAr: 'أبحث عن بذور', labelEn: 'Looking for seeds', onPress: () => router.push('/(tabs)/search') },
  ];

  return (
    <View style={styles.section}>
      <SectionTitle title={language === 'ar' ? 'ماذا تحتاج اليوم؟' : 'What do you need today?'} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <MotionPressable
              key={action.labelEn}
              accessibilityRole="button"
              accessibilityLabel={language === 'ar' ? action.labelAr : action.labelEn}
              onPress={action.onPress}
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
