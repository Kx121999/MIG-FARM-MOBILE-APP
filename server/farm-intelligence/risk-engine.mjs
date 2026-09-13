import { evaluateConfidence } from './confidence.mjs';

const RISK_TYPES = new Set(['WEATHER', 'IRRIGATION', 'CROP_STAGE', 'PROBLEM_FOLLOW_UP', 'DATA_QUALITY', 'HARVEST', 'SENSOR', 'DISEASE_CONDITIONS']);

export function buildRisks({ command, anomalies = [], providerStatus, now = new Date() } = {}) {
  const risks = [];
  for (const action of command?.priorities || []) {
    const riskType = action.kind === 'irrigation_record_gap' ? 'IRRIGATION'
      : action.kind === 'stage_confirmation' ? 'CROP_STAGE'
        : action.kind?.includes('problem') ? 'PROBLEM_FOLLOW_UP'
          : action.kind === 'harvest_window' ? 'HARVEST'
            : action.kind === 'missing_information' || action.kind?.includes('task') ? 'DATA_QUALITY' : null;
    if (!riskType) continue;
    risks.push(makeRisk({
      id: `risk:${action.id}`, riskType,
      severity: action.priority === 'critical' ? 'critical' : action.priority === 'high' ? 'high' : 'medium',
      titleAr: action.titleAr, titleEn: action.titleEn, reasonAr: action.reasonAr, reasonEn: action.reasonEn,
      evidence: [{ source: action.source, entityId: action.entityId, cropCycleId: action.cropCycleId, dueAt: action.dueAt }],
      requiredAction: action.action, sourceIds: action.sourceIds || [],
      confidence: action.source?.includes('verified')
        ? evaluateConfidence({ verifiedSources: 1, observations: 1, completeness: 'attention' })
        : evaluateConfidence({ observations: 1, completeness: 'attention' }),
      now,
    }));
  }
  for (const anomaly of anomalies) {
    const riskType = anomaly.type.startsWith('irrigation') ? 'IRRIGATION' : anomaly.type.startsWith('sensor') ? 'SENSOR' : 'DATA_QUALITY';
    risks.push(makeRisk({
      id: `risk:${anomaly.id}`, riskType, severity: anomaly.severity,
      titleAr: anomaly.titleAr, titleEn: anomaly.titleEn, reasonAr: anomaly.reasonAr, reasonEn: anomaly.reasonEn,
      evidence: [anomaly.evidence], requiredAction: anomaly.requiredAction, sourceIds: [], confidence: anomaly.confidence, now,
    }));
  }
  if (providerStatus?.weather?.status === 'not_configured') {
    risks.push(makeRisk({
      id: 'risk:weather-provider-missing', riskType: 'DATA_QUALITY', severity: 'low',
      titleAr: 'الطقس الحي غير متصل', titleEn: 'Live weather is not connected',
      reasonAr: 'لن تُنشأ مخاطر طقس أو توقعات من بيانات وهمية.', reasonEn: 'No weather risks or forecasts will be generated from fabricated data.',
      evidence: [{ providerStatus: 'not_configured' }], requiredAction: 'configure_weather_provider', sourceIds: [],
      confidence: { level: 'INSUFFICIENT_DATA', reasons: ['provider_unavailable'] }, now,
    }));
  }
  return deduplicate(risks).sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id));
}

export function buildDecisionCards(risks, language = 'en') {
  const ar = language === 'ar';
  return risks.slice(0, 8).map((risk) => ({
    id: `decision:${risk.id}`, riskId: risk.id,
    what: ar ? risk.titleAr : risk.titleEn,
    why: ar ? risk.reasonAr : risk.reasonEn,
    do: actionLabel(risk.requiredAction, ar),
    recheck: ar ? 'راجع اليوم أو في الموعد المسجل.' : 'Check today or at the recorded due time.',
    severity: risk.severity, confidence: risk.confidence, sourceIds: risk.sourceIds,
  }));
}

export function pesticideSafetyGate(input = {}) {
  const required = ['uaeRegistrationReference', 'targetCropOnLabel', 'targetPestOnLabel', 'verifiedLabelRate'];
  const missing = required.filter((key) => !input[key]);
  if (input.phiApplicable !== false && !input.phi) missing.push('phi');
  if (input.reiApplicable !== false && !input.rei) missing.push('rei');
  if (missing.length || input.labelVerified !== true) {
    return {
      status: 'blocked',
      missing: [...new Set(input.labelVerified === true ? missing : [...missing, 'verified_label'])],
      recommendation: null,
      messageAr: 'لا يمكن عرض توصية مبيد تجاري دون تسجيل إماراتي وملصق موثّق كامل.',
      messageEn: 'A commercial pesticide recommendation requires UAE registration and a complete verified label.',
    };
  }
  return { status: 'label_information_available', recommendation: null, labelInformation: input, offLabelUseAllowed: false };
}

function makeRisk(input) {
  if (!RISK_TYPES.has(input.riskType)) throw new Error('invalid_risk_type');
  return {
    id: input.id, riskType: input.riskType, severity: input.severity,
    titleAr: input.titleAr, titleEn: input.titleEn, reasonAr: input.reasonAr, reasonEn: input.reasonEn,
    evidence: input.evidence, requiredAction: input.requiredAction, sourceIds: input.sourceIds,
    confidence: input.confidence, createdAt: new Date(input.now).toISOString(), recheckAt: null,
    diagnosis: null, classification: 'risk_not_diagnosis',
  };
}

function actionLabel(action, ar) {
  const labels = {
    record_irrigation: ['تحقق من حدوث الري وسجله.', 'Check whether irrigation occurred and record it.'],
    check_whether_irrigation_occurred_and_record_it: ['تحقق من حدوث الري وسجله.', 'Check whether irrigation occurred and record it.'],
    follow_up_problem: ['حدّث متابعة المشكلة.', 'Update the problem follow-up.'],
    confirm_stage: ['أكد المرحلة التي تراها الآن.', 'Confirm the stage you observe now.'],
    complete_crop_data: ['أكمل بيانات المحصول الناقصة.', 'Complete the missing crop data.'],
    review_expense_record: ['راجع قيمة المصروف الأخير.', 'Review the latest expense value.'],
    review_overdue_tasks: ['راجع المهام المتأخرة.', 'Review overdue tasks.'],
    check_sensor_and_measurement: ['افحص الحساس وأعد القياس عند الحاجة.', 'Check the sensor and repeat the measurement if needed.'],
    configure_weather_provider: ['اربط مزود طقس حقيقي عند توفره.', 'Connect a real weather provider when available.'],
  };
  return labels[action]?.[ar ? 0 : 1] || (ar ? 'راجع السجل المرتبط.' : 'Review the related record.');
}

function deduplicate(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
const severityRank = (value) => ({ critical: 0, high: 1, medium: 2, low: 3 }[value] ?? 4);
