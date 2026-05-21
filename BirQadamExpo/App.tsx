import React, { useEffect, useState, type ComponentType } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, StyleSheet, View, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

LogBox.ignoreLogs([
  'Network Error',
  'Network request failed',
  '[Dashboard] Error loading dashboard',
]);

import { useAuthStore } from './src/store/authStore';
import { useThemeStore } from './src/store/themeStore';
import { appColors } from './src/theme';
import { OnboardingStorage } from './src/utils/storage';
import { I18nProvider } from './src/locales/i18n';
import { navigateFromRoot } from './src/navigation/navigationRef';
import { handleNotificationNavigation } from './src/utils/volunteerNotifications';
import { OfflineScreen } from './src/components/OfflineScreen';
import { ToastProvider } from './src/components/Toast';
import { AnimatedSplash } from './src/components/AnimatedSplash';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Минимальная длительность нашего кастомного сплэша, чтобы успели сыграть анимации
const SPLASH_MIN_DURATION_MS = 1600;

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
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashMounted, setSplashMounted] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [AppNavigator, setAppNavigator] = useState<AppNavigatorComponent | null>(null);
  const [OnboardingScreen, setOnboardingScreen] = useState<OnboardingComponent | null>(null);

  useEffect(() => {
    const startedAt = Date.now();
    void initializeApp().finally(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - elapsed);

      // После успешной инициализации кадр уже отрендерился с AnimatedSplash.
      // Два RAF — чтобы первый был commit layout, второй реальная отрисовка;
      // иначе при hideNative() на мгновение «просвечивает» фон без оверлея.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          SplashScreen.hideAsync().catch(() => undefined);
        });
      });

      setTimeout(() => {
        setSplashVisible(false);
      }, remaining);
    });
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
        <ToastProvider>
        <View style={[styles.container, { backgroundColor: appColors.background }]}>
          {isLoading ? (
            <View style={[styles.loadingContainer, { backgroundColor: appColors.background }]} />
          ) : showOnboarding && OnboardingScreen ? (
            <OnboardingScreen onComplete={handleOnboardingComplete} />
          ) : AppNavigator ? (
            <AppNavigator />
          ) : null}

          {splashMounted ? (
            <AnimatedSplash
              visible={splashVisible}
              onFinish={() => setSplashMounted(false)}
            />
          ) : null}

          {/* Пока сплэш на экране — не монтируем Modal: иначе на iOS может оказаться поверх оверлея */}
          {!splashMounted ? <OfflineScreen /> : null}

          {/* iOS: тёмные иконки на светлом фоне; в тёмной теме — светлые */}
          <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        </View>
        </ToastProvider>
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
