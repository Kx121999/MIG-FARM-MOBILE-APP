import { Platform } from 'react-native';
import { apiRequest } from '@/services/apiClient';
import type { Language } from '@/types';

export type HomeContentSection = {
  id: string;
  kind:
    | 'hero'
    | 'announcement'
    | 'promo'
    | 'featured'
    | 'new_arrivals'
    | 'popular'
    | 'recommended';
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  imageUrl: string;
  deepLink: string;
  productIds: number[];
};

export type OfferRecord = {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  bannerUrl: string;
  discount: string;
  ctaAr: string;
  ctaEn: string;
  deepLink: string;
  productIds: number[];
  startsAt?: string;
  endsAt?: string;
};

export const platformService = {
  home: () =>
    apiRequest<{ sections: HomeContentSection[] }>('/api/app/home', {
      auth: 'none',
    }),
  offers: () =>
    apiRequest<{ offers: OfferRecord[] }>('/api/offers', { auth: 'none' }),
  trackRecentlyViewed: (productId: number) =>
    apiRequest<void>('/api/recently-viewed', {
      method: 'POST',
      body: { productId },
    }).catch(() => undefined),
  recentlyViewed: () =>
    apiRequest<{ productIds: number[] }>('/api/recently-viewed'),
  savePushToken: (token: string, language: Language, deviceId = '') =>
    apiRequest<void>('/api/push-tokens', {
      method: 'POST',
      body: {
        token,
        locale: language,
        platform: Platform.OS,
        deviceId,
      },
    }),
  removePushToken: (token: string) =>
    apiRequest<void>('/api/push-tokens', {
      method: 'DELETE',
      body: { token },
    }),
};
