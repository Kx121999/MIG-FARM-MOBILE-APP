import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Mail, UserRound } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountField, AccountRow, Notice, ui } from './AccountUI';
import { AppButton } from '@/components/AppButton';
import { AppIconButton } from '@/components/AppIconButton';
import { BrandLogo } from '@/components/BrandLogo';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { MotionPressable } from '@/components/Motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { authService, customerError } from '@/services/customer';
import { validEmail } from '@/utils/customer';
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
    [name, setName] = useState('');
  const [visible, setVisible] = useState(false),
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
    if (!validEmail(email)) {
      setMessage(
        ar ? 'راجع البريد الإلكتروني.' : 'Enter a valid email address.',
      );
      return;
    }
    if (mode === 'register' && name.trim().length < 2) {
      setMessage(ar ? 'أدخل الاسم.' : 'Enter your name.');
      return;
    }
    if (mode !== 'forgot' && password.length < (mode === 'register' ? 10 : 1)) {
      setMessage(
        ar
          ? 'أدخل كلمة مرور صالحة، 10 أحرف على الأقل للحساب الجديد.'
          : 'Enter a valid password; new accounts need at least 10 characters.',
      );
      return;
    }
    setBusy(true);
    try {
      if (mode === 'forgot') {
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
  const BackIcon = ar ? ArrowRight : ArrowLeft;
  return (
    <SafeAreaView style={heroStyles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.leaf, colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={heroStyles.hero}
      >
        <View style={[heroStyles.heroTop, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={ar ? 'رجوع' : 'Back'}
            style={ui.glassIcon}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/account'))}
          >
            <BackIcon size={19} color="#FFFFFF" />
          </MotionPressable>
        </View>
        <View style={heroStyles.logoBadge}>
          <BrandLogo width={96} />
        </View>
        <Text style={heroStyles.title}>{title}</Text>
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
      </LinearGradient>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={heroStyles.sheetContent}
        style={heroStyles.sheet}
      >
      {mode === 'register' ? (
        <AccountField
          label={ar ? 'الاسم' : 'Name'}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          maxLength={120}
        />
      ) : null}
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
      {mode !== 'forgot' ? (
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
            : mode === 'forgot'
              ? ar
                ? 'إرسال رابط الاستعادة'
                : 'Send recovery link'
              : title
        }
        onPress={submit}
        disabled={busy}
      />
      {mode !== 'forgot' ? (
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
      </ScrollView>
    </SafeAreaView>
  );
}
const heroStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  hero: { alignItems: 'center', paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  heroTop: { width: '100%', minHeight: 44 },
  logoBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    ...shadow,
  },
  title: { ...typography.page, color: '#FFFFFF', marginTop: spacing.sm },
  subtitle: { ...typography.body, color: 'rgba(255,255,255,0.82)', textAlign: 'center' },
  sheet: { flex: 1, marginTop: -radius.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background },
  sheetContent: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
});
