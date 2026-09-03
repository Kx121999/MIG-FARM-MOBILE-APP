import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Eye, EyeOff, Mail, Phone, UserRound } from 'lucide-react-native';
import { AccountPage, AccountField, AccountRow, Notice, ui } from './AccountUI';
import { AppButton } from '@/components/AppButton';
import { AppIconButton } from '@/components/AppIconButton';
import { BrandLogo } from '@/components/BrandLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { authService, customerError } from '@/services/customer';
import { normalizePhone, validEmail } from '@/utils/customer';

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
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <BrandLogo width={132} />
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
