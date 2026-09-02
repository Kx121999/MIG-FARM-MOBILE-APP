import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const { isRTL } = useLanguage();
  return (
    <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
      {!!action && <Pressable onPress={onPress}><Text style={styles.action}>{action}</Text></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  action: { color: colors.primary, fontSize: 13, fontWeight: '800' },
});
