import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'mig_farm_refresh_v1';
// Access tokens are memory-only. Web persistence requires an HttpOnly cookie
// session on the future backend; never fall back to localStorage/AsyncStorage.
let webRefresh: string | null = null;
// Serialize native writes so a slow token save cannot outlive a later logout.
let pending: Promise<void> = Promise.resolve();
function mutate(operation: () => Promise<void>) {
  const next = pending.catch(() => {}).then(operation);
  pending = next;
  return next;
}
export const sessionStore = {
  read: async () => {
    await pending.catch(() => {});
    return Platform.OS === 'web'
      ? Promise.resolve(webRefresh)
      : SecureStore.getItemAsync(KEY);
  },
  write: (value: string) =>
    mutate(async () => {
      if (Platform.OS === 'web') webRefresh = value;
      else
        await SecureStore.setItemAsync(KEY, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
    }),
  clear: () =>
    mutate(async () => {
      webRefresh = null;
      if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(KEY);
    }),
};
