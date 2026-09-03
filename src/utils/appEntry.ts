export const ONBOARDING_KEY = 'mig_farm_onboarding_v1';
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown> };

async function bounded<T>(operation: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), 2000); })]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function hasCompletedOnboarding(storage: Storage): Promise<boolean> {
  // Storage failure must never block guest access to the shop.
  try { return (await bounded(storage.getItem(ONBOARDING_KEY), 'complete')) === 'complete'; }
  catch { return true; }
}

export async function completeOnboarding(storage: Storage): Promise<void> {
  try { await bounded(storage.setItem(ONBOARDING_KEY, 'complete'), undefined); }
  catch { /* Shopping remains available when local storage is unavailable. */ }
}
