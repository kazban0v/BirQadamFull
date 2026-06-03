<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import type { PublicVolunteer } from '@/services/webPortal';
import { getVolunteerDisplayName, getVolunteerInitials } from '@/utils/publicVolunteer';

defineProps<{
  volunteers: PublicVolunteer[];
}>();

const imageErrors = ref<Record<number, boolean>>({});
</script>

<template>
  <section v-if="volunteers.length" class="related">
    <h2 class="related__title">Другие волонтёры</h2>

    <ul class="related__list">
      <li v-for="vol in volunteers" :key="vol.id">
        <RouterLink
          :to="{ name: 'public-volunteer-detail', params: { id: String(vol.id) } }"
          class="related__row"
        >
          <div class="related__avatar">
            <img
              v-if="vol.avatar_url && !imageErrors[vol.id]"
              :src="vol.avatar_url"
              :alt="getVolunteerDisplayName(vol)"
              @error="imageErrors[vol.id] = true"
            />
            <span v-else class="related__avatar-ph">
              {{ getVolunteerInitials(vol.full_name, vol.username) }}
            </span>
          </div>

          <div class="related__info">
            <span class="related__name">{{ getVolunteerDisplayName(vol) }}</span>
            <span v-if="vol.bio" class="related__bio">{{ vol.bio }}</span>
          </div>

          <div class="related__meta">
            <span>{{ vol.completed_tasks }} задач</span>
          </div>

          <svg class="related__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.related {
  padding: 40px 0 16px;
}

.related__title {
  font-family: 'Lora', serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a2018;
  margin: 0 0 16px;
}

.related__list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: #fff;
  border: 1px solid rgba(61, 122, 47, 0.1);
  border-radius: 16px;
  overflow: hidden;
}

.related__row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid rgba(61, 122, 47, 0.08);
  transition: background 0.15s;
}

.related__list li:last-child .related__row {
  border-bottom: none;
}

.related__row:hover {
  background: rgba(61, 122, 47, 0.04);
}

.related__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #f0f4eb;
  border: 1px solid rgba(61, 122, 47, 0.1);
}

.related__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.related__avatar-ph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  font-weight: 800;
  color: #3d7a2f;
}

.related__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.related__name {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.92rem;
  font-weight: 700;
  color: #1a2018;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.related__bio {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  color: rgba(26, 32, 24, 0.5);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.related__meta {
  flex-shrink: 0;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.75rem;
  color: rgba(26, 32, 24, 0.45);
  text-align: right;
  display: none;
}

.related__chev {
  flex-shrink: 0;
  color: rgba(61, 122, 47, 0.45);
}

@media (min-width: 640px) {
  .related__meta {
    display: block;
    min-width: 72px;
  }
}
</style>
