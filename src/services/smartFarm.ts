import { apiRequest } from '@/services/apiClient';
import type {
  CropKnowledgeProfile,
  CropPlan,
  CropSpacingProfile,
  GreenhouseLayoutResult,
  GuidedDiagnosisResult,
  IrrigationRuntimeResult,
  PlantPopulationResult,
  UAERegulation,
} from '@/types/farm';

const publicRequest = <T>(path:string, options:Parameters<typeof apiRequest<T>>[1] = {}) =>
  apiRequest<T>(path,{...options,auth:'none'});

export const smartFarmService = {
  crops: async (q = '') => (await publicRequest<{crops:CropKnowledgeProfile[];verifiedOnly:true}>(`/api/knowledge/crops${q ? `?q=${encodeURIComponent(q)}` : ''}`)).crops,
  crop: async (slug:string) => (await publicRequest<{crop:CropKnowledgeProfile;verifiedOnly:true}>(`/api/knowledge/crops/${encodeURIComponent(slug)}`)).crop,
  regulations: async () => (await publicRequest<{regulations:UAERegulation[];verifiedOnly:true}>('/api/knowledge/uae/regulations')).regulations,
  search: (q:string) => publicRequest<{crops:CropKnowledgeProfile[];regulations:UAERegulation[];articles:Array<{id:string;slug:string;kind:string;titleAr:string;titleEn:string;summaryAr:string;summaryEn:string;source:UAERegulation['source']}>;verifiedOnly:true}>(`/api/knowledge/search?q=${encodeURIComponent(q)}`),
  area: (body:{mode?:'dimensions';length?:number;width?:number;unit?:'m'|'cm'|'ft';area?:number}) => publicRequest<{areaM2:number;dataOrigin:'user_supplied'}>('/api/farm-calculators/area',{method:'POST',body}),
  planting: (body:{areaM2:number;spacingProfileId?:string;rowSpacingCm?:number;plantSpacingCm?:number;plantsPerStation?:number;usableAreaPercent?:number}) => publicRequest<{result:PlantPopulationResult;profile:CropSpacingProfile|null;warning?:string}>('/api/farm-calculators/planting',{method:'POST',body}),
  irrigation: (body:{targetVolumeLiters:number;emitterFlowLitersPerHour:number;emitterCount:number}) => publicRequest<{result:IrrigationRuntimeResult;warning:string}>('/api/farm-calculators/irrigation',{method:'POST',body}),
  layout: (body:{lengthM:number;widthM:number;bedWidthM:number;aisleWidthM:number}) => publicRequest<{result:GreenhouseLayoutResult;warning:string}>('/api/farm-calculators/layout',{method:'POST',body}),
  diagnose: (body:{cropSlug?:string;symptoms:string[];plantPart?:string;spread?:string;recentEvents?:string[]}) => publicRequest<GuidedDiagnosisResult>('/api/diagnosis/guide',{method:'POST',body}),
  createPlan: (body:{farmId:string;zoneId?:string;cropProfileId:string;spacingProfileId?:string;plantingDate:string;areaM2:number;productionSystem:string;plantingMethod:string}) => apiRequest<{plan:CropPlan;generatedTasks:number;tasksReason?:string}>('/api/crop-plans',{method:'POST',body}),
  plan: async (id:string) => (await apiRequest<{plan:CropPlan}>(`/api/crop-plans/${encodeURIComponent(id)}`)).plan,
};
