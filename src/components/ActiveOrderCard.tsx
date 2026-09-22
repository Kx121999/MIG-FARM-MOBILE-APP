import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Clock3, PackageCheck, Truck, type LucideIcon } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { customerService } from '@/services/customer';
import { getGuestOrders } from '@/services/orders';
import { fulfillmentStatusLabel } from '@/utils/orders';
import type { CustomerOrder } from '@/types/customer';

const statusIcon: Record<CustomerOrder['fulfillmentStatus'], LucideIcon> = {
  received: PackageCheck,
  preparing: Clock3,
  out_for_delivery: Truck,
  delivered: PackageCheck,
  canceled: PackageCheck,
};

export function ActiveOrderCard() {
  const { user } = useAuth();
  const { language, isRTL } = useLanguage();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const TrailIcon = isRTL ? ChevronLeft : ChevronRight;

  useEffect(() => {
    let active = true;
    const load = user ? customerService.orders() : getGuestOrders();
    load
      .then((page) => {
        if (!active) return;
        const current = page.items.find((item) => item.fulfillmentStatus !== 'delivered' && item.fulfillmentStatus !== 'canceled');
        setOrder(current || null);
      })
      .catch(() => { if (active) setOrder(null); });
    return () => { active = false; };
  }, [user?.id]);

  if (!order) return null;
  const Icon = statusIcon[order.fulfillmentStatus];

  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={language === 'ar' ? `تتبع الطلب ${order.number}` : `Track order ${order.number}`}
      onPress={() => router.push({ pathname: '/order-detail', params: { number: order.number } })}
      style={[styles.card, shadow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
    >
      <View style={styles.icon}><Icon size={20} color={colors.primary} /></View>
      <View style={styles.copy}>
        <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>
          {language === 'ar' ? `طلبك ${order.number} في الطريق` : `Your order ${order.number} is on its way`}
        </Text>
        <Text style={[styles.status, { textAlign: isRTL ? 'right' : 'left' }]}>{fulfillmentStatusLabel(order.fulfillmentStatus, language === 'ar')}</Text>
      </View>
      <TrailIcon size={18} color={colors.muted} />
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, alignItems: 'center', gap: spacing.md },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.button, color: colors.text },
  status: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
