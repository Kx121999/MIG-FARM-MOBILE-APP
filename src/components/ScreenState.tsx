import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { PackageSearch, RefreshCw } from 'lucide-react-native';
import { colors, radius } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

export function ScreenState({ loading, error, empty, onRetry }: { loading?: boolean; error?: string | null; empty?: boolean; onRetry?: () => void }) {
  const { t } = useLanguage();

  if (loading) {
    return <View style={styles.wrap}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.text}>{t('loading')}</Text></View>;
  }
  if (error) {
    return (
      <View style={styles.wrap}>
        <RefreshCw size={32} color={colors.muted} />
        <Text style={styles.text}>{t('chatError')}</Text>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onRetry}>
          <Text style={styles.buttonText}>{t('retry')}</Text>
        </Pressable>
      </View>
    );
  }
  if (empty) {
    return <View style={styles.wrap}><PackageSearch size={34} color={colors.muted} /><Text style={styles.text}>{t('noProducts')}</Text></View>;
  }
  return null;
}

const styles = StyleSheet.create({
  wrap: { minHeight: 250, alignItems: 'center', justifyContent: 'center', padding: 26, gap: 12 },
  text: { color: colors.muted, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  button: { backgroundColor: colors.primary, paddingHorizontal: 20, height: 42, borderRadius: radius.pill, justifyContent: 'center' },
  pressed: { opacity: 0.78 },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
});
