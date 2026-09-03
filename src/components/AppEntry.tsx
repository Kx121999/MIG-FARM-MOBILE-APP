import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { BrandLogo } from '@/components/BrandLogo';
import { Onboarding } from '@/components/Onboarding';
import { useReducedMotion } from '@/components/Motion';
import { colors, motion } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { completeOnboarding, hasCompletedOnboarding } from '@/utils/appEntry';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => undefined);
  SplashScreen.setOptions({ fade: true, duration: motion.enter });
}
let completedThisSession = false;

export function AppEntry({ children }: { children: React.ReactNode }) {
  const { ready: languageReady } = useLanguage();
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<'checking' | 'intro' | 'onboarding' | 'app'>('checking');
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [laidOut, setLaidOut] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    hasCompletedOnboarding(AsyncStorage).then((value) => { if (active) setCompleted(completedThisSession || value); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (completed === null || !languageReady) return;
    setStage(completed ? 'app' : 'intro');
  }, [completed, languageReady]);
  useEffect(() => {
    if (stage !== 'intro' || !logoReady || !laidOut) return;
    if (reduced) { setStage('onboarding'); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: motion.intro, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' });
    animation.start(({ finished }) => { if (finished) setStage('onboarding'); });
    return () => animation.stop();
  }, [stage, logoReady, laidOut, reduced, progress]);
  useEffect(() => {
    if (laidOut && (logoReady || stage === 'app') && Platform.OS !== 'web') SplashScreen.hideAsync().catch(() => undefined);
  }, [laidOut, logoReady, stage]);

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    completedThisSession = true;
    await completeOnboarding(AsyncStorage);
    setStage('app');
  };

  if (stage === 'app') return <View {...(Platform.OS === 'web' ? { dir: 'ltr' } : {})} style={styles.app} onLayout={() => setLaidOut(true)}>{children}</View>;
  if (stage === 'onboarding') return <Onboarding saving={saving} onComplete={finish} />;
  return <View style={styles.brand} onLayout={() => setLaidOut(true)}>
    <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }), transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] }}>
      <BrandLogo width={200} onLoadEnd={() => setLogoReady(true)} />
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background, ...Platform.select({ web: {}, default: { direction: 'ltr' as const } }) },
  brand: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
