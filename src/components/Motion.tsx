import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { motion } from '@/constants/theme';

const MotionContext = createContext(true);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
}

export const useReducedMotion = () => useContext(MotionContext);

export function MotionPressable({ style, onPressIn, onPressOut, ...props }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => () => progress.stopAnimation(), [progress]);
  const animate = (pressed: boolean) => Animated.timing(progress, {
    toValue: pressed ? 1 : 0, duration: reduced ? 0 : motion.press, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web',
  }).start();
  return <AnimatedPressable {...props} onPressIn={(event) => { animate(true); onPressIn?.(event); }} onPressOut={(event) => { animate(false); onPressOut?.(event); }}
    style={[style, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }), transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : 0.985] }) }] }]} />;
}
