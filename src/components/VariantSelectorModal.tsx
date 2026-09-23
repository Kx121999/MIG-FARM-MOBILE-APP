import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAED, localizedProductTitle } from '@/services/catalog';
import { resolveVariant, selectVariantOption, variantOptionGroups, variantSelection } from '@/services/productExperience';
import type { Product, ProductVariant } from '@/types';

export function VariantSelectorModal({
  visible,
  product,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onConfirm: (variant: ProductVariant) => void;
}) {
  const { language, isRTL } = useLanguage();
  const optionGroups = useMemo(() => (product ? variantOptionGroups(product.variants) : []), [product]);
  const initial = useMemo(() => product?.variants.find((item) => item.available === true) || product?.variants[0] || null, [product]);
  const [selection, setSelection] = useState<Record<number, number>>({});
  const [flatVariantId, setFlatVariantId] = useState<number | null>(null);
  useEffect(() => {
    if (visible) { setSelection({}); setFlatVariantId(null); }
  }, [visible]);

  const activeSelection = Object.keys(selection).length ? selection : variantSelection(initial);
  const resolved = !product ? null
    : optionGroups.length
      ? resolveVariant(product.variants, activeSelection)
      : product.variants.find((item) => item.id === flatVariantId) || initial;

  if (!product) return null;
  const title = localizedProductTitle(product, language);

  const chooseOption = (attributeId: number, valueId: number) => {
    const current = resolved || initial;
    if (!current) return;
    const next = selectVariantOption(product.variants, current, attributeId, valueId);
    setSelection(next ? variantSelection(next) : { ...activeSelection, [attributeId]: valueId });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text numberOfLines={1} style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={isRTL ? 'إغلاق' : 'Close'} onPress={onClose} style={styles.closeButton}>
              <X size={18} color={colors.primaryDark} />
            </Pressable>
          </View>

          {optionGroups.length ? optionGroups.map((group) => (
            <View key={group.id} style={styles.group}>
              <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left' }]}>{group.name}</Text>
              <View style={[styles.options, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {group.values.map((value) => {
                  const active = activeSelection[group.id] === value.id;
                  const current = resolved || initial;
                  const resolves = current ? Boolean(selectVariantOption(product.variants, current, group.id, value.id)) : true;
                  return (
                    <Pressable
                      key={value.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active, disabled: !resolves }}
                      disabled={!resolves}
                      onPress={() => chooseOption(group.id, value.id)}
                      style={[styles.option, active && styles.optionActive, !resolves && styles.optionDisabled]}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{value.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )) : (
            <View style={styles.group}>
              <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'اختر الخيار' : 'Choose an option'}</Text>
              <View style={[styles.options, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {product.variants.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: resolved?.id === item.id }}
                    onPress={() => setFlatVariantId(item.id)}
                    style={[styles.option, resolved?.id === item.id && styles.optionActive]}
                  >
                    <Text style={[styles.optionText, resolved?.id === item.id && styles.optionTextActive]}>{item.title}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {resolved ? (
            <View style={[styles.summary, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.price}>{formatAED(resolved.price)}</Text>
              <Text style={[styles.availability, resolved.available === false && styles.availabilityMuted]}>
                {resolved.available === false
                  ? (language === 'ar' ? 'التوفر يحتاج مراجعة' : 'Availability needs review')
                  : (language === 'ar' ? 'متوفر' : 'Available')}
              </Text>
            </View>
          ) : null}

          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={language === 'ar' ? 'إضافة للسلة' : 'Add to cart'}
            disabled={!resolved || resolved.available === false}
            onPress={() => resolved && onConfirm(resolved)}
            style={[styles.confirm, (!resolved || resolved.available === false) && styles.confirmDisabled]}
          >
            <Text style={styles.confirmText}>{language === 'ar' ? 'إضافة للسلة' : 'Add to cart'}</Text>
          </MotionPressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8, 27, 17, 0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md, maxWidth: 680, width: '100%', alignSelf: 'center', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  header: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { ...typography.section, color: colors.text, flex: 1 },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  group: { gap: spacing.sm },
  label: { ...typography.caption, color: colors.muted, fontWeight: '800' },
  options: { flexWrap: 'wrap', gap: spacing.sm },
  option: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  optionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  optionDisabled: { opacity: 0.4 },
  optionText: { ...typography.caption, color: colors.text, fontWeight: '700' },
  optionTextActive: { color: colors.primaryDark },
  summary: { alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs },
  price: { ...typography.section, color: colors.primary, writingDirection: 'ltr' },
  availability: { ...typography.caption, color: colors.success, fontWeight: '700' },
  availabilityMuted: { color: colors.muted },
  confirm: { minHeight: 50, borderRadius: radius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  confirmDisabled: { backgroundColor: colors.textSubtle, opacity: 0.6 },
  confirmText: { ...typography.button, color: '#FFFFFF', fontWeight: '800' },
});
