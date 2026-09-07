import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Bell,
  Box,
  Heart,
  History,
  LogOut,
  MapPin,
  MessageCircle,
  Settings,
  ShieldCheck,
  UserRound,
  Headphones,
  FileText,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { MotionPressable } from '@/components/Motion';
import { UserAvatar } from '@/components/account/UserAvatar';
import {
  AccountRow,
  AccountHeading,
  ConfirmSheet,
  Notice,
  ui,
} from '@/components/account/AccountUI';
import { useAuth } from '@/contexts/AuthContext';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, typography } from '@/constants/theme';
import { customerError } from '@/services/customer';

export default function AccountScreen() {
  const { user, ready, logout } = useAuth();
  const { favorites } = useCommerce();
  const { language, isRTL: ar, setLanguage } = useLanguage();
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <SafeAreaView style={ui.safe} edges={['top']}>
      <AppHeader compact />
      <ScrollView
        contentContainerStyle={ui.page}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: ar ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 14,
            paddingVertical: 12,
          }}
        >
          <UserAvatar user={user} size={56} loading={!ready} />
          <View style={ui.flex}>
            <Text
              accessibilityRole="header"
              style={{
                ...typography.section,
                color: colors.text,
                textAlign: ar ? 'right' : 'left',
              }}
            >
              {user
                ? ar
                  ? 'مرحباً، ' + user.name.split(' ')[0]
                  : 'Hello, ' + user.name.split(' ')[0]
                : ar
                  ? 'مرحباً بك في ميغ فارم'
                  : 'Welcome to MIG FARM'}
            </Text>
            <Text
              style={[
                ui.body,
                { textAlign: ar ? 'right' : 'left', marginTop: 6 },
              ]}
            >
              {user
                ? user.email || user.phone
                : ar
                  ? 'سجل الدخول لحفظ طلباتك وعناوينك والوصول إليها من أي جهاز.'
                  : 'Sign in to access your orders and addresses across devices.'}
            </Text>
          </View>
        </View>
        {!user ? (
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10 }}>
            <AppButton
              style={ui.flex}
              label={ar ? 'تسجيل الدخول' : 'Sign in'}
              onPress={() => router.push('/auth/login')}
            />
            <AppButton
              style={ui.flex}
              secondary
              label={ar ? 'إنشاء حساب' : 'Create account'}
              onPress={() => router.push('/auth/register')}
            />
          </View>
        ) : null}
        <AccountHeading>{ar ? 'الملف الشخصي' : 'Profile'}</AccountHeading>
        <View style={styles.group}>
          <AccountRow
            icon={UserRound}
            title={ar ? 'الملف الشخصي' : 'Personal profile'}
            detail={!user ? (ar ? 'بيانات هذا الجهاز' : 'Details on this device') : undefined}
            onPress={() => router.push('/profile')}
          />
        </View>

        <AccountHeading>{ar ? 'الطلبات والحفظ' : 'Orders and saved items'}</AccountHeading>
        <View style={styles.group}>
          <AccountRow icon={Box} title={ar ? 'طلباتي' : 'Orders'} onPress={() => router.push('/orders')} />
          <AccountRow icon={MapPin} title={ar ? 'عناويني' : 'Addresses'} onPress={() => router.push('/addresses')} />
          <AccountRow icon={Heart} title={`${ar ? 'المفضلة' : 'Favorites'}${favorites.length ? ` (${favorites.length})` : ''}`} onPress={() => router.push('/favorites')} />
          <AccountRow icon={Bell} title={ar ? 'الإشعارات' : 'Notifications'} onPress={() => router.push('/notifications')} />
          <AccountRow icon={History} title={ar ? 'شوهد مؤخراً' : 'Recently viewed'} onPress={() => router.push('/recently-viewed')} />
        </View>

        <AccountHeading>{ar ? 'الدعم' : 'Support'}</AccountHeading>
        <View style={styles.group}>
          <AccountRow icon={MessageCircle} title={ar ? 'مساعد ميغ فارم' : 'MIG FARM assistant'} onPress={() => router.push('/(tabs)/assistant')} />
          <AccountRow icon={Headphones} title={ar ? 'الدعم' : 'Support'} onPress={() => router.push('/support')} />
        </View>

        <AccountHeading>{ar ? 'الإعدادات' : 'Settings'}</AccountHeading>
        <View style={styles.group}>
          <AccountRow icon={Settings} title={ar ? 'الإعدادات والأمان' : 'Settings & security'} onPress={() => router.push('/settings')} />
        </View>
        <AccountHeading>{ar ? 'اللغة' : 'Language'}</AccountHeading>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10 }}>
          {(['ar', 'en'] as const).map((value) => (
            <MotionPressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={value === 'ar' ? 'العربية' : 'English'}
              accessibilityState={{ checked: language === value }}
              onPress={() => setLanguage(value)}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 8,
                backgroundColor:
                  language === value ? colors.primary : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  ...typography.button,
                  color: language === value ? colors.surface : colors.text,
                }}
              >
                {value === 'ar' ? 'العربية' : 'English'}
              </Text>
            </MotionPressable>
          ))}
        </View>
        <AccountHeading>{ar ? 'الخصوصية والشروط' : 'Privacy and terms'}</AccountHeading>
        <View style={styles.group}>
          <AccountRow icon={ShieldCheck} title={ar ? 'سياسة الخصوصية' : 'Privacy policy'} onPress={() => router.push({ pathname: '/legal', params: { document: 'privacy' } })} />
          <AccountRow icon={FileText} title={ar ? 'الشروط والأحكام' : 'Terms & conditions'} onPress={() => router.push({ pathname: '/legal', params: { document: 'terms' } })} />
        </View>
        {user ? (
          <AccountRow
            icon={LogOut}
            title={ar ? 'تسجيل الخروج' : 'Sign out'}
            onPress={() => setConfirm(true)}
          />
        ) : null}
        {error ? <Notice error text={error} /> : null}
      </ScrollView>
      <ConfirmSheet
        visible={confirm}
        title={ar ? 'تسجيل الخروج' : 'Sign out'}
        body={
          ar
            ? 'سيتم إنهاء جلسة الحساب على هذا الجهاز.'
            : 'End your account session on this device?'
        }
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await logout();
            setConfirm(false);
          } catch (e) {
            setError(customerError(e, ar));
            setConfirm(false);
          } finally {
            setBusy(false);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  group: {
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
});
