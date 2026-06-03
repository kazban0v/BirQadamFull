import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { login as apiLogin, logout as apiLogout, fetchCurrentUser, fetchVolunteerProfile } from '@/services/auth';
import { getOrganizerProfile } from '@/services/webPortal';
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
  trust_factor?: number;
  average_rating?: number;
  bio_filled?: boolean;
  resume_filled?: boolean;
  profile_complete?: boolean;
}

function persistAccessToken(data: { access_token?: string }) {
  const access = data.access_token;
  if (access && typeof localStorage !== 'undefined') {
    localStorage.setItem('access', access);
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const initialized = ref(false);
  const loading = ref(false);

  const isAuthenticated = computed(() => !!user.value);

  const isOrganizerRole = computed(() => {
    const u = user.value;
    return !!(u && (u.role === 'organizer' || u.is_organizer));
  });

  const isApprovedOrganizer = computed(
    () => isOrganizerRole.value && user.value?.organizer_status === 'approved',
  );

  const isPendingOrganizer = computed(
    () => isOrganizerRole.value && user.value?.organizer_status === 'pending',
  );

  const isRejectedOrganizer = computed(
    () => isOrganizerRole.value && user.value?.organizer_status === 'rejected',
  );

  const needsBioCompletion = computed(() => {
    const u = user.value;
    if (!u) return false;
    if (isApprovedOrganizer.value) return !u.bio_filled;
    if (!isOrganizerRole.value) return !u.bio_filled;
    return false;
  });

  const needsProfileCompletion = computed(() => {
    const u = user.value;
    if (!u || isOrganizerRole.value) return false;
    return !u.profile_complete;
  });

  async function loadUser() {
    try {
      const response = await fetchCurrentUser();
      if (response && response.id) {
        user.value = response;
      } else {
        user.value = null;
      }
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        user.value = null;
        localStorage.removeItem('access');
      } else {
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
      persistAccessToken(data);
      user.value = data.user;
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      await apiLogout();
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      user.value = null;
      localStorage.removeItem('access');
      initialized.value = false;
    }
  }

  async function refreshProfile() {
    const profile = await fetchVolunteerProfile();
    if (user.value) {
      user.value.full_name = profile.name;
      user.value.phone_number = profile.phone_number;
      user.value.email = profile.email;
      if (profile.trust_factor !== undefined) {
        user.value.trust_factor = profile.trust_factor;
      }
      if (profile.average_rating !== undefined) {
        user.value.average_rating = profile.average_rating;
      }
      user.value.bio_filled = profile.bio_filled;
      user.value.resume_filled = profile.resume_filled;
      user.value.profile_complete = profile.profile_complete;
    } else {
      user.value = {
        id: profile.id || 0,
        username: profile.username || '',
        full_name: profile.name || '',
        phone_number: profile.phone_number || '',
        email: profile.email || null,
        registration_source: null,
        trust_factor: profile.trust_factor,
        average_rating: profile.average_rating,
        bio_filled: profile.bio_filled,
        resume_filled: profile.resume_filled,
        profile_complete: profile.profile_complete,
      } as AuthUser;
    }
    return profile;
  }

  async function refreshOrganizerProfile() {
    const profile = await getOrganizerProfile();
    if (user.value) {
      user.value.full_name = profile.full_name;
      user.value.organization_name = profile.organization_name;
      user.value.bio_filled = profile.bio_filled;
      user.value.profile_complete = profile.profile_complete;
    }
    return profile;
  }

  return {
    user,
    loading,
    isAuthenticated,
    isOrganizerRole,
    isApprovedOrganizer,
    isPendingOrganizer,
    isRejectedOrganizer,
    needsBioCompletion,
    needsProfileCompletion,
    initialize,
    initialized,
    loadUser,
    login,
    logout,
    refreshProfile,
    refreshOrganizerProfile,
    persistAccessToken,
  };
});
