import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { useReducedMotion } from '@/components/Motion';

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) { opacity.setValue(1); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.55, duration: 850, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 1, duration: 850, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity, reduced]);
  return <Animated.View accessible={false} style={[styles.base, style, { opacity }]} />;
}
const styles = StyleSheet.create({ base: { backgroundColor: colors.border, borderRadius: radius.sm } });
