import { apiRequest } from '@/services/apiClient';
import type { Page } from '@/types/customer';
import type { AgriculturalAnalysis, CropCycle, DiagnosisSession, Farm, FarmDashboard, FarmDraft, FarmInventoryItem, FarmOperation, FarmProblem, FarmProblemDetail, FarmReport, FarmTask, FarmTimelineEvent, FarmZone, HarvestRecord, IrrigationRecord } from '@/types/farm';

const id = (value:string) => encodeURIComponent(value);
const query = (values:Record<string,string|undefined>) => {
  const params=Object.entries(values).filter((entry):entry is [string,string]=>Boolean(entry[1])).map(([key,value])=>`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return params.length?'?'+params.join('&'):'';
};
const mutation = <T>(path:string,method:'POST'|'PATCH'|'DELETE',body?:unknown) => apiRequest<T>(path,{method,body});

export const farmService = {
  dashboard: () => apiRequest<FarmDashboard>('/api/my-farm/dashboard'),
  farms: async () => (await apiRequest<{farms:Farm[]}>('/api/farms')).farms,
  farm: async (farmId:string) => (await apiRequest<{farm:Farm}>(`/api/farms/${id(farmId)}`)).farm,
  createFarm: async (body:FarmDraft) => (await mutation<{farm:Farm}>('/api/farms','POST',body)).farm,
  updateFarm: async (farmId:string,body:Partial<FarmDraft>) => (await mutation<{farm:Farm}>(`/api/farms/${id(farmId)}`,'PATCH',body)).farm,
  deleteFarm: (farmId:string) => mutation<{ok:true}>(`/api/farms/${id(farmId)}`,'DELETE'),
  zones: async (farmId:string) => (await apiRequest<{zones:FarmZone[]}>(`/api/farms/${id(farmId)}/zones`)).zones,
  createZone: async (farmId:string,body:Partial<FarmZone>&Pick<FarmZone,'name'|'type'>) => (await mutation<{zone:FarmZone}>(`/api/farms/${id(farmId)}/zones`,'POST',body)).zone,
  updateZone: async (zoneId:string,body:Partial<FarmZone>) => (await mutation<{zone:FarmZone}>(`/api/zones/${id(zoneId)}`,'PATCH',body)).zone,
  deleteZone: (zoneId:string) => mutation<{ok:true}>(`/api/zones/${id(zoneId)}`,'DELETE'),
  crops: async (farmId:string) => (await apiRequest<{crops:CropCycle[]}>(`/api/farms/${id(farmId)}/crops`)).crops,
  crop: async (cropId:string) => (await apiRequest<{crop:CropCycle}>(`/api/crops/${id(cropId)}`)).crop,
  createCrop: async (body:Partial<CropCycle>&Pick<CropCycle,'farmId'|'cropName'>) => (await mutation<{crop:CropCycle}>('/api/crops','POST',body)).crop,
  updateCrop: async (cropId:string,body:Partial<CropCycle>) => (await mutation<{crop:CropCycle}>(`/api/crops/${id(cropId)}`,'PATCH',body)).crop,
  completeCrop: async (cropId:string,actualHarvestDate?:string) => (await mutation<{crop:CropCycle}>(`/api/crops/${id(cropId)}/complete`,'POST',{actualHarvestDate})).crop,
  tasks: (view:'all'|'today'|'upcoming'|'overdue'='all',filters:{farmId?:string;cropId?:string;cursor?:string}={}) => apiRequest<Page<FarmTask>>('/api/farm-tasks'+query({view,...filters})),
  createTask: async (body:Partial<FarmTask>&Pick<FarmTask,'farmId'|'type'|'title'|'dueAt'>) => (await mutation<{task:FarmTask}>('/api/farm-tasks','POST',body)).task,
  updateTask: async (taskId:string,body:Partial<FarmTask>) => (await mutation<{task:FarmTask}>(`/api/farm-tasks/${id(taskId)}`,'PATCH',body)).task,
  completeTask: async (taskId:string,body:{notes?:string;actualMinutes?:number;actualTime?:string;result?:string}={}) => (await mutation<{task:FarmTask}>(`/api/farm-tasks/${id(taskId)}/complete`,'POST',body)).task,
  deleteTask: (taskId:string) => mutation<{ok:true}>(`/api/farm-tasks/${id(taskId)}`,'DELETE'),
  irrigation: async (filters:{farmId?:string;zoneId?:string;cropId?:string}={}) => (await apiRequest<{records:IrrigationRecord[]}>('/api/irrigation-records'+query(filters))).records,
  createIrrigation: async (body:Partial<IrrigationRecord>&Pick<IrrigationRecord,'farmId'|'zoneId'|'method'>) => (await mutation<{record:IrrigationRecord}>('/api/irrigation-records','POST',body)).record,
  updateIrrigation: async (recordId:string,body:Partial<IrrigationRecord>) => (await mutation<{record:IrrigationRecord}>(`/api/irrigation-records/${id(recordId)}`,'PATCH',body)).record,
  operations: async (filters:{farmId?:string;zoneId?:string;cropId?:string}={}) => (await apiRequest<{operations:FarmOperation[]}>('/api/farm-operations'+query(filters))).operations,
  createOperation: async (body:Partial<FarmOperation>&Pick<FarmOperation,'farmId'|'type'|'performedAt'>) => (await mutation<{operation:FarmOperation}>('/api/farm-operations','POST',body)).operation,
  timeline: async (cropId:string) => (await apiRequest<{timeline:FarmTimelineEvent[]}>(`/api/crops/${id(cropId)}/timeline`)).timeline,
  problems: async (filters:{farmId?:string;zoneId?:string;cropId?:string;status?:FarmProblem['status']}={}) => (await apiRequest<{problems:FarmProblem[]}>('/api/farm-problems'+query(filters))).problems,
  problem: (problemId:string) => apiRequest<FarmProblemDetail>(`/api/farm-problems/${id(problemId)}`),
  createProblem: async (body:Partial<FarmProblem>&Pick<FarmProblem,'farmId'|'category'|'title'|'severity'>) => (await mutation<{problem:FarmProblem}>('/api/farm-problems','POST',body)).problem,
  updateProblem: async (problemId:string,body:Partial<FarmProblem>) => (await mutation<{problem:FarmProblem}>(`/api/farm-problems/${id(problemId)}`,'PATCH',body)).problem,
  followUp: (problemId:string,body:{condition:'better'|'same'|'worse'|'note';notes?:string}) => mutation<{problem:FarmProblem}>(`/api/farm-problems/${id(problemId)}/follow-up`,'POST',body),
  resolveProblem: async (problemId:string,notes?:string) => (await mutation<{problem:FarmProblem}>(`/api/farm-problems/${id(problemId)}/resolve`,'POST',{notes})).problem,
  reopenProblem: async (problemId:string,notes?:string) => (await mutation<{problem:FarmProblem}>(`/api/farm-problems/${id(problemId)}/reopen`,'POST',{notes})).problem,
  uploadMedia: (body:unknown) => mutation('/api/farm-media','POST',body),
  deleteMedia: (mediaId:string) => mutation(`/api/farm-media/${id(mediaId)}`,'DELETE'),
  createHarvest: async (body:Partial<HarvestRecord>&Pick<HarvestRecord,'farmId'|'cropCycleId'|'quantity'|'unit'>) => (await mutation<{harvest:HarvestRecord}>('/api/harvest-records','POST',body)).harvest,
  harvests: async (cropId:string) => (await apiRequest<{harvests:HarvestRecord[]}>(`/api/crops/${id(cropId)}/harvests`)).harvests,
  createNote: (body:{farmId:string;zoneId?:string;cropCycleId?:string;problemId?:string;body:string}) => mutation('/api/farm-notes','POST',body),
  inventory: async (farmId:string) => (await apiRequest<{items:FarmInventoryItem[]}>('/api/farm-inventory'+query({farmId}))).items,
  createInventoryItem: async (body:Partial<FarmInventoryItem>&Pick<FarmInventoryItem,'farmId'|'productNameSnapshot'|'category'>) => (await mutation<{item:FarmInventoryItem}>('/api/farm-inventory','POST',body)).item,
  updateInventoryItem: async (itemId:string,body:Partial<FarmInventoryItem>) => (await mutation<{item:FarmInventoryItem}>(`/api/farm-inventory/${id(itemId)}`,'PATCH',body)).item,
  deleteInventoryItem: (itemId:string) => mutation<{ok:true}>(`/api/farm-inventory/${id(itemId)}`,'DELETE'),
  analyses: async (farmId:string) => (await apiRequest<{analyses:AgriculturalAnalysis[]}>('/api/farm-analyses'+query({farmId}))).analyses,
  createAnalysis: async (body:Partial<AgriculturalAnalysis>&Pick<AgriculturalAnalysis,'farmId'|'type'|'sampledAt'>) => (await mutation<{analysis:AgriculturalAnalysis}>('/api/farm-analyses','POST',body)).analysis,
  diagnoses: async (problemId:string) => (await apiRequest<{sessions:DiagnosisSession[]}>(`/api/farm-problems/${id(problemId)}/diagnoses`)).sessions,
  saveDiagnosis: async (body:Partial<DiagnosisSession>&Pick<DiagnosisSession,'farmId'>) => (await mutation<{session:DiagnosisSession}>('/api/diagnosis-sessions','POST',body)).session,
  search: (value:string) => apiRequest<Record<string,unknown[]>>('/api/my-farm/search'+query({q:value})),
  report: (farmId:string,from:string,to:string) => apiRequest<FarmReport>('/api/my-farm/report'+query({farmId,from,to})),
};

export type QueuedFarmMutation = { id:string; ownerId:string; kind:'task'|'complete_task'|'irrigation'|'operation'|'problem'|'harvest'|'note'|'checkin'|'stage_confirmation'|'expense'|'sale'; body:Record<string,unknown>; queuedAt:number };
export async function runQueuedFarmMutation(item:QueuedFarmMutation) {
  const path=item.kind==='task'?'/api/farm-tasks':item.kind==='complete_task'?`/api/farm-tasks/${id(String(item.body.taskId))}/complete`:item.kind==='irrigation'?'/api/irrigation-records':item.kind==='operation'?'/api/farm-operations':item.kind==='problem'?'/api/farm-problems':item.kind==='harvest'?'/api/harvest-records':item.kind==='note'?'/api/farm-notes':item.kind==='checkin'?`/api/crops/${id(String(item.body.cropId))}/check-in`:item.kind==='stage_confirmation'?`/api/crops/${id(String(item.body.cropId))}/stage-confirmation`:item.kind==='expense'?'/api/farm-expenses':'/api/farm-sales';
  return apiRequest(path,{method:'POST',body:item.body,headers:{'Idempotency-Key':item.id}});
}
