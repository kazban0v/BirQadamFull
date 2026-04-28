import React, { useEffect, useState, type ComponentType } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from './src/store/authStore';
import { useThemeStore } from './src/store/themeStore';
import { appColors } from './src/theme';
import { OnboardingStorage } from './src/utils/storage';
import { I18nProvider } from './src/locales/i18n';
import { navigateFromRoot } from './src/navigation/navigationRef';
import { handleNotificationNavigation } from './src/utils/volunteerNotifications';

type AppNavigatorComponent = ComponentType;
type OnboardingComponent = ComponentType<{ onComplete: () => void }>;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const { loadUser } = useAuthStore();
  const { loadTheme, mode } = useThemeStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [AppNavigator, setAppNavigator] = useState<AppNavigatorComponent | null>(null);
  const [OnboardingScreen, setOnboardingScreen] = useState<OnboardingComponent | null>(null);

  useEffect(() => {
    void initializeApp();
  }, []);

  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const payload = response.notification.request.content.data as Record<string, unknown> | undefined;
      handleNotificationNavigation(payload, navigateFromRoot);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) {
        return;
      }

      const payload = response.notification.request.content.data as Record<string, unknown> | undefined;
      handleNotificationNavigation(payload, navigateFromRoot);
    });

    return () => {
      responseSubscription.remove();
    };
  }, []);

  const initializeApp = async () => {
    try {
      await loadTheme();

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('calendar-reminders', {
          name: 'Напоминания календаря',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: appColors.primary,
        });
      }

      const onboardingComplete = await OnboardingStorage.isCompleted();
      setShowOnboarding(!onboardingComplete);

      setAppNavigator(() => require('./src/navigation/AppNavigator').AppNavigator);
      if (!onboardingComplete) {
        setOnboardingScreen(() => require('./src/screens/onboarding/OnboardingScreen').OnboardingScreen);
      }

      await loadUser();
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  return (
    <I18nProvider initialLang="ru">
      <SafeAreaProvider>
        <View style={[styles.container, { backgroundColor: appColors.background }]}>
          {isLoading ? (
            <View style={[styles.loadingContainer, { backgroundColor: appColors.background }]}>
              <ActivityIndicator size="large" color={appColors.primary} />
            </View>
          ) : showOnboarding && OnboardingScreen ? (
            <OnboardingScreen onComplete={handleOnboardingComplete} />
          ) : AppNavigator ? (
            <AppNavigator />
          ) : null}
          <StatusBar
            style={mode === 'dark' ? 'light' : 'dark'}
            backgroundColor={appColors.background}
            hidden={false}
          />
        </View>
      </SafeAreaProvider>
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
