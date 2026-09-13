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
export type FarmProblem = { id:string; farmId:string; zoneId:string|null; cropCycleId:string|null; category:'crop'|'soil'|'irrigation'|'water'|'pest'|'disease'|'nutrition'|'growth'|'equipment'|'other'; title:string; description:string; severity:FarmProblemSeverity; status:FarmProblemStatus; firstObservedAt:string; lastFollowUpAt:string|null; nextFollowUpAt?:string|null; resolvedAt:string|null; suspectedCause:string|null; verifiedCause:string|null; confirmedBy:string|null; confirmedAt:string|null; version:number; createdAt:string; updatedAt:string };
export type FarmProblemUpdate = { id:string; problemId:string; condition:'better'|'same'|'worse'|'note'|'resolved'|'reopened'; notes:string; createdAt:string };
export type FarmMedia = { id:string; type:'farm'|'crop'|'problem'|'follow_up'|'harvest'|'analysis'|'note'; url:string; thumbnailUrl:string|null; capturedAt:string; notes:string; createdAt:string };
export type HarvestRecord = { id:string; farmId:string; zoneId:string|null; cropCycleId:string; harvestedAt:string; quantity:number; unit:'kg'|'ton'|'box'|'piece'|'custom'; customUnit:string|null; qualityNotes:string; createdAt:string };
export type DiagnosisSession = { id:string; farmId:string; zoneId:string|null; cropCycleId:string|null; problemId:string|null; observations:string[]; questions:string[]; answers:Record<string,string>; possibleCauses:string[]; recommendedInspections:string[]; verifiedDiagnosis:string|null; confirmedBy:string|null; confirmedAt:string|null; reviewStatus:'waiting_review'|'reviewed'|'needs_more_information'|'resolved'; createdAt:string; updatedAt:string };
export type FarmInventoryItem = { id:string; farmId:string; productId:number|null; productNameSnapshot:string; category:string; quantity:number|null; minimumQuantity?:number|null; expiresAt?:string|null; status?:'available'|'low_stock'|'out_of_stock'|'expiring_soon'; unit:string|null; notes:string; createdAt:string; updatedAt:string };
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

export type KnowledgeStatus = 'draft' | 'verified' | 'review_required' | 'deprecated';
export type KnowledgeSource = {
  id:string; authority:string; titleAr:string; titleEn:string; url:string;
  jurisdiction:string; publishedAt:string|null; reviewedAt:string; version:string|null; status:'verified';
};
export type CropSpacingProfile = {
  id:string; productionSystem:string; plantingMethod:string; rowSpacingCm:number;
  plantSpacingCm:number; plantsPerStation:number; usableAreaPercent:number;
  notesAr:string; notesEn:string; reviewedAt:string; status:'verified'; source:KnowledgeSource;
};
export type CropGrowthStageProfile = {
  id:string; key:string; nameAr:string; nameEn:string; startDay:number; endDay:number;
  checksAr:string[]; checksEn:string[]; reviewedAt:string; status:'verified'; source:KnowledgeSource;
};
export type CropKnowledgeProfile = {
  id:string; slug:string; nameAr:string; nameEn:string; scientificName:string|null;
  aliases:string[]; summaryAr:string; summaryEn:string; productionSystems:string[];
  climateTags:string[]; reviewedAt:string; status:'verified'; source:KnowledgeSource;
  spacingProfiles?:CropSpacingProfile[]; growthStages?:CropGrowthStageProfile[];
};
export type UAERegulation = {
  id:string; slug:string; category:string; titleAr:string; titleEn:string;
  summaryAr:string; summaryEn:string; effectiveAt:string|null; reviewedAt:string;
  status:'verified'; source:KnowledgeSource;
};
export type CalculationOrigin = 'verified_profile' | 'user_supplied' | 'farm_record';
export type PlantPopulationResult = {
  plantCount:number; stationCount:number; usableAreaM2:number;
  spacing:{rowCm:number;plantCm:number}; plantsPerStation:number;
  dataOrigin:CalculationOrigin; resultType:'calculated_estimate';
};
export type IrrigationRuntimeResult = {
  runtimeMinutes:number; totalFlowLitersPerHour:number; targetVolumeLiters:number;
  dataOrigin:'user_supplied'; resultType:'calculated_estimate'; advisory:false;
};
export type GreenhouseLayoutResult = {
  bedCount:number; growingAreaM2:number; circulationAreaM2:number; utilizationPercent:number;
  inputs:{lengthM:number;widthM:number;bedWidthM:number;aisleWidthM:number};
  dataOrigin:'user_supplied'; resultType:'calculated_estimate';
};
export type GuidedDiagnosisResult = {
  status:'possible_causes_found'|'no_verified_match'; diagnosis:null; verifiedOnly:true;
  possibleCauses:Array<{causeType:string;possibleCauseAr:string;possibleCauseEn:string;inspectionChecksAr:string[];inspectionChecksEn:string[];source:KnowledgeSource}>;
  disclaimerAr:string; disclaimerEn:string;
};
export type CropPlan = {
  id:string; farmId:string; zoneId:string|null; cropProfileId:string; spacingProfileId:string|null; cropCycleId:string|null;
  crop?:{slug:string;nameAr:string;nameEn:string}; plantingDate:string; areaM2:number;
  productionSystem:string; plantingMethod:string; calculation:PlantPopulationResult|{resultType:'verified_data_unavailable';reason:string};
  status:'planned'|'active'|'completed'|'cancelled'; version:number; createdAt:string; updatedAt:string;
};

export type FarmCommandStatus = 'good' | 'attention' | 'critical' | 'no_data';
export type FarmActionPriority = 'critical' | 'high' | 'normal' | 'low';
export type FarmPriorityAction = {
  id:string; kind:'task_overdue'|'task_due'|'problem_followup'|'problem_open'|'irrigation_record_gap'|'stage_confirmation'|'harvest_window'|'missing_information'|'intelligence_check';
  priority:FarmActionPriority; farmId:string; cropCycleId:string|null; entityId:string|null;
  dueAt:string|null; titleAr:string; titleEn:string; reasonAr:string; reasonEn:string;
  action:'complete_task'|'follow_up_problem'|'record_irrigation'|'confirm_stage'|'record_harvest'|'complete_crop_data'|'open_farm_intelligence';
  source:'farm_record'|'verified_knowledge_and_farm_record'|'personal_history_anomaly_not_agronomic_diagnosis';
};
export type CropMissionStage = {
  ageDays:number|null;
  expected:{key:GrowthStage;nameAr:string;nameEn:string;expectedAt:string|null;source:'verified_knowledge'}|null;
  confirmed:{key:GrowthStage;confirmedAt:string;source:'user_data'}|null;
  next:{key:GrowthStage;nameAr:string;nameEn:string;expectedAt:string|null;source:'verified_knowledge'}|null;
  needsConfirmation:boolean; verifiedGuidanceAvailable:boolean;
};
export type IrrigationCommandStatus = {
  status:'good'|'attention'|'no_data'; lastRecordedAt:string|null; daysSinceRecord:number|null;
  averageIntervalDays:number|null; observationAr:string; observationEn:string; source:'farm_record';
};
export type CropMission = {
  id:string; crop:CropCycle; farm:{id:string;name:string}; zone:{id:string;name:string}|null;
  ageDays:number|null; stage:CropMissionStage; irrigation:IrrigationCommandStatus;
  lastOperation:FarmOperation|null; openProblems:FarmProblem[]; upcomingTask:FarmTask|null;
  harvest:{events:number;totals:Array<{unit:string;quantity:number;events:number}>;status:{status:'good'|'attention'|'no_data';expectedAt:string|null;actualStart:string|null;source:'farm_record'|'verified_knowledge'|'verified_knowledge_unavailable'}};
  photos:Array<{id:string;cropCycleId:string;type:string;url:string;thumbnailUrl:string|null;capturedAt:string;notes:string}>;
  financials:{currency:string;totalCostMinor:number;totalRevenueMinor:number;grossMarginMinor:number};
  completeness:{status:'good'|'attention'|'critical';missing:string[];source:'user_data'};
  status:'good'|'attention'|'critical'; dataOrigin:'farm_record';
};
export type FarmToday = {
  generatedAt:string; selectedFarmId:string|null; date:string; missions:CropMission[];
  priorities:FarmPriorityAction[]; topActions:FarmPriorityAction[];
  morningBrief:{tasks:number;problemFollowUps:number;irrigationChecks:number;activeProblems:number};
  status:{tasks:FarmCommandStatus;irrigationRecords:FarmCommandStatus;openProblems:FarmCommandStatus;cropProgress:FarmCommandStatus;dataCompleteness:FarmCommandStatus;harvestReadiness:FarmCommandStatus};
  weather:{weatherStatus:'not_configured'|'provider_not_implemented';messageAr?:string;messageEn?:string};
  source:'deterministic_farm_command'; emptyState?:'plan_first_crop'|null;
};
export type CropCheckInQuestion = { key:'irrigated'|'stageStarted'|'newProblem'|'harvested'; ar:string;en:string;options:string[];stageKey?:GrowthStage;source:string };
export type CropMissionResponse = { mission:CropMission; todayCheckIn:{id:string;date:string;answers:Record<string,string>;notes:string}|null; checkInQuestions:CropCheckInQuestion[] };
export type CommandTimelineEvent = { id:string;farmId:string;zoneId:string|null;cropCycleId:string;problemId:string|null;eventType:string;eventAt:string;payload:Record<string,unknown>;source:string };
export type WeeklyFarmReport = { period:{from:string;to:string};tasksCompleted:number;tasksOverdue:number;irrigationRecords:number;operations:number;problemsOpened:number;problemsResolved:number;stageChanges:number;photosAdded:number;harvests:Array<{unit:string;quantity:number;events:number}>;expensesMinor:number;salesMinor:number;currency:string;source:'farm_record' };
export type SeasonFarmReport = { cropCycleId:string;plantingDate:string|null;confirmedStages:Array<{stageKey:GrowthStage;confirmedAt:string}>;firstHarvestDate:string|null;lastHarvestDate:string|null;seasonDurationDays:number|null;harvests:Array<{unit:string;quantity:number;events:number}>;yieldPerM2Kg:number|null;irrigationRecords:number;problems:number;expensesMinor:number;revenueMinor:number;grossMarginMinor:number;costPerKgMinor:number|null;currency:string;source:'farm_record_calculation' };
export type FarmExpense = { id:string;farmId:string;cropCycleId:string|null;cropPlanId:string|null;category:string;amountMinor:number;currency:string;occurredAt:string;notes:string;createdAt:string };
export type FarmSale = { id:string;farmId:string;cropCycleId:string;soldAt:string;quantity:number;unit:string;unitPriceMinor:number;totalMinor:number;currency:string;buyerNotes:string;createdAt:string };

export type IntelligenceConfidence = { level:'HIGH'|'MEDIUM'|'LOW'|'INSUFFICIENT_DATA';reasons:string[] };
export type DataFreshness = { status:'fresh'|'stale'|'unavailable'|'invalid';ageMinutes:number|null;timestamp:string|null };
export type IntelligenceProviderStatus = {
  provider:string|null;status:'configured'|'not_configured'|'unavailable';configured:boolean;
  dataTimestamp:string|null;freshness:'fresh'|'stale'|'unavailable';messageAr:string;messageEn:string;
};
export type VerifiedKnowledgeSource = {
  id:string;organization:string;title:string;url:string;sourceType:string|null;country:string|null;
  authorityLevel:string|null;language:string|null;retrievedAt:string|null;lastVerifiedAt:string|null;
  license:string|null;productionAllowed:boolean;status:'verified'|'review_required';notes:string;
};
export type VerifiedKnowledgeRecord = {
  id:string;type:string;domain:string;crop:string|null;productionSystem:string|null;growthStage:string|null;
  country:string|null;jurisdiction:string|null;reviewStatus:'verified';productionAllowed:true;
  lastVerifiedAt:string|null;payload:Record<string,unknown>;sources:VerifiedKnowledgeSource[];dataStatus:'verified';
};
export type FarmIntelligenceRisk = {
  id:string;riskType:'WEATHER'|'IRRIGATION'|'CROP_STAGE'|'PROBLEM_FOLLOW_UP'|'DATA_QUALITY'|'HARVEST'|'SENSOR'|'DISEASE_CONDITIONS';
  severity:'critical'|'high'|'medium'|'low';titleAr:string;titleEn:string;reasonAr:string;reasonEn:string;
  evidence:Array<Record<string,unknown>>;requiredAction:string;sourceIds:string[];confidence:IntelligenceConfidence;
  createdAt:string;recheckAt:string|null;diagnosis:null;classification:'risk_not_diagnosis';
};
export type FarmIntelligenceAnomaly = {
  id:string;type:string;severity:'high'|'medium'|'low';titleAr:string;titleEn:string;reasonAr:string;reasonEn:string;
  evidence:Record<string,unknown>;requiredAction:string;agronomicConclusion:null;confidence:IntelligenceConfidence;
};
export type CropDigitalState = {
  cropId:string;farmId:string;zoneId:string|null;crop:string;variety:string|null;plantingDate:string|null;ageDays:number|null;
  expectedGrowthStage:Record<string,unknown>|null;confirmedGrowthStage:Record<string,unknown>|null;stageConfirmationRequired:boolean;
  activeTasks:FarmTask[];lastIrrigation:string|null;recentOperations:FarmOperation[];openProblems:FarmProblem[];
  photoHistory:Array<Record<string,unknown>>;harvestStatus:Record<string,unknown>|null;harvestTotals:Array<Record<string,unknown>>;
  expenses:number;sales:number;verifiedKnowledgeAvailability:{status:'verified_available'|'verified_data_unavailable';sourceIds:string[];lastVerifiedAt:string|null};
  weatherStatus:'configured'|'not_configured'|'unavailable';sensorStatus:'configured'|'not_configured'|'unavailable';riskFlags:string[];
  dataCompleteness:{status:'good'|'attention';missing:string[];why:Array<{field:string;reason:string}>};
  confidence:IntelligenceConfidence;freshness:Record<string,DataFreshness>;lastUpdatedAt:string;dataModel:'deterministic_crop_state';
};
export type FarmDecisionCard = {
  id:string;riskId:string;what:string;why:string;do:string;recheck:string;
  severity:FarmIntelligenceRisk['severity'];confidence:IntelligenceConfidence;sourceIds:string[];
};
export type FarmIntelligence = {
  generatedAt:string;farmId:string|null;
  brief:{titleAr:string;titleEn:string;summaryAr?:string;summaryEn?:string;taskCount?:number;riskCount:number;anomalyCount:number;cropCount:number;dataQualityOnly?:boolean};
  cropStates:CropDigitalState[];risks:FarmIntelligenceRisk[];anomalies:FarmIntelligenceAnomaly[];
  forecasts:Array<{cropId:string;crop:string;harvest:{status:'forecast_available'|'insufficient_data';expectedWindow:{from:string;to:string}|null;exactDate:null;basedOn:string[];confidence:IntelligenceConfidence;sourceIds?:string[]};yield:{status:'forecast_available'|'insufficient_data';range:{min:number;max:number}|null;basedOn:string[];confidence:IntelligenceConfidence;unit?:string;guaranteed?:false}}>;
  decisionCards:FarmDecisionCard[];upcoming:FarmDecisionCard[];
  providerStatus:{weather:IntelligenceProviderStatus;vision:IntelligenceProviderStatus;sensor:IntelligenceProviderStatus};
  notifications:Array<{id:string;riskId:string;deliveryStatus:'not_sent';requiresUserNotificationConsent:true}>;
  healthScore:null;healthScoreStatus:'not_calculated';diagnosis:null;model:'deterministic_verified_farm_intelligence_v5';
};
export type WaterQualityReference = {
  status:'reference_available'|'verified_data_unavailable';userMeasurement:{value:number;unit:'dS/m';source:'user_measurement';measuredAt:string|null};
  referenceClasses:VerifiedKnowledgeRecord[];cropReferences:VerifiedKnowledgeRecord[];interpretation:Record<string,unknown>|null;
  prescription:null;warningAr:string;warningEn:string;
};
export type VerifiedDiagnosisResult = {
  status:'possible_causes_found'|'no_verified_match';diagnosis:null;visionStatus:'not_configured';verifiedOnly:true;
  possibleCauses:Array<{causeType:string;possibleCauseAr:string;possibleCauseEn:string;inspectionChecksAr:string[];inspectionChecksEn:string[];source:VerifiedKnowledgeSource|null;confidence:'LOW';classification:'possible_cause_not_diagnosis'}>;
  disclaimerAr:string;disclaimerEn:string;
};
