import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Box } from 'lucide-react-native';
import {
  AccountPage,
  AccountHeading,
  AccountRow,
  Notice,
  ui,
} from '@/components/account/AccountUI';
import { NotificationSettings } from '@/components/account/NotificationSettings';
import { ChoiceGroup } from '@/components/account/ChoiceGroup';
import { AppButton } from '@/components/AppButton';
import { ScreenState, EmptyState } from '@/components/ScreenState';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { customerService, customerError } from '@/services/customer';
import type { NotificationRecord } from '@/types/customer';
export default function NotificationsScreen() {
  const { user } = useAuth();
  return <NotificationsContent key={user?.id || 'guest'} />;
}

function NotificationsContent() {
  const { user } = useAuth();
  const { isRTL: ar } = useLanguage();
  const [items, setItems] = useState<NotificationRecord[]>([]),
    [category, setCategory] = useState('all'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [cursor, setCursor] = useState<string>();
  const load = async (more = false) => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      const page = await customerService.notifications(
        more ? cursor : undefined,
      );
      setItems((current) =>
        more
          ? [
              ...current,
              ...page.items.filter(
                (item) => !current.some((saved) => saved.id === item.id),
              ),
            ]
          : page.items,
      );
      setCursor(page.nextCursor);
    } catch (e) {
      setError(customerError(e, ar));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    setItems([]);
    void load();
  }, [user?.id]);
  const filtered = items.filter(
    (item) => category === 'all' || item.category === category,
  );
  return (
    <AccountPage title={ar ? 'الإشعارات' : 'Notifications'} globalHeader>
      <ChoiceGroup
        label={ar ? 'عرض' : 'Show'}
        value={category}
        options={[
          { value: 'all', label: ar ? 'الكل' : 'All' },
          { value: 'orders', label: ar ? 'الطلبات' : 'Orders' },
          { value: 'offers', label: ar ? 'العروض' : 'Offers' },
          { value: 'availability', label: ar ? 'التوفر' : 'Availability' },
          { value: 'newProducts', label: ar ? 'الجديد' : 'New' },
          { value: 'important', label: ar ? 'تحديثات مهمة' : 'Important' },
        ]}
        onChange={setCategory}
      />
      {busy && !items.length ? (
        <ScreenState loading />
      ) : error ? (
        <>
          <Notice error text={error} />
          <AppButton
            secondary
            label={ar ? 'إعادة المحاولة' : 'Retry'}
            onPress={() => load()}
          />
        </>
      ) : !user ? (
        <Notice
          text={
            ar
              ? 'مركز إشعارات الحساب غير متاح حاليًا. يمكنك متابعة طلبات هذا الجهاز.'
              : 'Account notifications are currently unavailable. You can track orders from this device.'
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          title={ar ? 'لا توجد إشعارات جديدة' : 'No new notifications'}
        />
      ) : (
        filtered.map((item) => (
          <View key={item.id} style={ui.card}>
            <Text style={ui.label}>{item.title}</Text>
            <Text style={ui.body}>{item.body}</Text>
            <AppButton
              secondary
              label={ar ? 'تحديد كمقروء' : 'Mark as read'}
              disabled={item.read}
              onPress={async () => {
                try {
                  await customerService.markNotificationRead(item.id);
                  setItems((current) =>
                    current.map((value) =>
                      value.id === item.id ? { ...value, read: true } : value,
                    ),
                  );
                } catch (e) {
                  setError(customerError(e, ar));
                }
              }}
            />
          </View>
        ))
      )}
      {cursor ? (
        <AppButton
          secondary
          disabled={busy}
          label={ar ? 'المزيد' : 'More'}
          onPress={() => load(true)}
        />
      ) : null}
      <AccountRow
        icon={Box}
        title={ar ? 'متابعة طلباتي' : 'Track my orders'}
        onPress={() => router.push('/orders')}
      />
      <AccountHeading>
        {ar ? 'تفضيلات الإشعارات' : 'Notification preferences'}
      </AccountHeading>
      <NotificationSettings />
    </AccountPage>
  );
}
