import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  authService,
  customerService,
  CustomerServiceError,
} from '@/services/customer';
import { sessionStore } from '@/services/sessionStore';
import { apiSession, refreshSession, validSession } from '@/services/apiClient';
import { useLanguage } from '@/contexts/LanguageContext';
import type {
  AuthSession,
  AvatarSelection,
  ProfileDraft,
  UserProfile,
} from '@/types/customer';

type AuthValue = {
  user: UserProfile | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (draft: ProfileDraft) => Promise<void>;
  uploadAvatar: (image: AvatarSelection) => Promise<void>;
  removeAvatar: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const session = useRef<AuthSession | null>(null);
  const generation = useRef(0);
  const accept = useCallback(
    async (next: AuthSession, expected = generation.current) => {
      if (!validSession(next))
        throw new CustomerServiceError('invalid');
      if (expected !== generation.current) return;
      await sessionStore.write(next.refreshToken);
      if (expected !== generation.current) return;
      session.current = next;
      apiSession.set(next);
      setUser(next.user);
    },
    [],
  );
  useEffect(() => {
    let active = true;
    const unsubscribe = apiSession.subscribe(next => {
      if (active) { session.current = next; setUser(next?.user ?? null); }
    });
    let restoring = false;
    const restore = async () => {
      if (restoring) return;
      restoring = true;
      const version = generation.current;
      try {
        if (authService.available) {
          const token = await sessionStore.read();
          if (token && active) {
            await refreshSession();
          }
        }
      } catch {
        if (active && version === generation.current && !apiSession.get()) {
          session.current = null;
          setUser(null);
        }
      } finally {
        restoring = false;
        if (active) setReady(true);
      }
    };
    void restore();
    const subscription = AppState.addEventListener('change', (state) => {
      if (
        state === 'active' &&
        (!session.current || session.current.expiresAt <= Date.now())
      )
        void restore();
    });
    return () => {
      active = false;
      generation.current++;
      subscription.remove();
      unsubscribe();
    };
  }, [accept]);
  const logout = async () => {
    const token = session.current?.refreshToken;
    generation.current++;
    session.current = null;
    setUser(null);
    await apiSession.clear();
    if (token) await authService.logout(token);
  };
  const authenticated = () => {
    if (!session.current) throw new CustomerServiceError('unauthorized');
  };
  const changeProfile = async (request: () => Promise<UserProfile>) => {
    authenticated();
    const version = generation.current;
    const id = session.current!.user.id;
    const updated = await request();
    if (version !== generation.current || session.current?.user.id !== id)
      return;
    if (updated.id !== id) throw new CustomerServiceError('invalid');
    session.current = { ...session.current, user: updated };
    apiSession.updateUser(updated);
    setUser(updated);
  };
  const value: AuthValue = {
    user,
    ready,
    login: async (email, password) => {
      const version = ++generation.current;
      await accept(await authService.login(email, password), version);
    },
    register: async (name, email, password) => {
      const version = ++generation.current;
      const result = await authService.register(name, email, password, language);
      await accept(result, version);
      return true;
    },
    logout,
    updateProfile: (draft) =>
      changeProfile(() => customerService.updateProfile(draft)),
    uploadAvatar: (image) =>
      changeProfile(() => customerService.uploadAvatar(image)),
    removeAvatar: () => changeProfile(() => customerService.removeAvatar()),
    deleteAccount: async (password) => {
      authenticated();
      const version = generation.current;
      await authService.deleteAccount(password);
      if (version !== generation.current) return;
      generation.current++;
      session.current = null;
      setUser(null);
      await apiSession.clear();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider required');
  return value;
}
