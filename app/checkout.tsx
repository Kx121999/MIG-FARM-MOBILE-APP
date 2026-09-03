import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, MapPin, ShieldCheck, UserRound } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckoutPayment } from '@/components/payments/CheckoutPayment';
import { colors, radius } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAED } from '@/services/catalog';
import { CheckoutCustomer, CheckoutError, createCheckoutSession, completeCheckoutAttempt, PaymentSession, ShippingAddress } from '@/services/payments';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAddresses } from '@/hooks/useCustomerAddresses';
import { ChoiceGroup } from '@/components/account/ChoiceGroup';
import { Notice } from '@/components/account/AccountUI';

const ORDER_REFS_KEY = 'mig_farm_order_refs_v1';
const emirates = [
  { value: 'Dubai', ar: 'دبي' },
  { value: 'Abu Dhabi', ar: 'أبوظبي' },
  { value: 'Sharjah', ar: 'الشارقة' },
  { value: 'Ajman', ar: 'عجمان' },
  { value: 'Al Ain', ar: 'العين' },
  { value: 'RAK', ar: 'رأس الخيمة' },
  { value: 'Other UAE', ar: 'إمارة أخرى' },
];

export default function CheckoutScreen() {
  const { cart, subtotal, clearCart, profile: guestProfile } = useCommerce();
  const { user } = useAuth();
  const profile = user || guestProfile;
  const { addresses, error: addressError } = useCustomerAddresses();
  const [selectedAddress, setSelectedAddress] = useState('');
  const { language, isRTL } = useLanguage();
  const [customer, setCustomer] = useState<CheckoutCustomer>({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState<ShippingAddress>({ emirate: 'Dubai', city: '', addressLine: '', notes: '' });
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completedOrder, setCompletedOrder] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    setCustomer((current) => ({
      name: current.name || profile.name,
      email: current.email || profile.email,
      phone: current.phone || profile.phone,
    }));
    const defaultAddress = addresses.find((item) => item.isDefault);
    if (defaultAddress) setAddress((current) => current.city || current.addressLine ? current : { ...current, emirate: defaultAddress.emirate, city: defaultAddress.city, addressLine: [defaultAddress.addressLine,defaultAddress.unit].filter(Boolean).join(', '), notes:defaultAddress.notes||'' });
  }, [addresses, profile]);

  const valid = customer.name.trim() && customer.email.includes('@') && customer.phone.trim() && address.emirate && address.city.trim() && address.addressLine.trim();

  const preparePayment = async () => {
    if (!valid || busy) {
      if (!valid) setError(language === 'ar' ? 'كمّل البيانات المطلوبة قبل الدفع.' : 'Complete the required details before payment.');
      return;
    }
    setBusy(true);
    setError('');
    requestRef.current?.abort();
    requestRef.current = new AbortController();
    try {
      setSession(await createCheckoutSession(cart, customer, address, requestRef.current.signal));
    } catch (reason) {
      if (reason instanceof CheckoutError && reason.code === 'payment_provider_not_configured') {
        setError(language === 'ar' ? 'خدمة الدفع غير متاحة حاليًا. حاول مرة أخرى لاحقًا.' : 'Payment is currently unavailable. Please try again later.');
      } else {
        setError(language === 'ar' ? 'تعذر تجهيز الدفع. راجع الاتصال وحاول مرة ثانية.' : 'Payment could not be prepared. Check the connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const paymentSucceeded = async () => {
    if (!session) return;
    setCompletedOrder(session.orderId);
    clearCart();
    void completeCheckoutAttempt();
    try {
      const stored = JSON.parse(await AsyncStorage.getItem(ORDER_REFS_KEY) || '[]');
      await AsyncStorage.setItem(ORDER_REFS_KEY, JSON.stringify([{ id: session.orderId, token: session.orderToken, createdAt: Date.now() }, ...stored].slice(0, 30)));
    } catch {
      // A successful payment is not invalidated by local history persistence.
    }
  };

  if (completedOrder) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.success}>
          <View style={styles.successIcon}><CheckCircle2 size={46} color={colors.success} strokeWidth={1.8} /></View>
          <Text style={styles.successTitle}>{language === 'ar' ? 'تم استلام طلبك' : 'Your order is confirmed'}</Text>
          <Text style={styles.successBody}>{language === 'ar' ? 'تم تأكيد الدفع وسنبدأ تجهيز الطلب للتوصيل.' : 'Payment is confirmed and your order will be prepared for delivery.'}</Text>
          <View style={styles.orderRef}><Text style={styles.orderRefLabel}>{language === 'ar' ? 'رقم الطلب' : 'Order reference'}</Text><Text style={styles.orderRefValue}>{completedOrder}</Text></View>
          <Pressable style={styles.homeButton} onPress={() => router.replace('/(tabs)')}><Text style={styles.homeButtonText}>{language === 'ar' ? 'العودة للرئيسية' : 'Back to home'}</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={() => router.back()}><BackIcon size={21} color={colors.primaryDark} /></Pressable>
        <Text style={styles.topBarTitle}>{language === 'ar' ? 'التوصيل والدفع' : 'Delivery and payment'}</Text>
        <View style={styles.secureBadge}><LockKeyhole size={15} color={colors.success} /></View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.page}>
            <View style={styles.steps}><View style={styles.stepDone}><CheckCircle2 size={15} color={colors.success} /><Text style={styles.stepDoneText}>{language === 'ar' ? 'السلة' : 'Cart'}</Text></View><View style={styles.stepLine} /><View style={styles.stepActive}><MapPin size={15} color="#FFFFFF" /><Text style={styles.stepActiveText}>{language === 'ar' ? 'التوصيل' : 'Delivery'}</Text></View><View style={styles.stepLine} /><View style={styles.stepFuture}><LockKeyhole size={15} color={colors.textSubtle} /><Text style={styles.stepFutureText}>{language === 'ar' ? 'الدفع' : 'Payment'}</Text></View></View>

            <View style={styles.section}>
              <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}><UserRound size={19} color={colors.primary} /><Text style={styles.sectionTitle}>{language === 'ar' ? 'بيانات الاستلام' : 'Contact details'}</Text></View>
              <Field label={language === 'ar' ? 'الاسم الكامل *' : 'Full name *'} value={customer.name} onChangeText={(name) => setCustomer((current) => ({ ...current, name }))} isRTL={isRTL} />
              <Field label={language === 'ar' ? 'البريد الإلكتروني *' : 'Email *'} value={customer.email} onChangeText={(email) => setCustomer((current) => ({ ...current, email }))} isRTL={isRTL} keyboardType="email-address" autoCapitalize="none" />
              <Field label={language === 'ar' ? 'رقم الهاتف *' : 'Phone number *'} value={customer.phone} onChangeText={(phone) => setCustomer((current) => ({ ...current, phone }))} isRTL={isRTL} keyboardType="phone-pad" />
            </View>

            <View style={styles.section}>
              <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}><MapPin size={19} color={colors.primary} /><Text style={styles.sectionTitle}>{language === 'ar' ? 'عنوان التوصيل' : 'Delivery address'}</Text></View>
              {addresses.length && !session ? <ChoiceGroup label={language==='ar'?'العناوين المحفوظة':'Saved addresses'} value={selectedAddress} options={addresses.map(item=>({value:item.id,label:item.label}))} onChange={(id)=>{const saved=addresses.find(item=>item.id===id);if(!saved)return;setSelectedAddress(id);setAddress({emirate:saved.emirate,city:saved.city,addressLine:[saved.addressLine,saved.unit].filter(Boolean).join(', '),notes:saved.notes||''});setCustomer(current=>({...current,name:saved.name||current.name,phone:saved.phone||current.phone}));}}/> : null}
              {addressError?<Notice text={language==='ar'?'تعذر تحميل العناوين. يمكنك إدخال العنوان يدويًا.':'Saved addresses could not be loaded. You can enter an address manually.'}/>:null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emirates}>
                {emirates.map((item) => <Pressable key={item.value} onPress={() => setAddress((current) => ({ ...current, emirate: item.value }))} style={[styles.emirate, address.emirate === item.value && styles.emirateActive]}><Text style={[styles.emirateText, address.emirate === item.value && styles.emirateTextActive]}>{language === 'ar' ? item.ar : item.value}</Text></Pressable>)}
              </ScrollView>
              <Field label={language === 'ar' ? 'المدينة أو المنطقة *' : 'City or area *'} value={address.city} onChangeText={(city) => setAddress((current) => ({ ...current, city }))} isRTL={isRTL} />
              <Field label={language === 'ar' ? 'العنوان بالتفصيل *' : 'Full address *'} value={address.addressLine} onChangeText={(addressLine) => setAddress((current) => ({ ...current, addressLine }))} isRTL={isRTL} multiline />
              <Field label={language === 'ar' ? 'ملاحظات التوصيل' : 'Delivery notes'} value={address.notes} onChangeText={(notes) => setAddress((current) => ({ ...current, notes }))} isRTL={isRTL} multiline />
            </View>

            <View style={styles.summary}>
              <Text style={[styles.summaryTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'ملخص الدفع' : 'Payment summary'}</Text>
              <View style={[styles.totalRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}><Text style={styles.totalLabel}>{language === 'ar' ? `${cart.length} منتجات` : `${cart.length} products`}</Text><Text style={styles.total}>{formatAED(subtotal)}</Text></View>
              <View style={[styles.secureRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}><ShieldCheck size={15} color={colors.success} /><Text style={styles.secureText}>{language === 'ar' ? 'السعر النهائي يُراجع من خادم Mig Farm قبل الدفع' : 'The final amount is verified by the Mig Farm server'}</Text></View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {session ? <CheckoutPayment session={session} customer={customer} language={language} onSuccess={paymentSucceeded} onError={setError} /> : (
              <Pressable accessibilityRole="button" disabled={busy || !cart.length} style={({ pressed }) => [styles.continueButton, (busy || !cart.length) && styles.disabled, pressed && styles.primaryPressed]} onPress={preparePayment}><Text style={styles.continueButtonText}>{busy ? (language === 'ar' ? 'جاري تجهيز الدفع…' : 'Preparing payment…') : (language === 'ar' ? 'المتابعة لبيانات البطاقة' : 'Continue to card details')}</Text></Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, isRTL, ...props }: React.ComponentProps<typeof TextInput> & { label: string; isRTL: boolean }) {
  return <View style={styles.field}><Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text><TextInput {...props} placeholderTextColor={colors.textSubtle} style={[styles.input, props.multiline && styles.inputMultiline, { textAlign: isRTL ? 'right' : 'left' }]} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: { minHeight: 62, paddingHorizontal: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  secureBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 32 },
  page: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 14, gap: 12 },
  steps: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepDone: { alignItems: 'center', gap: 2 },
  stepDoneText: { color: colors.success, fontSize: 8, fontWeight: '900' },
  stepActive: { height: 34, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepActiveText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  stepFuture: { alignItems: 'center', gap: 2 },
  stepFutureText: { color: colors.textSubtle, fontSize: 8, fontWeight: '800' },
  stepLine: { width: 34, height: 1, marginHorizontal: 7, backgroundColor: colors.borderStrong },
  section: { padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 11 },
  sectionHeader: { alignItems: 'center', gap: 7, marginBottom: 1 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  field: { gap: 5 },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  input: { minHeight: 46, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.background, color: colors.text, fontSize: 13 },
  inputMultiline: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  emirates: { gap: 7, paddingVertical: 2 },
  emirate: { height: 36, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  emirateActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  emirateText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  emirateTextActive: { color: '#FFFFFF' },
  summary: { padding: 14, borderRadius: radius.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#CBE3CF' },
  summaryTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  totalRow: { marginTop: 11, alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { color: colors.muted, fontSize: 11 },
  total: { color: colors.primary, fontSize: 21, fontWeight: '900' },
  secureRow: { marginTop: 10, alignItems: 'center', gap: 5 },
  secureText: { color: colors.success, fontSize: 9, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 11, lineHeight: 18, fontWeight: '800', textAlign: 'center', paddingHorizontal: 8 },
  continueButton: { height: 54, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  continueButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.68 },
  primaryPressed: { opacity: 0.82 },
  success: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  successTitle: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 18 },
  successBody: { color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: 'center', maxWidth: 320, marginTop: 8 },
  orderRef: { marginTop: 18, alignItems: 'center' },
  orderRefLabel: { color: colors.muted, fontSize: 10 },
  orderRefValue: { color: colors.primary, fontSize: 15, fontWeight: '900', marginTop: 4 },
  homeButton: { height: 48, paddingHorizontal: 22, marginTop: 22, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  homeButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
