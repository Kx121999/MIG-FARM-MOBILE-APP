import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  AccountPage,
  AccountHeading,
  AccountField,
  Notice,
  ConfirmSheet,
  ui,
} from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { useAuth } from '@/contexts/AuthContext';
import { useRetention } from '@/contexts/RetentionContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { authService, customerError } from '@/services/customer';
export default function SettingsScreen() {
  const auth = useAuth();
  const { isRTL: ar } = useLanguage();
  const { personalization, setPersonalization, ready } = useRetention();
  const [password, setPassword] = useState(''),
    [next, setNext] = useState(''),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  const change = async () => {
    if (!password || next.length < 8) {
      setMessage(
        ar
          ? 'أدخل كلمة المرور الحالية والجديدة (8 أحرف على الأقل).'
          : 'Enter the current password and a new password of at least 8 characters.',
      );
      return;
    }
    setBusy(true);
    try {
      await authService.changePassword(password, next);
      setMessage(ar ? 'تم تغيير كلمة المرور' : 'Password changed');
    } catch (e) {
      setMessage(customerError(e, ar));
    } finally {
      setBusy(false);
      setPassword('');
      setNext('');
    }
  };
  return (
    <AccountPage title={ar ? 'الإعدادات والأمان' : 'Settings & security'}>
      <AccountHeading>{ar ? 'التخصيص' : 'Personalization'}</AccountHeading>
      <View style={[ui.row, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <Text style={[ui.label, { flex: 1, textAlign: ar ? 'right' : 'left' }]}>
          {ar
            ? 'مختارات بناءً على المنتجات التي شاهدتها'
            : 'Suggestions based on viewed products'}
        </Text>
        <Switch
          accessibilityLabel={ar ? 'تخصيص الرئيسية' : 'Personalize Home'}
          disabled={!ready || busy}
          value={personalization}
          onValueChange={async (value) => {
            try {
              await setPersonalization(value);
            } catch {
              setMessage(
                ar ? 'تعذر حفظ التفضيل.' : 'Unable to save this preference.',
              );
            }
          }}
        />
      </View>
      <AccountHeading>{ar ? 'أمان الحساب' : 'Account security'}</AccountHeading>
      {!auth.user ? (
        <>
          <Notice
            text={
              ar
                ? 'تسجيل الدخول مطلوب لإدارة كلمة المرور أو حذف الحساب.'
                : 'Sign in to manage your password or delete your account.'
            }
          />
          <AppButton
            label={ar ? 'تسجيل الدخول' : 'Sign in'}
            onPress={() => router.push('/auth/login')}
          />
        </>
      ) : (
        <>
          <AccountField
            label={ar ? 'كلمة المرور الحالية' : 'Current password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            ltr
            autoCapitalize="none"
            maxLength={128}
          />
          <AccountField
            label={ar ? 'كلمة المرور الجديدة' : 'New password'}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            ltr
            autoCapitalize="none"
            maxLength={128}
          />
          <AppButton
            disabled={busy}
            label={ar ? 'تغيير كلمة المرور' : 'Change password'}
            onPress={change}
          />
          <AccountHeading>
            {ar ? 'حذف الحساب' : 'Delete account'}
          </AccountHeading>
          <Notice
            text={
              ar
                ? 'حذف الحساب يزيل بيانات الملف والصورة المرتبطة به وفق سياسة الاحتفاظ المعتمدة. لا يمكن التراجع عن الحذف.'
                : 'Account deletion removes the profile and associated photo according to the approved retention policy. Deletion cannot be undone.'
            }
          />
          <AppButton
            secondary
            disabled={busy}
            label={ar ? 'حذف الحساب' : 'Delete account'}
            onPress={() => {
              if (!password) {
                setMessage(
                  ar
                    ? 'أدخل كلمة المرور الحالية لتأكيد هويتك.'
                    : 'Enter your current password to verify your identity.',
                );
                return;
              }
              setConfirm(true);
            }}
          />
        </>
      )}
      {message ? <Notice text={message} /> : null}
      <ConfirmSheet
        visible={confirm}
        title={ar ? 'تأكيد حذف الحساب' : 'Confirm account deletion'}
        body={
          ar
            ? 'هل تؤكد طلب حذف حسابك وصورته من الخادم؟'
            : 'Request permanent deletion of your account and its photo from the server?'
        }
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await auth.deleteAccount(password);
            setConfirm(false);
            router.replace('/(tabs)/account');
          } catch (e) {
            setMessage(customerError(e, ar));
            setConfirm(false);
          } finally {
            setBusy(false);
            setPassword('');
          }
        }}
      />
    </AccountPage>
  );
}
