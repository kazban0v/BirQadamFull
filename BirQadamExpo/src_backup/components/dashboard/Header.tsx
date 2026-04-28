import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appColors } from '../../theme';

interface HeaderProps {
  userName: string;
  avatarUrl?: string | null;
  onNotificationPress: () => void;
  hasUnreadNotifications?: boolean;
  onLayout?: (event: any) => void;
  innerRef?: React.RefObject<View | null>;
}

import { useTranslation } from '../../locales/i18n';

export const Header: React.FC<HeaderProps> = React.memo(({
  userName,
  avatarUrl,
  onNotificationPress,
  hasUnreadNotifications = false,
  onLayout,
  innerRef,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View
      ref={innerRef}
      style={[styles.header, { paddingTop: insets.top + 12 }]}
      onLayout={onLayout}
    >
      <View style={styles.headerLeft}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Ionicons name="person" size={20} color={appColors.white} />
          )}
        </View>
        <View>
          <Text style={styles.welcomeText}>{t('dashboard.welcomeBack')}</Text>
          <Text style={styles.userNameText}>{userName}!</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.notificationButton}
        onPress={onNotificationPress}
      >
        <Ionicons name="notifications-outline" size={24} color={appColors.text} />
        {hasUnreadNotifications && <View style={styles.notificationDot} />}
      </TouchableOpacity>
    </View>
  );
});

Header.displayName = 'Header';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: appColors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: appColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  welcomeText: {
    fontSize: 12,
    color: appColors.textMuted,
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.text,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: appColors.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: appColors.danger,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
