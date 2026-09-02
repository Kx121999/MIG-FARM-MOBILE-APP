import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { CreditCard, LockKeyhole } from 'lucide-react-native';
import { colors, radius } from '@/constants/theme';
import type { CheckoutPaymentProps } from './CheckoutPayment.web';

export function StripeCheckout(props: CheckoutPaymentProps) {
  const stripe = useMemo(() => loadStripe(props.session.publishableKey), [props.session.publishableKey]);
  return (
    <Elements stripe={stripe} options={{ clientSecret: props.session.clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: colors.primary, borderRadius: `${radius.md}px`, colorText: colors.text } } }}>
      <WebPaymentForm {...props} />
    </Elements>
  );
}

function WebPaymentForm({ language, onSuccess, onError }: CheckoutPaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    const result = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    setBusy(false);
    if (result.error) onError(result.error.message || 'payment_failed');
    else onSuccess();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.element}><PaymentElement /></View>
      <View style={styles.secure}><LockKeyhole size={16} color={colors.success} /><Text style={styles.secureText}>{language === 'ar' ? 'بيانات بطاقتك مشفّرة ولا يتم حفظها عندنا' : 'Your card details are encrypted and never stored by us'}</Text></View>
      <Pressable accessibilityRole="button" disabled={!stripe || busy} style={({ pressed }) => [styles.button, (!stripe || busy) && styles.disabled, pressed && styles.pressed]} onPress={pay}>
        <CreditCard size={19} color="#FFFFFF" />
        <Text style={styles.buttonText}>{busy ? (language === 'ar' ? 'جاري تأكيد الدفع…' : 'Confirming payment…') : (language === 'ar' ? 'الدفع الآن' : 'Pay now')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 13 },
  element: { padding: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secureText: { color: colors.muted, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  button: { height: 54, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.82 },
});
