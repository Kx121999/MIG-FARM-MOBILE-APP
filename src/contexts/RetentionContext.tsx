import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  defaultNotificationPreferences,
  readNotificationPreferences,
} from '@/utils/customer';
import type { NotificationPreference } from '@/types/customer';
const KEY = 'mig_farm_notifications_v1',
  PERSONAL = 'mig_farm_personalization_v1';
type Value = {
  ready: boolean;
  preferences: NotificationPreference;
  personalization: boolean;
  savePreferences: (value: NotificationPreference) => Promise<void>;
  setPersonalization: (value: boolean) => Promise<void>;
};
const Context = createContext<Value | null>(null);
export function RetentionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false),
    [preferences, setPreferences] = useState(defaultNotificationPreferences),
    [personalization, setPersonalizationState] = useState(true);
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
        ready,
        preferences,
        personalization,
        savePreferences: async (value) => {
          await AsyncStorage.setItem(KEY, JSON.stringify(value));
          setPreferences(value);
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
