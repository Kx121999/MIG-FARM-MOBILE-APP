import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, CalendarDays, Droplets, Flame, Leaf, Sprout, type LucideIcon } from 'lucide-react-native';
import { MotionPressable, useReducedMotion } from '@/components/Motion';
import { colors, glow, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { farmIntelligenceService } from '@/services/farmIntelligence';

const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type SeasonTip = {
  months: number[];
  icon: LucideIcon;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  sourceAr: string;
  sourceEn: string;
};

const fallbackSource = {
  sourceAr: 'المصدر: مواسم الزراعة المعتمدة في الإمارات',
  sourceEn: 'Source: UAE regional planting calendars',
};

const tips: SeasonTip[] = [
  {
    months: [10, 11, 12, 1, 2, 3],
    icon: Leaf,
    titleAr: 'موسم الزراعة الرئيسي',
    titleEn: 'Main growing season',
    bodyAr: 'من أكتوبر إلى مارس أفضل وقت لمعظم خضروات الموسم البارد: الخس والسبانخ والجزر والفول.',
    bodyEn: 'October to March is best for cool-season vegetables: lettuce, spinach, carrots, and beans.',
    ...fallbackSource,
  },
  {
    months: [8, 9],
    icon: Droplets,
    titleAr: 'نافذة الزراعة الصيفية',
    titleEn: 'Warm-season window',
    bodyAr: 'أواخر أغسطس وسبتمبر وقت زراعة الطماطم والفلفل والخيار قبل دخول موسم الشتاء.',
    bodyEn: 'Late August and September are for planting tomatoes, peppers, and cucumbers before winter.',
    ...fallbackSource,
  },
  {
    months: [4, 5],
    icon: Flame,
    titleAr: 'محاصيل تتحمل الحرارة',
    titleEn: 'Heat-tolerant crops',
    bodyAr: 'إبريل ومايو مناسبان لمحاصيل تتحمل الحرارة زي البامية والفلفل الحار.',
    bodyEn: 'April and May suit heat-tolerant crops like okra and hot peppers.',
    ...fallbackSource,
  },
  {
    months: [6, 7],
    icon: Sprout,
    titleAr: 'عناية وتخطيط للموسم القادم',
    titleEn: 'Care and next-season planning',
    bodyAr: 'يونيو ويوليو للعناية بالأعشاب المقاومة للحرارة زي الريحان، والتخطيط لموسم الخريف.',
    bodyEn: 'June and July are for tending heat-tolerant herbs like basil and planning the autumn season.',
    ...fallbackSource,
  },
];

const SEEDS_CATEGORY_ID = '1';

type VerifiedTip = { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; sourceAr: string; sourceEn: string };

export function SeasonalGrowingTip() {
  const { language, isRTL } = useLanguage();
  const reduced = useReducedMotion();
  const currentMonth = new Date().getMonth() + 1;
  const [verifiedTips, setVerifiedTips] = useState<VerifiedTip[] | null>(null);

  useEffect(() => {
    let active = true;
    farmIntelligenceService.plantingCalendar(currentMonth, 'field')
      .then((response) => {
        if (!active) return;
        const monthLabel = monthAbbr[currentMonth - 1];
        const crops = response.items
          .map((item) => item.payload as Record<string, unknown>)
          .filter((payload) => Array.isArray(payload.field_months) && (payload.field_months as string[]).includes(monthLabel))
          .slice(0, 4);
        if (!crops.length) return;
        setVerifiedTips(crops.map((crop): VerifiedTip => ({
          titleAr: String(crop.name_ar || crop.name_en || ''),
          titleEn: String(crop.name_en || crop.name_ar || ''),
          bodyAr: String(crop.note || `وقت زراعة ${crop.name_ar || crop.name_en} في الحقل الآن.`),
          bodyEn: String(crop.note || `Now is a good time to field-plant ${crop.name_en}.`),
          sourceAr: 'المصدر: التقويم الزراعي المعتمد من وزارة التغير المناخي والبيئة',
          sourceEn: 'Source: MOCCAE-verified UAE planting calendar',
        })));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [currentMonth]);

  const activeTips = useMemo<Array<VerifiedTip & { icon: LucideIcon }>>(() => {
    if (verifiedTips?.length) return verifiedTips.map((tip) => ({ ...tip, icon: Sprout }));
    return tips;
  }, [verifiedTips]);
  const order = useMemo(() => {
    if (verifiedTips?.length) return [...Array(activeTips.length).keys()];
    const activeIndex = Math.max(0, tips.findIndex((tip) => tip.months.includes(currentMonth)));
    return [...Array(activeTips.length).keys()].map((offset) => (activeIndex + offset) % activeTips.length);
  }, [activeTips.length, currentMonth, verifiedTips]);
  const [step, setStep] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => { setStep(0); }, [order.length]);

  useEffect(() => {
    if (reduced) return;
    const interval = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
        if (!finished) return;
        setStep((current) => (current + 1) % order.length);
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: Platform.OS !== 'web' }).start();
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [opacity, order.length, reduced]);

  const tip = activeTips[order[step]] || activeTips[0];
  const Icon = tip.icon;

  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={language === 'ar' ? tip.titleAr : tip.titleEn}
      onPress={() => router.push({ pathname: '/(tabs)/catalog', params: { category: SEEDS_CATEGORY_ID } })}
      style={styles.wrap}
    >
      <LinearGradient
        colors={[colors.leaf, colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={styles.headerLeft}>
            <CalendarDays size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.eyebrow}>{language === 'ar' ? 'الموسم الزراعي الآن' : 'This season in the UAE'}</Text>
          </View>
          <View style={styles.verified}>
            <BadgeCheck size={12} color="#FFFFFF" />
            <Text style={styles.verifiedText}>{language === 'ar' ? 'بيانات موثّقة' : 'Verified'}</Text>
          </View>
        </View>

        <Animated.View style={[styles.body, { flexDirection: isRTL ? 'row-reverse' : 'row', opacity }]}>
          <View style={styles.iconBadge}>
            <Icon size={26} color="#FFFFFF" strokeWidth={1.8} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? tip.titleAr : tip.titleEn}</Text>
            <Text numberOfLines={2} style={[styles.text, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? tip.bodyAr : tip.bodyEn}</Text>
          </View>
        </Animated.View>

        <View style={[styles.footer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.dots, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {order.map((_, index) => (
              <View key={index} style={[styles.dot, index === step && styles.dotActive]} />
            ))}
          </View>
          <Text style={[styles.source, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? tip.sourceAr : tip.sourceEn}</Text>
        </View>
      </LinearGradient>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radius.xl, ...glow },
  card: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, overflow: 'hidden' },
  header: { alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  eyebrow: { ...typography.caption, color: 'rgba(255,255,255,0.9)', fontWeight: '800' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)' },
  verifiedText: { fontSize: 10, lineHeight: 14, fontWeight: '800', color: '#FFFFFF' },
  body: { alignItems: 'center', gap: spacing.md },
  iconBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { ...typography.button, color: '#FFFFFF', fontWeight: '800' },
  text: { ...typography.caption, color: 'rgba(255,255,255,0.86)', lineHeight: 17 },
  footer: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dots: { alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 14, backgroundColor: '#FFFFFF' },
  source: { flex: 1, fontSize: 9, lineHeight: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
});
