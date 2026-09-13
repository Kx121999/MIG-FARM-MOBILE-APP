import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CustomerServiceError } from '@/services/apiClient';
import { farmIntelligenceService } from '@/services/farmIntelligence';
import type { FarmIntelligence } from '@/types/farm';

const key=(userId:string,farmId:string|undefined,language:'ar'|'en')=>`mig_farm_intelligence_v5:${userId}:${farmId||'latest'}:${language}`;

export function useFarmIntelligence(farmId?:string,enabled=true){
  const {user}=useAuth();
  const {language}=useLanguage();
  const userId=user?.id;
  const [data,setData]=useState<FarmIntelligence|null>(null);
  const [loading,setLoading]=useState(Boolean(userId&&enabled));
  const [refreshing,setRefreshing]=useState(false);
  const [cached,setCached]=useState(false);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    if(!userId||!enabled)return;
    setRefreshing(true);setError('');
    try{
      const next=await farmIntelligenceService.center(farmId,language);
      setData(next);setCached(false);
      await AsyncStorage.setItem(key(userId,farmId,language),JSON.stringify(next));
    }catch(cause){setError(cause instanceof CustomerServiceError?cause.code:'unavailable');}
    finally{setLoading(false);setRefreshing(false);}
  },[enabled,farmId,language,userId]);
  useEffect(()=>{
    if(!userId||!enabled){setData(null);setLoading(false);return;}
    let active=true;setLoading(true);
    AsyncStorage.getItem(key(userId,farmId,language)).then((stored)=>{
      if(!active||!stored)return;
      try{setData(JSON.parse(stored));setCached(true);}catch{/* Ignore damaged owner-scoped cache. */}
    }).finally(()=>{if(active)void refresh();});
    return()=>{active=false;};
  },[enabled,farmId,language,refresh,userId]);
  return{data,loading,refreshing,cached,error,refresh};
}
