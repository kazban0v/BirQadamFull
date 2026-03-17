import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Экспорты экранов
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterVolunteerScreen } from '../screens/auth/RegisterVolunteerScreen';
import { RegisterOrganizerScreen } from '../screens/auth/RegisterOrganizerScreen';
import { PasswordResetScreen } from '../screens/auth/PasswordResetScreen';
import { EmailVerificationScreen } from '../screens/auth/EmailVerificationScreen';

import { VolunteerDashboardScreen } from '../screens/volunteer/DashboardScreen';
import { VolunteerProfileScreen } from '../screens/volunteer/ProfileScreen';
import { VolunteerTasksScreen } from '../screens/volunteer/TasksScreen';
import { VolunteerTaskDetailScreen } from '../screens/volunteer/VolunteerTaskDetailScreen';
import { VolunteerProjectDetailScreen } from '../screens/volunteer/ProjectDetailScreen';
import { VolunteerNotificationsScreen } from '../screens/volunteer/NotificationsScreen';
import { OrganizerProfileScreen } from '../screens/volunteer/OrganizerProfileScreen';
import { PermissionsStatusScreen } from '../screens/permissions/PermissionsStatusScreen';
import { VolunteerMyProjectsScreen } from '../screens/volunteer/MyProjectsScreen';

import { CustomTabBar } from './CustomTabBar';
import { useAuthStore } from '../store/authStore';

export type AuthStackParamList = {
  Login: undefined;
  RegisterVolunteer: undefined;
  RegisterOrganizer: undefined;
  PasswordReset: undefined;
  EmailVerification: { email?: string };
};

export type VolunteerTabsParamList = {
  Главная: undefined;
  Задачи: undefined;
  Календарь: undefined;
  Чаты: undefined;
  Профиль: undefined;
};

export type MainStackParamList = {
  VolunteerTabs: undefined;
  VolunteerProjectDetail: { projectId: number };
  VolunteerTaskDetail: { taskId: number };
  VolunteerNotifications: undefined;
  OrganizerProfile: { organizerId: number };
  PermissionsStatus: undefined;
  VolunteerMyProjects: undefined;
};

export type OnboardingStackParamList = {
  Onboarding: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
};

// ИНИЦИАЛИЗАЦИЯ (Обязательно до компонентов)
export const Tab = createBottomTabNavigator<VolunteerTabsParamList>();
export const Stack = createNativeStackNavigator<RootStackParamList & AuthStackParamList & MainStackParamList & OnboardingStackParamList>();
export { OnboardingScreen };

// Заглушки
const CalendarPlaceholder = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
    <Ionicons name="calendar-outline" size={64} color="#9CA3AF" />
    <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 16 }}>Календарь в разработке</Text>
  </View>
);

const ChatPlaceholder = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
    <Ionicons name="chatbubble-ellipses-outline" size={64} color="#9CA3AF" />
    <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 16 }}>Чаты в разработке</Text>
  </View>
);

const VolunteerTabs = () => {
  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen name="Главная" component={VolunteerDashboardScreen} />
        <Tab.Screen name="Задачи" component={VolunteerTasksScreen} />
        <Tab.Screen name="Календарь" component={CalendarPlaceholder} />
        <Tab.Screen name="Чаты" component={ChatPlaceholder} />
        <Tab.Screen name="Профиль" component={VolunteerProfileScreen} />
      </Tab.Navigator>
    </View>
  );
};

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="RegisterVolunteer" component={RegisterVolunteerScreen} />
    <Stack.Screen name="RegisterOrganizer" component={RegisterOrganizerScreen} />
    <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
    <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
  </Stack.Navigator>
);

const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="VolunteerTabs" component={VolunteerTabs} />
    <Stack.Screen name="VolunteerProjectDetail" component={VolunteerProjectDetailScreen} options={{ presentation: 'modal' }} />
    <Stack.Screen name="VolunteerTaskDetail" component={VolunteerTaskDetailScreen} />
    <Stack.Screen name="VolunteerNotifications" component={VolunteerNotificationsScreen} />
    <Stack.Screen name="OrganizerProfile" component={OrganizerProfileScreen} />
    <Stack.Screen name="PermissionsStatus" component={PermissionsStatusScreen} options={{ presentation: 'modal' }} />
    <Stack.Screen name="VolunteerMyProjects" component={VolunteerMyProjectsScreen} options={{
      headerShown: true,
      title: '',
      headerStyle: {
        backgroundColor: '#F9FAFB',
        shadowColor: 'transparent',
        elevation: 0,
      },
      headerShadowVisible: false,
      headerLeftContainerStyle: {
        paddingLeft: 8,
      },
      headerBackButtonDisplayMode: 'minimal',
    }} />
  </Stack.Navigator>
);

const RootStack = () => {
  const { isAuthenticated } = useAuthStore();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : (
        <Stack.Screen name="Main" component={MainStack} />
      )}
    </Stack.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <RootStack />
    </NavigationContainer>
  );
};