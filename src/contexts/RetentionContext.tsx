import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { customerService } from '@/services/customer';
import { useOnline } from '@/components/Connectivity';
import {
  defaultNotificationPreferences,
  readNotificationPreferences,
} from '@/utils/customer';
import type { NotificationPreference } from '@/types/customer';
const KEY = 'mig_farm_notifications_v1',
  PERSONAL = 'mig_farm_personalization_v1';
type Value = {
  ready: boolean;
  error: boolean;
  retry: () => void;
  preferences: NotificationPreference;
  personalization: boolean;
  savePreferences: (value: NotificationPreference) => Promise<void>;
  setPersonalization: (value: boolean) => Promise<void>;
};
const Context = createContext<Value | null>(null);
export function RetentionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const owner = user?.id;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const online = useOnline();
  const [remote, setRemote] = useState<{ owner: string; value: NotificationPreference }>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false),
    [preferences, setPreferences] = useState(defaultNotificationPreferences),
    [personalization, setPersonalizationState] = useState(true);
  useEffect(() => {
    let active = true;
    setError(false);
    if (owner && online) void customerService.notificationPreferences().then(value => {
      if (active) setRemote({ owner, value });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [owner, online, revision]);
  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(PERSONAL)])
      .then(([value, personal]) => {
        if (!active) return;
        setPreferences(
          readNotificationPreferences(value ? JSON.parse(value) : null),
        );
        setPersonalizationState(personal !== 'false');
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Context.Provider
      value={{
        ready: ready && (!owner || remote?.owner === owner),
        error: !!owner && error,
        retry: () => setRevision(value => value + 1),
        preferences: owner ? (remote?.owner === owner ? remote.value : defaultNotificationPreferences) : preferences,
        personalization,
        savePreferences: async (value) => {
          if (owner) {
            await customerService.updateNotificationPreferences(value);
            if (ownerRef.current === owner) setRemote({ owner, value });
          } else {
            await AsyncStorage.setItem(KEY, JSON.stringify(value));
            setPreferences(value);
          }
        },
        setPersonalization: async (value) => {
          await AsyncStorage.setItem(PERSONAL, String(value));
          setPersonalizationState(value);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useRetention() {
  const value = useContext(Context);
  if (!value) throw new Error('RetentionProvider required');
  return value;
}
