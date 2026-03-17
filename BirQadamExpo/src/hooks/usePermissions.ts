import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { Linking, Platform, AppState, AppStateStatus } from 'react-native';

export interface PermissionStatus {
  notifications: {
    granted: boolean;
    canAskAgain: boolean;
  };
  location: {
    granted: boolean;
    canAskAgain: boolean;
  };
  network: {
    isConnected: boolean;
    type: string | null;
  };
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    notifications: { granted: false, canAskAgain: true },
    location: { granted: false, canAskAgain: true },
    network: { isConnected: false, type: null },
  });
  const [isChecking, setIsChecking] = useState(true);

  const checkNotifications = useCallback(async () => {
    try {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      return {
        granted: status === 'granted',
        canAskAgain: canAskAgain ?? true,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error checking notifications permission:', error);
      }
      return { granted: false, canAskAgain: true };
    }
  }, []);

  const checkLocation = useCallback(async () => {
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      return {
        granted: status === 'granted',
        canAskAgain: canAskAgain ?? true,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error checking location permission:', error);
      }
      return { granted: false, canAskAgain: true };
    }
  }, []);

  const checkNetwork = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      return {
        isConnected: state.isConnected ?? false,
        type: state.type,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error checking network:', error);
      }
      return { isConnected: false, type: null };
    }
  }, []);

  const checkAllPermissions = useCallback(async () => {
    setIsChecking(true);
    try {
      const [notifications, location, network] = await Promise.all([
        checkNotifications(),
        checkLocation(),
        checkNetwork(),
      ]);

      setPermissions({
        notifications,
        location,
        network,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error checking permissions:', error);
      }
    } finally {
      setIsChecking(false);
    }
  }, [checkNotifications, checkLocation, checkNetwork]);

  const openSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  // Проверяем разрешения при монтировании
  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  // Слушаем изменения сети
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setPermissions((prev) => ({
        ...prev,
        network: {
          isConnected: state.isConnected ?? false,
          type: state.type,
        },
      }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Проверяем разрешения при возврате в приложение
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkAllPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkAllPermissions]);

  // Проверяем, есть ли неразрешенные разрешения
  const hasMissingPermissions = useCallback(() => {
    return (
      !permissions.notifications.granted ||
      !permissions.location.granted ||
      !permissions.network.isConnected
    );
  }, [permissions]);

  return {
    permissions,
    isChecking,
    checkAllPermissions,
    openSettings,
    hasMissingPermissions,
  };
};



