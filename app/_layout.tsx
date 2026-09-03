import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CommerceProvider } from '@/contexts/CommerceContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PaymentProvider } from '@/components/payments/PaymentProvider';
import { colors } from '@/constants/theme';
import { AppEntry } from '@/components/AppEntry';
import { MotionProvider } from '@/components/Motion';
import {
  ConnectionNotice,
  ConnectivityProvider,
} from '@/components/Connectivity';
import { AuthProvider } from '@/contexts/AuthContext';
import { RetentionProvider } from '@/contexts/RetentionContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <MotionProvider>
          <StatusBar style="dark" />
          <AppEntry>
            <AuthProvider>
              <ConnectivityProvider>
                <ConnectionNotice />
                <PaymentProvider>
                  <CommerceProvider>
                    <RetentionProvider>
                      <Stack
                        screenOptions={{
                          headerStyle: { backgroundColor: colors.surface },
                          headerTintColor: colors.primaryDark,
                          headerTitleStyle: { fontWeight: '700' },
                          contentStyle: { backgroundColor: colors.background },
                        }}
                      >
                        <Stack.Screen
                          name="(tabs)"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="product/[handle]"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="checkout"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="orders"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="compare"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="profile"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="notifications"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="auth/login"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="auth/register"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="auth/forgot-password"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="auth/reset-password"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="addresses"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="favorites"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="recently-viewed"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="order-detail"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="settings"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="support"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="legal"
                          options={{ headerShown: false }}
                        />
                      </Stack>
                    </RetentionProvider>
                  </CommerceProvider>
                </PaymentProvider>
              </ConnectivityProvider>
            </AuthProvider>
          </AppEntry>
        </MotionProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
