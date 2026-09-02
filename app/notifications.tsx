import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, Tag, Sprout } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

const NOTIFICATIONS_KEY = 'mig_farm_notifications_v1';
type Preferences = { orderUpdates: boolean; offers: boolean; farmingTips: boolean };
const defaults: Preferences = { orderUpdates: true, offers: true, farmingTips: true };

export default function NotificationsScreen() {
  const { language, isRTL, t } = useLanguage();
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [loading, setLoading] = useState(true);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => { AsyncStorage.getItem(NOTIFICATIONS_KEY).then((value) => { if (value) setPreferences({ ...defaults, ...JSON.parse(value) }); }).catch(() => undefined).finally(() => setLoading(false)); }, []);
  const toggle = (key: keyof Preferences) => setPreferences((current) => { const next = { ...current, [key]: !current[key] }; AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next)).catch(() => undefined); return next; });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}><BackIcon size={21} color={colors.primaryDark} /></Pressable><Text style={styles.title}>{t('notifications')}</Text><View style={styles.iconButton}><Bell size={18} color={colors.primary} /></View></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.hero}><View style={styles.heroIcon}><Bell size={27} color={colors.sun} /></View><Text style={[styles.heroTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('notifications')}</Text><Text style={[styles.heroBody, { textAlign: isRTL ? 'right' : 'left' }]}>{t('notificationsBody')}</Text></View>
          {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : <View style={styles.preferenceList}>
            <Preference icon={CheckCircle2} title={t('orderUpdates')} body={language === 'ar' ? 'تأكيد الطلب وتغير حالته' : 'Order confirmation and status changes'} value={preferences.orderUpdates} onChange={() => toggle('orderUpdates')} />
            <Preference icon={Tag} title={t('offers')} body={language === 'ar' ? 'عروض موسمية ومنتجات جديدة' : 'Seasonal offers and new products'} value={preferences.offers} onChange={() => toggle('offers')} />
            <Preference icon={Sprout} title={t('farmingTips')} body={language === 'ar' ? 'نصائح مناسبة للموسم والزراعة' : 'Seasonal growing tips'} value={preferences.farmingTips} onChange={() => toggle('farmingTips')} last />
          </View>}
          <Text style={[styles.note, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'سنضيف إشعارات الهاتف الفورية عند ربط بيئة الإنتاج بخدمة الإشعارات.' : 'Push notifications will activate when the production notification service is connected.'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Preference({ icon: Icon, title, body, value, onChange, last }: { icon: typeof Bell; title: string; body: string; value: boolean; onChange: () => void; last?: boolean }) {
  return (
    <View style={[styles.preference, last && styles.preferenceLast]}>
      <View style={styles.preferenceIcon}><Icon size={18} color={colors.primary} /></View>
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceBody}>{body}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.borderStrong, true: '#9CCBA8' }} thumbColor={value ? colors.primary : '#FFFFFF'} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { minHeight: 62, paddingHorizontal: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  content: { paddingBottom: 30 },
  page: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 15 },
  hero: { padding: 18, borderRadius: radius.lg, backgroundColor: colors.primaryDark },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  heroBody: { color: '#D7E8DC', fontSize: 12, lineHeight: 19, marginTop: 5 },
  loader: { marginTop: 24 },
  preferenceList: { marginTop: 14, paddingHorizontal: 13, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  preference: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  preferenceLast: { borderBottomWidth: 0 },
  preferenceIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  preferenceCopy: { flex: 1 },
  preferenceTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  preferenceBody: { color: colors.muted, fontSize: 10, marginTop: 3 },
  note: { color: colors.textSubtle, fontSize: 10, lineHeight: 17, marginTop: 15 },
});
