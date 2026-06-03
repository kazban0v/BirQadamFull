<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { PublicOrganizerDetail } from '@/services/webPortal';
import {
  getOrganizerDisplayName,
  getOrganizerInitials,
  formatPublicDate,
  projectsCountLabel,
} from '@/utils/publicOrganizer';

defineProps<{
  organizer: PublicOrganizerDetail;
}>();

const router = useRouter();
const authStore = useAuthStore();
const imageError = ref(false);

function handleVolunteerCta() {
  if (!authStore.isAuthenticated) {
    router.push({ name: 'register-volunteer' });
    return;
  }
  if (authStore.isOrganizerRole) {
    router.push({ name: 'organizer-dashboard' });
    return;
  }
  router.push({ name: 'volunteer-projects' });
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__card">
      <div class="sidebar__avatar">
        <img
          v-if="organizer.avatar_url && !imageError"
          :src="organizer.avatar_url"
          :alt="getOrganizerDisplayName(organizer)"
          @error="imageError = true"
        />
        <div v-else class="sidebar__avatar-ph">
          {{ getOrganizerInitials(getOrganizerDisplayName(organizer)) }}
        </div>
      </div>

      <h2 class="sidebar__name">{{ getOrganizerDisplayName(organizer) }}</h2>
      <p class="sidebar__role">Фонд / НКО</p>

      <p v-if="organizer.city" class="sidebar__meta">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        {{ organizer.city }}
      </p>

      <p v-if="organizer.date_joined" class="sidebar__joined">
        На платформе с {{ formatPublicDate(organizer.date_joined) }}
      </p>

      <div class="sidebar__stats">
        <div class="sidebar__stat">
          <span class="sidebar__stat-val">{{ organizer.active_projects ?? 0 }}</span>
          <span class="sidebar__stat-lbl">активных проектов</span>
        </div>
        <div class="sidebar__stat">
          <span class="sidebar__stat-val">{{ organizer.completed_projects }}</span>
          <span class="sidebar__stat-lbl">завершено</span>
        </div>
      </div>

      <div class="sidebar__actions">
        <a
          v-if="organizer.website"
          :href="organizer.website"
          target="_blank"
          rel="noopener noreferrer"
          class="sidebar__link"
        >
          Веб-сайт
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>

        <button type="button" class="sidebar__cta" @click="handleVolunteerCta">
          Участвовать в проектах
        </button>
        <p class="sidebar__hint">
          {{ projectsCountLabel(organizer.total_projects ?? organizer.active_projects ?? 0) }} на BirQadam
        </p>
      </div>
    </div>
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
  width: 112px;
  height: 112px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto 16px;
  background: #f0f4eb;
  border: 1px solid rgba(61, 122, 47, 0.1);
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
  font-size: 2.5rem;
  font-weight: 800;
  color: #3d7a2f;
}

.sidebar__name {
  font-family: 'Lora', serif;
  font-size: 1.35rem;
  font-weight: 700;
  color: #1a2018;
  margin: 0 0 4px;
  line-height: 1.3;
}

.sidebar__role {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem;
  color: rgba(26, 32, 24, 0.55);
  margin: 0 0 12px;
}

.sidebar__meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem;
  color: #2196f3;
  margin: 0 0 8px;
}

.sidebar__joined {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  color: rgba(26, 32, 24, 0.5);
  margin: 0 0 20px;
}

.sidebar__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.sidebar__stat {
  background: rgba(61, 122, 47, 0.06);
  border-radius: 12px;
  padding: 12px 8px;
}

.sidebar__stat-val {
  display: block;
  font-family: 'DM Sans', sans-serif;
  font-size: 1.25rem;
  font-weight: 800;
  color: #3d7a2f;
}

.sidebar__stat-lbl {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.68rem;
  color: rgba(26, 32, 24, 0.55);
  line-height: 1.3;
}

.sidebar__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #3d7a2f;
  color: #3d7a2f;
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
}

.sidebar__link:hover {
  background: rgba(61, 122, 47, 0.05);
}

.sidebar__cta {
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-radius: 100px;
  background: #3d7a2f;
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s;
}

.sidebar__cta:hover {
  background: #326628;
}

.sidebar__hint {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.75rem;
  color: rgba(26, 32, 24, 0.45);
  margin: 0;
}

@media (max-width: 900px) {
  .sidebar {
    position: static;
  }

  .sidebar__card {
    padding: 24px 20px;
    border-radius: 20px;
  }

  .sidebar__avatar {
    width: 96px;
    height: 96px;
  }

  .sidebar__name {
    font-size: 1.2rem;
  }
}

@media (max-width: 480px) {
  .sidebar__stats {
    grid-template-columns: 1fr;
  }

  .sidebar__cta,
  .sidebar__link {
    font-size: 0.88rem;
  }
}
</style>
