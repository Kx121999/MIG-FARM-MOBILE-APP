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
}: {
  language: Language;
  ready: boolean;
  onComplete: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const [loaded, setLoaded] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const finish = useRef(onComplete);
  finish.current = onComplete;
  // The image language is fixed for this launch; UI language changes apply next launch.
  const [launchLanguage] = useState(language);
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
        <Image
          source={launchImages[launchLanguage]}
          resizeMode="contain"
          style={styles.image}
          accessibilityLabel={`MIG FARM launch ${launchLanguage === 'ar' ? 'Arabic' : 'English'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        <View
          pointerEvents="box-none"
          style={[
            styles.actionArea,
            {
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              paddingLeft: Math.max(insets.left, spacing.lg),
              paddingRight: Math.max(insets.right, spacing.lg),
            },
          ]}
        >
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={launchLanguage === 'ar' ? 'ابدأ الآن' : 'Start Now'}
            disabled={!ready || leaving}
            onPress={start}
            style={[styles.startButton, (!ready || leaving) && styles.disabled]}
          >
            <Text style={styles.startText}>
              {launchLanguage === 'ar' ? 'ابدأ الآن' : 'Start Now'}
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
    ...Platform.select({ web: {}, default: { direction: 'ltr' as const } }),
  },
  image: { width: '100%', height: '100%', flex: 1 },
  actionArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
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
