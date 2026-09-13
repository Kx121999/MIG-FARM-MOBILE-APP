const DAY_MS = 86_400_000;

export const PRIORITY_ORDER = Object.freeze({ critical: 0, high: 1, normal: 2, low: 3 });

const time = (value) => value ? new Date(value).getTime() : Number.NaN;
const finite = (value) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const iso = (value) => value ? new Date(value).toISOString() : null;
const dayDiff = (from, to) => Math.max(0, Math.floor((time(to) - time(from)) / DAY_MS));
const localDay = (value) => new Date(value).toISOString().slice(0, 10);
const activeProblem = (problem) => problem.status !== 'resolved';
const incompleteTask = (task) => !['completed', 'cancelled'].includes(task.status);
const byNewest = (field) => (a, b) => time(b[field]) - time(a[field]);

export function evaluateTasks(tasks = [], now = new Date()) {
  const nowMs = time(now);
  return tasks.filter(incompleteTask).map((task) => {
    const dueMs = time(task.dueAt || task.due_at);
    const overdueDays = Number.isFinite(dueMs) && dueMs < nowMs ? Math.max(0, Math.floor((nowMs - dueMs) / DAY_MS)) : 0;
    const dueToday = Number.isFinite(dueMs) && localDay(dueMs) === localDay(nowMs);
    const priority = overdueDays >= 2 || (overdueDays > 0 && task.priority === 'urgent')
      ? 'critical'
      : overdueDays > 0 || task.priority === 'urgent'
        ? 'high'
        : dueToday
          ? 'normal'
          : 'low';
    return {
      id: `task:${task.id}`,
      kind: overdueDays > 0 ? 'task_overdue' : 'task_due',
      priority,
      farmId: task.farmId || task.farm_id,
      cropCycleId: task.cropCycleId || task.crop_cycle_id || null,
      entityId: task.id,
      dueAt: iso(dueMs),
      titleAr: overdueDays > 0 ? `أكمل مهمة متأخرة: ${task.title}` : task.title,
      titleEn: overdueDays > 0 ? `Complete overdue task: ${task.title}` : task.title,
      reasonAr: overdueDays > 0 ? `موعدها مضى منذ ${overdueDays || 1} يوم` : 'مطلوبة اليوم حسب سجلك',
      reasonEn: overdueDays > 0 ? `Due ${overdueDays || 1} day(s) ago` : 'Due today in your records',
      action: 'complete_task',
      source: 'farm_record',
    };
  });
}

export function evaluateOpenProblems(problems = [], now = new Date()) {
  const nowMs = time(now);
  return problems.filter(activeProblem).map((problem) => {
    const followUpMs = time(problem.nextFollowUpAt || problem.next_follow_up_at);
    const followUpDue = Number.isFinite(followUpMs) && followUpMs <= nowMs;
    const priority = problem.severity === 'severe' || problem.status === 'action_required'
      ? 'critical'
      : followUpDue || ['reopened', 'investigating'].includes(problem.status)
        ? 'high'
        : 'normal';
    return {
      id: `problem:${problem.id}`,
      kind: followUpDue ? 'problem_followup' : 'problem_open',
      priority,
      farmId: problem.farmId || problem.farm_id,
      cropCycleId: problem.cropCycleId || problem.crop_cycle_id || null,
      entityId: problem.id,
      dueAt: Number.isFinite(followUpMs) ? iso(followUpMs) : null,
      titleAr: followUpDue ? `تابع المشكلة: ${problem.title}` : problem.title,
      titleEn: followUpDue ? `Follow up: ${problem.title}` : problem.title,
      reasonAr: problem.severity === 'severe' ? 'مسجلة كمشكلة شديدة' : followUpDue ? 'حان موعد المتابعة المسجل' : 'مشكلة لم تُحل بعد',
      reasonEn: problem.severity === 'severe' ? 'Recorded as severe' : followUpDue ? 'Recorded follow-up is due' : 'Unresolved problem',
      action: 'follow_up_problem',
      source: 'farm_record',
    };
  });
}

export function evaluateIrrigationStatus(records = [], { now = new Date(), farmId = null, cropCycleId = null } = {}) {
  const startedAt = (item) => item.startedAt || item.started_at;
  const ordered = [...records].filter(startedAt).sort((a,b) => time(startedAt(b))-time(startedAt(a)));
  if (!ordered.length) {
    return {
      status: 'no_data', lastRecordedAt: null, daysSinceRecord: null, averageIntervalDays: null,
      observationAr: 'لم يتم تسجيل عمليات ري بعد.', observationEn: 'No irrigation records have been added yet.',
      source: 'farm_record',
    };
  }
  const lastRecordedAt = iso(startedAt(ordered[0]));
  const daysSinceRecord = dayDiff(lastRecordedAt, now);
  const intervals = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const interval = Math.abs(time(startedAt(ordered[index])) - time(startedAt(ordered[index + 1]))) / DAY_MS;
    if (Number.isFinite(interval) && interval > 0) intervals.push(interval);
  }
  const averageIntervalDays = intervals.length >= 2
    ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(1))
    : null;
  const recordingGap = averageIntervalDays !== null && daysSinceRecord > Math.max(averageIntervalDays * 1.5, averageIntervalDays + 1);
  return {
    status: recordingGap ? 'attention' : 'good',
    lastRecordedAt,
    daysSinceRecord,
    averageIntervalDays,
    source: 'farm_record',
    observationAr: recordingGap
      ? `قد يكون سجل الري متأخرًا؛ آخر تسجيل منذ ${daysSinceRecord} أيام مقارنة بمتوسط ${averageIntervalDays} يوم.`
      : `آخر تسجيل ري منذ ${daysSinceRecord} يوم.`,
    observationEn: recordingGap
      ? `Your irrigation record may be overdue; the last entry was ${daysSinceRecord} days ago versus a ${averageIntervalDays}-day average.`
      : `The last irrigation entry was ${daysSinceRecord} day(s) ago.`,
    ...(recordingGap ? {
      action: {
        id: `irrigation-gap:${cropCycleId || farmId}`,
        kind: 'irrigation_record_gap',
        priority: 'high',
        farmId,
        cropCycleId,
        entityId: null,
        dueAt: null,
        titleAr: 'راجع سجل الري',
        titleEn: 'Review irrigation records',
        reasonAr: 'نمط التسجيل الحالي أطول من تاريخ سجلاتك المعتاد',
        reasonEn: 'The current recording gap is longer than your usual history',
        action: 'record_irrigation',
        source: 'farm_record',
      },
    } : {}),
  };
}

export function evaluateDataCompleteness({ farm, crop, zone } = {}) {
  const missing = [];
  if (!farm?.areaM2 && !farm?.area_m2) missing.push('farm_area');
  if (!crop?.plantingDate && !crop?.planting_date) missing.push('planting_date');
  if (!crop?.areaM2 && !crop?.area_m2) missing.push('crop_area');
  if (!zone) missing.push('zone');
  return {
    status: missing.length === 0 ? 'good' : missing.length >= 3 ? 'critical' : 'attention',
    missing,
    source: 'user_data',
  };
}

export function evaluateGrowthStage({ crop, stageProfiles = [], confirmations = [], now = new Date() }) {
  const plantingDate = crop?.plantingDate || crop?.planting_date;
  const ageDays = plantingDate && time(plantingDate) <= time(now) ? dayDiff(plantingDate, now) : null;
  const verifiedStages = stageProfiles.filter((stage) => stage.status === 'verified').sort((a, b) => Number(a.startDay ?? a.start_day) - Number(b.startDay ?? b.start_day));
  const expected = ageDays === null ? null : verifiedStages.find((stage) => ageDays >= Number(stage.startDay ?? stage.start_day) && ageDays <= Number(stage.endDay ?? stage.end_day)) || null;
  const confirmedAt = (item) => item.confirmedAt || item.confirmed_at;
  const confirmed = [...confirmations].sort((a,b) => time(confirmedAt(b))-time(confirmedAt(a)))[0] || null;
  const expectedKey = expected?.key || expected?.stage_key || null;
  const confirmedKey = confirmed?.stageKey || confirmed?.stage_key || null;
  const needsConfirmation = Boolean(expectedKey && expectedKey !== confirmedKey);
  const nextIndex = expected ? verifiedStages.indexOf(expected) + 1 : -1;
  return {
    ageDays,
    expected: expected ? {
      key: expectedKey,
      nameAr: expected.nameAr || expected.name_ar,
      nameEn: expected.nameEn || expected.name_en,
      expectedAt: plantingDate ? iso(time(plantingDate) + Number(expected.startDay ?? expected.start_day) * DAY_MS) : null,
      source: 'verified_knowledge',
    } : null,
    confirmed: confirmed ? {
      key: confirmedKey,
      confirmedAt: iso(confirmed.confirmedAt || confirmed.confirmed_at),
      source: 'user_data',
    } : null,
    next: nextIndex > 0 && verifiedStages[nextIndex] ? {
      key: verifiedStages[nextIndex].key || verifiedStages[nextIndex].stage_key,
      nameAr: verifiedStages[nextIndex].nameAr || verifiedStages[nextIndex].name_ar,
      nameEn: verifiedStages[nextIndex].nameEn || verifiedStages[nextIndex].name_en,
      expectedAt: plantingDate ? iso(time(plantingDate) + Number(verifiedStages[nextIndex].startDay ?? verifiedStages[nextIndex].start_day) * DAY_MS) : null,
      source: 'verified_knowledge',
    } : null,
    needsConfirmation,
    verifiedGuidanceAvailable: verifiedStages.length > 0,
  };
}

export function evaluateHarvestStatus({ crop, stage, harvests = [], now = new Date() }) {
  const actualStart = harvests.map((item) => item.harvestedAt || item.harvested_at).filter(Boolean).sort()[0] || null;
  if (actualStart || ['harvesting','completed'].includes(crop.status)) return {status:'good',expectedAt:null,actualStart:iso(actualStart),source:'farm_record',action:null};
  const verifiedHarvest = stage.expected?.key === 'harvest' ? stage.expected : stage.next?.key === 'harvest' ? stage.next : null;
  if (!verifiedHarvest?.expectedAt) return {status:'no_data',expectedAt:null,actualStart:null,source:'verified_knowledge_unavailable',action:null};
  const daysUntil = Math.ceil((time(verifiedHarvest.expectedAt)-time(now))/DAY_MS);
  const approaching = daysUntil >= 0 && daysUntil <= 7;
  return {
    status:approaching?'attention':'good',expectedAt:verifiedHarvest.expectedAt,actualStart:null,source:'verified_knowledge',
    action:approaching?{id:`harvest-window:${crop.id}`,kind:'harvest_window',priority:daysUntil<=3?'high':'normal',farmId:crop.farmId||crop.farm_id,cropCycleId:crop.id,entityId:crop.id,dueAt:verifiedHarvest.expectedAt,titleAr:'راجع جاهزية الحصاد',titleEn:'Review harvest readiness',reasonAr:`مرحلة الحصاد الموثقة متوقعة خلال ${daysUntil} يوم`,reasonEn:`The verified harvest stage is expected in ${daysUntil} day(s)`,action:'record_harvest',source:'verified_knowledge_and_farm_record'}:null,
  };
}

export function buildCropMission(input, now = new Date()) {
  const { crop, farm, zone = null, tasks = [], problems = [], irrigations = [], operations = [], harvests = [], expenses = [], sales = [], photos = [], stageProfiles = [], confirmations = [] } = input;
  const stage = evaluateGrowthStage({ crop, stageProfiles, confirmations, now });
  const harvestStatus = evaluateHarvestStatus({crop,stage,harvests,now});
  const irrigation = evaluateIrrigationStatus(irrigations, { now, farmId: farm.id, cropCycleId: crop.id });
  const openProblems = problems.filter(activeProblem);
  const upcomingTask = tasks.filter(incompleteTask).sort((a, b) => time(a.dueAt || a.due_at) - time(b.dueAt || b.due_at))[0] || null;
  const harvestByUnit = Object.values(harvests.reduce((result, item) => {
    const unit = item.customUnit || item.custom_unit || item.unit;
    result[unit] ||= { unit, quantity: 0, events: 0 };
    result[unit].quantity += Number(item.quantity || 0);
    result[unit].events += 1;
    return result;
  }, {}));
  const totalCostMinor = expenses.reduce((sum, item) => sum + Number(item.amountMinor ?? item.amount_minor ?? 0), 0);
  const totalRevenueMinor = sales.reduce((sum, item) => sum + Number(item.totalMinor ?? item.total_minor ?? 0), 0);
  const completeness = evaluateDataCompleteness({ farm, crop, zone });
  const status = openProblems.some((item) => item.severity === 'severe' || item.status === 'action_required')
    ? 'critical'
    : irrigation.status === 'attention' || openProblems.length || tasks.some((item) => incompleteTask(item) && time(item.dueAt || item.due_at) < time(now))
      ? 'attention'
      : 'good';
  return {
    id: crop.id,
    crop,
    farm: { id: farm.id, name: farm.name },
    zone: zone ? { id: zone.id, name: zone.name } : null,
    ageDays: stage.ageDays,
    stage,
    irrigation,
    lastOperation: [...operations].sort((a,b) => time(b.performedAt || b.performed_at)-time(a.performedAt || a.performed_at))[0] || null,
    openProblems,
    upcomingTask,
    harvest: { events: harvests.length, totals: harvestByUnit, status:harvestStatus },
    photos: [...photos].sort((a,b) => time(b.capturedAt || b.captured_at)-time(a.capturedAt || a.captured_at)),
    financials: { currency: 'AED', totalCostMinor, totalRevenueMinor, grossMarginMinor: totalRevenueMinor - totalCostMinor },
    completeness,
    status,
    dataOrigin: 'farm_record',
  };
}

export function buildDailyPriorities(input, now = new Date()) {
  const taskActions = evaluateTasks(input.tasks, now).filter((item) => item.priority !== 'low');
  const problemActions = evaluateOpenProblems(input.problems, now);
  const irrigationActions = input.missions.map((mission) => mission.irrigation.action).filter(Boolean);
  const stageActions = input.missions.filter((mission) => mission.stage.needsConfirmation).map((mission) => ({
    id: `stage:${mission.id}`,
    kind: 'stage_confirmation',
    priority: 'normal',
    farmId: mission.crop.farmId || mission.crop.farm_id,
    cropCycleId: mission.id,
    entityId: mission.id,
    dueAt: mission.stage.expected?.expectedAt || null,
    titleAr: `أكد مرحلة ${mission.stage.expected?.nameAr || mission.crop.cropName || mission.crop.crop_name}`,
    titleEn: `Confirm ${mission.stage.expected?.nameEn || mission.crop.cropName || mission.crop.crop_name} stage`,
    reasonAr: 'مرحلة متوقعة من ملف معرفة موثّق وتحتاج تأكيدك',
    reasonEn: 'A stage expected from verified knowledge needs your confirmation',
    action: 'confirm_stage',
    source: 'verified_knowledge_and_farm_record',
  }));
  const harvestActions = input.missions.map((mission)=>mission.harvest.status.action).filter(Boolean);
  const dataActions = input.missions.filter((mission) => mission.completeness.missing.length).map((mission) => ({
    id: `data:${mission.id}`,
    kind: 'missing_information',
    priority: 'low',
    farmId: mission.crop.farmId || mission.crop.farm_id,
    cropCycleId: mission.id,
    entityId: mission.id,
    dueAt: null,
    titleAr: 'أكمل بيانات المحصول',
    titleEn: 'Complete crop information',
    reasonAr: `بيانات ناقصة: ${mission.completeness.missing.join(', ')}`,
    reasonEn: `Missing data: ${mission.completeness.missing.join(', ')}`,
    action: 'complete_crop_data',
    source: 'farm_record',
  }));
  return [...taskActions, ...problemActions, ...irrigationActions, ...stageActions, ...harvestActions, ...dataActions]
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || time(a.dueAt) - time(b.dueAt) || a.id.localeCompare(b.id));
}

export function buildFarmToday(input, now = new Date()) {
  const missions = input.missions || [];
  const priorities = buildDailyPriorities({ ...input, missions }, now);
  const topActions = priorities.slice(0, 5);
  const activeProblems = (input.problems || []).filter(activeProblem);
  const dueTasks = (input.tasks || []).filter((task) => incompleteTask(task) && time(task.dueAt || task.due_at) <= time(now) + DAY_MS);
  return {
    generatedAt: iso(now),
    selectedFarmId: input.selectedFarmId || null,
    date: localDay(now),
    missions,
    priorities,
    topActions,
    morningBrief: {
      tasks: dueTasks.length,
      problemFollowUps: priorities.filter((item) => item.kind === 'problem_followup').length,
      irrigationChecks: priorities.filter((item) => item.kind === 'irrigation_record_gap').length,
      activeProblems: activeProblems.length,
    },
    status: {
      tasks: dueTasks.some((task) => time(task.dueAt || task.due_at) < time(now)) ? 'attention' : dueTasks.length ? 'good' : 'no_data',
      irrigationRecords: missions.length ? (missions.some((mission) => mission.irrigation.status === 'attention') ? 'attention' : missions.every((mission) => mission.irrigation.status === 'no_data') ? 'no_data' : 'good') : 'no_data',
      openProblems: activeProblems.some((item) => item.severity === 'severe' || item.status === 'action_required') ? 'critical' : activeProblems.length ? 'attention' : 'good',
      cropProgress: missions.some((mission) => mission.stage.verifiedGuidanceAvailable) ? 'good' : 'no_data',
      dataCompleteness: missions.some((mission) => mission.completeness.status === 'critical') ? 'critical' : missions.some((mission) => mission.completeness.status === 'attention') ? 'attention' : missions.length ? 'good' : 'no_data',
      harvestReadiness: missions.some((mission) => mission.harvest.status.status === 'attention') ? 'attention' : missions.some((mission) => mission.harvest.status.status === 'good') ? 'good' : 'no_data',
    },
    weather: input.weather || { weatherStatus: 'not_configured' },
    source: 'deterministic_farm_command',
  };
}

export function buildWeeklyFarmReport(input) {
  const sumMinor = (items, field) => items.reduce((sum, item) => sum + Number(item[field] ?? 0), 0);
  return {
    period: input.period,
    tasksCompleted: input.tasks.filter((item) => item.completed_at || item.completedAt).length,
    tasksOverdue: input.tasks.filter((item) => incompleteTask(item) && time(item.due_at || item.dueAt) < time(input.period.to)).length,
    irrigationRecords: input.irrigations.length,
    operations: input.operations.length,
    problemsOpened: input.problems.length,
    problemsResolved: input.problemUpdates.filter((item) => item.condition === 'resolved').length,
    stageChanges: input.stageConfirmations.length,
    photosAdded: input.photos.length,
    harvests: groupQuantities(input.harvests),
    expensesMinor: sumMinor(input.expenses, 'amount_minor'),
    salesMinor: sumMinor(input.sales, 'total_minor'),
    currency: 'AED',
    source: 'farm_record',
  };
}

export function buildSeasonReport(input) {
  const harvests = groupQuantities(input.harvests);
  const kg = harvests.length === 1 && harvests[0].unit === 'kg' ? harvests[0].quantity : null;
  const areaM2 = finite(input.crop.area_m2 ?? input.crop.areaM2);
  const expensesMinor = input.expenses.reduce((sum, item) => sum + Number(item.amount_minor ?? item.amountMinor ?? 0), 0);
  const revenueMinor = input.sales.reduce((sum, item) => sum + Number(item.total_minor ?? item.totalMinor ?? 0), 0);
  const harvestDates = input.harvests.map((item) => item.harvested_at || item.harvestedAt).filter(Boolean).sort();
  const plantingDate = input.crop.planting_date || input.crop.plantingDate || null;
  const endDate = input.crop.actual_harvest_date || input.crop.actualHarvestDate || harvestDates.at(-1) || null;
  return {
    cropCycleId: input.crop.id,
    plantingDate,
    confirmedStages: input.stageConfirmations.map((item) => ({ stageKey: item.stage_key || item.stageKey, confirmedAt: iso(item.confirmed_at || item.confirmedAt) })),
    firstHarvestDate: harvestDates[0] || null,
    lastHarvestDate: harvestDates.at(-1) || null,
    seasonDurationDays: plantingDate && endDate ? dayDiff(plantingDate, endDate) : null,
    harvests,
    yieldPerM2Kg: kg !== null && areaM2 ? Number((kg / areaM2).toFixed(3)) : null,
    irrigationRecords: input.irrigations.length,
    problems: input.problems.length,
    expensesMinor,
    revenueMinor,
    grossMarginMinor: revenueMinor - expensesMinor,
    costPerKgMinor: kg ? Math.round(expensesMinor / kg) : null,
    notes: input.notes.map((item) => item.body),
    currency: 'AED',
    source: 'farm_record_calculation',
  };
}

function groupQuantities(items = []) {
  return Object.values(items.reduce((result, item) => {
    const unit = item.custom_unit || item.customUnit || item.unit;
    result[unit] ||= { unit, quantity: 0, events: 0 };
    result[unit].quantity += Number(item.quantity || 0);
    result[unit].events += 1;
    return result;
  }, {})).sort((a, b) => String(a.unit).localeCompare(String(b.unit)));
}
