import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CommerceProvider } from '@/contexts/CommerceContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PaymentProvider } from '@/components/payments/PaymentProvider';
import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <PaymentProvider>
        <CommerceProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.primaryDark,
            headerTitleStyle: { fontWeight: '800' },
            contentStyle: { backgroundColor: colors.background },
          }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="product/[handle]" options={{ headerShown: false }} />
            <Stack.Screen name="checkout" options={{ headerShown: false }} />
            <Stack.Screen name="orders" options={{ headerShown: false }} />
            <Stack.Screen name="compare" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
          </Stack>
        </CommerceProvider>
        </PaymentProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
