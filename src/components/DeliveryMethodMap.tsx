import React, { useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DeliveryMethod,
  EMIRATE_CENTER,
  MapFallback,
  MethodToggle,
  PickupNotice,
  styles,
} from './DeliveryMethodMap.shared';

export type { DeliveryMethod };

export function DeliveryMethodMap({
  emirate,
  method,
  onChangeMethod,
}: {
  emirate: string;
  method: DeliveryMethod;
  onChangeMethod: (method: DeliveryMethod) => void;
}) {
  const { isRTL } = useLanguage();
  const center = useMemo(() => EMIRATE_CENTER[emirate] || EMIRATE_CENTER.Dubai, [emirate]);
  const [pin, setPin] = useState(center);

  return (
    <View style={styles.wrap}>
      <MethodToggle method={method} onChangeMethod={onChangeMethod} isRTL={isRTL} />
      {method === 'delivery' ? (
        Platform.OS === 'ios' ? (
          <View style={styles.mapCard}>
            <MapView
              style={styles.map}
              initialRegion={{ ...center, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
              onPress={(event) => setPin(event.nativeEvent.coordinate)}
            >
              <Marker
                coordinate={pin}
                draggable
                onDragEnd={(event) => setPin(event.nativeEvent.coordinate)}
                pinColor={colors.primary}
              />
            </MapView>
            <Text style={[styles.hint, { textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'اضغط مطولاً على الخريطة لتحريك موقع التوصيل بدقة.' : 'Drag the pin to fine-tune your delivery spot.'}
            </Text>
          </View>
        ) : (
          <MapFallback
            isRTL={isRTL}
            text={
              isRTL
                ? 'معاينة الخريطة التفاعلية متاحة حاليًا على iPhone فقط. سيتم تفعيلها على Android بعد إضافة مفتاح Google Maps.'
                : 'The interactive map preview is available on iPhone for now. Android support arrives once a Google Maps key is added.'
            }
          />
        )
      ) : (
        <PickupNotice isRTL={isRTL} />
      )}
    </View>
  );
}
