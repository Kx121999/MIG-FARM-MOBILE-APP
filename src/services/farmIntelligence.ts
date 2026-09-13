import { apiRequest } from '@/services/apiClient';
import type { FarmIntelligence, VerifiedDiagnosisResult, VerifiedKnowledgeRecord, WaterQualityReference } from '@/types/farm';

const publicRequest = <T>(path:string,options:Parameters<typeof apiRequest<T>>[1]={}) => apiRequest<T>(path,{...options,auth:'none'});
const query = (values:Record<string,string|number|undefined>) => {
  const params=Object.entries(values).filter((entry):entry is [string,string|number]=>entry[1]!==undefined&&entry[1]!=='').map(([key,value])=>`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return params.length?`?${params.join('&')}`:'';
};

export const farmIntelligenceService = {
  center:(farmId?:string,language:'ar'|'en'='ar')=>apiRequest<FarmIntelligence>('/api/my-farm/intelligence'+query({farmId,language})),
  crop:(cropId:string,language:'ar'|'en'='ar')=>apiRequest<{generatedAt:string;cropState:FarmIntelligence['cropStates'][number];forecasts:FarmIntelligence['forecasts'];risks:FarmIntelligence['risks'];anomalies:FarmIntelligence['anomalies'];providerStatus:FarmIntelligence['providerStatus'];diagnosis:null}>(`/api/crops/${encodeURIComponent(cropId)}/intelligence${query({language})}`),
  providers:()=>apiRequest<FarmIntelligence['providerStatus']>('/api/my-farm/provider-status'),
  crops:(cursor?:string)=>publicRequest<{items:VerifiedKnowledgeRecord[];nextCursor?:string;verifiedOnly:true}>('/api/knowledge/v5/crops'+query({cursor})),
  search:(q:string,type?:string)=>publicRequest<{items:VerifiedKnowledgeRecord[];nextCursor?:string;query:string;verifiedOnly:true}>('/api/knowledge/v5/search'+query({q,type})),
  plantingCalendar:(month:number,mode:'field'|'nursery')=>publicRequest<{month:number;monthName:string;mode:string;items:VerifiedKnowledgeRecord[];verifiedOnly:true}>('/api/knowledge/v5/planting-calendar'+query({month,mode})),
  regulations:(kind?:'regulation'|'service')=>publicRequest<{items:VerifiedKnowledgeRecord[];nextCursor?:string;verifiedOnly:true;disclaimerAr:string;disclaimerEn:string}>('/api/knowledge/v5/uae'+query({kind})),
  waterQuality:(body:{ecDsM:number;crop?:string;measuredAt?:string})=>publicRequest<WaterQualityReference>('/api/farm-calculators/v5/water-quality',{method:'POST',body}),
  diagnose:(body:{cropSlug?:string;symptoms:string[];plantPart?:string;spread?:string})=>publicRequest<VerifiedDiagnosisResult>('/api/diagnosis/verified',{method:'POST',body}),
};
