<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchPublicVolunteers, type PublicVolunteer, type VolunteerSort } from '@/services/webPortal';
import PublicPageHero from '@/components/public/PublicPageHero.vue';
import VolunteerMiniCard from '@/components/public/VolunteerMiniCard.vue';

const volunteers = ref<PublicVolunteer[]>([]);
const loading = ref(true);
const error = ref(false);
const searchQuery = ref('');
const sortBy = ref<VolunteerSort>('rating');

onMounted(async () => {
  await loadVolunteers();
});

async function loadVolunteers() {
  loading.value = true;
  error.value = false;
  try {
    volunteers.value = await fetchPublicVolunteers(searchQuery.value, sortBy.value);
  } catch (err) {
    console.error('Failed to fetch volunteers', err);
    error.value = true;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  loadVolunteers();
}

function handleSortChange() {
  loadVolunteers();
}
</script>

<template>
  <div class="pg">
    <PublicPageHero
      title="Топ Волонтёров"
      description="Люди, которые делают мир лучше каждый день."
      search-placeholder="Поиск по имени..."
      v-model:search-model="searchQuery"
      @search="handleSearch"
    />

    <div class="pg__body">
      <div class="pg__toolbar">
        <div class="pg__sort">
          <label class="pg__sort-label" for="vol-sort">Сортировка</label>
          <select id="vol-sort" v-model="sortBy" @change="handleSortChange" class="pg__sort-select">
            <option value="rating">По рейтингу</option>
            <option value="tasks">По заданиям</option>
            <option value="newest">Новые</option>
          </select>
        </div>
      </div>

      <div v-if="loading" class="pg__loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="error" class="pg__error">
        <p>Не удалось загрузить список волонтёров. Пожалуйста, попробуйте позже.</p>
        <button type="button" @click="loadVolunteers" class="btn-retry">Повторить</button>
      </div>

      <div v-else-if="volunteers.length === 0" class="pg__empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <p>Волонтёры не найдены.</p>
      </div>

      <div v-else class="v-grid">
        <VolunteerMiniCard
          v-for="vol in volunteers"
          :key="vol.id"
          :volunteer="vol"
          centered
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pg {
  --green: #3d7a2f;
  --cream: #faf8f3;
  --ink: #1a2018;
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

.pg__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  margin-bottom: 32px;
}

.pg__sort {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.pg__sort-label {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(26, 32, 24, 0.55);
}

.pg__sort-select {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 8px 32px 8px 14px;
  border-radius: 100px;
  border: 1px solid rgba(61, 122, 47, 0.2);
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233d7a2f' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.v-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 24px;
}

.pg__loading, .pg__error, .pg__empty {
  text-align: center;
  padding: 60px 24px;
  color: rgba(26, 32, 24, 0.5);
  font-family: 'DM Sans', sans-serif;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(61, 122, 47, 0.2);
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
  color: rgba(26, 32, 24, 0.2);
  margin-bottom: 16px;
}
</style>
