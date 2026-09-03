import React from 'react';
import { Text, View } from 'react-native';
import { MotionPressable } from '@/components/Motion';
import { colors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { ui } from './AccountUI';
export function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const { isRTL } = useLanguage();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[ui.label, { textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {options.map((option) => (
          <MotionPressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: option.value === value }}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: 44,
              paddingHorizontal: 12,
              borderRadius: 8,
              justifyContent: 'center',
              backgroundColor:
                option.value === value ? colors.primary : colors.surface,
            }}
          >
            <Text
              style={[
                ui.caption,
                {
                  color: option.value === value ? colors.surface : colors.text,
                },
              ]}
            >
              {option.label}
            </Text>
          </MotionPressable>
        ))}
      </View>
    </View>
  );
}
