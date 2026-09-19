import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotionPressable, useReducedMotion } from '@/components/Motion';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import type { Language } from '@/types';

export const launchImages = {
  ar: require('../../assets/launch/mig-farm-launch-ar.png'),
  en: require('../../assets/launch/mig-farm-launch-en.png'),
};
let preload: Promise<unknown> | undefined;
export function preloadLaunchImages() {
  return (preload ??= Asset.loadAsync([launchImages.ar, launchImages.en]).catch(
    () => undefined,
  ));
}

export function LocalizedLaunchScreen({
  language,
  ready,
  onComplete,
  onLanguageChange,
}: {
  language: Language;
  ready: boolean;
  onComplete: () => void;
  onLanguageChange: (language: Language) => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const [loaded, setLoaded] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const finish = useRef(onComplete);
  finish.current = onComplete;
  useEffect(() => {
    if (!loaded || !laidOut) return;
    if (Platform.OS !== 'web')
      void SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, laidOut]);

  const start = () => {
    if (!ready || leaving) return;
    setLeaving(true);
    const animation = Animated.timing(opacity, {
      toValue: 0,
      duration: reduced ? 0 : 200,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(({ finished }) => {
      if (finished) finish.current();
    });
  };
  return (
    <Animated.View
      style={[styles.root, { opacity }]}
      onLayout={() => setLaidOut(true)}
    >
      <View
        style={[
          styles.artwork,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <View style={styles.languageArea}>
          <View style={styles.languageSwitch}>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="العربية"
              accessibilityState={{ selected: language === 'ar' }}
              onPress={() => onLanguageChange('ar')}
              style={[styles.languageOption, language === 'ar' && styles.languageOptionActive]}
            >
              <Text style={[styles.languageText, language === 'ar' && styles.languageTextActive]}>العربية</Text>
            </MotionPressable>
            <View style={styles.languageDivider} />
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="English"
              accessibilityState={{ selected: language === 'en' }}
              onPress={() => onLanguageChange('en')}
              style={[styles.languageOption, language === 'en' && styles.languageOptionActive]}
            >
              <Text style={[styles.languageText, language === 'en' && styles.languageTextActive]}>English</Text>
            </MotionPressable>
          </View>
        </View>
        <View style={styles.imageStage}>
          <Image
            source={launchImages[language]}
            resizeMode="contain"
            style={styles.image}
            accessibilityLabel={`MIG FARM launch ${language === 'ar' ? 'Arabic' : 'English'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        </View>
        <View style={styles.actionArea}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={language === 'ar' ? 'ابدأ الآن' : 'Start Now'}
            disabled={!ready || leaving}
            onPress={start}
            style={[styles.startButton, (!ready || leaving) && styles.disabled]}
          >
            <Text style={[styles.startText, { writingDirection: language === 'ar' ? 'rtl' : 'ltr' }]}>
              {language === 'ar' ? 'ابدأ الآن' : 'Start Now'}
            </Text>
          </MotionPressable>
        </View>
      </View>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  artwork: {
    flex: 1,
    backgroundColor: '#F5F5F2',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    ...Platform.select({ web: {}, default: { direction: 'ltr' as const } }),
  },
  languageArea: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  languageSwitch: {
    height: 38,
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageOption: {
    minWidth: 88,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  languageOptionActive: { backgroundColor: colors.primarySoft },
  languageDivider: { width: 1, height: 18, backgroundColor: colors.border },
  languageText: { ...typography.caption, color: colors.muted },
  languageTextActive: { color: colors.primaryDark, fontWeight: '700' },
  imageStage: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%', maxWidth: 620 },
  actionArea: {
    flexShrink: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  startButton: {
    width: '100%',
    maxWidth: 360,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    ...shadow,
  },
  startText: { ...typography.button, color: colors.surface, fontWeight: '700' },
  disabled: { opacity: 0.65 },
});
