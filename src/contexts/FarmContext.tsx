import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useOnline } from '@/components/Connectivity';
import { useAuth } from '@/contexts/AuthContext';
import { CustomerServiceError } from '@/services/apiClient';
import { farmService, runQueuedFarmMutation, type QueuedFarmMutation } from '@/services/farm';
import type { FarmDashboard } from '@/types/farm';

type MutationKind=QueuedFarmMutation['kind'];
type FarmValue={
  dashboard:FarmDashboard|null; loading:boolean; refreshing:boolean; error:string; cached:boolean;
  pendingCount:number; refresh:()=>Promise<void>; submit:(kind:MutationKind,body:Record<string,unknown>)=>Promise<'saved'|'queued'>;
};
const FarmContext=createContext<FarmValue|null>(null);
const cacheKey=(id:string)=>`mig_farm_os_cache_v1:${id}`;
const queueKey=(id:string)=>`mig_farm_os_queue_v1:${id}`;
const makeId=()=>`${Date.now()}-${Math.random().toString(36).slice(2,10)}`;

export function FarmProvider({children}:{children:React.ReactNode}) {
  const {user}=useAuth(),online=useOnline();
  const [dashboard,setDashboard]=useState<FarmDashboard|null>(null),[loading,setLoading]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[cached,setCached]=useState(false),[queue,setQueue]=useState<QueuedFarmMutation[]>([]);
  const owner=useRef<string|null>(null),syncing=useRef(false);
  const persistQueue=useCallback(async(userId:string,next:QueuedFarmMutation[])=>{ setQueue(next); await AsyncStorage.setItem(queueKey(userId),JSON.stringify(next)); },[]);
  const refresh=useCallback(async()=>{
    if(!user) return;
    setRefreshing(true); setError('');
    try { const next=await farmService.dashboard(); if(owner.current!==user.id)return; setDashboard(next); setCached(false); await AsyncStorage.setItem(cacheKey(user.id),JSON.stringify(next)); }
    catch(e){ if(owner.current===user.id)setError(e instanceof CustomerServiceError?e.code:'unavailable'); }
    finally { if(owner.current===user.id){setRefreshing(false);setLoading(false);} }
  },[user]);
  useEffect(()=>{
    owner.current=user?.id??null; setDashboard(null); setError(''); setCached(false); setQueue([]);
    if(!user){setLoading(false);return;}
    let active=true; setLoading(true);
    Promise.all([AsyncStorage.getItem(cacheKey(user.id)),AsyncStorage.getItem(queueKey(user.id))]).then(([rawCache,rawQueue])=>{
      if(!active||owner.current!==user.id)return;
      if(rawCache){ try{setDashboard(JSON.parse(rawCache));setCached(true);}catch{/* ignore damaged cache */} }
      if(rawQueue){ try{ const parsed=JSON.parse(rawQueue); if(Array.isArray(parsed))setQueue(parsed.filter((x)=>x.ownerId===user.id)); }catch{/* ignore damaged queue */} }
    }).finally(()=>{if(active)void refresh();});
    return()=>{active=false;};
  },[user?.id,refresh]);
  useEffect(()=>{
    if(!online||!user||!queue.length||syncing.current)return;
    let cancelled=false; syncing.current=true;
    (async()=>{
      let remaining=[...queue];
      while(remaining.length&&!cancelled&&owner.current===user.id){
        const item=remaining[0];
        try { await runQueuedFarmMutation(item); remaining=remaining.slice(1); await persistQueue(user.id,remaining); }
        catch(e){ if(e instanceof CustomerServiceError&&e.code==='network')break; remaining=remaining.slice(1); await persistQueue(user.id,remaining); setError(e instanceof CustomerServiceError?e.code:'unavailable'); }
      }
      if(!cancelled&&remaining.length===0)await refresh();
    })().finally(()=>{syncing.current=false;});
    return()=>{cancelled=true;};
  },[online,user,queue,persistQueue,refresh]);
  const submit=useCallback(async(kind:MutationKind,body:Record<string,unknown>)=>{
    if(!user)throw new CustomerServiceError('unauthorized',401);
    const item:QueuedFarmMutation={id:makeId(),ownerId:user.id,kind,body,queuedAt:Date.now()};
    if(!online){await persistQueue(user.id,[...queue,item]);return'queued';}
    try { await runQueuedFarmMutation(item); await refresh(); return'saved'; }
    catch(e){ if(e instanceof CustomerServiceError&&e.code==='network'){await persistQueue(user.id,[...queue,item]);return'queued';} throw e; }
  },[user,online,queue,persistQueue,refresh]);
  return <FarmContext.Provider value={{dashboard,loading,refreshing,error,cached,pendingCount:queue.length,refresh,submit}}>{children}</FarmContext.Provider>;
}
export function useFarm(){const value=useContext(FarmContext);if(!value)throw new Error('FarmProvider required');return value;}
