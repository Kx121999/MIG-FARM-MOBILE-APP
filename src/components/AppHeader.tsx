import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, ShoppingBag } from 'lucide-react-native';
import { colors, spacing } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppIconButton } from '@/components/AppIconButton';
import { BrandLogo } from '@/components/BrandLogo';
import { AccountAvatarButton } from '@/components/account/UserAvatar';

export function AppHeader({ compact = false }: { compact?: boolean }) {
  const { cartCount } = useCommerce();
  const { isRTL, t } = useLanguage();
  return <View style={styles.surface}>
    <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }, compact && styles.compact]}>
      <View style={[styles.side, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}><AccountAvatarButton /></View>
      <View pointerEvents="box-none" style={styles.brand}><BrandLogo width={compact ? 92 : 100} /></View>
      <View style={[styles.side, styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: isRTL ? 'flex-start' : 'flex-end' }]}>
        <AppIconButton icon={Bell} label={t('notifications')} onPress={() => router.push('/notifications')} />
        <AppIconButton icon={ShoppingBag} label={t('cart')} count={cartCount} onPress={() => router.push('/(tabs)/cart')} />
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  surface: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  row: { position: 'relative', minHeight: 58, width: '100%', maxWidth: 760, alignSelf: 'center', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  compact: { minHeight: 54 },
  side: { width: 96, minWidth: 96, justifyContent: 'center' },
  brand: { position: 'absolute', left: 96, right: 96, alignItems: 'center', justifyContent: 'center' },
  actions: { alignItems: 'center', gap: 0 },
});
