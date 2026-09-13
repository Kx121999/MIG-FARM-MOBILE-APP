const providerState = (provider, status, messageAr, messageEn, details = {}) => ({
  provider,
  status,
  configured: status !== 'not_configured',
  dataTimestamp: null,
  freshness: 'unavailable',
  messageAr,
  messageEn,
  ...details,
});

export function createWeatherProvider(env = process.env) {
  if (!env.FARM_WEATHER_PROVIDER || !env.FARM_WEATHER_API_KEY) {
    const state = providerState(null, 'not_configured', 'بيانات الطقس الحية غير متصلة حاليًا.', 'Live weather data is not connected.');
    return missingProvider(state);
  }
  const state = providerState(env.FARM_WEATHER_PROVIDER, 'unavailable', 'مزود الطقس المحدد غير مدعوم في هذا الإصدار.', 'The configured weather provider is not supported in this build.');
  return missingProvider(state);
}

export function createVisionProvider(env = process.env) {
  if (!env.FARM_VISION_PROVIDER || !env.FARM_VISION_API_KEY) {
    const state = providerState(null, 'not_configured', 'تحليل الصور غير متصل.', 'Image analysis is not connected.');
    return { status: async () => state, analyze: async () => ({ ...state, observations: null, possibleCauses: [], diagnosis: null }) };
  }
  const state = providerState(env.FARM_VISION_PROVIDER, 'unavailable', 'مزود تحليل الصور غير مدعوم في هذا الإصدار.', 'The configured vision provider is not supported in this build.');
  return { status: async () => state, analyze: async () => ({ ...state, observations: null, possibleCauses: [], diagnosis: null }) };
}

export function createSensorProvider(env = process.env) {
  if (!env.FARM_SENSOR_PROVIDER || !env.FARM_SENSOR_API_KEY) {
    const state = providerState(null, 'not_configured', 'لا توجد حساسات مرتبطة.', 'No sensors are connected.');
    return { status: async () => state, readings: async () => ({ ...state, readings: [] }) };
  }
  const state = providerState(env.FARM_SENSOR_PROVIDER, 'unavailable', 'مزود الحساسات غير مدعوم في هذا الإصدار.', 'The configured sensor provider is not supported in this build.');
  return { status: async () => state, readings: async () => ({ ...state, readings: [] }) };
}

export function logProviderFailure({ provider, error, httpStatus = null, correlationId = null }, logger = console) {
  logger.error(JSON.stringify({
    event: 'farm_provider_failure',
    provider: provider || 'unknown',
    errorClass: error?.name || 'Error',
    httpStatus: Number.isInteger(httpStatus) ? httpStatus : null,
    correlationId: correlationId || null,
  }));
}

function missingProvider(state) {
  return {
    configured: state.configured,
    status: async () => state,
    getProviderStatus: async () => state,
    getCurrentWeather: async () => ({ ...state, observations: null, checks: [] }),
    getHourlyForecast: async () => ({ ...state, forecast: null, checks: [] }),
    getDailyForecast: async () => ({ ...state, forecast: null, checks: [] }),
    getDataTimestamp: () => null,
    current: async () => ({ weatherStatus: state.status, observations: null, checks: [], messageAr: state.messageAr, messageEn: state.messageEn }),
  };
}
