import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useRetention } from '@/contexts/RetentionContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { customerError } from '@/services/customer';
import { AppButton } from '@/components/AppButton';
import { Notice, ui } from './AccountUI';
import type { NotificationPreference } from '@/types/customer';

export function NotificationSettings() {
  const { preferences, savePreferences, ready, error, retry } = useRetention();
  const { user } = useAuth();
  const { isRTL: ar } = useLanguage();
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const options: Array<{ key: keyof NotificationPreference; label: string }> = [
    { key: 'orderUpdates', label: ar ? 'تحديثات الطلب' : 'Order updates' },
    { key: 'offers', label: ar ? 'العروض' : 'Offers' },
    { key: 'newProducts', label: ar ? 'المنتجات الجديدة' : 'New products' },
    {
      key: 'availability',
      label: ar ? 'توفر المنتجات' : 'Product availability',
    },
  ];
  const change = async (key: keyof NotificationPreference, value: boolean) => {
    const next = {
      ...preferences,
      [key]: value,
      marketingConsent:
        preferences.marketingConsent ||
        ((key === 'offers' || key === 'newProducts') && value),
    };
    setBusy(true);
    try {
      await savePreferences(next);
      setMessage(
        ar
          ? (user ? 'تم حفظ التفضيلات في حسابك.' : 'تم حفظ التفضيلات على هذا الجهاز.')
          : (user ? 'Preferences saved to your account.' : 'Preferences saved on this device.'),
      );
    } catch (e) {
      setMessage(customerError(e, ar));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {error ? <><Notice error text={ar ? 'تعذر تحميل التفضيلات.' : 'Unable to load preferences.'} /><AppButton secondary label={ar ? 'إعادة المحاولة' : 'Retry'} onPress={retry} /></> : null}
      {options.map((option) => (
        <View
          key={option.key}
          style={[ui.row, { flexDirection: ar ? 'row-reverse' : 'row' }]}
        >
          <Text
            style={[ui.label, { flex: 1, textAlign: ar ? 'right' : 'left' }]}
          >
            {option.label}
          </Text>
          <Switch
            accessibilityLabel={option.label}
            disabled={!ready || busy}
            value={preferences[option.key]}
            onValueChange={(value) => change(option.key, value)}
          />
        </View>
      ))}
      <Notice
        text={
          ar
            ? 'العروض والمنتجات الجديدة اختيارية. إشعارات الهاتف الفورية غير مفعلة حاليًا.'
            : 'Offers and new-product alerts are optional. Push notifications are not active yet.'
        }
      />
      {message ? <Notice text={message} /> : null}
    </>
  );
}
