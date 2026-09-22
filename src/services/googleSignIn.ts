import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignIn() {
  return Google.useIdTokenAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
}

export function googleIdToken(
  response: ReturnType<typeof useGoogleSignIn>[1],
): string | null {
  if (response?.type !== 'success') return null;
  const token = response.params?.id_token;
  return typeof token === 'string' && token ? token : null;
}
