import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { MotionPressable } from '@/components/Motion';

export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const { isRTL } = useLanguage();
  const Arrow = isRTL ? ChevronLeft : ChevronRight;
  return <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
    <Text accessibilityRole="header" style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
    {action && onPress ? <MotionPressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onPress} style={[styles.actionTarget, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={styles.action}>{action}</Text><Arrow size={16} color={colors.primary} />
    </MotionPressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, gap: spacing.sm },
  title: { ...typography.section, color: colors.text, flex: 1 },
  actionTarget: { minHeight: 44, alignItems: 'center', gap: spacing.xs },
  action: { ...typography.caption, color: colors.primary },
});
