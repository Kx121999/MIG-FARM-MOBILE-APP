import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { colors, glow, radius, shadow, sizes, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { MotionPressable } from '@/components/Motion';

export function AppButton({ label, onPress, secondary = false, arrow = false, disabled = false, style }: {
  label: string; onPress: () => void; secondary?: boolean; arrow?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { isRTL } = useLanguage();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const color = secondary ? colors.primaryDark : colors.surface;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.wrap,
        secondary ? shadow : glow,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={[styles.button, secondary && styles.secondary, style]}>
        {!secondary ? (
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={[colors.leaf, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        ) : null}
        <View style={[styles.content, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text maxFontSizeMultiplier={1.6} style={[styles.label, { color, textAlign: 'center' }]}>
            {label}
          </Text>
          {arrow ? <Arrow size={18} color={color} /> : null}
        </View>
      </View>
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  wrap: { minHeight: sizes.button, borderRadius: radius.xl },
  button: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center', gap: spacing.sm },
  secondary: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.5 },
  label: { ...typography.button, flexShrink: 1 },
});
