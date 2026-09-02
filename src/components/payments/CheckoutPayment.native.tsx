import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { CreditCard, LockKeyhole } from 'lucide-react-native';
import { colors, radius } from '@/constants/theme';
import { CheckoutCustomer, PaymentSession } from '@/services/payments';

type Props = { session: PaymentSession; customer: CheckoutCustomer; language: 'ar' | 'en'; onSuccess: () => void; onError: (message: string) => void };

export function CheckoutPayment({ session, customer, language, onSuccess, onError }: Props) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    const initialized = await initPaymentSheet({
      merchantDisplayName: 'MIG FARM',
      paymentIntentClientSecret: session.clientSecret,
      returnURL: 'migfarm://stripe-redirect',
      defaultBillingDetails: customer,
      allowsDelayedPaymentMethods: false,
      appearance: { colors: { primary: colors.primary, background: colors.surface, componentBackground: colors.surfaceMuted, primaryText: colors.text } },
    });
    if (initialized.error) {
      onError(initialized.error.message);
      setBusy(false);
      return;
    }
    const result = await presentPaymentSheet();
    setBusy(false);
    if (result.error) onError(result.error.message);
    else onSuccess();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.secure}><LockKeyhole size={16} color={colors.success} /><Text style={styles.secureText}>{language === 'ar' ? 'بيانات بطاقتك مشفّرة ولا يتم حفظها عندنا' : 'Your card details are encrypted and never stored by us'}</Text></View>
      <Pressable accessibilityRole="button" disabled={busy} style={({ pressed }) => [styles.button, busy && styles.disabled, pressed && styles.pressed]} onPress={pay}>
        <CreditCard size={19} color="#FFFFFF" />
        <Text style={styles.buttonText}>{busy ? (language === 'ar' ? 'جاري تجهيز الدفع…' : 'Preparing payment…') : (language === 'ar' ? 'الدفع الآن' : 'Pay now')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secureText: { color: colors.muted, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  button: { height: 54, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.82 },
});
