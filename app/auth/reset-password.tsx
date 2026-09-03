import React, { useState } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AccountPage,
  AccountField,
  Notice,
} from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { authService, customerError } from '@/services/customer';

export default function ResetPasswordScreen() {
  const { isRTL: ar } = useLanguage();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const value =
        new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
      if (value)
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        );
      return value;
    }
    return typeof params.token === 'string' ? params.token : '';
  });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    if (busy) return;
    if (password.length < 10 || password !== confirm) {
      setMessage(
        ar
          ? 'راجع تطابق كلمتي المرور، 10 أحرف على الأقل.'
          : 'Passwords must match and contain at least 10 characters.',
      );
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await authService.resetPassword(token, password);
      setComplete(true);
    } catch (error) {
      setMessage(customerError(error, ar));
    } finally {
      setBusy(false);
      setPassword('');
      setConfirm('');
    }
  };
  return (
    <AccountPage title={ar ? 'إعادة تعيين كلمة المرور' : 'Reset password'}>
      {complete ? (
        <>
          <Notice
            text={
              ar
                ? 'تم تغيير كلمة المرور. سجل الدخول من جديد.'
                : 'Password changed. Please sign in again.'
            }
          />
          <AppButton
            label={ar ? 'تسجيل الدخول' : 'Sign in'}
            onPress={() => router.replace('/auth/login')}
          />
        </>
      ) : !token ? (
        <Notice
          error
          text={
            ar
              ? 'افتح رابط الاستعادة المرسل إلى بريدك.'
              : 'Open the recovery link sent to your email.'
          }
        />
      ) : (
        <>
          <Notice
            text={
              ar
                ? 'استخدم كلمة مرور غير شائعة من 10 أحرف على الأقل.'
                : 'Use an uncommon password of at least 10 characters.'
            }
          />
          <AccountField
            label={ar ? 'كلمة المرور الجديدة' : 'New password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            ltr
            maxLength={128}
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <AccountField
            label={ar ? 'تأكيد كلمة المرور' : 'Confirm password'}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            ltr
            maxLength={128}
            autoCapitalize="none"
            autoComplete="new-password"
          />
          {message ? <Notice error text={message} /> : null}
          <AppButton
            disabled={busy}
            label={ar ? 'حفظ كلمة المرور' : 'Save password'}
            onPress={submit}
          />
        </>
      )}
    </AccountPage>
  );
}
