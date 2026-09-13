import { apiRequest } from '@/services/apiClient';
import type {
  CommandTimelineEvent,
  CropMissionResponse,
  FarmExpense,
  FarmSale,
  FarmToday,
  GrowthStage,
  SeasonFarmReport,
  WeeklyFarmReport,
} from '@/types/farm';

const id = (value:string) => encodeURIComponent(value);
const query = (values:Record<string,string|undefined>) => {
  const params = Object.entries(values)
    .filter((entry):entry is [string,string] => Boolean(entry[1]))
    .map(([key,value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return params.length ? `?${params.join('&')}` : '';
};

export const farmCommandService = {
  today: (farmId?:string) => apiRequest<FarmToday>('/api/my-farm/today' + query({ farmId })),
  commandCenter: (farmId?:string) => apiRequest<FarmToday>('/api/my-farm/command-center' + query({ farmId })),
  changes: (since?:string,farmId?:string) => apiRequest<{since:string|null;changes:Array<Record<string,unknown>>;reason?:string}>('/api/my-farm/changes' + query({ since,farmId })),
  status: (farmId?:string) => apiRequest<Record<string,unknown>>('/api/my-farm/status' + query({ farmId })),
  mission: (cropId:string) => apiRequest<CropMissionResponse>(`/api/crops/${id(cropId)}/mission`),
  checkIn: (cropId:string,body:{date?:string;answers:Record<string,string>;notes?:string}) => apiRequest<{checkIn:{id:string;date:string;answers:Record<string,string>;notes:string};nextActions:string[]}>(`/api/crops/${id(cropId)}/check-in`,{method:'POST',body}),
  confirmStage: (cropId:string,body:{stageKey:GrowthStage;confirmedAt?:string;notes?:string}) => apiRequest<{confirmation:{id:string;stageKey:GrowthStage;expectedAt:string|null;confirmedAt:string;adjustmentDays:number};adjustedTasks:number;adaptation:'future_verified_tasks_shifted'|'verified_guidance_not_available'}>(`/api/crops/${id(cropId)}/stage-confirmation`,{method:'POST',body}),
  timeline: async (cropId:string) => (await apiRequest<{timeline:CommandTimelineEvent[]}>(`/api/crops/${id(cropId)}/timeline`)).timeline,
  followProblem: (problemId:string,body:{condition:'better'|'same'|'worse'|'resolved'|'note';notes?:string;nextFollowUpAt?:string}) => apiRequest(`/api/problems/${id(problemId)}/follow-up`,{method:'POST',body}),
  weeklyReport: (farmId:string,from?:string,to?:string) => apiRequest<{farm:{id:string;name:string};report:WeeklyFarmReport;comparison:null}>(`/api/farms/${id(farmId)}/weekly-report` + query({from,to})),
  seasonReport: (cropId:string) => apiRequest<{report:SeasonFarmReport;stored:boolean}>(`/api/crops/${id(cropId)}/season-report`),
  seasonHistory: (farmId:string) => apiRequest<{farm:{id:string;name:string};seasons:Array<{cropCycleId:string;cropName:string;variety:string;plantingDate:string|null;actualHarvestDate:string|null;generatedAt:string;report:SeasonFarmReport;source:'farm_record_calculation'}>}>(`/api/farms/${id(farmId)}/seasons`),
  expenses: (farmId:string,cropId?:string) => apiRequest<{expenses:FarmExpense[];totalMinor:number;currency:string}>('/api/farm-expenses' + query({farmId,cropId})),
  addExpense: (body:{farmId:string;cropCycleId?:string;category:string;amount:number;currency?:string;date?:string;notes?:string}) => apiRequest<{expense:FarmExpense}>('/api/farm-expenses',{method:'POST',body}),
  sales: (farmId:string,cropId?:string) => apiRequest<{sales:FarmSale[];revenueMinor:number;currency:string}>('/api/farm-sales' + query({farmId,cropId})),
  addSale: (body:{farmId:string;cropCycleId:string;quantity:number;unit:string;unitPrice:number;currency?:string;date?:string;buyerNotes?:string}) => apiRequest<{sale:FarmSale}>('/api/farm-sales',{method:'POST',body}),
  escalateProblem: (problemId:string) => apiRequest<{escalation:{id:string;status:'prepared';deliveryStatus:'provider_not_configured';casePackage:Record<string,unknown>}}>(`/api/problems/${id(problemId)}/escalate`,{method:'POST',body:{}}),
};
