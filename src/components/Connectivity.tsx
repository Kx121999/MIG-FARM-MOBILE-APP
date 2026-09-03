import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

const ConnectivityContext = createContext(true);
export const useOnline = () => useContext(ConnectivityContext);

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setOnline(window.navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return <ConnectivityContext.Provider value={online}>{children}</ConnectivityContext.Provider>;
}

export function ConnectionNotice() {
  const online = useOnline();
  const { language, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return <View accessibilityLiveRegion="polite" style={[styles.notice, { paddingTop: insets.top + spacing.sm, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
    <WifiOff size={18} color={colors.muted} />
    <Text style={[styles.text, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'تعذر الاتصال بالإنترنت' : 'No internet connection'}</Text>
  </View>;
}
const styles = StyleSheet.create({
  notice: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  text: { ...typography.caption, color: colors.text, flexShrink: 1 },
});
