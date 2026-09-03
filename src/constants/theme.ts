import { Platform, TextStyle } from 'react-native';

export const colors = {
  primary: '#175C3B',
  primaryDark: '#143D2C',
  primarySoft: '#EDF3EE',
  leaf: '#5F873B',
  sun: '#E9B928',
  orange: '#A76B24',
  background: '#F7F8F6',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#F0F2EF',
  text: '#242B27',
  muted: '#626C66',
  textSubtle: '#727C75',
  border: '#E6EAE5',
  borderStrong: '#CCD3CD',
  danger: '#B43C3C',
  success: '#276342',
  warning: '#896111',
  shadow: '#18231C',
  overlay: 'rgba(20, 29, 23, 0.38)',
};

export const radius = { sm: 4, md: 8, lg: 8, xl: 8, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const sizes = { touch: 44, button: 48, input: 48, icon: 22, badge: 20, page: 760 };
export const motion = { press: 160, enter: 220, intro: 850 };

export const typography = {
  display: { fontSize: 28, lineHeight: 38, fontWeight: '700', letterSpacing: 0 },
  page: { fontSize: 24, lineHeight: 34, fontWeight: '700', letterSpacing: 0 },
  section: { fontSize: 19, lineHeight: 28, fontWeight: '600', letterSpacing: 0 },
  product: { fontSize: 14, lineHeight: 21, fontWeight: '600', letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 24, fontWeight: '400', letterSpacing: 0 },
  secondary: { fontSize: 13, lineHeight: 21, fontWeight: '400', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '500', letterSpacing: 0 },
  button: { fontSize: 14, lineHeight: 22, fontWeight: '600', letterSpacing: 0 },
} satisfies Record<string, TextStyle>;

export const shadow = Platform.select({
  web: { boxShadow: '0 2px 8px rgba(24, 35, 28, 0.035)' },
  default: { shadowColor: colors.shadow, shadowOpacity: 0.035, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
}) ?? {};
