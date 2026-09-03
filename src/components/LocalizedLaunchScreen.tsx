import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/components/Motion';
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
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const finish = useRef(onComplete);
  finish.current = onComplete;
  // The image language is fixed for this launch; UI language changes apply next launch.
  const [launchLanguage] = useState(language);
  useEffect(() => {
    if (!loaded || !laidOut) return;
    if (Platform.OS !== 'web')
      void SplashScreen.hideAsync().catch(() => undefined);
    const timer = setTimeout(() => setMinimumElapsed(true), 900);
    return () => clearTimeout(timer);
  }, [loaded, laidOut]);
  useEffect(() => {
    if (!minimumElapsed || !ready) return;
    const animation = Animated.timing(opacity, {
      toValue: 0,
      duration: reduced ? 0 : 200,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(({ finished }) => {
      if (finished) finish.current();
    });
    return () => animation.stop();
  }, [minimumElapsed, ready, reduced, opacity]);
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
});
