import React, { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { House, MessageCircle, ShoppingBag, Store, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage, CopyKey } from '@/contexts/LanguageContext';
import { CountBadge } from '@/components/AppIconButton';
import { MotionPressable } from '@/components/Motion';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
const destinations = [
  { name: 'index', label: 'home', icon: House },
  { name: 'catalog', label: 'store', icon: Store },
  { name: 'assistant', label: 'assistant', icon: MessageCircle },
  { name: 'cart', label: 'cart', icon: ShoppingBag },
  { name: 'account', label: 'account', icon: UserRound },
] satisfies Array<{ name: string; label: CopyKey; icon: typeof House }>;

function AppTabBar({ state, navigation }: TabBarProps) {
  const { cartCount } = useCommerce();
  const { t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboardVisible) return null;
  return <View accessibilityRole="tablist" style={[styles.bar, { flexDirection: isRTL ? 'row-reverse' : 'row', paddingBottom: Math.max(insets.bottom, spacing.sm), paddingLeft: insets.left, paddingRight: insets.right }]}>
    {destinations.map(({ name, label, icon: Icon }) => {
      const route = state.routes.find((item) => item.name === name);
      if (!route) return null;
      const focused = state.routes[state.index].key === route.key;
      const color = focused ? colors.primary : colors.muted;
      return <MotionPressable key={name} accessibilityRole="tab" accessibilityLabel={t(label)} accessibilityState={{ selected: focused }}
        onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params); }}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} style={styles.item}>
        <View style={[styles.icon, focused && styles.activeIcon]}><Icon size={22} color={color} strokeWidth={focused ? 2.1 : 1.7} />{name === 'cart' ? <CountBadge count={cartCount} /> : null}</View>
        <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}>{t(label)}</Text>
      </MotionPressable>;
    })}
  </View>;
}

export default function TabLayout() {
  return <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="index" />
    <Tabs.Screen name="catalog" />
    <Tabs.Screen name="assistant" />
    <Tabs.Screen name="cart" />
    <Tabs.Screen name="account" />
    <Tabs.Screen name="search" options={{ href: null }} />
  </Tabs>;
}
const styles = StyleSheet.create({
  bar: { paddingTop: spacing.xs, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'stretch' },
  item: { flex: 1, minWidth: 0, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icon: { width: 40, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  activeIcon: { backgroundColor: colors.primarySoft },
  label: { ...typography.caption, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
