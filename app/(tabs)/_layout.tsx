import React from 'react';
import { ColorValue, Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { House, Search, ShoppingBag, Store, UserRound, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { useCommerce } from '@/contexts/CommerceContext';
import { useLanguage } from '@/contexts/LanguageContext';

function TabIcon({ icon: Icon, color, focused }: { icon: LucideIcon; color: ColorValue; focused: boolean }) {
  return <Icon size={21} color={color} strokeWidth={focused ? 2.5 : 2} />;
}

export default function TabLayout() {
  const { cartCount } = useCommerce();
  const { t } = useLanguage();

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textSubtle,
      tabBarHideOnKeyboard: true,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabLabel,
      tabBarItemStyle: styles.tabItem,
      tabBarIconStyle: styles.tabIcon,
    }}>
      <Tabs.Screen name="index" options={{ title: t('home'), tabBarIcon: ({ color, focused }) => <TabIcon icon={House} color={color} focused={focused} /> }} />
      <Tabs.Screen name="catalog" options={{ title: t('departments'), tabBarIcon: ({ color, focused }) => <TabIcon icon={Store} color={color} focused={focused} /> }} />
      <Tabs.Screen name="search" options={{ title: t('searchTab'), tabBarIcon: ({ color, focused }) => <TabIcon icon={Search} color={color} focused={focused} /> }} />
      <Tabs.Screen name="cart" options={{ title: t('cart'), tabBarBadge: cartCount || undefined, tabBarBadgeStyle: styles.badge, tabBarIcon: ({ color, focused }) => <TabIcon icon={ShoppingBag} color={color} focused={focused} /> }} />
      <Tabs.Screen name="account" options={{ title: t('account'), tabBarIcon: ({ color, focused }) => <TabIcon icon={UserRound} color={color} focused={focused} /> }} />
      <Tabs.Screen name="assistant" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    minHeight: 68,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 -4px 12px rgba(16, 37, 26, 0.06)' },
      default: {
        elevation: 8,
        shadowColor: colors.shadow,
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
      },
    }),
  },
  tabItem: { paddingVertical: 3 },
  tabIcon: { marginTop: 1 },
  tabLabel: { fontSize: 10, lineHeight: 13, fontWeight: '700' },
  badge: { backgroundColor: colors.orange, color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});

function languageAware(t: (key: string) => string, key: string) {
  return t(key);
}
