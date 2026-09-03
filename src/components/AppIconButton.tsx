import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors, sizes, typography } from '@/constants/theme';
import { MotionPressable } from '@/components/Motion';

export function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return <View style={styles.badge}><Text maxFontSizeMultiplier={1.2} style={styles.badgeText}>{count > 99 ? '99+' : count}</Text></View>;
}
export function AppIconButton({ icon: Icon, label, onPress, count = 0, selected = false, style }: {
  icon: LucideIcon; label: string; onPress: () => void; count?: number; selected?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return <MotionPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.button, selected && styles.selected, style]}>
    <Icon size={sizes.icon} strokeWidth={1.8} color={selected ? colors.primary : colors.text} />
    <CountBadge count={count} />
  </MotionPressable>;
}
const styles = StyleSheet.create({
  button: { width: sizes.touch, height: sizes.touch, borderRadius: sizes.touch / 2, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.primarySoft },
  badge: { pointerEvents: 'none', position: 'absolute', top: 0, right: 0, minWidth: sizes.badge, height: sizes.badge, paddingHorizontal: 4, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...typography.caption, fontSize: 10, lineHeight: 14, color: colors.surface, fontWeight: '700' },
});
