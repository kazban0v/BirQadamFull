<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { PublicVolunteer } from '@/services/webPortal';
import { formatPublicDate, getVolunteerDisplayName, getVolunteerInitials, projectsLabel } from '@/utils/publicVolunteer';
import InviteVolunteerDialog from './InviteVolunteerDialog.vue';

defineProps<{
  volunteer: PublicVolunteer;
}>();

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const imageError = ref(false);
const inviteOpen = ref(false);
const successMessage = ref('');

const isApprovedOrganizer = computed(() => authStore.isApprovedOrganizer);
const isAuthenticated = computed(() => authStore.isAuthenticated);

function handleCta() {
  successMessage.value = '';

  if (!isAuthenticated.value) {
    router.push({
      name: 'login',
      query: { redirect: route.fullPath },
    });
    return;
  }

  if (!isApprovedOrganizer.value) {
    if (authStore.isOrganizerRole) {
      router.push({ name: 'organizer-application-rejected' }).catch(() => {
        router.push({ path: '/register/organizer' });
      });
    } else {
      router.push({ path: '/register/organizer' });
    }
    return;
  }

  inviteOpen.value = true;
}

function onInvited(message: string) {
  successMessage.value = message;
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__card">
      <div class="sidebar__avatar">
        <img
          v-if="volunteer.avatar_url && !imageError"
          :src="volunteer.avatar_url"
          :alt="getVolunteerDisplayName(volunteer)"
          @error="imageError = true"
        />
        <div v-else class="sidebar__avatar-ph">
          {{ getVolunteerInitials(volunteer.full_name, volunteer.username) }}
        </div>
      </div>

      <h2 class="sidebar__name">{{ getVolunteerDisplayName(volunteer) }}</h2>
      <p class="sidebar__role">Волонтёр</p>

      <p v-if="volunteer.date_joined" class="sidebar__joined">
        Дата регистрации: {{ formatPublicDate(volunteer.date_joined) }}
      </p>

      <div class="sidebar__stats">
        <div class="sidebar__stat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>{{ volunteer.rating }}/750</span>
        </div>
        <div class="sidebar__stat sidebar__stat--text">
          {{ projectsLabel(volunteer.completed_tasks) }}
        </div>
      </div>

      <div class="sidebar__cta-wrap">
        <button type="button" class="sidebar__cta" @click="handleCta">
          Пригласить в проект
        </button>
        <p v-if="successMessage" class="sidebar__success">{{ successMessage }}</p>
        <p v-else-if="!isAuthenticated" class="sidebar__hint">
          Войдите как организатор, чтобы пригласить волонтёра
        </p>
      </div>
    </div>

    <InviteVolunteerDialog
      v-model:open="inviteOpen"
      :volunteer="volunteer"
      @invited="onInvited"
    />
  </aside>
</template>

<style scoped>
.sidebar {
  position: sticky;
  top: 100px;
  align-self: start;
}

.sidebar__card {
  background: #fff;
  border-radius: 24px;
  padding: 32px 24px;
  box-shadow: 0 12px 40px rgba(26, 60, 18, 0.08);
  border: 1px solid rgba(61, 122, 47, 0.08);
  text-align: center;
}

.sidebar__avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  background: #8bc34a;
  margin: 0 auto 20px;
  box-shadow: 0 8px 24px rgba(139, 195, 74, 0.35);
}

.sidebar__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar__avatar-ph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'DM Sans', sans-serif;
  font-size: 3rem;
  font-weight: 800;
  color: #fff;
}

.sidebar__name {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.25rem;
  font-weight: 800;
  color: #1a2018;
  margin: 0 0 4px;
  line-height: 1.3;
}

.sidebar__role {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  color: rgba(26, 32, 24, 0.55);
  margin: 0 0 16px;
}

.sidebar__joined {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  color: rgba(26, 32, 24, 0.45);
  margin: 0 0 24px;
}

.sidebar__stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;
}

.sidebar__stat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: #3d7a2f;
}

.sidebar__stat--text {
  font-weight: 600;
  color: rgba(26, 32, 24, 0.65);
  font-size: 0.85rem;
}

.sidebar__cta-wrap {
  position: relative;
}

.sidebar__cta {
  width: 100%;
  background: #3d7a2f;
  color: #fff;
  border: none;
  border-radius: 100px;
  padding: 14px 20px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.sidebar__cta:hover {
  background: #2e6323;
  transform: translateY(-1px);
}

.sidebar__hint {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.75rem;
  color: rgba(26, 32, 24, 0.45);
  margin: 10px 0 0;
  line-height: 1.4;
}

.sidebar__success {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  color: #3d7a2f;
  margin: 10px 0 0;
  line-height: 1.4;
  font-weight: 600;
}

@media (max-width: 900px) {
  .sidebar {
    position: static;
  }
}
</style>
