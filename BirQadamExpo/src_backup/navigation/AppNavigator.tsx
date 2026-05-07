import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
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
import { ChatsScreen } from '../screens/volunteer/ChatsScreen';
import { ChatDetailScreen } from '../screens/volunteer/ChatDetailScreen';
import { CustomTabBar } from './CustomTabBar';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { appColors, getAppNavigationTheme } from '../theme';
import type { CalendarEvent } from '../types';

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
  ChatDetail: { chatId: number, chatTitle: string, chatType: string };
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

const defaultStackScreenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: appColors.background,
  },
  animation: 'slide_from_right' as const,
};

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

const AuthStack = () => (
  <Stack.Navigator screenOptions={defaultStackScreenOptions}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="RegisterVolunteer" component={RegisterVolunteerScreen} />
    <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
    <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
  </Stack.Navigator>
);

const MainStack = () => (
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
        title: 'Проекты',
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
      }}
    />
    <Stack.Screen
      name="VolunteerHelp"
      component={VolunteerHelpScreen}
      options={{
        ...defaultHeaderOptions,
        title: 'Центр помощи',
        headerBackTitle: 'Профиль',
      }}
    />
    <Stack.Screen
      name="PrivacyPolicy"
      component={PrivacyPolicyScreen}
      options={{
        ...defaultHeaderOptions,
        title: 'Конфиденциальность',
      }}
    />
    <Stack.Screen
      name="AboutApp"
      component={AboutAppScreen}
      options={{
        ...defaultHeaderOptions,
        title: 'О приложении',
      }}
    />
    <Stack.Screen
      name="VolunteerAchievements"
      component={VolunteerAchievementsScreen}
    />
    <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
  </Stack.Navigator>
);

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
    <NavigationContainer theme={navigationTheme}>
      <RootStack />
    </NavigationContainer>
  );
};
