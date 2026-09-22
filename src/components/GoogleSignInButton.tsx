import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { radius, sizes, spacing } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { MotionPressable } from '@/components/Motion';
import { GoogleLogo } from '@/components/icons/GoogleLogo';

export function GoogleSignInButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const { isRTL } = useLanguage();
  const label = isRTL ? 'الدخول بحساب Google' : 'Continue with Google';
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
        disabled && styles.disabled,
      ]}
    >
      <GoogleLogo size={18} />
      <Text maxFontSizeMultiplier={1.6} style={styles.label}>
        {label}
      </Text>
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: sizes.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#3C4043' },
});
