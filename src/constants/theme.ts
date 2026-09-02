export const colors = {
  primary: '#0B6A3E',
  primaryDark: '#06462B',
  primarySoft: '#E7F3EA',
  leaf: '#68A93C',
  sun: '#F4B820',
  orange: '#E86F2C',
  background: '#F5F7F3',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#EEF3ED',
  text: '#142B21',
  muted: '#66766D',
  textSubtle: '#849189',
  border: '#DCE5DE',
  borderStrong: '#C7D6CB',
  danger: '#C43B3B',
  success: '#2F8B57',
  warning: '#A66F00',
  shadow: '#10251A',
  overlay: 'rgba(3, 32, 19, 0.72)',
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
};

export const shadow = Platform.select({
  web: { boxShadow: '0 8px 16px rgba(16, 37, 26, 0.07)' },
  default: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
}) ?? {};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
import { Platform } from 'react-native';
