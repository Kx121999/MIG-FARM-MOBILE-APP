import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Trash2, MapPin } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  AccountPage,
  AccountField,
  AccountRow,
  Notice,
  ConfirmSheet,
  ui,
} from '@/components/account/AccountUI';
import { UserAvatar } from '@/components/account/UserAvatar';
import { AppButton } from '@/components/AppButton';
import { useAuth } from '@/contexts/AuthContext';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { customerError } from '@/services/customer';
import { selectAvatar } from '@/services/avatar';
import { normalizePhone, validEmail, EMIRATES } from '@/utils/customer';
import type { AvatarSelection, ProfileDraft } from '@/types/customer';
import { ChoiceGroup } from '@/components/account/ChoiceGroup';

export default function ProfileScreen() {
  const auth = useAuth();
  const { profile, setProfile, hydrated } = useCommerce();
  const { language, isRTL: ar, setLanguage } = useLanguage();
  const [draft, setDraft] = useState<ProfileDraft>({
    ...profile,
    emirate: profile.emirate || 'Dubai',
    language,
  });
  const [photo, setPhoto] = useState<AvatarSelection | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty)
      setDraft({
        ...(auth.user || profile),
        emirate: auth.user?.emirate || profile.emirate || 'Dubai',
        language,
      });
  }, [auth.user, profile, language, dirty]);
  const update = (key: keyof ProfileDraft, value: string) => {
    setDirty(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const choose = async (source: 'library' | 'camera') => {
    setMessage('');
    setBusy(true);
    try {
      const selected = await selectAvatar(source);
      if (selected) setPhoto(selected);
    } catch {
      setMessage(
        ar
          ? 'تعذر اختيار الصورة. راجع الإذن واختر صورة أصغر وحاول مرة أخرى.'
          : 'Unable to select the photo. Check permission and try a smaller image.',
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const phone = draft.phone ? normalizePhone(draft.phone) : '';
    if (
      draft.name.trim().length < 2 ||
      (draft.email && !validEmail(draft.email)) ||
      phone === null
    ) {
      setMessage(
        ar
          ? 'راجع الاسم والبريد الإلكتروني ورقم الهاتف مع رمز الدولة.'
          : 'Check your name, email and phone number with country code.',
      );
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const next = {
        ...draft,
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone,
      };
      if (auth.user) await auth.updateProfile(next);
      else setProfile(next);
      setLanguage(draft.language);
      setDirty(false);
      setMessage(
        auth.user
          ? ar
            ? 'تم حفظ التغييرات'
            : 'Changes saved'
          : ar
            ? 'تم حفظ بيانات التواصل على هذا الجهاز فقط.'
            : 'Contact details saved on this device only.',
      );
    } catch (e) {
      setMessage(customerError(e, ar));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AccountPage title={ar ? 'الملف الشخصي' : 'Personal profile'}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
        <UserAvatar
          user={auth.user}
          size={80}
          loading={!auth.ready}
          preview={photo?.uri}
        />
        <Text style={ui.caption}>
          {ar ? 'الصورة اختيارية' : 'Photo is optional'}
        </Text>
      </View>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10 }}>
        <AppButton
          style={ui.flex}
          secondary
          disabled={busy}
          label={ar ? 'اختيار صورة' : 'Choose photo'}
          onPress={() => choose('library')}
        />
        <AppButton
          style={ui.flex}
          secondary
          disabled={busy}
          label={ar ? 'الكاميرا' : 'Camera'}
          onPress={() => choose('camera')}
        />
      </View>
      {photo ? (
        <>
          <Notice
            text={
              ar
                ? 'معاينة فقط؛ الصورة لم تُرفع بعد.'
                : 'Preview only; this photo has not been uploaded.'
            }
          />
          <AppButton
            disabled={busy}
            label={ar ? 'حفظ الصورة' : 'Save photo'}
            onPress={async () => {
              setBusy(true);
              try {
                if (!auth.user) {
                  setMessage(
                    ar
                      ? 'حفظ الصورة للحساب غير متاح حاليًا. المعاينة لن تُحفظ بشكل دائم.'
                      : 'Account photo storage is not available yet. This preview is temporary.',
                  );
                  return;
                }
                await auth.uploadAvatar(photo);
                setPhoto(null);
                setMessage(ar ? 'تم تحديث الصورة' : 'Photo updated');
              } catch {
                setMessage(
                  ar
                    ? 'تعذر تحديث الصورة. حاول مرة أخرى.'
                    : 'Unable to update the photo. Please try again.',
                );
              } finally {
                setBusy(false);
              }
            }}
          />
          <AppButton
            secondary
            label={ar ? 'إلغاء الصورة المختارة' : 'Discard selected photo'}
            onPress={() => setPhoto(null)}
          />
        </>
      ) : null}
      {auth.user?.avatarUrl ? (
        <AccountRow
          icon={Trash2}
          title={ar ? 'إزالة الصورة' : 'Remove photo'}
          onPress={() => setRemove(true)}
        />
      ) : null}
      {!auth.user ? (
        <Notice
          text={
            ar
              ? 'بيانات التواصل هنا محفوظة على هذا الجهاز، وليست حسابًا مسجلاً.'
              : 'These contact details are local to this device, not a registered account.'
          }
        />
      ) : null}
      <AccountField
        label={ar ? 'الاسم' : 'Name'}
        value={draft.name}
        onChangeText={(v) => update('name', v)}
        maxLength={120}
      />
      <AccountField
        label={ar ? 'البريد الإلكتروني' : 'Email'}
        value={draft.email}
        onChangeText={(v) => update('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
        ltr
        maxLength={254}
      />
      <AccountField
        label={ar ? 'رقم الهاتف' : 'Phone number'}
        value={draft.phone}
        onChangeText={(v) => update('phone', v)}
        keyboardType="phone-pad"
        ltr
        placeholder="+971"
        maxLength={30}
      />
      <ChoiceGroup
        label={ar ? 'الإمارة' : 'Emirate'}
        value={draft.emirate || 'Dubai'}
        options={EMIRATES.map(([value, label]) => ({
          value,
          label: ar ? label : value,
        }))}
        onChange={(v) => update('emirate', v)}
      />
      <ChoiceGroup
        label={ar ? 'اللغة' : 'Language'}
        value={draft.language}
        options={[
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ]}
        onChange={(v) => update('language', v)}
      />
      {message ? <Notice text={message} /> : null}
      <AppButton
        label={
          busy
            ? ar
              ? 'جارٍ الحفظ...'
              : 'Saving...'
            : ar
              ? 'حفظ التغييرات'
              : 'Save changes'
        }
        disabled={busy || !hydrated}
        onPress={save}
      />
      <AccountRow
        icon={MapPin}
        title={ar ? 'عناويني' : 'My addresses'}
        onPress={() => router.push('/addresses')}
      />
      <ConfirmSheet
        visible={remove}
        title={ar ? 'إزالة الصورة' : 'Remove photo'}
        body={
          ar
            ? 'سيعود الحساب للصورة الافتراضية.'
            : 'Your account will use the default avatar.'
        }
        busy={busy}
        onCancel={() => setRemove(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await auth.removeAvatar();
            setRemove(false);
          } catch {
            setMessage(
              ar
                ? 'تعذر تحديث الصورة. حاول مرة أخرى.'
                : 'Unable to update the photo. Try again.',
            );
            setRemove(false);
          } finally {
            setBusy(false);
          }
        }}
      />
    </AccountPage>
  );
}
