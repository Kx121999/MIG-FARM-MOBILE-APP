import type { Language } from '@/types';

export function resolveLaunchLanguage(saved: unknown, locale?: string | null): Language {
  if (saved === 'ar' || saved === 'en') return saved;
  return locale?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}
