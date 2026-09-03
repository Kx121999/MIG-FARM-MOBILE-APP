import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Onboarding } from '@/components/Onboarding';
import {
  LocalizedLaunchScreen,
  preloadLaunchImages,
} from '@/components/LocalizedLaunchScreen';
import { colors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { completeOnboarding, hasCompletedOnboarding } from '@/utils/appEntry';

if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
  SplashScreen.setOptions({ fade: true, duration: 150 });
}
let completedThisSession = false;
export function AppEntry({ children }: { children: React.ReactNode }) {
  const { ready: languageReady, language } = useLanguage();
  const [stage, setStage] = useState<'launch' | 'onboarding' | 'app'>('launch');
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void preloadLaunchImages().finally(() => {
      if (active) setAssetsReady(true);
    });
    void hasCompletedOnboarding(AsyncStorage).then((value) => {
      if (active) setCompleted(completedThisSession || value);
    });
    return () => {
      active = false;
    };
  }, []);
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    completedThisSession = true;
    await completeOnboarding(AsyncStorage);
    setStage('app');
  };
  if (!languageReady || !assetsReady) return <View style={styles.neutral} />;
  const showApp = stage === 'app' || completed === true;
  return (
    <View {...(Platform.OS === 'web' ? { dir: 'ltr' } : {})} style={styles.app}>
      <View
        style={[styles.app, { pointerEvents: stage === 'launch' ? 'none' : 'auto' }]}
        accessibilityElementsHidden={stage === 'launch'}
        importantForAccessibility={
          stage === 'launch' ? 'no-hide-descendants' : 'auto'
        }
      >
        {completed !== null ? (
          showApp ? (
            children
          ) : (
            <Onboarding saving={saving} onComplete={finish} />
          )
        ) : null}
      </View>
      {stage === 'launch' ? (
        <View style={StyleSheet.absoluteFill}>
          <LocalizedLaunchScreen
            language={language}
            ready={completed !== null}
            onComplete={() => setStage(completed ? 'app' : 'onboarding')}
          />
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
    ...Platform.select({ web: {}, default: { direction: 'ltr' as const } }),
  },
  neutral: { flex: 1, backgroundColor: '#FFFFFF' },
});
