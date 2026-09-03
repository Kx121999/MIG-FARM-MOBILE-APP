import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { AppIconButton } from '@/components/AppIconButton';
import { AppButton } from '@/components/AppButton';
import { MotionPressable } from '@/components/Motion';
import { colors, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

export function AccountPage({
  title,
  children,
  globalHeader = false,
}: {
  title: string;
  children: React.ReactNode;
  globalHeader?: boolean;
}) {
  const { isRTL } = useLanguage();
  return (
    <SafeAreaView style={ui.safe} edges={['top', 'bottom']}>
      {globalHeader ? <AppHeader compact /> : null}
      <View style={[ui.top, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <AppIconButton
          icon={isRTL ? ArrowRight : ArrowLeft}
          label={isRTL ? 'رجوع' : 'Back'}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/(tabs)/account')
          }
        />
        <Text
          accessibilityRole="header"
          style={[ui.pageTitle, { textAlign: isRTL ? 'right' : 'left' }]}
        >
          {title}
        </Text>
      </View>
      <KeyboardAvoidingView
        style={ui.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={ui.page}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function AccountField({
  label,
  error,
  ltr,
  ...props
}: TextInputProps & { label: string; error?: string; ltr?: boolean }) {
  const { isRTL } = useLanguage();
  return (
    <View style={ui.field}>
      <Text style={[ui.label, { textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={error}
        placeholderTextColor={colors.muted}
        style={[
          ui.input,
          props.multiline && { minHeight: 88, textAlignVertical: 'top' },
          {
            textAlign: ltr ? 'left' : isRTL ? 'right' : 'left',
            writingDirection: ltr ? 'ltr' : isRTL ? 'rtl' : 'ltr',
          },
          props.style,
        ]}
      />
      {error ? <Notice error text={error} /> : null}
    </View>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  const { isRTL } = useLanguage();
  return (
    <Text
      accessibilityRole={error ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[
        ui.body,
        {
          textAlign: isRTL ? 'right' : 'left',
          color: colors.muted,
          marginVertical: spacing.sm,
        },
      ]}
    >
      {text}
    </Text>
  );
}
export function AccountRow({
  icon: Icon,
  title,
  detail,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  onPress: () => void;
}) {
  const { isRTL } = useLanguage();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[ui.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
    >
      <Icon size={21} color={colors.primary} />
      <View style={ui.flex}>
        <Text style={[ui.label, { textAlign: isRTL ? 'right' : 'left' }]}>
          {title}
        </Text>
        {detail ? (
          <Text style={[ui.caption, { textAlign: isRTL ? 'right' : 'left' }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Chevron size={18} color={colors.muted} />
    </MotionPressable>
  );
}
export function AccountHeading({ children }: { children: React.ReactNode }) {
  const { isRTL } = useLanguage();
  return (
    <Text
      accessibilityRole="header"
      style={[ui.heading, { textAlign: isRTL ? 'right' : 'left' }]}
    >
      {children}
    </Text>
  );
}
export function ConfirmSheet({
  visible,
  title,
  body,
  onCancel,
  onConfirm,
  busy = false,
}: {
  visible: boolean;
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const { isRTL } = useLanguage();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={ui.scrim}>
        <SafeAreaView
          style={ui.sheet}
          edges={['bottom']}
          accessibilityViewIsModal
        >
          <View
            style={[ui.top, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Text
              style={[ui.pageTitle, { textAlign: isRTL ? 'right' : 'left' }]}
            >
              {title}
            </Text>
            <AppIconButton
              icon={X}
              label={isRTL ? 'إغلاق' : 'Close'}
              onPress={onCancel}
            />
          </View>
          <Notice text={body} />
          <AppButton
            disabled={busy}
            label={isRTL ? 'تأكيد' : 'Confirm'}
            onPress={onConfirm}
          />
          <AppButton
            secondary
            disabled={busy}
            label={isRTL ? 'إلغاء' : 'Cancel'}
            onPress={onCancel}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  top: {
    minHeight: 56,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
  },
  pageTitle: { ...typography.section, color: colors.text, flex: 1 },
  page: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  heading: {
    ...typography.section,
    color: colors.text,
    marginTop: 16,
    marginBottom: 4,
  },
  body: { ...typography.body, color: colors.muted },
  caption: { ...typography.caption, color: colors.muted },
  label: { ...typography.button, color: colors.text },
  field: { gap: 8 },
  input: {
    ...typography.body,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  row: {
    minHeight: 60,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    padding: 20,
    gap: 12,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
});
