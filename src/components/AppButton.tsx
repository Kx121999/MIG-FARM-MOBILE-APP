import React from 'react';
import { StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { MotionPressable } from '@/components/Motion';

export function AppButton({ label, onPress, secondary = false, arrow = false, disabled = false, style }: {
  label: string; onPress: () => void; secondary?: boolean; arrow?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { isRTL } = useLanguage();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const color = secondary ? colors.primaryDark : colors.surface;
  return <MotionPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondary, { flexDirection: isRTL ? 'row-reverse' : 'row' }, disabled && styles.disabled, style]}>
    <Text maxFontSizeMultiplier={1.6} style={[styles.label, { color, textAlign: 'center' }]}>{label}</Text>
    {arrow ? <Arrow size={18} color={color} /> : null}
  </MotionPressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: sizes.button, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  secondary: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.5 },
  label: { ...typography.button, flexShrink: 1 },
});
