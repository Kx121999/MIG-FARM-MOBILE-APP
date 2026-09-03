import React, { useState } from 'react';
import { Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { COMPANY } from '@/constants/company';
export default function LegalScreen() {
  const { document } = useLocalSearchParams<{ document?: string }>();
  const terms = document === 'terms';
  const { isRTL: ar } = useLanguage();
  const [error, setError] = useState('');
  const url = terms ? COMPANY.termsUrl : COMPANY.privacyUrl;
  let valid = false;
  try {
    valid = new URL(url).protocol === 'https:';
  } catch {}
  return (
    <AccountPage
      title={
        terms
          ? ar
            ? 'الشروط والأحكام'
            : 'Terms & conditions'
          : ar
            ? 'سياسة الخصوصية'
            : 'Privacy policy'
      }
    >
      {!valid ? (
        <Notice
          text={
            ar
              ? 'الوثيقة الرسمية غير متاحة حاليًا. تواصل مع ميغ فارم للحصول على النسخة المعتمدة.'
              : 'The official document is currently unavailable. Contact MIG FARM for the approved version.'
          }
        />
      ) : (
        <AppButton
          label={ar ? 'فتح الوثيقة الرسمية' : 'Open official document'}
          onPress={async () => {
            try {
              await Linking.openURL(url);
            } catch {
              setError(ar ? 'تعذر فتح الرابط.' : 'Unable to open the link.');
            }
          }}
        />
      )}
      {error ? <Notice error text={error} /> : null}
      <AppButton
        secondary
        label={ar ? 'تواصل مع الدعم' : 'Contact support'}
        onPress={() => router.push('/support')}
      />
    </AccountPage>
  );
}
