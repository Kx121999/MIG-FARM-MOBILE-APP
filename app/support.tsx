import React, { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MessageCircle, Phone, MapPin } from 'lucide-react-native';
import {
  AccountPage,
  AccountHeading,
  AccountRow,
  Notice,
  ui,
} from '@/components/account/AccountUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { COMPANY } from '@/constants/company';
export default function SupportScreen() {
  const { isRTL: ar } = useLanguage();
  const [message, setMessage] = useState('');
  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setMessage(
        ar
          ? 'تعذر فتح وسيلة التواصل. حاول مرة أخرى.'
          : 'Unable to open this contact option. Please try again.',
      );
    }
  };
  return (
    <AccountPage title={ar ? 'الدعم' : 'Support'} globalHeader>
      <AccountRow
        icon={MessageCircle}
        title={ar ? 'واتساب ميغ فارم' : 'MIG FARM WhatsApp'}
        detail={COMPANY.phoneLabel}
        onPress={() => open(COMPANY.whatsapp)}
      />
      <AccountRow
        icon={Phone}
        title={ar ? 'تواصل معنا' : 'Contact us'}
        detail={COMPANY.phoneLabel}
        onPress={() => open(COMPANY.phone)}
      />
      <AccountRow
        icon={MapPin}
        title={ar ? 'فروعنا' : 'Our branches'}
        detail={ar ? 'مليحة، الشارقة | العين' : 'Mleiha, Sharjah | Al Ain'}
        onPress={() => open(COMPANY.branches)}
      />
      <AccountRow
        icon={MessageCircle}
        title={ar ? 'مساعد ميغ فارم' : 'MIG FARM assistant'}
        onPress={() => router.push('/(tabs)/assistant')}
      />
      {message ? <Notice error text={message} /> : null}
      <AccountHeading>
        {ar ? 'الأسئلة الشائعة' : 'Frequently asked questions'}
      </AccountHeading>
      <View style={{ gap: 8 }}>
        <Text style={ui.label}>
          {ar ? 'هل أحتاج حسابًا للتسوق؟' : 'Do I need an account to shop?'}
        </Text>
        <Text style={ui.body}>
          {ar
            ? 'لا، يمكنك التصفح وإضافة المنتجات وإكمال الطلب كضيف.'
            : 'No. Browse, add products and check out as a guest.'}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={ui.label}>
          {ar ? 'أين أجد طلباتي؟' : 'Where are my orders?'}
        </Text>
        <Text style={ui.body}>
          {ar
            ? 'من حسابي ثم طلباتي. طلبات الضيف مرتبطة بالجهاز الذي أتممت عليه الدفع.'
            : 'Open Account, then Orders. Guest orders are linked to the device used for payment.'}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={ui.label}>
          {ar ? 'هل صورة الحساب مطلوبة؟' : 'Is a profile photo required?'}
        </Text>
        <Text style={ui.body}>
          {ar
            ? 'لا، صورة الحساب اختيارية دائمًا.'
            : 'No. A profile photo is always optional.'}
        </Text>
      </View>
    </AccountPage>
  );
}
