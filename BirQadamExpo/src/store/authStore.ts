import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';
import type { User, LoginCredentials, VolunteerRegistrationData, OrganizerRegistrationData, AuthResponse } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  requiresEmailVerification: boolean;
  verificationEmail: string | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  registerVolunteer: (data: VolunteerRegistrationData) => Promise<void>;
  registerOrganizer: (data: OrganizerRegistrationData) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
  cancelRegistration: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
  clearError: () => void;
}

const USER_KEY = 'birqadam_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  requiresEmailVerification: false,
  verificationEmail: null,

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login(credentials.identifier, credentials.password);
      const data: AuthResponse = response.data;
      
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
      
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        requiresEmailVerification: false,
        verificationEmail: null,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Ошибка входа';
      const requiresEmailVerification = error.response?.data?.requires_email_verification;
      const email = error.response?.data?.email;
      
      set({
        isLoading: false,
        error: errorMessage,
        requiresEmailVerification: requiresEmailVerification || false,
        verificationEmail: email || null,
      });
      throw new Error(errorMessage);
    }
  },

  registerVolunteer: async (data: VolunteerRegistrationData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.registerVolunteer(data);
      const responseData = response.data;
      
      set({
        isLoading: false,
        requiresEmailVerification: true,
        verificationEmail: data.email,
      });
      
      return responseData;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Ошибка регистрации';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  registerOrganizer: async (data: OrganizerRegistrationData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.registerOrganizer(data);
      const responseData = response.data;
      
      set({
        isLoading: false,
        requiresEmailVerification: true,
        verificationEmail: data.email,
      });
      
      return responseData;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Ошибка регистрации';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  verifyEmail: async (email: string, code: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.verifyEmail(email, code);
      const data: AuthResponse = response.data;
      
      console.log('[AUTH] Email verified, response:', data);
      
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
      
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        requiresEmailVerification: false,
        verificationEmail: null,
      });
    } catch (error: any) {
      console.error('[AUTH] Verification error:', error.response?.data);
      const errorMessage = error.response?.data?.detail || 'Ошибка подтверждения';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  resendVerificationCode: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      await authAPI.resendVerificationCode(email);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Ошибка отправки кода';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  cancelRegistration: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('[AUTH] Canceling registration for:', email);
      await authAPI.cancelRegistration(email);
      console.log('[AUTH] Registration cancelled successfully');
      set({
        isLoading: false,
        requiresEmailVerification: false,
        verificationEmail: null,
      });
    } catch (error: any) {
      console.error('[AUTH] Cancel registration error:', error.response?.data);
      const errorMessage = error.response?.data?.detail || 'Ошибка отмены регистрации';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  requestPasswordReset: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      await authAPI.requestPasswordReset(email);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Ошибка сброса пароля';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  confirmPasswordReset: async (email: string, code: string, newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      await authAPI.confirmPasswordReset(email, code, newPassword);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Ошибка установки пароля';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await SecureStore.deleteItemAsync(USER_KEY);
      set({
        user: null,
        isAuthenticated: false,
        error: null,
        requiresEmailVerification: false,
        verificationEmail: null,
      });
    }
  },

  loadUser: async () => {
    try {
      const userData = await SecureStore.getItemAsync(USER_KEY);
      if (userData) {
        const user: User = JSON.parse(userData);
        set({
          user,
          isAuthenticated: true,
        });
      }
    } catch (error) {
      console.error('Load user error:', error);
    }
  },

  updateProfile: async (data: any) => {
    // TODO: Реализовать обновление профиля через API
    const currentState = get();
    if (currentState.user) {
      const updatedUser = { ...currentState.user, ...data };
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
