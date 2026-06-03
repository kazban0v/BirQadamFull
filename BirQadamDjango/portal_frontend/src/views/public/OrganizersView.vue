<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchPublicOrganizers, type PublicOrganizer } from '@/services/webPortal';
import PublicPageHero from '@/components/public/PublicPageHero.vue';
import { getOrganizerDisplayName, getOrganizerInitials, formatPublicDate } from '@/utils/publicOrganizer';

const organizers = ref<PublicOrganizer[]>([]);
const loading = ref(true);
const error = ref(false);
const searchQuery = ref('');
const imageErrors = ref<Record<number, boolean>>({});

onMounted(async () => {
  await loadOrganizers();
});

async function loadOrganizers() {
  loading.value = true;
  error.value = false;
  imageErrors.value = {};
  try {
    organizers.value = await fetchPublicOrganizers(searchQuery.value);
  } catch (err) {
    console.error('Failed to fetch organizers', err);
    error.value = true;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  loadOrganizers();
}
</script>

<template>
  <div class="pg">
    <PublicPageHero
      title="Реестр Фондов и НКО"
      description="Организации, которые создают возможности для добрых дел."
      search-placeholder="Поиск по названию или городу..."
      v-model:search-model="searchQuery"
      @search="handleSearch"
    />

    <div class="pg__body">
      <div v-if="loading" class="pg__loading">
        <div class="spinner"></div>
      </div>
      
      <div v-else-if="error" class="pg__error">
        <p>Не удалось загрузить реестр организаций. Пожалуйста, попробуйте позже.</p>
        <button @click="loadOrganizers" class="btn-retry">Повторить</button>
      </div>

      <div v-else-if="organizers.length === 0" class="pg__empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <p>Организации не найдены.</p>
      </div>

      <div v-else class="o-grid">
        <RouterLink
          v-for="org in organizers"
          :key="org.id"
          :to="{ name: 'public-organizer-detail', params: { id: org.id } }"
          class="o-card"
        >
          <div class="o-card__top">
            <div class="o-card__avatar">
              <img 
                v-if="org.avatar_url && !imageErrors[org.id]" 
                :src="org.avatar_url" 
                :alt="org.organization_name" 
                @error="imageErrors[org.id] = true" 
              />
              <div v-else class="o-card__avatar-placeholder">
                {{ getOrganizerInitials(getOrganizerDisplayName(org)) }}
              </div>
            </div>
            
            <div class="o-card__badge" v-if="org.city">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {{ org.city }}
            </div>
          </div>
          
          <div class="o-card__content">
            <h3 class="o-card__name">{{ getOrganizerDisplayName(org) }}</h3>
            
            <div class="o-card__stats">
              <div class="stat-row">
                <span class="stat-lbl">Проектов:</span>
                <span class="stat-val">{{ org.completed_projects }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-lbl">С нами с:</span>
                <span class="stat-val">{{ formatPublicDate(org.date_joined) }}</span>
              </div>
            </div>
          </div>

          <div class="o-card__footer">
            <a
              v-if="org.website"
              :href="org.website"
              target="_blank"
              rel="noopener noreferrer"
              class="o-btn o-btn--outline"
              @click.stop
            >
              Веб-сайт
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            <span v-else class="o-btn o-btn--disabled">Нет сайта</span>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pg {
  --green: #3d7a2f;
  --cream: #faf8f3;
  --ink: #1a2018;
  --blue: #2196F3;
  background: var(--cream);
  min-height: 100vh;
  padding-bottom: 80px;
}

.pg__body {
  max-width: 1200px;
  margin: 0 auto;
  padding: 60px 24px;
  position: relative;
  z-index: 2;
}

.o-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 24px;
}

.o-card {
  background: #fff;
  border-radius: 24px;
  padding: 24px;
  border: 1px solid rgba(61,122,47,0.08);
  box-shadow: 0 8px 24px rgba(26,60,18,0.04);
  transition: transform 0.3s, box-shadow 0.3s;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
}

.o-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px rgba(26,60,18,0.08);
}

.o-card__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.o-card__avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: #f0f4eb;
  flex-shrink: 0;
  border: 1px solid rgba(61,122,47,0.1);
}

.o-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.o-card__avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'DM Sans', sans-serif;
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--green);
}

.o-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(33, 150, 243, 0.1);
  color: var(--blue);
  padding: 6px 12px;
  border-radius: 100px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
}

.o-card__content {
  flex: 1;
  margin-bottom: 24px;
}

.o-card__name {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 16px;
  line-height: 1.3;
}

.o-card__stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(0,0,0,0.05);
}

.stat-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.stat-lbl {
  color: rgba(26,32,24,0.6);
}

.stat-val {
  font-weight: 700;
  color: var(--ink);
}

.o-card__footer {
  margin-top: auto;
}

.o-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  text-decoration: none;
  transition: all 0.2s;
}

.o-btn--outline {
  border: 1px solid var(--green);
  color: var(--green);
  background: transparent;
}

.o-btn--outline:hover {
  background: rgba(61,122,47,0.05);
}

.o-btn--disabled {
  border: 1px dashed rgba(0,0,0,0.1);
  color: rgba(0,0,0,0.3);
  background: transparent;
  cursor: not-allowed;
}

.pg__loading, .pg__error, .pg__empty {
  text-align: center;
  padding: 60px 24px;
  color: rgba(26,32,24,0.5);
  font-family: 'DM Sans', sans-serif;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(61,122,47,0.2);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin { 100% { transform: rotate(360deg); } }

.btn-retry {
  background: var(--green);
  color: #fff;
  border: none;
  border-radius: 100px;
  padding: 10px 24px;
  font-weight: 600;
  margin-top: 16px;
  cursor: pointer;
}

.pg__empty svg {
  color: rgba(26,32,24,0.2);
  margin-bottom: 16px;
}
</style>
