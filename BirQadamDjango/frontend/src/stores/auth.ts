import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { login as apiLogin, logout as apiLogout, fetchCurrentUser, fetchVolunteerProfile } from '@/services/auth';
import type { LoginPayload } from '@/services/auth';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  registration_source: string | null;
  role?: string | null;
  is_organizer?: boolean;
  organizer_status?: 'pending' | 'approved' | 'rejected' | null;
  is_approved?: boolean;
  organization_name?: string | null;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const initialized = ref(false);
  const loading = ref(false);

  const isAuthenticated = computed(() => !!user.value);

  async function loadUser() {
    try {
      const response = await fetchCurrentUser();
      // Проверяем, что ответ содержит данные пользователя
      if (response && response.id) {
      user.value = response;
      } else {
        user.value = null;
      }
    } catch (error: any) {
      // При ошибке авторизации (401, 403) очищаем данные
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        user.value = null;
        localStorage.removeItem('access');
      } else {
        // Для других ошибок тоже очищаем, чтобы не было ложных данных
      user.value = null;
      }
    }
  }

  async function initialize() {
    if (initialized.value) return;
    await loadUser();
    initialized.value = true;
  }

  async function login(payload: LoginPayload) {
    loading.value = true;
    try {
      const data = await apiLogin(payload);
      const loggedInUser = data.user;
      user.value = loggedInUser;
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
    await apiLogout();
    } catch (error) {
      // Игнорируем ошибки при logout (может быть уже разлогинен)
      console.warn('Logout error:', error);
    } finally {
      // Всегда очищаем данные пользователя
    user.value = null;
      // Очищаем localStorage
      localStorage.removeItem('access');
      // Сбрасываем флаг инициализации для повторной проверки при следующем входе
      initialized.value = false;
    }
  }

  async function refreshProfile() {
    const profile = await fetchVolunteerProfile();
    user.value = {
      ...user.value,
      ...{
        full_name: profile.name,
        phone_number: profile.phone_number,
        email: profile.email,
      },
    } as AuthUser | null;
    return profile;
  }

  return {
    user,
    loading,
    isAuthenticated,
    initialize,
    initialized,
    loadUser,
    login,
    logout,
    refreshProfile,
  };
});

