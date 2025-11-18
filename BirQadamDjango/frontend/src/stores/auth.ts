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
      user.value = response;
    } catch (error) {
      user.value = null;
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
    await apiLogout();
    user.value = null;
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

