import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, ShoppingBag } from 'lucide-react-native';
import { colors, spacing } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppIconButton } from '@/components/AppIconButton';
import { BrandLogo } from '@/components/BrandLogo';

export function AppHeader({ compact = false }: { compact?: boolean }) {
  const { cartCount } = useCommerce();
  const { isRTL, t } = useLanguage();
  return <View style={styles.surface}>
    <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }, compact && styles.compact]}>
      <BrandLogo width={compact ? 104 : 120} />
      <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <AppIconButton icon={Bell} label={t('notifications')} onPress={() => router.push('/notifications')} />
        <AppIconButton icon={ShoppingBag} label={t('cart')} count={cartCount} onPress={() => router.push('/(tabs)/cart')} />
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  surface: { backgroundColor: colors.surface },
  row: { minHeight: 64, width: '100%', maxWidth: 760, alignSelf: 'center', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  compact: { minHeight: 56 },
  actions: { alignItems: 'center', gap: spacing.xs },
});
