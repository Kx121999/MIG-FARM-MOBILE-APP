import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { customerService, customerError } from '@/services/customer';
import { useOnline } from '@/components/Connectivity';

export function useAccountFavorites(
  guest: number[],
  hydrated: boolean,
  toggleGuest: (id: number) => void,
) {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const online = useOnline();
  const owner = user?.id;
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const [remote, setRemote] = useState<{ owner?: string; ids: number[] }>({
    ids: [],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef(new Set<number>());
  const load = useCallback(async () => {
    if (!owner || !hydrated) return;
    setLoading(true);
    setError('');
    const signature = JSON.stringify([...guest].sort((a, b) => a - b));
    const key = 'mig_farm_favorite_merge_v1_' + owner;
    try {
      const merged = await AsyncStorage.getItem(key);
      if (currentOwner.current !== owner) return;
      const ids =
        merged === signature || !guest.length
          ? await customerService.favorites()
          : await customerService.mergeFavorites(guest);
      if (currentOwner.current !== owner) return;
      setRemote({ owner, ids });
      await AsyncStorage.setItem(key, signature);
    } catch (e) {
      if (currentOwner.current === owner) setError(customerError(e, isRTL));
    } finally {
      if (currentOwner.current === owner) setLoading(false);
    }
  }, [owner, hydrated, guest, isRTL]);
  useEffect(() => {
    setRemote({ ids: [] });
    setError('');
    pending.current.clear();
  }, [owner]);
  useEffect(() => {
    if (online) void load();
  }, [load, online, revision]);
  const ids = owner ? (remote.owner === owner ? remote.ids : []) : guest;
  const toggle = useCallback(
    (id: number) => {
      if (!owner) {
        toggleGuest(id);
        return;
      }
      if (loading || remote.owner !== owner || pending.current.has(id)) {
        if (!loading) setRevision((value) => value + 1);
        return;
      }
      pending.current.add(id);
      const add = !ids.includes(id);
      setError('');
      setRemote((current) => ({
        owner,
        ids: add
          ? [...current.ids, id]
          : current.ids.filter((value) => value !== id),
      }));
      void customerService
        .setFavorite(id, add)
        .catch((e) => {
          if (currentOwner.current !== owner) return;
          setRemote((current) => ({
            owner,
            ids: add
              ? current.ids.filter((value) => value !== id)
              : [...new Set([...current.ids, id])],
          }));
          setError(customerError(e, isRTL));
        })
        .finally(() => {
          if (currentOwner.current === owner) pending.current.delete(id);
        });
    },
    [owner, ids, loading, remote.owner, toggleGuest, isRTL],
  );
  const retryFavorites = useCallback(
    () => setRevision((value) => value + 1),
    [],
  );
  return {
    favorites: ids,
    toggleFavorite: toggle,
    favoritesError: error,
    favoritesLoading: loading,
    retryFavorites,
  };
}
