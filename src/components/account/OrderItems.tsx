import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Package } from 'lucide-react-native';
import { ui } from './AccountUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAED } from '@/services/catalog';
import { colors } from '@/constants/theme';
import type { CustomerOrderItem } from '@/types/customer';
export function OrderThumbnail({ uri }: { uri: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={{
        width: 52,
        height: 60,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri, cache: 'force-cache' }}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Package size={20} color={colors.muted} />
      )}
    </View>
  );
}
export function OrderItems({ items }: { items: CustomerOrderItem[] }) {
  const { isRTL: ar } = useLanguage();
  return (
    <>
      {items.map((item, index) => (
        <View
          key={index}
          style={[ui.row, { flexDirection: ar ? 'row-reverse' : 'row' }]}
        >
          <OrderThumbnail uri={item.image} />
          <View style={ui.flex}>
            <Text style={[ui.label, { textAlign: ar ? 'right' : 'left' }]}>
              {item.title}
            </Text>
            <Text style={[ui.caption, { textAlign: ar ? 'right' : 'left' }]}>
              {item.quantity} × {formatAED(item.unitPrice)}
            </Text>
            <Text style={[ui.label, { textAlign: ar ? 'right' : 'left' }]}>
              {formatAED(item.lineTotal)}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}
