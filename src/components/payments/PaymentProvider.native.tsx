import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export function PaymentProvider({ children }: { children: React.ReactElement }) {
  return (
    <StripeProvider
      publishableKey={env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_not_configured'}
      merchantIdentifier="merchant.com.migfarm.app"
      urlScheme="migfarm"
    >
      {children}
    </StripeProvider>
  );
}
