import React, { useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { AppIconButton } from '@/components/AppIconButton';
import { BrandLogo } from '@/components/BrandLogo';
import { useReducedMotion } from '@/components/Motion';
import { colors, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

const slides = [
  { image: require('../../assets/home-farm.webp'), fit: 'cover' as const,
    ar: ['كل احتياجات زراعتك في مكان واحد', 'بذور، أسمدة، مبيدات، أدوات ومستلزمات زراعية مختارة بعناية.'],
    en: ['Everything you need to grow, in one place', 'Carefully selected seeds, fertilizers, crop care, tools and growing supplies.'] },
  { image: require('../../assets/category-seeds.webp'), fit: 'contain' as const,
    ar: ['اختيار أسهل لزراعة أفضل', 'اكتشف المنتجات المناسبة واطلب المساعدة الزراعية وقت ما تحتاج.'],
    en: ['Better choices. Better growing.', 'Discover the right products and ask for growing guidance whenever you need it.'] },
  { image: require('../../assets/category-tools.webp'), fit: 'contain' as const,
    ar: ['اطلب بسهولة داخل الإمارات', 'تجربة شراء واضحة وسريعة من اختيار المنتج حتى استلام الطلب.'],
    en: ['Shop with ease across the UAE', 'A clear shopping experience, from choosing your products to receiving your order.'] },
];

export function Onboarding({ onComplete, saving }: { onComplete: () => void; saving: boolean }) {
  const { language, isRTL, setLanguage } = useLanguage();
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const pager = useRef<ScrollView>(null);
  const physicalIndex = (logical: number) => isRTL ? slides.length - 1 - logical : logical;
  const goTo = (next: number) => { setIndex(next); pager.current?.scrollTo({ x: physicalIndex(next) * width, animated: !reduced }); };
  const ordered = isRTL ? [...slides].reverse() : slides;
  const Back = isRTL ? ArrowRight : ArrowLeft;

  return <SafeAreaView {...(Platform.OS === 'web' ? { dir: 'ltr' } : {})} style={styles.safe}>
    <View style={styles.page}>
      <View style={[styles.top, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <BrandLogo width={112} />
        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'} onPress={() => setLanguage(isRTL ? 'en' : 'ar')} style={styles.textButton}>
            <Text style={styles.language}>{isRTL ? 'English' : 'العربية'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={onComplete} style={styles.textButton}>
            <Text style={styles.skip}>{isRTL ? 'تخطي' : 'Skip'}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.pagerArea} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? <ScrollView key={language} ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} bounces={false}
          style={styles.pager} contentContainerStyle={styles.pagerContent}
          onContentSizeChange={() => pager.current?.scrollTo({ x: physicalIndex(index) * width, animated: false })}
          onMomentumScrollEnd={(event) => {
            const physical = Math.max(0, Math.min(2, Math.round(event.nativeEvent.contentOffset.x / width)));
            setIndex(isRTL ? 2 - physical : physical);
          }}>
          {ordered.map((slide, position) => <ScrollView key={slide.ar[0]} aria-hidden={physicalIndex(index) !== position} accessibilityElementsHidden={physicalIndex(index) !== position} style={{ width }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slide}>
            <Image source={slide.image} resizeMode={slide.fit} style={[styles.visual, { height: Math.min(260, height * 0.32) }]} accessible={false} />
            <View style={styles.copy}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={[styles.title, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{slide[language][0]}</Text>
              <Text maxFontSizeMultiplier={1.6} style={[styles.body, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{slide[language][1]}</Text>
            </View>
          </ScrollView>)}
        </ScrollView> : null}
      </View>
      <View style={styles.footer}>
        <View accessibilityLabel={isRTL ? `الصفحة ${index + 1} من 3` : `Page ${index + 1} of 3`} style={[styles.indicators, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {slides.map((_, position) => <Pressable key={position} accessibilityRole="button" accessibilityLabel={isRTL ? `الصفحة ${position + 1}` : `Page ${position + 1}`} accessibilityState={{ selected: position === index }} onPress={() => goTo(position)} style={styles.dotTarget}><View style={[styles.dot, position === index && styles.activeDot]} /></Pressable>)}
        </View>
        <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {index > 0 ? <AppIconButton icon={Back} label={isRTL ? 'السابق' : 'Previous'} onPress={() => goTo(index - 1)} /> : null}
          <AppButton style={styles.next} disabled={saving} label={index === 2 ? (isRTL ? 'ابدأ التسوق' : 'Start shopping') : (isRTL ? 'التالي' : 'Next')} arrow onPress={index === 2 ? onComplete : () => goTo(index + 1)} />
        </View>
      </View>
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface, ...Platform.select({ web: {}, default: { direction: 'ltr' as const } }) },
  page: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  top: { minHeight: 72, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  textButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  language: { ...typography.caption, color: colors.text },
  skip: { ...typography.button, color: colors.muted },
  pagerArea: { flex: 1 },
  pager: { flex: 1 },
  pagerContent: { flexDirection: 'row' },
  slide: { flexGrow: 1, paddingBottom: spacing.lg },
  visual: { width: '100%', backgroundColor: colors.background, marginTop: spacing.md },
  copy: { padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.display, color: colors.text },
  body: { ...typography.body, color: colors.muted },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, backgroundColor: colors.surface },
  indicators: { justifyContent: 'center' },
  dotTarget: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  activeDot: { width: 20, backgroundColor: colors.primary },
  actions: { alignItems: 'center', gap: spacing.md },
  next: { flex: 1 },
});
