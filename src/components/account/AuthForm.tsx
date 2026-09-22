import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Eye, EyeOff, Mail, Phone, UserRound } from 'lucide-react-native';
import { AccountPage, AccountField, AccountRow, Notice, ui } from './AccountUI';
import { AppButton } from '@/components/AppButton';
import { AppIconButton } from '@/components/AppIconButton';
import { BrandLogo } from '@/components/BrandLogo';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { authService, customerError } from '@/services/customer';
import { normalizePhone, validEmail } from '@/utils/customer';
import { googleIdToken, useGoogleSignIn } from '@/services/googleSignIn';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';

function Divider({ label }: { label: string }) {
  return (
    <View style={dividerStyles.row}>
      <View style={dividerStyles.line} />
      <Text style={dividerStyles.label}>{label}</Text>
      <View style={dividerStyles.line} />
    </View>
  );
}
const dividerStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  label: { ...typography.caption, color: colors.muted },
});

export function AuthForm({ mode }: { mode: 'login' | 'register' | 'forgot' }) {
  const { isRTL: ar } = useLanguage();
  const auth = useAuth();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [phone, setPhone] = useState('');
  const [phoneMode, setPhoneMode] = useState(false),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [googleRequest, googleResponse, promptGoogle] = useGoogleSignIn();
  useEffect(() => {
    const idToken = googleIdToken(googleResponse);
    if (!idToken) return;
    setBusy(true);
    setMessage('');
    auth
      .loginWithGoogle(idToken)
      .then(() => router.replace('/(tabs)/account'))
      .catch((error) => setMessage(customerError(error, ar)))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);
  const title =
    mode === 'login'
      ? ar
        ? 'تسجيل الدخول'
        : 'Sign in'
      : mode === 'register'
        ? ar
          ? 'إنشاء حساب'
          : 'Create account'
        : ar
          ? 'نسيت كلمة المرور'
          : 'Forgot password';
  const submit = async () => {
    if (busy) return;
    setMessage('');
    if (phoneMode && !normalizePhone(phone)) {
      setMessage(
        ar
          ? 'أدخل رقمًا صحيحًا مع رمز الدولة، مثل +971501234567.'
          : 'Enter a valid number with country code, e.g. +971501234567.',
      );
      return;
    }
    if (!phoneMode && !validEmail(email)) {
      setMessage(
        ar ? 'راجع البريد الإلكتروني.' : 'Enter a valid email address.',
      );
      return;
    }
    if (mode === 'register' && name.trim().length < 2) {
      setMessage(ar ? 'أدخل الاسم.' : 'Enter your name.');
      return;
    }
    if (
      mode !== 'forgot' &&
      !phoneMode &&
      password.length < (mode === 'register' ? 10 : 1)
    ) {
      setMessage(
        ar
          ? 'أدخل كلمة مرور صالحة، 10 أحرف على الأقل للحساب الجديد.'
          : 'Enter a valid password; new accounts need at least 10 characters.',
      );
      return;
    }
    setBusy(true);
    try {
      if (phoneMode) {
        await authService.requestPhoneCode(normalizePhone(phone)!);
        setMessage(
          ar
            ? 'راجع رسالة التحقق على هاتفك.'
            : 'Check your phone for a verification code.',
        );
      } else if (mode === 'forgot') {
        await authService.forgotPassword(email.trim());
        setMessage(
          ar
            ? 'إذا كان البريد مسجلاً، ستصلك تعليمات الاستعادة.'
            : 'If this email is registered, recovery instructions will be sent.',
        );
      } else if (mode === 'register') {
        if (await auth.register(name.trim(), email.trim(), password))
          router.replace('/(tabs)/account');
        else
          setMessage(
            ar
              ? 'راجع بريدك لتأكيد الحساب.'
              : 'Check your email to verify your account.',
          );
      } else {
        await auth.login(email.trim(), password);
        router.replace('/(tabs)/account');
      }
    } catch (error) {
      setMessage(customerError(error, ar));
    } finally {
      setBusy(false);
      setPassword('');
    }
  };
  return (
    <AccountPage title={title}>
      <View style={heroStyles.hero}>
        <View style={heroStyles.logoBadge}>
          <BrandLogo width={104} />
        </View>
        <Text style={heroStyles.subtitle}>
          {mode === 'register'
            ? ar
              ? 'انضم لعائلة ميج فارم في دقايق'
              : 'Join MIG FARM in minutes'
            : mode === 'forgot'
              ? ar
                ? 'هنساعدك تستعيد حسابك بسرعة'
                : "We'll help you get back in quickly"
              : ar
                ? 'أهلاً بعودتك'
                : 'Welcome back'}
        </Text>
      </View>
      {mode === 'register' ? (
        <AccountField
          label={ar ? 'الاسم' : 'Name'}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          maxLength={120}
        />
      ) : null}
      {phoneMode ? (
        <AccountField
          label={ar ? 'رقم الهاتف' : 'Phone number'}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          ltr
          placeholder="+971"
          maxLength={30}
        />
      ) : (
        <AccountField
          label={ar ? 'البريد الإلكتروني' : 'Email'}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          ltr
          maxLength={254}
        />
      )}
      {mode !== 'forgot' && !phoneMode ? (
        <View style={{ gap: 8 }}>
          <AccountField
            label={ar ? 'كلمة المرور' : 'Password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
            ltr
            maxLength={128}
          />
          <View style={{ alignItems: ar ? 'flex-start' : 'flex-end' }}>
            <AppIconButton
              icon={visible ? EyeOff : Eye}
              label={
                ar
                  ? visible
                    ? 'إخفاء كلمة المرور'
                    : 'إظهار كلمة المرور'
                  : visible
                    ? 'Hide password'
                    : 'Show password'
              }
              onPress={() => setVisible(!visible)}
            />
          </View>
        </View>
      ) : null}
      {mode === 'register' ? <Notice text={ar ? 'كلمة مرور غير شائعة من 10 أحرف على الأقل.' : 'An uncommon password of at least 10 characters.'} /> : null}
      {message ? <Notice error text={message} /> : null}
      <AppButton
        label={
          busy
            ? ar
              ? 'جارٍ المتابعة...'
              : 'Please wait...'
            : phoneMode
              ? ar
                ? 'إرسال رمز التحقق'
                : 'Send verification code'
              : mode === 'forgot'
                ? ar
                  ? 'إرسال رابط الاستعادة'
                  : 'Send recovery link'
                : title
        }
        onPress={submit}
        disabled={busy}
      />
      {mode !== 'forgot' && !phoneMode ? (
        <>
          <Divider label={ar ? 'أو' : 'or'} />
          <GoogleSignInButton
            onPress={() => {
              setMessage('');
              void promptGoogle();
            }}
            disabled={busy || !googleRequest}
          />
        </>
      ) : null}
      {mode === 'login' ? (
        <>
          <AccountRow
            icon={phoneMode ? Mail : Phone}
            title={
              phoneMode
                ? ar
                  ? 'الدخول بالبريد الإلكتروني'
                  : 'Use email'
                : ar
                  ? 'الدخول برقم الهاتف'
                  : 'Use phone number'
            }
            onPress={() => {
              setPhoneMode(!phoneMode);
              setMessage('');
            }}
          />
          <AccountRow
            icon={Mail}
            title={ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            onPress={() => router.push('/auth/forgot-password')}
          />
          <AccountRow
            icon={UserRound}
            title={ar ? 'إنشاء حساب' : 'Create account'}
            onPress={() => router.push('/auth/register')}
          />
        </>
      ) : null}
      <AppButton
        secondary
        label={ar ? 'متابعة كضيف' : 'Continue as guest'}
        onPress={() => router.replace('/(tabs)')}
      />
      <Text style={ui.caption}>
        {ar
          ? 'التصفح والشراء متاحان بدون إنشاء حساب.'
          : 'Browse and shop without creating an account.'}
      </Text>
    </AccountPage>
  );
}
const heroStyles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  logoBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    ...shadow,
  },
  subtitle: { ...typography.body, color: colors.muted, textAlign: 'center' },
});
