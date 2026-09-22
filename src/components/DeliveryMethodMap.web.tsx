import React from 'react';
import { View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DeliveryMethod,
  MapFallback,
  MethodToggle,
  PickupNotice,
  styles,
} from './DeliveryMethodMap.shared';

export type { DeliveryMethod };

export function DeliveryMethodMap({
  method,
  onChangeMethod,
}: {
  emirate: string;
  method: DeliveryMethod;
  onChangeMethod: (method: DeliveryMethod) => void;
}) {
  const { isRTL } = useLanguage();
  return (
    <View style={styles.wrap}>
      <MethodToggle method={method} onChangeMethod={onChangeMethod} isRTL={isRTL} />
      {method === 'delivery' ? (
        <MapFallback
          isRTL={isRTL}
          text={
            isRTL
              ? 'معاينة الخريطة التفاعلية متاحة على تطبيق الهاتف. افتح التطبيق على جهازك لاختيار موقع التوصيل على الخريطة.'
              : 'The interactive map preview is available in the mobile app. Open the app on your device to pin your delivery spot.'
          }
        />
      ) : (
        <PickupNotice isRTL={isRTL} />
      )}
    </View>
  );
}
