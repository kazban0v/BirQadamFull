<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import type { PublicVolunteer } from '@/services/webPortal';
import { getVolunteerDisplayName, getVolunteerInitials } from '@/utils/publicVolunteer';
import VolunteerLevelBadge from './VolunteerLevelBadge.vue';

defineProps<{
  volunteer: PublicVolunteer;
  centered?: boolean;
}>();

const imageError = ref(false);
</script>

<template>
  <RouterLink
    :to="{ name: 'public-volunteer-detail', params: { id: String(volunteer.id) } }"
    class="mini-card"
    :class="{ 'mini-card--centered': centered }"
  >
    <div class="mini-card__avatar-wrap">
      <div class="mini-card__avatar">
        <img
          v-if="volunteer.avatar_url && !imageError"
          :src="volunteer.avatar_url"
          :alt="getVolunteerDisplayName(volunteer)"
          @error="imageError = true"
        />
        <div v-else class="mini-card__avatar-ph">
          {{ getVolunteerInitials(volunteer.full_name, volunteer.username) }}
        </div>
      </div>
      <VolunteerLevelBadge :level="volunteer.level" size="sm" class="mini-card__badge" />
    </div>

    <h3 class="mini-card__name">{{ getVolunteerDisplayName(volunteer) }}</h3>

    <div class="mini-card__stats">
      <span class="mini-card__stat">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        {{ volunteer.rating }}
      </span>
      <span class="mini-card__stat mini-card__stat--star">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        {{ volunteer.average_rating.toFixed(1) }}
      </span>
      <span class="mini-card__projects">{{ volunteer.completed_tasks }} {{ volunteer.completed_tasks === 1 ? 'проект' : volunteer.completed_tasks < 5 ? 'проекта' : 'проектов' }}</span>
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

.mini-card__avatar-wrap {
  position: relative;
  margin-bottom: 16px;
}

.mini-card__avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: #8bc34a;
  box-shadow: 0 4px 16px rgba(139, 195, 74, 0.35);
}

.mini-card--centered .mini-card__avatar-wrap {
  margin-left: auto;
  margin-right: auto;
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
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
}

.mini-card__badge {
  position: absolute;
  bottom: -4px;
  right: -8px;
}

.mini-card__name {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a2018;
  margin: 0 0 12px;
  line-height: 1.3;
}

.mini-card__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  width: 100%;
}

.mini-card--centered .mini-card__stats {
  justify-content: center;
}

.mini-card__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  color: #3d7a2f;
}

.mini-card__stat--star {
  color: #f5a623;
}

.mini-card__projects {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(26, 32, 24, 0.5);
  margin-left: auto;
}

.mini-card--centered .mini-card__projects {
  margin-left: 0;
}
</style>
