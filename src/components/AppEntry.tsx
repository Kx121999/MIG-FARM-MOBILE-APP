import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
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
  const [stage, setStage] = useState<'launch' | 'app'>('launch');
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
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
  const enterApp = () => {
    if (stage !== 'launch') return;
    completedThisSession = true;
    setCompleted(true);
    setStage('app');
    void completeOnboarding(AsyncStorage).catch(() => undefined);
  };
  if (!languageReady || !assetsReady) return <View style={styles.neutral} />;
  return (
    <View {...(Platform.OS === 'web' ? { dir: 'ltr' } : {})} style={styles.app}>
      <View
        style={[styles.app, { pointerEvents: stage === 'launch' ? 'none' : 'auto' }]}
        accessibilityElementsHidden={stage === 'launch'}
        importantForAccessibility={
          stage === 'launch' ? 'no-hide-descendants' : 'auto'
        }
      >
        {completed !== null ? children : null}
      </View>
      {stage === 'launch' ? (
        <View style={StyleSheet.absoluteFill}>
          <LocalizedLaunchScreen
            language={language}
            ready={completed !== null}
            onComplete={enterApp}
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
