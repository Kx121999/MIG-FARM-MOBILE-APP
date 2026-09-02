import React from 'react';
import { CheckoutCustomer, PaymentSession } from '@/services/payments';

export function CheckoutPayment(props: {
  session: PaymentSession;
  customer: CheckoutCustomer;
  language: 'ar' | 'en';
  onSuccess: () => void;
  onError: (message: string) => void;
}): React.ReactElement;
