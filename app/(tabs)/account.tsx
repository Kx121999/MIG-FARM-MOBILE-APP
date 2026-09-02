import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  BookOpenText,
  Bell,
  Box,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Heart,
  Languages,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { colors, radius } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';

type MenuRowProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
  isRTL: boolean;
  last?: boolean;
};

function MenuRow({ icon: Icon, title, subtitle, onPress, isRTL, last = false }: MenuRowProps) {
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.menuRow, last && styles.menuRowLast, { flexDirection: isRTL ? 'row-reverse' : 'row' }, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.menuIcon}><Icon size={19} color={colors.primary} strokeWidth={2.1} /></View>
      <View style={styles.menuCopy}>
        <Text style={[styles.menuTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[styles.menuSubtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{subtitle}</Text> : null}
      </View>
      <Chevron size={18} color={colors.textSubtle} strokeWidth={2.1} />
    </Pressable>
  );
}

export default function AccountScreen() {
  const { favorites, cartCount, profile } = useCommerce();
  const { language, setLanguage, isRTL, t } = useLanguage();
  const open = (url: string) => Linking.openURL(url).catch(() => undefined);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader compact />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={[styles.profile, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={styles.avatar}><UserRound size={30} color={colors.primaryDark} strokeWidth={1.8} /></View>
            <View style={styles.profileCopy}>
              <View style={[styles.verifiedRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.profileTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{profile.name || t('accountTitle')}</Text>
                <ShieldCheck size={17} color={colors.sun} fill={colors.sun} strokeWidth={1.8} />
              </View>
              <Text style={[styles.profileBody, { textAlign: isRTL ? 'right' : 'left' }]}>{profile.email || (language === 'ar' ? 'تابع طلباتك واحفظ منتجاتك المفضلة' : 'Track orders and keep your favorite products')}</Text>
            </View>
          </View>

          <View style={styles.stats}>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.stat, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/cart')}>
              <ShoppingBag size={20} color={colors.primary} strokeWidth={2.1} />
              <Text style={styles.statValue}>{cartCount}</Text>
              <Text style={styles.statLabel}>{t('cart')}</Text>
            </Pressable>
            <View style={styles.statDivider} />
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.stat, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/(tabs)/catalog', params: { favorites: '1' } })}>
              <Heart size={20} color={colors.orange} strokeWidth={2.1} />
              <Text style={styles.statValue}>{favorites.length}</Text>
              <Text style={styles.statLabel}>{t('favorites')}</Text>
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.signIn, pressed && styles.primaryPressed]} onPress={() => router.push('/orders')}>
            <Box size={18} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.signInText}>{language === 'ar' ? 'متابعة الطلبات' : 'Track orders'}</Text>
          </Pressable>

          <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'حسابك' : 'Your account'}</Text>
          <View style={styles.menu}>
            <MenuRow icon={UserRound} title={t('profile')} subtitle={language === 'ar' ? 'بياناتك وعناوين التوصيل' : 'Your details and delivery addresses'} onPress={() => router.push('/profile')} isRTL={isRTL} />
            <MenuRow icon={Box} title={t('orders')} subtitle={language === 'ar' ? 'عرض حالة الطلبات السابقة' : 'View previous order status'} onPress={() => router.push('/orders')} isRTL={isRTL} />
            <MenuRow icon={Bell} title={t('notifications')} subtitle={language === 'ar' ? 'تحكم في التنبيهات والتحديثات' : 'Control alerts and updates'} onPress={() => router.push('/notifications')} isRTL={isRTL} />
            <MenuRow icon={Heart} title={t('favorites')} subtitle={`${favorites.length} ${language === 'ar' ? 'منتج محفوظ' : 'saved products'}`} onPress={() => router.push({ pathname: '/(tabs)/catalog', params: { favorites: '1' } })} isRTL={isRTL} />
            <MenuRow icon={BookOpenText} title={t('articles')} subtitle={language === 'ar' ? 'اسأل المهندس عن الزراعة' : 'Ask the engineer for growing advice'} onPress={() => router.push('/(tabs)/assistant')} isRTL={isRTL} last />
          </View>

          <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('contact')}</Text>
          <View style={styles.menu}>
            <MenuRow icon={MessageCircle} title="WhatsApp" subtitle="+971 58 176 8215" onPress={() => open('https://wa.me/971581768215')} isRTL={isRTL} />
            <MenuRow icon={Phone} title={language === 'ar' ? 'اتصل بنا' : 'Call us'} subtitle="058 176 8215" onPress={() => open('tel:+971581768215')} isRTL={isRTL} />
            <MenuRow icon={MapPin} title={t('branches')} subtitle={language === 'ar' ? 'مليحة، الشارقة | العين' : 'Mleiha, Sharjah | Al Ain'} onPress={() => open('https://www.google.com/maps/search/?api=1&query=MIG+Farm+UAE')} isRTL={isRTL} last />
          </View>

          <View style={[styles.languageTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.sectionTitle, styles.languageHeading, { textAlign: isRTL ? 'right' : 'left' }]}>{t('language')}</Text>
            <Languages size={18} color={colors.primary} strokeWidth={2.1} />
          </View>
          <View style={[styles.language, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: language === 'ar' }} onPress={() => setLanguage('ar')} style={({ pressed }) => [styles.languageButton, language === 'ar' && styles.languageActive, pressed && styles.pressed]}>
              <Text style={[styles.languageText, language === 'ar' && styles.languageTextActive]}>{t('arabic')}</Text>
            </Pressable>
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: language === 'en' }} onPress={() => setLanguage('en')} style={({ pressed }) => [styles.languageButton, language === 'en' && styles.languageActive, pressed && styles.pressed]}>
              <Text style={[styles.languageText, language === 'en' && styles.languageTextActive]}>{t('english')}</Text>
            </Pressable>
          </View>

          <View style={styles.versionRow}><Globe2 size={13} color={colors.textSubtle} /><Text style={styles.version}>MIG FARM Mobile 2.0 | UAE</Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16 },
  profile: { padding: 17, backgroundColor: colors.primaryDark, borderRadius: radius.lg, alignItems: 'center', gap: 13 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  profileCopy: { flex: 1 },
  verifiedRow: { alignItems: 'center', gap: 6 },
  profileTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  profileBody: { color: '#D7E8DC', fontSize: 11, lineHeight: 18, marginTop: 4 },
  stats: { height: 78, marginTop: 10, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  statDivider: { width: 1, height: 36, backgroundColor: colors.border },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  signIn: { height: 49, marginTop: 10, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  signInText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 23, marginBottom: 9 },
  menu: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  menuRow: { minHeight: 68, alignItems: 'center', paddingHorizontal: 12, gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1 },
  menuTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  menuSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  languageTitleRow: { alignItems: 'center', gap: 7, marginTop: 23, marginBottom: 9 },
  languageHeading: { flex: 1, marginTop: 0, marginBottom: 0 },
  language: { gap: 9 },
  languageButton: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  languageActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  languageText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  languageTextActive: { color: '#FFFFFF' },
  versionRow: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', marginTop: 26 },
  version: { color: colors.textSubtle, fontSize: 9, fontWeight: '700' },
  pressed: { opacity: 0.68 },
  primaryPressed: { opacity: 0.82 },
});
