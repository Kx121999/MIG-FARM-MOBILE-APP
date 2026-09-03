import React from 'react';
import { Image, StyleProp, ImageStyle } from 'react-native';

export const brandLogoSource = require('../../assets/mig-farm-logo.png');

export function BrandLogo({ width = 124, style, onLoadEnd }: { width?: number; style?: StyleProp<ImageStyle>; onLoadEnd?: () => void }) {
  return <Image source={brandLogoSource} accessibilityLabel="MIG FARM" resizeMode="contain" onLoadEnd={onLoadEnd} style={[{ width, height: width * 356 / 720 }, style]} />;
}
