<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import type { PublicOrganizer } from '@/services/webPortal';
import { getOrganizerDisplayName, getOrganizerInitials } from '@/utils/publicOrganizer';

defineProps<{
  organizers: PublicOrganizer[];
}>();

const imageErrors = ref<Record<number, boolean>>({});
</script>

<template>
  <section v-if="organizers.length" class="related">
    <h2 class="related__title">Другие организации</h2>

    <ul class="related__list">
      <li v-for="org in organizers" :key="org.id">
        <RouterLink
          :to="{ name: 'public-organizer-detail', params: { id: String(org.id) } }"
          class="related__row"
        >
          <div class="related__avatar">
            <img
              v-if="org.avatar_url && !imageErrors[org.id]"
              :src="org.avatar_url"
              :alt="getOrganizerDisplayName(org)"
              @error="imageErrors[org.id] = true"
            />
            <span v-else class="related__avatar-ph">
              {{ getOrganizerInitials(getOrganizerDisplayName(org)) }}
            </span>
          </div>

          <div class="related__info">
            <span class="related__name">{{ getOrganizerDisplayName(org) }}</span>
            <span v-if="org.city" class="related__city">{{ org.city }}</span>
          </div>

          <div class="related__meta">
            <span>{{ org.completed_projects }} завершено</span>
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

.related__city {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  color: rgba(26, 32, 24, 0.5);
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
    min-width: 88px;
  }
}
</style>
