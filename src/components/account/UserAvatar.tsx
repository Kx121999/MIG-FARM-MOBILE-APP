import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { MotionPressable } from '@/components/Motion';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/constants/theme';
import { avatarSource } from '@/utils/customer';
import type { UserProfile } from '@/types/customer';

export function UserAvatar({
  user,
  size = 36,
  loading = false,
  preview,
}: {
  user?: UserProfile | null;
  size?: number;
  loading?: boolean;
  preview?: string;
}) {
  const uri = preview || avatarSource(user);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (loading)
    return (
      <Skeleton style={{ width: size, height: size, borderRadius: size / 2 }} />
    );
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {uri && !failed ? (
        <Image
          accessibilityLabel=""
          source={{ uri, cache: 'force-cache' }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(true)}
        />
      ) : user?.name.trim() ? (
        <Text
          maxFontSizeMultiplier={1.2}
          style={{
            fontSize: size * 0.42,
            color: colors.primary,
            fontWeight: '600',
          }}
        >
          {Array.from(user.name.trim())[0]}
        </Text>
      ) : (
        <UserRound size={size * 0.55} color={colors.muted} strokeWidth={1.7} />
      )}
    </View>
  );
}
export function AccountAvatarButton() {
  const { user, ready } = useAuth();
  const { isRTL } = useLanguage();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={isRTL ? 'فتح حسابي' : 'Open my account'}
      style={styles.target}
      onPress={() => router.push('/(tabs)/account')}
    >
      <UserAvatar user={user} loading={!ready} />
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  target: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
