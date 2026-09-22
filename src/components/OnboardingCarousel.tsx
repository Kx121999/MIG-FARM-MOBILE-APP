import React, { useRef, useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PackageCheck, ShieldCheck, Truck, type LucideIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/Motion';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

type Slide = { icon: LucideIcon; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string };

const slides: Slide[] = [
  {
    icon: PackageCheck,
    titleAr: 'كل احتياجات مزرعتك في مكان واحد',
    titleEn: 'Everything your farm needs, in one place',
    bodyAr: 'بذور ومغذيات ومعدات ومستلزمات ري مختارة لكل موسم.',
    bodyEn: 'Seeds, nutrients, equipment, and irrigation supplies picked for every season.',
  },
  {
    icon: Truck,
    titleAr: 'توصيل لكل الإمارات',
    titleEn: 'Delivery across the UAE',
    bodyAr: 'كتالوج مباشر من Odoo وتوصيل يوصلك أينما كانت مزرعتك.',
    bodyEn: 'A live Odoo catalog and delivery that reaches your farm wherever it is.',
  },
  {
    icon: ShieldCheck,
    titleAr: 'اطلب وتابع بسهولة وأمان',
    titleEn: 'Order and track with ease',
    bodyAr: 'راجع طلبك، ادفع بأمان، وتابع حالة التوصيل خطوة بخطوة.',
    bodyEn: 'Review your order, pay securely, and follow delivery status step by step.',
  },
];

export function OnboardingCarousel({ onDone }: { onDone: () => void }) {
  const { language, isRTL } = useLanguage();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width;

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: isRTL ? -clamped * width : clamped * width, animated: true });
  };

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = event.nativeEvent.contentOffset.x / width;
    const page = Math.round(isRTL ? -raw : raw);
    setIndex(Math.max(0, Math.min(slides.length - 1, page)));
  };

  const last = index === slides.length - 1;

  return (
    <LinearGradient
      colors={[colors.leaf, colors.primary, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.skipRow}>
          {!last ? (
            <MotionPressable accessibilityRole="button" accessibilityLabel={language === 'ar' ? 'تخطي' : 'Skip'} style={styles.skip} onPress={onDone}>
              <Text style={styles.skipText}>{language === 'ar' ? 'تخطي' : 'Skip'}</Text>
            </MotionPressable>
          ) : <View style={styles.skip} />}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={[styles.pager, isRTL && styles.pagerRTL]}
          contentContainerStyle={isRTL && styles.pagerRTL}
        >
          {slides.map((slide) => {
            const Icon = slide.icon;
            return (
              <View key={slide.titleEn} style={[styles.slide, { width }]}>
                <View style={styles.iconBadge}>
                  <Icon size={56} color="#FFFFFF" strokeWidth={1.6} />
                </View>
                <Text style={styles.title}>{language === 'ar' ? slide.titleAr : slide.titleEn}</Text>
                <Text style={styles.body}>{language === 'ar' ? slide.bodyAr : slide.bodyEn}</Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.dots}>
          {slides.map((slide, dotIndex) => (
            <View key={slide.titleEn} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.actionArea}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={last ? (language === 'ar' ? 'ابدأ التسوق' : 'Get started') : (language === 'ar' ? 'التالي' : 'Next')}
            style={styles.nextButton}
            onPress={() => (last ? onDone() : goTo(index + 1))}
          >
            <Text style={styles.nextText}>{last ? (language === 'ar' ? 'ابدأ التسوق' : 'Get started') : (language === 'ar' ? 'التالي' : 'Next')}</Text>
          </MotionPressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  skipRow: { minHeight: 44, paddingHorizontal: spacing.lg, alignItems: 'flex-end', justifyContent: 'center' },
  skip: { minHeight: 32, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  skipText: { ...typography.button, color: 'rgba(255,255,255,0.86)' },
  pager: { flex: 1 },
  pagerRTL: { flexDirection: 'row-reverse' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, gap: spacing.lg },
  iconBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typography.page, color: '#FFFFFF', textAlign: 'center' },
  body: { ...typography.body, color: 'rgba(255,255,255,0.82)', textAlign: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 22, backgroundColor: '#FFFFFF' },
  actionArea: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  nextButton: {
    minHeight: 52,
    borderRadius: radius.xl,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  nextText: { ...typography.button, color: colors.primaryDark, fontWeight: '800' },
});
