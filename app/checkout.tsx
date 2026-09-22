import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PackageCheck,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChoiceGroup } from '@/components/account/ChoiceGroup';
import { Notice } from '@/components/account/AccountUI';
import { CheckoutPayment } from '@/components/payments/CheckoutPayment';
import { DeliveryMethod, DeliveryMethodMap } from '@/components/DeliveryMethodMap';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCustomerAddresses } from '@/hooks/useCustomerAddresses';
import { formatAED, localizedProductTitle } from '@/services/catalog';
import {
  CheckoutCustomer,
  CheckoutError,
  createPaymentSession,
  ORDER_PREPARE_ENABLED,
  PAYMENT_ENABLED,
  PaymentSession,
  prepareOrder,
  PreparedOrder,
  ShippingAddress,
} from '@/services/payments';
import type { CartItem } from '@/types';

const emirates = [
  { value: 'Dubai', ar: 'دبي' },
  { value: 'Abu Dhabi', ar: 'أبوظبي' },
  { value: 'Sharjah', ar: 'الشارقة' },
  { value: 'Ajman', ar: 'عجمان' },
  { value: 'Umm Al Quwain', ar: 'أم القيوين' },
  { value: 'Ras Al Khaimah', ar: 'رأس الخيمة' },
  { value: 'Fujairah', ar: 'الفجيرة' },
];

function money(value: number, currency: string, language: 'ar' | 'en') {
  try {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-AE' : 'en-AE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function checkoutError(code: string, language: 'ar' | 'en') {
  const ar = language === 'ar';
  if (code === 'order_prepare_disabled')
    return ar ? 'تجهيز الطلب غير مفعّل في هذه النسخة.' : 'Order preparation is not enabled in this build.';
  if (['invalid_cart_item', 'cart_is_empty', 'odoo_variant_unavailable', 'odoo_variant_out_of_stock'].includes(code))
    return ar ? 'تغيّر أحد المنتجات أو خياراته. ارجع للسلة وراجع الطلب.' : 'A product or variant changed. Return to the cart and review your order.';
  if (code === 'invalid_customer')
    return ar ? 'راجع الاسم والبريد ورقم الهاتف.' : 'Check the name, email, and phone number.';
  if (code === 'invalid_uae_shipping_address')
    return ar ? 'اختر إمارة داخل الإمارات وأكمل العنوان.' : 'Choose a UAE emirate and complete the address.';
  if (code === 'idempotency_conflict')
    return ar ? 'تغيّرت بيانات المحاولة السابقة. ارجع للسلة ثم أعد المحاولة.' : 'The previous attempt details changed. Return to the cart and try again.';
  if (code === 'network')
    return ar ? 'تعذر الاتصال. الطلب لم يُدفع والسلة ما زالت محفوظة.' : 'Could not connect. Nothing was paid and your cart is still saved.';
  if (code === 'payment_disabled' || code === 'missing_credentials' || code === 'credential_mode_mismatch')
    return ar ? 'الدفع الإلكتروني غير متاح مؤقتًا. طلبك وسلتك محفوظان.' : 'Online payment is temporarily unavailable. Your order and cart are saved.';
  if (code.startsWith('payment_') || code === 'invalid_payment_session')
    return ar ? 'تعذر تجهيز الدفع بأمان. لم يتم خصم أي مبلغ ويمكنك المحاولة مرة أخرى.' : 'Secure payment could not be prepared. Nothing was charged and you can retry.';
  if (code.startsWith('odoo_'))
    return ar ? 'تعذر التحقق من Odoo الآن. السلة محفوظة ويمكنك المحاولة لاحقًا.' : 'Odoo verification is currently unavailable. Your cart is saved for retry.';
  return ar ? 'تعذر تجهيز مراجعة الطلب. راجع البيانات وحاول مرة أخرى.' : 'Final review could not be prepared. Check the details and try again.';
}

export default function CheckoutScreen() {
  const { cart, subtotal, profile: guestProfile } = useCommerce();
  const { user } = useAuth();
  const profile = user || guestProfile;
  const { addresses, error: addressError } = useCustomerAddresses();
  const { language, isRTL } = useLanguage();
  const [selectedAddress, setSelectedAddress] = useState('');
  const [customer, setCustomer] = useState<CheckoutCustomer>({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState<ShippingAddress>({ emirate: 'Dubai', city: '', addressLine: '', notes: '' });
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery');
  const [preparedOrder, setPreparedOrder] = useState<PreparedOrder | null>(null);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const preparingRef = useRef(false);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    setCustomer((current) => ({
      name: current.name || profile.name,
      email: current.email || profile.email,
      phone: current.phone || profile.phone,
    }));
    const defaultAddress = addresses.find((item) => item.isDefault);
    if (defaultAddress) {
      setAddress((current) => current.city || current.addressLine ? current : {
        ...current,
        addressId: defaultAddress.id,
        emirate: defaultAddress.emirate,
        city: defaultAddress.city,
        addressLine: [defaultAddress.addressLine, defaultAddress.unit].filter(Boolean).join(', '),
        notes: defaultAddress.notes || '',
      });
      setSelectedAddress((current) => current || defaultAddress.id);
    }
  }, [addresses, profile.email, profile.name, profile.phone]);

  const valid = Boolean(
    customer.name.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) &&
    customer.phone.trim() &&
    address.emirate &&
    address.city.trim() &&
    address.addressLine.trim(),
  );

  const prepareReview = async () => {
    if (preparingRef.current || preparedOrder) return;
    if (!ORDER_PREPARE_ENABLED) {
      setError(checkoutError('order_prepare_disabled', language));
      return;
    }
    if (!cart.length) {
      setError(checkoutError('cart_is_empty', language));
      return;
    }
    if (!valid) {
      setError(language === 'ar' ? 'أكمل بيانات العميل وعنوان التوصيل المطلوبة.' : 'Complete the required customer and delivery details.');
      return;
    }
    preparingRef.current = true;
    setBusy(true);
    setError('');
    requestRef.current?.abort();
    requestRef.current = new AbortController();
    try {
      const result = await prepareOrder(cart, customer, address, requestRef.current.signal);
      setPreparedOrder(result);
    } catch (reason) {
      setError(checkoutError(reason instanceof CheckoutError ? reason.code : reason instanceof Error ? reason.message : 'unknown', language));
    } finally {
      preparingRef.current = false;
      setBusy(false);
    }
  };

  const chooseAddress = (id: string) => {
    const saved = addresses.find((item) => item.id === id);
    if (!saved) return;
    setSelectedAddress(id);
    setAddress({
      addressId: saved.id,
      emirate: saved.emirate,
      city: saved.city,
      addressLine: [saved.addressLine, saved.unit].filter(Boolean).join(', '),
      notes: saved.notes || '',
    });
    setCustomer((current) => ({ ...current, name: saved.name || current.name, phone: saved.phone || current.phone }));
  };

  const startPayment = async () => {
    if (!preparedOrder || paymentBusy || paymentSession) return;
    setPaymentBusy(true);
    setError('');
    try {
      setPaymentSession(await createPaymentSession(preparedOrder));
    } catch (reason) {
      setError(checkoutError(reason instanceof CheckoutError ? reason.code : 'network', language));
    } finally {
      setPaymentBusy(false);
    }
  };

  const paymentSubmitted = () => {
    if (!preparedOrder) return;
    router.replace({
      pathname: '/order-detail',
      params: { number: preparedOrder.orderId },
    });
  };

  const priceChanged = Boolean(preparedOrder && Math.abs(preparedOrder.subtotal - subtotal) >= 0.01);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={() => router.back()}>
          <BackIcon size={21} color={colors.primaryDark} />
        </Pressable>
        <Text style={styles.topBarTitle}>{language === 'ar' ? 'التوصيل ومراجعة الطلب' : 'Delivery and review'}</Text>
        <View style={styles.secureBadge}><ClipboardCheck size={17} color={colors.success} /></View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.page}>
            <CheckoutSteps language={language} prepared={Boolean(preparedOrder)} />

            {!preparedOrder ? (
              <>
                <View style={styles.section}>
                  <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <UserRound size={19} color={colors.primary} />
                    <Text style={styles.sectionTitle}>{language === 'ar' ? 'بيانات الاستلام' : 'Contact details'}</Text>
                  </View>
                  <Field label={language === 'ar' ? 'الاسم الكامل *' : 'Full name *'} value={customer.name} onChangeText={(name) => setCustomer((current) => ({ ...current, name }))} isRTL={isRTL} />
                  <Field label={language === 'ar' ? 'البريد الإلكتروني *' : 'Email *'} value={customer.email} onChangeText={(email) => setCustomer((current) => ({ ...current, email }))} isRTL={isRTL} keyboardType="email-address" autoCapitalize="none" />
                  <Field label={language === 'ar' ? 'رقم الهاتف *' : 'Phone number *'} value={customer.phone} onChangeText={(phone) => setCustomer((current) => ({ ...current, phone }))} isRTL={isRTL} keyboardType="phone-pad" />
                </View>

                <View style={styles.section}>
                  <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <MapPin size={19} color={colors.primary} />
                    <Text style={styles.sectionTitle}>{language === 'ar' ? 'عنوان التوصيل' : 'Delivery address'}</Text>
                  </View>
                  {addresses.length ? <ChoiceGroup label={language === 'ar' ? 'العناوين المحفوظة' : 'Saved addresses'} value={selectedAddress} options={addresses.map((item) => ({ value: item.id, label: item.label }))} onChange={chooseAddress} /> : null}
                  {addressError ? <Notice text={language === 'ar' ? 'تعذر تحميل العناوين. يمكنك إدخال العنوان يدويًا.' : 'Saved addresses could not be loaded. You can enter an address manually.'} /> : null}
                  <DeliveryMethodMap emirate={address.emirate} method={deliveryMethod} onChangeMethod={setDeliveryMethod} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emirates}>
                    {emirates.map((item) => (
                      <Pressable key={item.value} onPress={() => setAddress((current) => ({ ...current, addressId: null, emirate: item.value }))} style={[styles.emirate, address.emirate === item.value && styles.emirateActive]}>
                        <Text style={[styles.emirateText, address.emirate === item.value && styles.emirateTextActive]}>{language === 'ar' ? item.ar : item.value}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Field label={language === 'ar' ? 'المدينة أو المنطقة *' : 'City or area *'} value={address.city} onChangeText={(city) => setAddress((current) => ({ ...current, addressId: null, city }))} isRTL={isRTL} />
                  <Field label={language === 'ar' ? 'العنوان بالتفصيل *' : 'Full address *'} value={address.addressLine} onChangeText={(addressLine) => setAddress((current) => ({ ...current, addressId: null, addressLine }))} isRTL={isRTL} multiline />
                  <Field label={language === 'ar' ? 'ملاحظات التوصيل' : 'Delivery notes'} value={address.notes} onChangeText={(notes) => setAddress((current) => ({ ...current, notes }))} isRTL={isRTL} multiline />
                </View>
              </>
            ) : (
              <View style={styles.preparedNotice}>
                <CheckCircle2 size={25} color={colors.success} />
                <View style={styles.flex}>
                  <Text style={[styles.preparedTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'المراجعة النهائية جاهزة' : 'Final review is ready'}</Text>
                  <Text style={[styles.preparedBody, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? `مرجع عرض Odoo: ${preparedOrder.odoo.orderName}` : `Odoo quotation: ${preparedOrder.odoo.orderName}`}</Text>
                </View>
              </View>
            )}

            <CartReview cart={cart} language={language} isRTL={isRTL} />

            <View style={styles.summary}>
              <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <PackageCheck size={19} color={colors.primary} />
                <Text style={styles.sectionTitle}>{preparedOrder ? (language === 'ar' ? 'إجماليات Odoo المعتمدة' : 'Authoritative Odoo totals') : (language === 'ar' ? 'ملخص تقديري' : 'Provisional summary')}</Text>
              </View>
              {preparedOrder ? (
                <>
                  <MoneyRow label={language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'} value={money(preparedOrder.subtotal, preparedOrder.currency, language)} isRTL={isRTL} />
                  <MoneyRow label={language === 'ar' ? 'الضريبة' : 'Tax'} value={money(preparedOrder.tax, preparedOrder.currency, language)} isRTL={isRTL} />
                  <MoneyRow label={language === 'ar' ? 'التوصيل' : 'Delivery'} value={money(preparedOrder.delivery, preparedOrder.currency, language)} isRTL={isRTL} />
                  <View style={styles.summaryDivider} />
                  <MoneyRow label={language === 'ar' ? 'الإجمالي' : 'Total'} value={money(preparedOrder.total, preparedOrder.currency, language)} isRTL={isRTL} strong />
                  {priceChanged ? <Text style={[styles.priceChanged, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'تم تحديث السعر حسب بيانات Odoo الحالية.' : 'Price updated from the current Odoo catalog.'}</Text> : null}
                </>
              ) : (
                <>
                  <MoneyRow label={language === 'ar' ? 'مجموع السلة المعروض' : 'Displayed cart subtotal'} value={formatAED(subtotal)} isRTL={isRTL} strong />
                  <Text style={[styles.provisional, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'لا نحسب الضريبة داخل التطبيق. السعر والتوصيل والضريبة يؤكدها Odoo والخادم.' : 'The app does not calculate tax. Odoo and the server confirm price, delivery, and tax.'}</Text>
                </>
              )}
            </View>

            {!ORDER_PREPARE_ENABLED && !preparedOrder ? <Notice text={language === 'ar' ? 'تجهيز مسودة الطلب مغلق بأمان في هذه النسخة. لن يبدأ دفع أو إنشاء طلب عند الضغط.' : 'Draft preparation is safely disabled in this build. No payment or order will start.'} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>

        <View style={styles.stickyAction}>
          {preparedOrder ? (
            paymentSession ? (
              <CheckoutPayment session={paymentSession} customer={customer} language={language} onSuccess={paymentSubmitted} onError={(code) => setError(checkoutError(code || 'payment_error', language))} />
            ) : PAYMENT_ENABLED ? (
              <Pressable accessibilityRole="button" disabled={paymentBusy} style={({ pressed }) => [styles.continueButton, paymentBusy && styles.disabled, pressed && styles.primaryPressed]} onPress={startPayment}>
                <Text style={styles.continueButtonText}>{paymentBusy ? (language === 'ar' ? 'جاري تجهيز الدفع الآمن…' : 'Preparing secure payment…') : (language === 'ar' ? 'المتابعة إلى الدفع الآمن' : 'Continue to secure payment')}</Text>
              </Pressable>
            ) : (
              <View style={styles.stopPanel}>
                <ShieldCheck size={17} color={colors.success} />
                <Text style={styles.stopText}>{language === 'ar' ? 'الدفع الإلكتروني غير متاح مؤقتًا. تم حفظ مرجع الطلب والسلة.' : 'Online payment is temporarily unavailable. Your order reference and cart are saved.'}</Text>
              </View>
            )
          ) : (
            <Pressable accessibilityRole="button" disabled={busy || !cart.length || !ORDER_PREPARE_ENABLED} style={({ pressed }) => [styles.continueButton, (busy || !cart.length || !ORDER_PREPARE_ENABLED) && styles.disabled, pressed && styles.primaryPressed]} onPress={prepareReview}>
              <Text style={styles.continueButtonText}>{busy ? (language === 'ar' ? 'جاري التحقق مع Odoo…' : 'Verifying with Odoo…') : (language === 'ar' ? 'تجهيز المراجعة النهائية' : 'Prepare final review')}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CheckoutSteps({ language, prepared }: { language: 'ar' | 'en'; prepared: boolean }) {
  return <View style={styles.steps}>
    <View style={styles.stepDone}><CheckCircle2 size={15} color={colors.success} /><Text style={styles.stepDoneText}>{language === 'ar' ? 'السلة' : 'Cart'}</Text></View>
    <View style={styles.stepLine} />
    <View style={prepared ? styles.stepDone : styles.stepActive}><MapPin size={15} color={prepared ? colors.success : '#FFFFFF'} /><Text style={prepared ? styles.stepDoneText : styles.stepActiveText}>{language === 'ar' ? 'التوصيل' : 'Delivery'}</Text></View>
    <View style={styles.stepLine} />
    <View style={prepared ? styles.stepActive : styles.stepFuture}><ClipboardCheck size={15} color={prepared ? '#FFFFFF' : colors.textSubtle} /><Text style={prepared ? styles.stepActiveText : styles.stepFutureText}>{language === 'ar' ? 'المراجعة' : 'Review'}</Text></View>
  </View>;
}

function CartReview({ cart, language, isRTL }: { cart: CartItem[]; language: 'ar' | 'en'; isRTL: boolean }) {
  return <View style={styles.section}>
    <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'منتجات الطلب' : 'Order items'}</Text>
    {cart.map((item) => {
      const options = item.variant.options?.map((option) => `${option.attributeName}: ${option.value}`).join(' · ');
      return <View key={item.key} style={[styles.cartLine, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={styles.cartImage}>{item.image ? <Image source={{ uri: item.image, cache: 'force-cache' }} resizeMode="contain" style={styles.image} /> : <PackageCheck size={22} color={colors.muted} />}</View>
        <View style={styles.flex}>
          <Text numberOfLines={2} style={[styles.cartTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{localizedProductTitle(item, language)}</Text>
          {options || item.variant.title !== 'Default Title' ? <Text numberOfLines={2} style={[styles.cartVariant, { textAlign: isRTL ? 'right' : 'left' }]}>{options || item.variant.title}</Text> : null}
          <Text style={[styles.cartMeta, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? `الكمية ${item.quantity} · سعر الوحدة ${formatAED(item.variant.price)}` : `Qty ${item.quantity} · Unit ${formatAED(item.variant.price)}`}</Text>
        </View>
      </View>;
    })}
  </View>;
}

function MoneyRow({ label, value, isRTL, strong = false }: { label: string; value: string; isRTL: boolean; strong?: boolean }) {
  return <View style={[styles.totalRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}><Text style={strong ? styles.totalStrongLabel : styles.totalLabel}>{label}</Text><Text style={strong ? styles.total : styles.totalValue}>{value}</Text></View>;
}

function Field({ label, isRTL, ...props }: React.ComponentProps<typeof TextInput> & { label: string; isRTL: boolean }) {
  return <View style={styles.field}><Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text><TextInput {...props} placeholderTextColor={colors.textSubtle} style={[styles.input, props.multiline && styles.inputMultiline, { textAlign: isRTL ? 'right' : 'left' }]} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: { minHeight: 56, paddingHorizontal: 12, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  secureBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 16 },
  page: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 16, gap: 10 },
  steps: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepDone: { alignItems: 'center', gap: 2 },
  stepDoneText: { color: colors.success, fontSize: 8, fontWeight: '900' },
  stepActive: { height: 34, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepActiveText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  stepFuture: { alignItems: 'center', gap: 2 },
  stepFutureText: { color: colors.textSubtle, fontSize: 8, fontWeight: '800' },
  stepLine: { width: 34, height: 1, marginHorizontal: 7, backgroundColor: colors.borderStrong },
  section: { padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, gap: 9 },
  sectionHeader: { alignItems: 'center', gap: 7, marginBottom: 1 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  field: { gap: 5 },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  input: { minHeight: 44, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.background, color: colors.text, fontSize: 13 },
  inputMultiline: { minHeight: 66, paddingTop: 10, textAlignVertical: 'top' },
  emirates: { gap: 7, paddingVertical: 2, paddingEnd: 14 },
  emirate: { height: 36, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  emirateActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  emirateText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  emirateTextActive: { color: '#FFFFFF' },
  cartLine: { alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  cartImage: { width: 52, height: 58, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  cartTitle: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: '900' },
  cartVariant: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  cartMeta: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 4 },
  summary: { padding: 13, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  totalRow: { marginTop: 10, alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  totalLabel: { color: colors.muted, fontSize: 11 },
  totalValue: { color: colors.text, fontSize: 12, fontWeight: '800', writingDirection: 'ltr' },
  totalStrongLabel: { color: colors.text, fontSize: 13, fontWeight: '900' },
  total: { color: colors.primary, fontSize: 20, fontWeight: '900', writingDirection: 'ltr' },
  summaryDivider: { height: 1, backgroundColor: colors.borderStrong, marginTop: 12 },
  provisional: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 10 },
  priceChanged: { color: colors.primaryDark, fontSize: 10, lineHeight: 16, fontWeight: '900', marginTop: 10 },
  preparedNotice: { padding: 13, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  preparedTitle: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  preparedBody: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 3 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 18, fontWeight: '800', textAlign: 'center', paddingHorizontal: 8 },
  stickyAction: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  continueButton: { height: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  continueButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  stopPanel: { minHeight: 50, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stopText: { flex: 1, color: colors.primaryDark, fontSize: 10, lineHeight: 16, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.68 },
  primaryPressed: { opacity: 0.82 },
});
