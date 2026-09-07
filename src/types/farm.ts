export type AreaUnit = 'm2' | 'hectare' | 'acre';
export type FarmType = 'farm' | 'greenhouse' | 'home_garden' | 'rooftop' | 'project' | 'other';
export type ZoneType = 'open_field' | 'greenhouse' | 'shade_house' | 'garden' | 'nursery' | 'raised_bed' | 'pots' | 'other';
export type GrowthStage = 'seedling' | 'vegetative' | 'flowering' | 'fruit_set' | 'production' | 'harvest' | 'finished';
export type CropStatus = 'planned' | 'planted' | 'active' | 'harvesting' | 'completed' | 'stopped';
export type FarmTaskStatus = 'scheduled' | 'due' | 'completed' | 'missed' | 'cancelled';
export type FarmTaskPriority = 'normal' | 'important' | 'urgent';
export type FarmTaskType = 'irrigation' | 'fertilization' | 'crop_inspection' | 'pest_inspection' | 'disease_inspection' | 'planting' | 'transplanting' | 'pruning' | 'training' | 'treatment' | 'maintenance' | 'harvest' | 'soil_test' | 'water_test' | 'problem_follow_up' | 'custom';
export type FarmProblemStatus = 'new' | 'investigating' | 'action_required' | 'monitoring' | 'improving' | 'resolved' | 'reopened';
export type FarmProblemSeverity = 'mild' | 'medium' | 'severe';

export type Farm = {
  id: string; name: string; type: FarmType; emirate: string; region: string;
  area: number | null; areaM2: number | null; areaUnit: AreaUnit | null;
  location: { latitude: number; longitude: number } | null; notes: string;
  mainImage: string | null; version: number; createdAt: string; updatedAt: string;
  zoneCount?: number; activeCropCount?: number; dueTaskCount?: number; activeProblemCount?: number;
};
export type FarmDraft = Pick<Farm, 'name' | 'type'> & Partial<Pick<Farm, 'emirate' | 'region' | 'area' | 'areaUnit' | 'location' | 'notes'>>;
export type FarmZone = {
  id:string; farmId:string; name:string; type:ZoneType; area:number|null; areaM2:number|null;
  areaUnit:AreaUnit|null; soilType:'sandy'|'clay'|'loam'|'mixed'|'unknown'|null;
  irrigationSystem:'drip'|'sprinkler'|'manual'|'pivot'|'other'|null;
  waterSource:'network'|'well'|'tank'|'treated'|'other'|null; notes:string;
  version:number; createdAt:string; updatedAt:string;
};
export type CropCycle = {
  id:string; farmId:string; zoneId:string|null; cropName:string; cropId:string|null;
  variety:string; varietyId:string|null; plantingDate:string|null; transplantDate:string|null;
  expectedHarvestDate:string|null; actualHarvestDate:string|null; area:number|null; areaM2:number|null;
  areaUnit:AreaUnit|null; plantCount:number|null; growthStage:GrowthStage; status:CropStatus;
  notes:string; version:number; createdAt:string; updatedAt:string;
};
export type RecurrenceRule = { frequency:'daily'|'interval_days'|'weekly'|'custom'; interval?:number; label?:string };
export type FarmTask = {
  id:string; farmId:string; zoneId:string|null; cropCycleId:string|null; problemId:string|null;
  type:FarmTaskType; title:string; description:string; dueAt:string; completedAt:string|null;
  completionNotes:string; actualMinutes:number|null; result:string; status:FarmTaskStatus;
  priority:FarmTaskPriority; recurrenceRule:RecurrenceRule|null; source:'user'|'problem_follow_up'|'system';
  version:number; createdAt:string; updatedAt:string;
};
export type IrrigationRecord = { id:string; farmId:string; zoneId:string; cropCycleId:string|null; startedAt:string; durationMinutes:number|null; waterVolumeLiters:number|null; method:'drip'|'sprinkler'|'manual'|'pivot'|'other'; notes:string; createdAt:string; updatedAt:string };
export type FarmOperation = { id:string; farmId:string; zoneId:string|null; cropCycleId:string|null; type:'irrigation'|'fertilization'|'spraying'|'pruning'|'harvest'|'inspection'|'planting'|'maintenance'|'note'|'other'; performedAt:string; productId:number|null; productNameSnapshot:string|null; quantity:number|null; unit:string|null; applicationMethod:string|null; notes:string; source:'user_recorded'|'mig_farm_verified'; createdAt:string };
export type FarmProblem = { id:string; farmId:string; zoneId:string|null; cropCycleId:string|null; category:'crop'|'soil'|'irrigation'|'water'|'pest'|'disease'|'nutrition'|'growth'|'equipment'|'other'; title:string; description:string; severity:FarmProblemSeverity; status:FarmProblemStatus; firstObservedAt:string; lastFollowUpAt:string|null; resolvedAt:string|null; suspectedCause:string|null; verifiedCause:string|null; confirmedBy:string|null; confirmedAt:string|null; version:number; createdAt:string; updatedAt:string };
export type FarmProblemUpdate = { id:string; problemId:string; condition:'better'|'same'|'worse'|'note'|'resolved'|'reopened'; notes:string; createdAt:string };
export type FarmMedia = { id:string; type:'farm'|'crop'|'problem'|'follow_up'|'harvest'|'analysis'|'note'; url:string; thumbnailUrl:string|null; capturedAt:string; notes:string; createdAt:string };
export type HarvestRecord = { id:string; farmId:string; zoneId:string|null; cropCycleId:string; harvestedAt:string; quantity:number; unit:'kg'|'ton'|'box'|'piece'|'custom'; customUnit:string|null; qualityNotes:string; createdAt:string };
export type DiagnosisSession = { id:string; farmId:string; zoneId:string|null; cropCycleId:string|null; problemId:string|null; observations:string[]; questions:string[]; answers:Record<string,string>; possibleCauses:string[]; recommendedInspections:string[]; verifiedDiagnosis:string|null; confirmedBy:string|null; confirmedAt:string|null; reviewStatus:'waiting_review'|'reviewed'|'needs_more_information'|'resolved'; createdAt:string; updatedAt:string };
export type FarmInventoryItem = { id:string; farmId:string; productId:number|null; productNameSnapshot:string; category:string; quantity:number|null; unit:string|null; notes:string; createdAt:string; updatedAt:string };
export type AgriculturalAnalysis = { id:string; farmId:string; zoneId:string|null; type:'soil'|'water'; sampledAt:string; labName:string|null; results:Partial<Record<'pH'|'EC'|'salinity'|'organicMatter'|'N'|'P'|'K'|'Ca'|'Mg'|'Na'|'bicarbonate',number>>; notes:string; documentUrl:string|null; createdAt:string };
export type FarmDashboard = { farms:Farm[]; tasks:FarmTask[]; problems:FarmProblem[]; crops:CropCycle[]; operations:FarmOperation[]; weather:{available:false;reason:'weather_provider_not_configured'}; generatedAt:string };
export type FarmProblemDetail = { problem:FarmProblem; updates:FarmProblemUpdate[]; media:FarmMedia[] };
export type FarmTimelineEvent = { eventType:'crop_created'|'operation'|'irrigation'|'problem'|'harvest'; eventAt:string; id?:string } & Record<string,unknown>;
export type FarmReport = {
  farm:Farm;
  period:{from:string;to:string};
  facts:{crops:number;operations:number;irrigations:number;tasksCompleted:number;problemsResolved:number;harvests:Array<{unit:HarvestRecord['unit'];customUnit:string|null;quantity:number}>};
  labels:{records:'user_recorded_data';ai:'ai_observation';recommendations:'verified_recommendation';engineer:'human_engineer_review'};
};
