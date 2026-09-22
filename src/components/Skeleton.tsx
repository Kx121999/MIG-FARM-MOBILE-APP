import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useReducedMotion } from '@/components/Motion';

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const { isRTL } = useLanguage();
  const [width, setWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    if (!width) return;
    sweep.setValue(0);
    const animation = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [sweep, opacity, reduced, width]);
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: isRTL ? [width, -width] : [-width, width],
  });
  return (
    <Animated.View
      accessible={false}
      style={[styles.base, style, { opacity: reduced ? opacity : 1 }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {!reduced && width ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  base: { backgroundColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
});
