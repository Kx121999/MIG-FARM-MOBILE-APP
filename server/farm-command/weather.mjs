export function createWeatherProvider(env = process.env) {
  if (!env.FARM_WEATHER_PROVIDER || !env.FARM_WEATHER_API_KEY) {
    return {
      configured: false,
      async current() {
        return {
          weatherStatus: 'not_configured',
          observations: null,
          checks: [],
          messageAr: 'بيانات الطقس غير متصلة حاليًا.',
          messageEn: 'Weather data is not connected currently.',
        };
      },
    };
  }

  return {
    configured: false,
    async current() {
      return {
        weatherStatus: 'provider_not_implemented',
        observations: null,
        checks: [],
        messageAr: 'مزود الطقس المحدد غير مدعوم في هذا الإصدار.',
        messageEn: 'The configured weather provider is not supported in this build.',
      };
    },
  };
}
