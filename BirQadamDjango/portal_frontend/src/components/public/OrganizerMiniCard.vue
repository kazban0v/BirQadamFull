<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import type { PublicOrganizer } from '@/services/webPortal';
import { getOrganizerDisplayName, getOrganizerInitials, formatPublicDate } from '@/utils/publicOrganizer';

defineProps<{
  organizer: PublicOrganizer;
  centered?: boolean;
}>();

const imageError = ref(false);
</script>

<template>
  <RouterLink
    :to="{ name: 'public-organizer-detail', params: { id: String(organizer.id) } }"
    class="mini-card"
    :class="{ 'mini-card--centered': centered }"
  >
    <div class="mini-card__avatar">
      <img
        v-if="organizer.avatar_url && !imageError"
        :src="organizer.avatar_url"
        :alt="getOrganizerDisplayName(organizer)"
        @error="imageError = true"
      />
      <div v-else class="mini-card__avatar-ph">
        {{ getOrganizerInitials(getOrganizerDisplayName(organizer)) }}
      </div>
    </div>

    <h3 class="mini-card__name">{{ getOrganizerDisplayName(organizer) }}</h3>
    <p v-if="organizer.city" class="mini-card__city">{{ organizer.city }}</p>

    <div class="mini-card__stats">
      <span>{{ organizer.completed_projects }} завершено</span>
      <span v-if="organizer.date_joined">с {{ formatPublicDate(organizer.date_joined) }}</span>
    </div>
  </RouterLink>
</template>

<style scoped>
.mini-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: #fff;
  border-radius: 24px;
  padding: 24px;
  border: 1px solid rgba(61, 122, 47, 0.08);
  box-shadow: 0 8px 24px rgba(26, 60, 18, 0.04);
  text-decoration: none;
  color: inherit;
  transition: transform 0.3s, box-shadow 0.3s;
  height: 100%;
}

.mini-card--centered {
  align-items: center;
  text-align: center;
}

.mini-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px rgba(26, 60, 18, 0.08);
}

.mini-card__avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  background: #f0f4eb;
  margin-bottom: 16px;
  border: 1px solid rgba(61, 122, 47, 0.1);
}

.mini-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mini-card__avatar-ph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'DM Sans', sans-serif;
  font-size: 1.5rem;
  font-weight: 800;
  color: #3d7a2f;
}

.mini-card__name {
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #1a2018;
  margin: 0 0 6px;
  line-height: 1.35;
}

.mini-card__city {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.82rem;
  color: rgba(26, 32, 24, 0.55);
  margin: 0 0 12px;
}

.mini-card__stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  color: rgba(26, 32, 24, 0.6);
  margin-top: auto;
}
</style>
