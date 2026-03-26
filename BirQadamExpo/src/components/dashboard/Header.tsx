import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeaderProps {
  userName: string;
  onNotificationPress: () => void;
  hasUnreadNotifications?: boolean;
  onLayout?: (event: any) => void;
  innerRef?: React.RefObject<View | null>;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  userName,
  onNotificationPress,
  hasUnreadNotifications = false,
  onLayout,
  innerRef,
}) => {
  return (
    <View
      ref={innerRef}
      style={styles.header}
      onLayout={onLayout}
    >
      <View style={styles.headerLeft}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color="#FFFFFF" />
        </View>
        <View>
          <Text style={styles.welcomeText}>С возвращением,</Text>
          <Text style={styles.userNameText}>{userName}!</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.notificationButton}
        onPress={onNotificationPress}
      >
        <Ionicons name="notifications-outline" size={24} color="#1F2937" />
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
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

