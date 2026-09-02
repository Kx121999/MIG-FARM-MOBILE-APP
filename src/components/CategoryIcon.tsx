import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Bug,
  Droplets,
  FlaskConical,
  Grid2X2,
  Shovel,
  Sprout,
  Warehouse,
  type LucideIcon,
} from 'lucide-react-native';
import { CategoryId, categories } from '@/constants/categories';

const icons: Record<CategoryId, LucideIcon> = {
  all: Grid2X2,
  seeds: Sprout,
  fertilizers: FlaskConical,
  pest: Bug,
  irrigation: Droplets,
  tools: Shovel,
  greenhouses: Warehouse,
};

export function CategoryIcon({ id, size = 20, boxSize = 42, inverse = false }: { id: CategoryId; size?: number; boxSize?: number; inverse?: boolean }) {
  const category = categories.find((item) => item.id === id) ?? categories[0];
  const Icon = icons[id];

  return (
    <View style={[styles.wrap, { width: boxSize, height: boxSize, borderRadius: Math.min(12, boxSize / 3), backgroundColor: inverse ? 'rgba(255,255,255,0.18)' : `${category.color}16` }]}>
      <Icon color={inverse ? '#FFFFFF' : category.color} size={size} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
