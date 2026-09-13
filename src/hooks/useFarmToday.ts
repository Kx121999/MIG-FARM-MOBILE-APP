import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CustomerServiceError } from '@/services/apiClient';
import { farmCommandService } from '@/services/farmCommand';
import type { FarmToday } from '@/types/farm';

const cacheKey = (userId:string,farmId?:string) => `mig_farm_command_v1:${userId}:${farmId || 'all'}`;
const visitKey = (userId:string,farmId?:string) => `mig_farm_command_visit_v1:${userId}:${farmId || 'all'}`;

export function useFarmToday(farmId?:string) {
  const { user } = useAuth();
  const userId = user?.id;
  const [data,setData] = useState<FarmToday|null>(null);
  const [changes,setChanges] = useState<Array<Record<string,unknown>>>([]);
  const [loading,setLoading] = useState(Boolean(user));
  const [refreshing,setRefreshing] = useState(false);
  const [cached,setCached] = useState(false);
  const [error,setError] = useState('');

  const refresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    setError('');
    try {
      const previousVisit = await AsyncStorage.getItem(visitKey(userId,farmId));
      const [next,nextChanges] = await Promise.all([
        farmCommandService.commandCenter(farmId),
        previousVisit ? farmCommandService.changes(previousVisit,farmId).catch(() => ({changes:[]})) : Promise.resolve({changes:[]}),
      ]);
      setData(next);
      setChanges(nextChanges.changes || []);
      setCached(false);
      await Promise.all([
        AsyncStorage.setItem(cacheKey(userId,farmId),JSON.stringify(next)),
        AsyncStorage.setItem(visitKey(userId,farmId),new Date().toISOString()),
      ]);
    } catch (cause) {
      setError(cause instanceof CustomerServiceError ? cause.code : 'unavailable');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  },[userId,farmId]);

  useEffect(() => {
    if (!userId) { setData(null); setChanges([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    AsyncStorage.getItem(cacheKey(userId,farmId)).then((stored) => {
      if (!active || !stored) return;
      try { setData(JSON.parse(stored)); setCached(true); } catch { /* Ignore damaged cache. */ }
    }).finally(() => { if (active) void refresh(); });
    return () => { active = false; };
  },[userId,farmId,refresh]);

  return { data,changes,loading,refreshing,cached,error,refresh };
}
