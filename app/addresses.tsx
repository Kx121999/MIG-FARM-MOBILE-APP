import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import {
  AccountPage,
  AccountField,
  Notice,
  ConfirmSheet,
  ui,
} from '@/components/account/AccountUI';
import { ChoiceGroup } from '@/components/account/ChoiceGroup';
import { AppButton } from '@/components/AppButton';
import { AppIconButton } from '@/components/AppIconButton';
import { EmptyState, ScreenState } from '@/components/ScreenState';
import { useCustomerAddresses } from '@/hooks/useCustomerAddresses';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { EMIRATES, normalizePhone } from '@/utils/customer';
import { customerError } from '@/services/customer';
import type { SavedAddress } from '@/types';

const blank: Omit<SavedAddress, 'id'> & { id?: string } = {
  label: '',
  category: 'home',
  name: '',
  phone: '',
  emirate: 'Dubai',
  city: '',
  addressLine: '',
  unit: '',
  notes: '',
  isDefault: false,
};
export default function AddressesScreen() {
  const data = useCustomerAddresses();
  const { user } = useAuth();
  const { isRTL: ar } = useLanguage();
  const [draft, setDraft] = useState<typeof blank | null>(null),
    [message, setMessage] = useState(''),
    [deleting, setDeleting] = useState(''),
    [busy, setBusy] = useState(false);
  const update = (key: keyof typeof blank, value: string | boolean) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const save = async () => {
    if (!draft || busy) return;
    const phone = draft.phone ? normalizePhone(draft.phone) : '';
    if (
      !draft.label.trim() ||
      !draft.city.trim() ||
      !draft.addressLine.trim() ||
      phone === null
    ) {
      setMessage(
        ar
          ? 'أكمل اسم العنوان والمنطقة والعنوان، وراجع رقم الهاتف.'
          : 'Complete the address label, area and full address, and check the phone number.',
      );
      return;
    }
    setBusy(true);
    try {
      await data.save({ ...draft, label: draft.label.trim(), phone });
      setDraft(null);
      setMessage(
        user
          ? ar
            ? 'تم حفظ العنوان'
            : 'Address saved'
          : ar
            ? 'تم حفظ العنوان على هذا الجهاز.'
            : 'Address saved on this device.',
      );
    } catch (e) {
      setMessage(customerError(e, ar));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AccountPage title={ar ? 'عناويني' : 'My addresses'}>
      {!user ? (
        <Notice
          text={
            ar
              ? 'عناوين هذا الجهاز فقط. المزامنة تحتاج حسابًا وخدمة متاحة.'
              : 'Addresses on this device only. Sync requires an account and an available service.'
          }
        />
      ) : null}
      {data.loading ? (
        <ScreenState loading />
      ) : data.error ? (
        <ScreenState error="request" onRetry={data.reload} />
      ) : null}
      {!draft && !data.loading && !data.error && !data.addresses.length ? (
        <EmptyState
          title={ar ? 'لا توجد عناوين محفوظة' : 'No saved addresses'}
          body={
            ar
              ? 'أضف عنوانًا لاستخدامه عند الطلب.'
              : 'Add an address for your next order.'
          }
        />
      ) : null}
      {!draft
        ? data.addresses.map((item) => (
            <View key={item.id} style={ui.card}>
              <Text style={[ui.label, { textAlign: ar ? 'right' : 'left' }]}>
                {item.label}
                {item.isDefault ? (ar ? ' · افتراضي' : ' · Default') : ''}
              </Text>
              <Text style={[ui.body, { textAlign: ar ? 'right' : 'left' }]}>
                {item.addressLine}
                {'\n'}
                {item.city}, {item.emirate}
              </Text>
              <View
                style={{
                  flexDirection: ar ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AppIconButton
                  icon={Pencil}
                  label={(ar ? 'تعديل ' : 'Edit ') + item.label}
                  onPress={() => {
                    setDraft(item);
                    setMessage('');
                  }}
                />
                <AppIconButton
                  icon={Trash2}
                  label={(ar ? 'حذف ' : 'Delete ') + item.label}
                  onPress={() => setDeleting(item.id)}
                />
                {!item.isDefault ? (
                  <AppButton
                    secondary
                    style={ui.flex}
                    label={ar ? 'تعيين افتراضي' : 'Set default'}
                    onPress={async () => {
                      try {
                        await data.makeDefault(item.id);
                      } catch (e) {
                        setMessage(customerError(e, ar));
                      }
                    }}
                  />
                ) : null}
              </View>
            </View>
          ))
        : null}
      {!draft ? (
        <AppButton
          disabled={data.loading}
          label={ar ? 'إضافة عنوان' : 'Add address'}
          onPress={() => {
            setDraft({ ...blank, isDefault: !data.addresses.length });
            setMessage('');
          }}
        />
      ) : (
        <>
          <ChoiceGroup
            label={ar ? 'نوع العنوان' : 'Address type'}
            value={draft.category || 'other'}
            options={[
              { value: 'home', label: ar ? 'المنزل' : 'Home' },
              { value: 'farm', label: ar ? 'المزرعة' : 'Farm' },
              { value: 'company', label: ar ? 'الشركة' : 'Company' },
              { value: 'other', label: ar ? 'عنوان آخر' : 'Other' },
            ]}
            onChange={(v) => update('category', v)}
          />
          <AccountField
            label={ar ? 'اسم العنوان' : 'Address label'}
            value={draft.label}
            onChangeText={(v) => update('label', v)}
            maxLength={80}
          />
          <AccountField
            label={ar ? 'اسم المستلم (اختياري)' : 'Recipient name (optional)'}
            value={draft.name || ''}
            onChangeText={(v) => update('name', v)}
            maxLength={120}
          />
          <AccountField
            label={ar ? 'هاتف المستلم (اختياري)' : 'Recipient phone (optional)'}
            value={draft.phone || ''}
            onChangeText={(v) => update('phone', v)}
            keyboardType="phone-pad"
            ltr
            maxLength={30}
          />
          <ChoiceGroup
            label={ar ? 'الإمارة' : 'Emirate'}
            value={draft.emirate}
            options={EMIRATES.map(([value, label]) => ({
              value,
              label: ar ? label : value,
            }))}
            onChange={(v) => update('emirate', v)}
          />
          <AccountField
            label={ar ? 'المدينة / المنطقة' : 'City / area'}
            value={draft.city}
            onChangeText={(v) => update('city', v)}
            maxLength={100}
          />
          <AccountField
            label={
              ar ? 'الشارع والمبنى / الفيلا' : 'Street and building / villa'
            }
            value={draft.addressLine}
            onChangeText={(v) => update('addressLine', v)}
            multiline
            maxLength={180}
          />
          <AccountField
            label={ar ? 'رقم الوحدة (اختياري)' : 'Unit (optional)'}
            value={draft.unit || ''}
            onChangeText={(v) => update('unit', v)}
            maxLength={30}
          />
          <AccountField
            label={
              ar ? 'ملاحظات التوصيل (اختياري)' : 'Delivery notes (optional)'
            }
            value={draft.notes || ''}
            onChangeText={(v) => update('notes', v)}
            multiline
            maxLength={300}
          />
          <View
            style={{
              flexDirection: ar ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={ui.label}>
              {ar ? 'العنوان الافتراضي' : 'Default address'}
            </Text>
            <Switch
              accessibilityLabel={ar ? 'العنوان الافتراضي' : 'Default address'}
              value={draft.isDefault}
              onValueChange={(v) => update('isDefault', v)}
            />
          </View>
          <AppButton
            disabled={busy}
            label={ar ? 'حفظ العنوان' : 'Save address'}
            onPress={save}
          />
          <AppButton
            secondary
            disabled={busy}
            label={ar ? 'إلغاء' : 'Cancel'}
            onPress={() => setDraft(null)}
          />
        </>
      )}
      {message ? <Notice text={message} /> : null}
      <ConfirmSheet
        visible={!!deleting}
        title={ar ? 'حذف العنوان' : 'Delete address'}
        body={
          ar
            ? 'هل تريد إزالة هذا العنوان المحفوظ؟'
            : 'Remove this saved address?'
        }
        busy={busy}
        onCancel={() => setDeleting('')}
        onConfirm={async () => {
          setBusy(true);
          try {
            await data.remove(deleting);
            setDeleting('');
          } catch (e) {
            setMessage(customerError(e, ar));
            setDeleting('');
          } finally {
            setBusy(false);
          }
        }}
      />
    </AccountPage>
  );
}
