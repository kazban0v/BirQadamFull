import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterVolunteerScreen } from '../screens/auth/RegisterVolunteerScreen';
import { PasswordResetScreen } from '../screens/auth/PasswordResetScreen';
import { EmailVerificationScreen } from '../screens/auth/EmailVerificationScreen';
import { VolunteerDashboardScreen } from '../screens/volunteer/DashboardScreen';
import { VolunteerProfileScreen } from '../screens/volunteer/ProfileScreen';
import { EditProfileScreen } from '../screens/volunteer/EditProfileScreen';
import { ChangePasswordScreen } from '../screens/volunteer/ChangePasswordScreen';
import { VolunteerTasksScreen } from '../screens/volunteer/TasksScreen';
import { VolunteerTaskDetailScreen } from '../screens/volunteer/VolunteerTaskDetailScreen';
import { PhotoReportDetailScreen } from '../screens/volunteer/PhotoReportDetailScreen';
import { SubmitPhotoReportScreen } from '../screens/volunteer/SubmitPhotoReportScreen';
import { VolunteerCalendarScreen } from '../screens/volunteer/CalendarScreen';
import { CalendarEventDetailScreen } from '../screens/volunteer/CalendarEventDetailScreen';
import { VolunteerProjectDetailScreen } from '../screens/volunteer/ProjectDetailScreen';
import { VolunteerProjectsScreen } from '../screens/volunteer/ProjectsScreen';
import { VolunteerNotificationsScreen } from '../screens/volunteer/NotificationsScreen';
import { OrganizerProfileScreen } from '../screens/volunteer/OrganizerProfileScreen';
import { PermissionsStatusScreen } from '../screens/permissions/PermissionsStatusScreen';
import { VolunteerMyProjectsScreen } from '../screens/volunteer/MyProjectsScreen';
import { VolunteerHelpScreen } from '../screens/volunteer/HelpScreen';
import { PrivacyPolicyScreen } from '../screens/volunteer/PrivacyPolicyScreen';
import { AboutAppScreen } from '../screens/volunteer/AboutAppScreen';
import { VolunteerAchievementsScreen } from '../screens/volunteer/AchievementsScreen';
import { VolunteerActivityScreen } from '../screens/volunteer/ActivityScreen';
import { ChatsScreen } from '../screens/volunteer/ChatsScreen';
import { ChatDetailScreen } from '../screens/volunteer/ChatDetailScreen';
import { BlockedUsersScreen } from '../screens/volunteer/BlockedUsersScreen';
import { CustomTabBar } from './CustomTabBar';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { appColors, getAppNavigationTheme } from '../theme';
import type { CalendarEvent } from '../types';
import { flushPendingNavigation, navigationRef } from './navigationRef';
import { useTranslation } from "../locales/i18n";

export type AuthStackParamList = {
  Login: undefined;
  RegisterVolunteer: undefined;
  PasswordReset: undefined;
  EmailVerification: { email?: string };
};

export type VolunteerTabsParamList = {
  HomeTab: undefined;
  TasksTab: undefined;
  CalendarTab: undefined;
  ChatsTab: undefined;
  ProfileTab: undefined;
};

export type MainStackParamList = {
  VolunteerTabs: undefined;
  EditVolunteerProfile: undefined;
  ChangePassword: undefined;
  VolunteerProjects: undefined;
  VolunteerProjectDetail: { projectId: number };
  VolunteerTaskDetail: { taskId: number };
  CalendarEventDetail: { event: CalendarEvent };
  PhotoReportDetail: { taskId: number };
  SubmitPhotoReport: { taskId: number };
  VolunteerNotifications: undefined;
  OrganizerProfile: { organizerId: number };
  PermissionsStatus: undefined;
  VolunteerMyProjects: undefined;
  VolunteerHelp: undefined;
  PrivacyPolicy: undefined;
  AboutApp: undefined;
  VolunteerAchievements: undefined;
  VolunteerActivity: undefined;
  ChatDetail: { chatId: number, chatTitle: string, chatType: string };
  BlockedUsers: undefined;
};

export type OnboardingStackParamList = {
  Onboarding: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
};

export const Tab = createBottomTabNavigator<VolunteerTabsParamList>();
export const Stack = createNativeStackNavigator<
  RootStackParamList & AuthStackParamList & MainStackParamList & OnboardingStackParamList
>();
export { OnboardingScreen };

// Chat placeholder removed

const defaultStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: appColors.background,
  },
  animation: 'slide_from_right',
};

/** Не задаём `statusBarStyle` здесь: это вызывает native `RNSScreen setStatusBarStyle` и
 *  `RCTLogError` в Expo Go, если в Info.plist нет `UIViewControllerBasedStatusBarAppearance` = YES.
 *  Внешний вид статус-бара задаётся через `<StatusBar />` в `App.tsx`. */
const defaultHeaderOptions = {
  headerShown: true,
  headerStyle: {
    backgroundColor: appColors.surface,
  },
  headerTintColor: appColors.text,
  headerBackTitle: '',
  headerBackTitleVisible: false,
  headerTitleStyle: {
    color: appColors.text,
    fontWeight: '700' as const,
  },
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: appColors.background,
  },
};

const VolunteerTabs = () => {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: appColors.background }}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: {
            backgroundColor: appColors.background,
          },
        }}
      >
        <Tab.Screen name="HomeTab" component={VolunteerDashboardScreen} />
        <Tab.Screen name="TasksTab" component={VolunteerTasksScreen} />
        <Tab.Screen name="CalendarTab" component={VolunteerCalendarScreen} />
        <Tab.Screen name="ChatsTab" component={ChatsScreen} />
        <Tab.Screen name="ProfileTab" component={VolunteerProfileScreen} />
      </Tab.Navigator>
    </View>
  );
};

const AuthStack = () => {
  return (
  <Stack.Navigator screenOptions={defaultStackScreenOptions}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="RegisterVolunteer" component={RegisterVolunteerScreen} />
    <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
    <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
  </Stack.Navigator>
  );
};

const MainStack = () => {
  const { t } = useTranslation();

  return (
  <Stack.Navigator screenOptions={defaultStackScreenOptions}>
    <Stack.Screen
      name="VolunteerTabs"
      component={VolunteerTabs}
      options={{
        title: '',
        headerBackTitle: '',
      }}
    />
    <Stack.Screen name="EditVolunteerProfile" component={EditProfileScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <Stack.Screen
      name="VolunteerProjects"
      component={VolunteerProjectsScreen}
      options={{
        ...defaultHeaderOptions,
        title: '',
        headerBackTitle: '',
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: appColors.surfaceSoft },
      }}
    />
    <Stack.Screen
      name="VolunteerProjectDetail"
      component={VolunteerProjectDetailScreen}
      options={{
        presentation: 'modal',
        contentStyle: {
          backgroundColor: appColors.background,
        },
      }}
    />
    <Stack.Screen name="VolunteerTaskDetail" component={VolunteerTaskDetailScreen} />
    <Stack.Screen name="CalendarEventDetail" component={CalendarEventDetailScreen} />
    <Stack.Screen name="PhotoReportDetail" component={PhotoReportDetailScreen} />
    <Stack.Screen name="SubmitPhotoReport" component={SubmitPhotoReportScreen} />
    <Stack.Screen name="VolunteerNotifications" component={VolunteerNotificationsScreen} />
    <Stack.Screen name="OrganizerProfile" component={OrganizerProfileScreen} />
    <Stack.Screen
      name="PermissionsStatus"
      component={PermissionsStatusScreen}
      options={{
        presentation: 'modal',
        contentStyle: {
          backgroundColor: appColors.background,
        },
      }}
    />
    <Stack.Screen
      name="VolunteerMyProjects"
      component={VolunteerMyProjectsScreen}
      options={{
        ...defaultHeaderOptions,
        title: '',
        headerBackTitle: '',
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: appColors.surfaceSoft },
      }}
    />
    <Stack.Screen
      name="VolunteerHelp"
      component={VolunteerHelpScreen}
      options={{
        ...defaultHeaderOptions,
        title: t('appnavigator.s_1'),
        headerBackTitle: '',
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
    <Stack.Screen
      name="PrivacyPolicy"
      component={PrivacyPolicyScreen}
      options={{
        ...defaultHeaderOptions,
        title: t('appnavigator.s_3'),
      }}
    />
    <Stack.Screen
      name="AboutApp"
      component={AboutAppScreen}
      options={{
        ...defaultHeaderOptions,
        title: t('appnavigator.s_4'),
      }}
    />
    <Stack.Screen
      name="VolunteerAchievements"
      component={VolunteerAchievementsScreen}
    />
    <Stack.Screen
      name="VolunteerActivity"
      component={VolunteerActivityScreen}
      options={{
        ...defaultHeaderOptions,
        title: t('activity.s_0'),
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
    <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
    <Stack.Screen 
      name="BlockedUsers" 
      component={BlockedUsersScreen} 
      options={{
        ...defaultHeaderOptions,
        title: 'Заблокированные пользователи',
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
  </Stack.Navigator>
  );
};

const RootStack = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <Stack.Navigator screenOptions={defaultStackScreenOptions}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : (
        <Stack.Screen name="Main" component={MainStack} />
      )}
    </Stack.Navigator>
  );
};

export const AppNavigator = () => {
  const mode = useThemeStore((state) => state.mode);
  const navigationTheme = useMemo(() => getAppNavigationTheme(mode), [mode]);

  return (
    <NavigationContainer theme={navigationTheme} ref={navigationRef} onReady={flushPendingNavigation}>
      <RootStack />
    </NavigationContainer>
  );
};
