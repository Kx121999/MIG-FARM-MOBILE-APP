import React, { Suspense } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { CheckoutCustomer, PaymentSession } from '@/services/payments';

export type CheckoutPaymentProps = {
  session: PaymentSession;
  customer: CheckoutCustomer;
  language: 'ar' | 'en';
  onSuccess: () => void;
  onError: (message: string) => void;
};

const StripeCheckout = React.lazy(() => import('./CheckoutPaymentStripe.web').then((module) => ({ default: module.StripeCheckout })));

export function CheckoutPayment(props: CheckoutPaymentProps) {
  return (
    <Suspense fallback={<View style={styles.loading}><Text style={styles.loadingText}>{props.language === 'ar' ? 'جاري تجهيز الدفع…' : 'Preparing payment…'}</Text></View>}>
      <StripeCheckout {...props} />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 84, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
});
