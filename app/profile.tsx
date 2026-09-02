import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, MapPin, Plus, Save, Trash2, UserRound } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ProfileScreen() {
  const { profile, setProfile, addresses, saveAddress, removeAddress } = useCommerce();
  const { language, isRTL, t } = useLanguage();
  const [draft, setDraft] = useState(profile);
  const [address, setAddress] = useState({ label: '', emirate: 'Dubai', city: '', addressLine: '', isDefault: true });
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const update = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const saveProfile = () => { setProfile(draft); Alert.alert(language === 'ar' ? 'تم الحفظ' : 'Saved', language === 'ar' ? 'تم تحديث بياناتك بنجاح.' : 'Your details were updated.'); };
  const addAddress = () => {
    if (!address.label.trim() || !address.city.trim() || !address.addressLine.trim()) return;
    saveAddress(address);
    setAddress({ label: '', emirate: 'Dubai', city: '', addressLine: '', isDefault: false });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}><BackIcon size={21} color={colors.primaryDark} /></Pressable>
        <Text style={styles.title}>{t('profile')}</Text>
        <View style={styles.iconButton}><UserRound size={18} color={colors.primary} /></View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.page}>
          <SectionHeading icon={UserRound} title={language === 'ar' ? 'بيانات التواصل' : 'Contact details'} />
          <Field label={t('fullName')} value={draft.name} onChangeText={(value) => update('name', value)} isRTL={isRTL} />
          <Field label={t('email')} value={draft.email} onChangeText={(value) => update('email', value)} isRTL={isRTL} keyboardType="email-address" autoCapitalize="none" />
          <Field label={t('phone')} value={draft.phone} onChangeText={(value) => update('phone', value)} isRTL={isRTL} keyboardType="phone-pad" />
          <Pressable accessibilityRole="button" onPress={saveProfile} style={styles.saveButton}><Save size={17} color="#FFFFFF" /><Text style={styles.saveText}>{t('save')}</Text></Pressable>

          <SectionHeading icon={MapPin} title={t('addresses')} />
          {addresses.map((item) => (
            <View key={item.id} style={[styles.addressCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={styles.addressIcon}><MapPin size={17} color={colors.primary} /></View>
              <View style={styles.addressCopy}><Text style={[styles.addressLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{item.label} {item.isDefault ? `· ${t('defaultAddress')}` : ''}</Text><Text style={[styles.addressText, { textAlign: isRTL ? 'right' : 'left' }]}>{item.city}, {item.emirate}{'\n'}{item.addressLine}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={language === 'ar' ? 'حذف العنوان' : 'Delete address'} onPress={() => removeAddress(item.id)} style={styles.deleteButton}><Trash2 size={16} color={colors.danger} /></Pressable>
            </View>
          ))}
          <View style={styles.addAddressBox}>
            <View style={[styles.addHeading, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}><Plus size={18} color={colors.primary} /><Text style={styles.addTitle}>{t('addAddress')}</Text></View>
            <Field label={t('addressLabel')} value={address.label} onChangeText={(value) => setAddress((current) => ({ ...current, label: value }))} isRTL={isRTL} />
            <View style={[styles.emirates, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>{['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'].map((item) => <Pressable key={item} onPress={() => setAddress((current) => ({ ...current, emirate: item }))} style={[styles.emirate, address.emirate === item && styles.emirateActive]}><Text style={[styles.emirateText, address.emirate === item && styles.emirateTextActive]}>{item}</Text></Pressable>)}</View>
            <Field label={t('city')} value={address.city} onChangeText={(value) => setAddress((current) => ({ ...current, city: value }))} isRTL={isRTL} />
            <Field label={t('addressLine')} value={address.addressLine} onChangeText={(value) => setAddress((current) => ({ ...current, addressLine: value }))} isRTL={isRTL} multiline />
            <Pressable accessibilityRole="button" onPress={addAddress} style={[styles.addButton, (!address.label.trim() || !address.city.trim() || !address.addressLine.trim()) && styles.disabled]}><Plus size={17} color="#FFFFFF" /><Text style={styles.addButtonText}>{t('addAddress')}</Text></Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: typeof UserRound; title: string }) { return <View style={styles.sectionHeading}><Icon size={18} color={colors.primary} /><Text style={styles.sectionTitle}>{title}</Text></View>; }
function Field({ label, isRTL, ...props }: React.ComponentProps<typeof TextInput> & { label: string; isRTL: boolean }) { return <View style={styles.field}><Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text><TextInput {...props} placeholderTextColor={colors.textSubtle} style={[styles.input, props.multiline && styles.multiline, { textAlign: isRTL ? 'right' : 'left' }]} /></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { minHeight: 62, paddingHorizontal: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  content: { paddingBottom: 30 },
  page: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 15 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  field: { gap: 5, marginBottom: 11 },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  input: { minHeight: 46, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.text, fontSize: 13 },
  multiline: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  saveButton: { height: 48, marginTop: 2, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  saveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  addressCard: { minHeight: 82, padding: 12, marginBottom: 9, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 10 },
  addressIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  addressCopy: { flex: 1 },
  addressLabel: { color: colors.text, fontSize: 12, fontWeight: '900' },
  addressText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 3 },
  deleteButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF6F5', alignItems: 'center', justifyContent: 'center' },
  addAddressBox: { marginTop: 5, padding: 13, borderRadius: radius.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#C9DECF' },
  addHeading: { alignItems: 'center', gap: 7, marginBottom: 13 },
  addTitle: { color: colors.primaryDark, fontSize: 14, fontWeight: '900' },
  emirates: { flexWrap: 'wrap', gap: 7, marginBottom: 11 },
  emirate: { height: 34, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  emirateActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  emirateText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  emirateTextActive: { color: '#FFFFFF' },
  addButton: { height: 46, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
