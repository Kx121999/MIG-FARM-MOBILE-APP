import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, ShoppingBag } from 'lucide-react-native';
import { colors, radius } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';

const logoSource = require('../../assets/mig-farm-logo.png');

export function AppHeader({ compact = false }: { compact?: boolean }) {
  const { cartCount } = useCommerce();
  const { isRTL, language } = useLanguage();

  return (
    <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }, compact && styles.compact]}>
      <Image
        source={logoSource}
        style={[styles.logo, compact && styles.compactLogo]}
        resizeMode="contain"
        accessibilityLabel="Mig Farm"
      />
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={language === 'ar' ? 'الإشعارات' : 'Notifications'} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={() => router.push('/notifications')}>
          <Bell size={18} color={colors.primary} strokeWidth={2.2} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cart"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          onPress={() => router.push('/(tabs)/cart')}
        >
          <ShoppingBag size={19} color={colors.primaryDark} strokeWidth={2.2} />
          {cartCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(99, cartCount)}</Text></View> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 62, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  compact: { height: 56 },
  logo: { width: 122, height: 52 },
  compactLogo: { width: 96, height: 40 },
  actions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  badge: { position: 'absolute', top: -4, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
