import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Grid2X2, Layers3 } from 'lucide-react-native';
import { CategoryId } from '@/constants/categories';
import { colors } from '@/constants/theme';

export function CategoryIcon({ id, size = 20, boxSize = 42, inverse = false }: { id: CategoryId; size?: number; boxSize?: number; inverse?: boolean }) {
  const Icon = id === 'all' ? Grid2X2 : Layers3;
  return (
    <View style={[styles.wrap, {
      width: boxSize,
      height: boxSize,
      borderRadius: Math.min(12, boxSize / 3),
      backgroundColor: inverse ? 'rgba(255,255,255,0.18)' : colors.primarySoft,
    }]}>
      <Icon color={inverse ? '#FFFFFF' : colors.primary} size={size} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
