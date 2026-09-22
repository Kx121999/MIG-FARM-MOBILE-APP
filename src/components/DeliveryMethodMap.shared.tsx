import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Truck, PackageOpen } from 'lucide-react-native';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { MotionPressable } from '@/components/Motion';

export const EMIRATE_CENTER: Record<string, { latitude: number; longitude: number }> = {
  Dubai: { latitude: 25.2048, longitude: 55.2708 },
  'Abu Dhabi': { latitude: 24.4539, longitude: 54.3773 },
  Sharjah: { latitude: 25.3463, longitude: 55.4209 },
  Ajman: { latitude: 25.4052, longitude: 55.5136 },
  'Umm Al Quwain': { latitude: 25.5644, longitude: 55.5552 },
  'Ras Al Khaimah': { latitude: 25.7895, longitude: 55.9432 },
  Fujairah: { latitude: 25.1288, longitude: 56.3265 },
};

export type DeliveryMethod = 'delivery' | 'pickup';

export function MethodToggle({
  method,
  onChangeMethod,
  isRTL,
}: {
  method: DeliveryMethod;
  onChangeMethod: (method: DeliveryMethod) => void;
  isRTL: boolean;
}) {
  return (
    <View style={[styles.toggle, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityState={{ selected: method === 'delivery' }}
        onPress={() => onChangeMethod('delivery')}
        style={[styles.option, method === 'delivery' && styles.optionActive]}
      >
        <Truck size={18} color={method === 'delivery' ? colors.surface : colors.primaryDark} />
        <Text style={[styles.optionText, method === 'delivery' && styles.optionTextActive]}>
          {isRTL ? 'توصيل' : 'Delivery'}
        </Text>
      </MotionPressable>
      <MotionPressable
        accessibilityRole="button"
        accessibilityState={{ selected: method === 'pickup' }}
        onPress={() => onChangeMethod('pickup')}
        style={[styles.option, method === 'pickup' && styles.optionActive]}
      >
        <PackageOpen size={18} color={method === 'pickup' ? colors.surface : colors.primaryDark} />
        <Text style={[styles.optionText, method === 'pickup' && styles.optionTextActive]}>
          {isRTL ? 'استلام من المتجر' : 'Pickup'}
        </Text>
      </MotionPressable>
    </View>
  );
}

export function PickupNotice({ isRTL }: { isRTL: boolean }) {
  return (
    <View style={styles.mapCard}>
      <Text style={[styles.pickupText, { textAlign: isRTL ? 'right' : 'left' }]}>
        {isRTL
          ? 'استلم طلبك من أقرب نقطة استلام لميج فارم — هنؤكد لك العنوان والموعد بعد تجهيز الطلب.'
          : "Pick up your order from your nearest MIG FARM point — we'll confirm the address and time once it's ready."}
      </Text>
    </View>
  );
}

export function MapFallback({ isRTL, text }: { isRTL: boolean; text: string }) {
  return (
    <View style={styles.mapCard}>
      <View style={styles.mapFallback}>
        <Text style={styles.mapFallbackText}>{text}</Text>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.sm },
  toggle: { gap: spacing.sm },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  optionActive: { backgroundColor: colors.primary },
  optionText: { ...typography.button, color: colors.primaryDark },
  optionTextActive: { color: colors.surface },
  mapCard: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted, ...shadow },
  map: { width: '100%', height: 180 },
  mapFallback: { minHeight: 140, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  mapFallbackText: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  hint: { ...typography.caption, color: colors.muted, padding: spacing.sm },
  pickupText: { ...typography.body, color: colors.text, padding: spacing.lg },
});
