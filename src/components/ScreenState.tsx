import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PackageSearch, RefreshCw, WifiOff, type LucideIcon } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppButton } from '@/components/AppButton';
import { ProductCardSkeleton } from '@/components/ProductCard';
import { useOnline } from '@/components/Connectivity';

export function EmptyState({ title, body, action, onAction, icon: Icon = PackageSearch }: {
  title: string; body?: string; action?: string; onAction?: () => void; icon?: LucideIcon;
}) {
  return <View style={styles.wrap} accessibilityLiveRegion="polite">
    <Icon size={32} color={colors.muted} strokeWidth={1.5} />
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {body ? <Text style={styles.body}>{body}</Text> : null}
    {action && onAction ? <AppButton label={action} onPress={onAction} style={styles.action} /> : null}
  </View>;
}

export function ScreenState({ loading, error, empty, onRetry, emptyTitle, emptyAction, onEmptyAction }: {
  loading?: boolean; error?: string | null; empty?: boolean; onRetry?: () => void;
  emptyTitle?: string; emptyAction?: string; onEmptyAction?: () => void;
}) {
  const { t, language } = useLanguage();
  const online = useOnline();
  const ar = language === 'ar';
  if (loading) return <View accessibilityLabel={t('loading')} accessibilityState={{ busy: true }} style={styles.skeletons}><ProductCardSkeleton /><ProductCardSkeleton /></View>;
  if (error) {
    const offline = !online || /network|fetch|timeout|abort|internet/i.test(error);
    return <EmptyState icon={offline ? WifiOff : RefreshCw}
      title={offline ? (ar ? 'تعذر الاتصال بالإنترنت' : 'No internet connection') : (ar ? 'تعذر تحميل المحتوى' : 'Unable to load content')}
      body={offline ? (ar ? 'تحقق من اتصالك وحاول مرة أخرى.' : 'Check your connection and try again.') : (ar ? 'حدثت مشكلة أثناء الاتصال. حاول مرة أخرى.' : 'Something went wrong. Please try again.')}
      action={t('retry')} onAction={onRetry} />;
  }
  if (empty) return <EmptyState title={emptyTitle || t('noProducts')} action={emptyAction} onAction={onEmptyAction} />;
  return null;
}
const styles = StyleSheet.create({
  wrap: { minHeight: 240, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { ...typography.section, textAlign: 'center', color: colors.text },
  body: { ...typography.body, maxWidth: 340, textAlign: 'center', color: colors.muted },
  action: { marginTop: spacing.sm },
  skeletons: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
});
