import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Gift, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ScreenState } from '@/components/ScreenState';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { OfferRecord, platformService } from '@/services/platform';

export default function OffersScreen() {
  const { language, isRTL } = useLanguage();
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setOffers((await platformService.offers()).offers || []);
    } catch {
      setError(language === 'ar' ? 'تعذر تحميل العروض.' : 'Unable to load offers.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [language]);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader compact />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>
          {language === 'ar' ? 'العروض' : 'Offers'}
        </Text>
        <ScreenState loading={loading} error={error} onRetry={load} />
        {!loading && !error && !offers.length ? (
          <EmptyState title={language === 'ar' ? 'لا توجد عروض نشطة الآن' : 'No active offers right now'} />
        ) : null}
        {offers.map((offer) => (
          <Pressable
            key={offer.id}
            accessibilityRole="button"
            onPress={() => offer.deepLink ? router.push(offer.deepLink as never) : router.push('/(tabs)/catalog')}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={styles.icon}><Gift size={22} color={colors.primary} /></View>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={[styles.cardTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {language === 'ar' ? offer.titleAr : offer.titleEn}
                </Text>
                <Text numberOfLines={2} style={[styles.body, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {language === 'ar' ? offer.descriptionAr : offer.descriptionEn}
                </Text>
                {offer.discount ? <Text style={styles.discount}>{offer.discount}</Text> : null}
              </View>
              <Arrow size={18} color={colors.primary} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  title: { ...typography.page, color: colors.text },
  card: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  row: { alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: spacing.xs },
  cardTitle: { ...typography.section, fontSize: 17, color: colors.text },
  body: { ...typography.secondary, color: colors.muted },
  discount: { ...typography.caption, color: colors.danger, fontWeight: '900' },
});
