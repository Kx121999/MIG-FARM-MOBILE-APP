import { evaluateConfidence, dataFreshness } from './confidence.mjs';

const DAY = 86_400_000;

export function detectAnomalies({ irrigations = [], tasks = [], problems = [], expenses = [], sensors = [], now = new Date() } = {}) {
  return [
    detectIrrigationIntervalAnomaly(irrigations, now),
    detectTaskCompletionAnomaly(tasks, now),
    detectProblemDurationAnomaly(problems, now),
    detectExpenseAnomaly(expenses),
    ...detectSensorAnomalies(sensors, now),
  ].filter(Boolean).sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id));
}

export function detectIrrigationIntervalAnomaly(records, now = new Date()) {
  const dates = records.map((item) => dateValue(item.startedAt || item.started_at)).filter(Number.isFinite).sort((a, b) => b - a);
  if (dates.length < 4) return null;
  const historicalIntervals = [];
  for (let index = 1; index < dates.length - 1; index += 1) historicalIntervals.push(Math.abs(dates[index] - dates[index + 1]) / DAY);
  if (historicalIntervals.length < 2) return null;
  const personalMedianDays = median(historicalIntervals);
  const currentGapDays = Math.max(0, (dateValue(now) - dates[0]) / DAY);
  if (!(currentGapDays > Math.max(personalMedianDays * 2, personalMedianDays + 1))) return null;
  return {
    id: 'anomaly:irrigation-interval', type: 'irrigation_interval_changed', severity: 'medium',
    titleAr: 'تغير نمط تسجيل الري', titleEn: 'Irrigation logging pattern changed',
    reasonAr: `آخر تسجيل منذ ${round(currentGapDays)} يوم، بينما وسيط تاريخ مزرعتك ${round(personalMedianDays)} يوم.`,
    reasonEn: `The latest record is ${round(currentGapDays)} day(s) old versus your farm median of ${round(personalMedianDays)} day(s).`,
    evidence: { currentGapDays: round(currentGapDays), personalMedianDays: round(personalMedianDays), records: dates.length, basis: 'YOUR_FARM_HISTORY' },
    requiredAction: 'check_whether_irrigation_occurred_and_record_it', agronomicConclusion: null,
    confidence: evaluateConfidence({ observations: dates.length, completeness: 'good' }),
  };
}

export function detectTaskCompletionAnomaly(tasks, now = new Date()) {
  const nowMs = dateValue(now);
  const recent = tasks.filter((task) => inWindow(task.dueAt || task.due_at, nowMs - 14 * DAY, nowMs));
  const baseline = tasks.filter((task) => inWindow(task.dueAt || task.due_at, nowMs - 42 * DAY, nowMs - 14 * DAY));
  if (recent.length < 3 || baseline.length < 5) return null;
  const completionRate = (items) => items.filter((task) => task.status === 'completed' || task.completedAt || task.completed_at).length / items.length;
  if (!(completionRate(baseline) - completionRate(recent) >= 0.3)) return null;
  return {
    id: 'anomaly:task-completion', type: 'task_completion_changed', severity: 'low',
    titleAr: 'انخفض إكمال المهام مقارنة بتاريخ مزرعتك', titleEn: 'Task completion changed from your farm history',
    reasonAr: 'معدل آخر أسبوعين أقل من الفترة السابقة المسجلة.', reasonEn: 'The last two weeks are below the previously recorded period.',
    evidence: { recentCompleted: completed(recent), recentTotal: recent.length, baselineCompleted: completed(baseline), baselineTotal: baseline.length, basis: 'YOUR_FARM_HISTORY' },
    requiredAction: 'review_overdue_tasks', agronomicConclusion: null,
    confidence: evaluateConfidence({ observations: recent.length + baseline.length, completeness: 'good' }),
  };
}

export function detectProblemDurationAnomaly(problems, now = new Date()) {
  const resolvedDurations = problems.filter((item) => item.resolvedAt || item.resolved_at).map((item) => durationDays(item.firstObservedAt || item.first_observed_at || item.createdAt || item.created_at, item.resolvedAt || item.resolved_at)).filter(Number.isFinite);
  const open = problems.filter((item) => !['resolved', 'closed'].includes(item.status));
  if (resolvedDurations.length < 3 || !open.length) return null;
  const baseline = median(resolvedDurations);
  const outlier = open.map((item) => ({ item, days: durationDays(item.firstObservedAt || item.first_observed_at || item.createdAt || item.created_at, now) })).filter(({ days }) => Number.isFinite(days) && days > Math.max(baseline * 2, baseline + 2)).sort((a, b) => b.days - a.days)[0];
  if (!outlier) return null;
  return {
    id: `anomaly:problem-duration:${outlier.item.id}`, type: 'problem_open_longer_than_personal_pattern', severity: 'medium',
    titleAr: 'المشكلة مفتوحة أطول من نمط مزرعتك', titleEn: 'Problem is open longer than your farm pattern',
    reasonAr: 'هذه مقارنة زمنية بسجلاتك وليست حكمًا زراعيًا.', reasonEn: 'This is a timing comparison to your records, not an agronomic conclusion.',
    evidence: { openDays: round(outlier.days), personalMedianResolutionDays: round(baseline), completedProblems: resolvedDurations.length, basis: 'YOUR_FARM_HISTORY' },
    requiredAction: 'follow_up_problem', agronomicConclusion: null,
    confidence: evaluateConfidence({ observations: resolvedDurations.length, completeness: 'good' }),
  };
}

export function detectExpenseAnomaly(expenses) {
  const ordered = expenses.filter((item) => positive(item.amountMinor ?? item.amount_minor)).sort((a, b) => dateValue(b.occurredAt || b.occurred_at || b.createdAt || b.created_at) - dateValue(a.occurredAt || a.occurred_at || a.createdAt || a.created_at));
  if (ordered.length < 5) return null;
  const current = Number(ordered[0].amountMinor ?? ordered[0].amount_minor);
  const baseline = median(ordered.slice(1).map((item) => Number(item.amountMinor ?? item.amount_minor)));
  if (!(current > baseline * 2)) return null;
  return {
    id: `anomaly:expense:${ordered[0].id || 'latest'}`, type: 'expense_spike', severity: 'low',
    titleAr: 'مصروف أعلى من نمط السجلات السابقة', titleEn: 'Expense differs from prior records',
    reasonAr: 'القيمة الأخيرة أعلى من وسيط مصروفات مزرعتك المسجلة.', reasonEn: 'The latest value is above the median of your recorded farm expenses.',
    evidence: { currentAmountMinor: current, personalMedianAmountMinor: round(baseline), records: ordered.length, basis: 'YOUR_FARM_HISTORY' },
    requiredAction: 'review_expense_record', agronomicConclusion: null,
    confidence: evaluateConfidence({ observations: ordered.length, completeness: 'good' }),
  };
}

export function detectSensorAnomalies(readings, now = new Date()) {
  const groups = new Map();
  for (const item of readings) {
    const key = `${item.deviceId || item.device_id}:${item.sensorType || item.sensor_type}:${item.unit}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const anomalies = [];
  for (const [key, items] of groups) {
    const valid = items.filter((item) => item.quality !== 'invalid' && Number.isFinite(Number(item.value))).sort((a, b) => dateValue(b.observedAt || b.observed_at) - dateValue(a.observedAt || a.observed_at));
    if (!valid.length) continue;
    const freshness = dataFreshness(valid[0].observedAt || valid[0].observed_at, now);
    if (freshness.status === 'stale') anomalies.push(sensorResult(key, 'sensor_reading_stale', 'medium', valid, freshness));
    if (valid.length < 5) continue;
    const baseline = valid.slice(1, 11).map((item) => Number(item.value));
    const center = median(baseline);
    const mad = median(baseline.map((value) => Math.abs(value - center)));
    if (mad > 0 && Math.abs(Number(valid[0].value) - center) > mad * 4) anomalies.push(sensorResult(key, 'sensor_personal_baseline_deviation', 'medium', valid, freshness, { personalMedian: center, medianAbsoluteDeviation: mad }));
  }
  return anomalies;
}

function sensorResult(key, type, severity, items, freshness, extra = {}) {
  return {
    id: `anomaly:${type}:${key}`, type, severity,
    titleAr: type === 'sensor_reading_stale' ? 'قراءة الحساس قديمة' : 'قراءة مختلفة عن الخط الأساسي الشخصي',
    titleEn: type === 'sensor_reading_stale' ? 'Sensor reading is stale' : 'Sensor reading differs from personal baseline',
    reasonAr: 'هذا تنبيه جودة بيانات وليس تشخيصًا للمحصول.', reasonEn: 'This is a data-quality alert, not a crop diagnosis.',
    evidence: { latestValue: Number(items[0].value), unit: items[0].unit, records: items.length, freshness, basis: 'YOUR_FARM_HISTORY', ...extra },
    requiredAction: 'check_sensor_and_measurement', agronomicConclusion: null,
    confidence: evaluateConfidence({ observations: items.length, completeness: 'good', freshness: freshness.status }),
  };
}

export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
const completed = (items) => items.filter((item) => item.status === 'completed' || item.completedAt || item.completed_at).length;
const dateValue = (value) => new Date(value).getTime();
const durationDays = (from, to) => (dateValue(to) - dateValue(from)) / DAY;
const inWindow = (value, from, to) => { const time = dateValue(value); return Number.isFinite(time) && time >= from && time < to; };
const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const round = (value) => Number(Number(value).toFixed(1));
const severityRank = (value) => ({ high: 0, medium: 1, low: 2 }[value] ?? 3);
