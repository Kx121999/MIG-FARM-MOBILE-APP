import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Sprout, TriangleAlert } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { farmService } from '@/services/farm';
import type { FarmDashboard, FarmTask } from '@/types/farm';

export function FarmTodayCard() {
  const { user } = useAuth();
  const { language, isRTL } = useLanguage();
  const [dashboard, setDashboard] = useState<FarmDashboard | null>(null);

  useEffect(() => {
    if (!user) { setDashboard(null); return; }
    let active = true;
    farmService.dashboard()
      .then((data) => { if (active) setDashboard(data); })
      .catch(() => { if (active) setDashboard(null); });
    return () => { active = false; };
  }, [user?.id]);

  if (!user) return null;

  const farm = dashboard?.farms[0];
  if (!farm) {
    return (
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={language === 'ar' ? 'ابدأ ملف مزرعتك' : 'Start your farm profile'}
        onPress={() => router.push('/my-farm')}
        style={[styles.emptyCard, shadow]}
      >
        <View style={styles.icon}><Sprout size={22} color={colors.primary} /></View>
        <View style={styles.copy}>
          <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'ابدأ ملف مزرعتك' : 'Start your farm profile'}</Text>
          <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'أضف محصولك ومساحتك للحصول على إرشادات مبنية على بيانات موثقة' : 'Add your crop and area to get guidance based on verified data'}</Text>
        </View>
      </MotionPressable>
    );
  }

  const nextTask = [...(dashboard?.tasks || [])]
    .filter((task: FarmTask) => task.status === 'scheduled' || task.status === 'due')
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];

  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={language === 'ar' ? 'مزرعتك اليوم' : 'Your farm today'}
      onPress={() => router.push('/my-farm')}
      style={[styles.card, shadow]}
    >
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={[styles.eyebrow, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'مزرعتك اليوم' : 'Your farm today'}</Text>
        {(farm.activeProblemCount || 0) > 0 ? (
          <View style={styles.warning}>
            <TriangleAlert size={12} color={colors.danger} />
            <Text style={styles.warningText}>{farm.activeProblemCount}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.farmName, { textAlign: isRTL ? 'right' : 'left' }]}>{farm.name}</Text>
      <View style={[styles.stats, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{farm.activeCropCount ?? 0}</Text>
          <Text style={styles.statLabel}>{language === 'ar' ? 'محاصيل نشطة' : 'Active crops'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{farm.dueTaskCount ?? 0}</Text>
          <Text style={styles.statLabel}>{language === 'ar' ? 'مهام مستحقة' : 'Tasks due'}</Text>
        </View>
      </View>
      {nextTask ? (
        <Text numberOfLines={1} style={[styles.nextTask, { textAlign: isRTL ? 'right' : 'left' }]}>
          {language === 'ar' ? `التالي: ${nextTask.title}` : `Next: ${nextTask.title}`}
        </Text>
      ) : null}
      <View style={[styles.cta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={styles.ctaText}>{language === 'ar' ? 'عرض التفاصيل' : 'View details'}</Text>
        {isRTL ? <ChevronLeft size={16} color={colors.primary} /> : <ChevronRight size={16} color={colors.primary} />}
      </View>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, gap: spacing.sm },
  emptyCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.button, color: colors.text },
  subtitle: { ...typography.caption, color: colors.muted, marginTop: 2, lineHeight: 16 },
  header: { alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...typography.caption, color: colors.muted, fontWeight: '800' },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: '#FBEAEA' },
  warningText: { fontSize: 10, lineHeight: 14, fontWeight: '900', color: colors.danger },
  farmName: { ...typography.section, color: colors.text },
  stats: { gap: spacing.xl, marginTop: 2 },
  stat: { gap: 1 },
  statValue: { ...typography.section, color: colors.primary, fontWeight: '900' },
  statLabel: { ...typography.caption, color: colors.muted },
  nextTask: { ...typography.caption, color: colors.text },
  cta: { alignItems: 'center', gap: 4, marginTop: 2 },
  ctaText: { ...typography.caption, color: colors.primary, fontWeight: '800' },
});
