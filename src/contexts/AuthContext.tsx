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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const session = useRef<AuthSession | null>(null);
  const generation = useRef(0);
  const accept = useCallback(
    async (next: AuthSession, expected = generation.current) => {
      if (
        !next.user.id ||
        !next.accessToken ||
        !next.refreshToken ||
        next.expiresAt <= Date.now()
      )
        throw new CustomerServiceError('invalid');
      if (expected !== generation.current) return;
      await sessionStore.write(next.refreshToken);
      if (expected !== generation.current) return;
      session.current = next;
      setUser(next.user);
    },
    [],
  );
  useEffect(() => {
    let active = true;
    let restoring = false;
    const restore = async () => {
      if (restoring) return;
      restoring = true;
      const version = generation.current;
      try {
        if (authService.available) {
          const token = await sessionStore.read();
          if (token && active) {
            const next = await authService.refresh(token);
            if (active) await accept(next, version);
          }
        }
      } catch {
        if (active && version === generation.current) {
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
        session.current &&
        session.current.expiresAt <= Date.now()
      )
        void restore();
    });
    return () => {
      active = false;
      generation.current++;
      subscription.remove();
    };
  }, [accept]);
  const logout = async () => {
    const version = generation.current;
    const token = session.current?.refreshToken;
    if (token) await authService.logout(token);
    if (version !== generation.current) return;
    generation.current++;
    session.current = null;
    setUser(null);
    await sessionStore.clear();
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
      const result = await authService.register(name, email, password);
      if ('verificationRequired' in result) return false;
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
      await sessionStore.clear();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider required');
  return value;
}
