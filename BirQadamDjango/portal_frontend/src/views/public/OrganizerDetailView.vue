<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchPublicOrganizerDetail,
  type PublicOrganizer,
  type PublicOrganizerDetail,
} from '@/services/webPortal';
import PublicBreadcrumbs from '@/components/public/PublicBreadcrumbs.vue';
import OrganizerSidebarCard from '@/components/public/OrganizerSidebarCard.vue';
import RelatedOrganizersCarousel from '@/components/public/RelatedOrganizersCarousel.vue';
import { getOrganizerDisplayName, formatPublicDate } from '@/utils/publicOrganizer';

const route = useRoute();
const router = useRouter();

const organizer = ref<PublicOrganizerDetail | null>(null);
const relatedOrganizers = ref<PublicOrganizer[]>([]);
const loading = ref(true);
const error = ref(false);
const activeTab = ref<'about' | 'projects'>('about');

const displayName = computed(() =>
  organizer.value ? getOrganizerDisplayName(organizer.value) : '',
);

const aboutText = computed(() => {
  const org = organizer.value;
  if (!org) return null;
  return org.bio?.trim() || null;
});

watch(
  () => route.params.id,
  async () => {
    activeTab.value = 'about';
    await loadOrganizer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  { immediate: true },
);

async function loadOrganizer() {
  const id = route.params.id as string;
  if (!id) return;

  loading.value = true;
  error.value = false;
  try {
    const data = await fetchPublicOrganizerDetail(id);
    organizer.value = data.organizer;
    relatedOrganizers.value = data.related_organizers;
  } catch (err) {
    console.error('Failed to fetch organizer', err);
    error.value = true;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="pg">
    <div v-if="loading" class="pg__state">
      <div class="spinner"></div>
    </div>

    <div v-else-if="error || !organizer" class="pg__state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      <h2>Организация не найдена</h2>
      <p>Возможно, профиль был скрыт или ещё не одобрен модерацией.</p>
      <button type="button" @click="router.push({ name: 'public-organizers' })" class="btn-back">Вернуться к реестру</button>
    </div>

    <div v-else class="detail">
      <div class="detail__inner">
        <PublicBreadcrumbs
          :items="[
            { label: 'Главная', to: { name: 'home' } },
            { label: 'Фонды и НКО', to: { name: 'public-organizers' } },
            { label: displayName },
          ]"
        />

        <header class="detail__header">
          <h1 class="detail__title">{{ displayName }}</h1>
          <p class="detail__subtitle">Публичный профиль организации на BirQadam</p>
        </header>

        <div class="detail__layout">
          <main class="detail__main">
            <OrganizerSidebarCard :organizer="organizer" class="detail__sidebar-mobile" />

            <div class="tabs">
              <button
                type="button"
                class="tabs__btn"
                :class="{ 'tabs__btn--active': activeTab === 'about' }"
                @click="activeTab = 'about'"
              >
                О фонде
              </button>
              <button
                type="button"
                class="tabs__btn"
                :class="{ 'tabs__btn--active': activeTab === 'projects' }"
                @click="activeTab = 'projects'"
              >
                Проекты
                <span v-if="organizer.projects.length" class="tabs__count">{{ organizer.projects.length }}</span>
              </button>
            </div>

            <div v-show="activeTab === 'about'" class="tab-panel">
              <section class="section">
                <h2 class="section__title">О фонде</h2>
                <p v-if="aboutText" class="section__bio">{{ aboutText }}</p>
                <p v-else class="section__empty">Организация пока не добавила описание.</p>
              </section>

              <section v-if="organizer.work_history" class="section">
                <h2 class="section__title">Опыт</h2>
                <p v-if="organizer.work_experience_years" class="section__meta">
                  Опыт: {{ organizer.work_experience_years }} {{ organizer.work_experience_years === 1 ? 'год' : organizer.work_experience_years < 5 ? 'года' : 'лет' }}
                </p>
                <p class="section__bio">{{ organizer.work_history }}</p>
              </section>
            </div>

            <div v-show="activeTab === 'projects'" class="tab-panel">
              <section class="section">
                <h2 class="section__title">Проекты организации</h2>

                <div v-if="organizer.projects.length" class="projects-grid">
                  <article v-for="project in organizer.projects" :key="project.id" class="project-card">
                    <div class="project-card__cover">
                      <img v-if="project.cover_url" :src="project.cover_url" :alt="project.title" />
                      <div v-else class="project-card__cover-ph">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        </svg>
                      </div>
                    </div>
                    <div class="project-card__body">
                      <h3 class="project-card__title">{{ project.title }}</h3>
                      <p v-if="project.description" class="project-card__desc">{{ project.description }}</p>
                      <p class="project-card__meta">{{ project.city }} · {{ project.volunteer_type_display }}</p>
                      <p v-if="project.start_date" class="project-card__date">
                        {{ formatPublicDate(project.start_date) }}
                        <template v-if="project.end_date"> — {{ formatPublicDate(project.end_date) }}</template>
                      </p>
                    </div>
                  </article>
                </div>

                <p v-else class="section__empty">У организации пока нет опубликованных проектов на BirQadam.</p>
              </section>
            </div>

            <RelatedOrganizersCarousel :organizers="relatedOrganizers" />
          </main>

          <OrganizerSidebarCard :organizer="organizer" class="detail__sidebar-desktop" />
        </div>
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
  padding: 100px 24px 80px;
}

.pg__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 48px 24px;
  text-align: center;
  color: rgba(26, 32, 24, 0.55);
  font-family: 'DM Sans', sans-serif;
}

.pg__state h2 {
  font-family: 'Lora', serif;
  color: var(--ink);
  margin: 16px 0 8px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(61, 122, 47, 0.2);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { 100% { transform: rotate(360deg); } }

.btn-back {
  margin-top: 20px;
  background: var(--green);
  color: #fff;
  border: none;
  border-radius: 100px;
  padding: 12px 24px;
  font-weight: 700;
  cursor: pointer;
}

.detail__inner {
  max-width: 1200px;
  margin: 0 auto;
}

.detail__sidebar-mobile {
  margin-bottom: 32px;
}

.detail__header {
  margin-bottom: 32px;
}

.detail__title {
  font-family: 'Lora', serif;
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 8px;
}

.detail__subtitle {
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  color: rgba(26, 32, 24, 0.55);
  margin: 0;
}

.detail__layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 40px;
  align-items: start;
}

@media (max-width: 900px) {
  .detail__layout { grid-template-columns: 1fr; }
  .detail__sidebar-desktop { display: none; }
}

@media (min-width: 901px) {
  .detail__sidebar-mobile { display: none; }
}

@media (max-width: 640px) {
  .pg {
    padding: 88px 16px 64px;
  }

  .detail__header {
    margin-bottom: 24px;
  }

  .detail__title {
    font-size: 1.75rem;
  }

  .detail__subtitle {
    font-size: 0.9rem;
  }

  .tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    gap: 0;
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }

  .tabs__btn {
    flex-shrink: 0;
    padding: 10px 14px;
    font-size: 0.88rem;
  }

  .section__title {
    font-size: 1.25rem;
  }

  .projects-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .project-card__body {
    padding: 14px;
  }
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 28px;
  border-bottom: 1px solid rgba(61, 122, 47, 0.12);
  padding-bottom: 0;
}

.tabs__btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 12px 16px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(26, 32, 24, 0.5);
  cursor: pointer;
  margin-bottom: -1px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tabs__btn--active {
  color: var(--green);
  border-bottom-color: var(--green);
}

.tabs__count {
  font-size: 0.75rem;
  background: rgba(61, 122, 47, 0.12);
  color: var(--green);
  padding: 2px 8px;
  border-radius: 100px;
}

.section {
  margin-bottom: 40px;
}

.section__title {
  font-family: 'Lora', serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 16px;
}

.section__bio {
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  line-height: 1.65;
  color: rgba(26, 32, 24, 0.85);
  white-space: pre-wrap;
  margin: 0;
}

.section__meta {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--green);
  margin: 0 0 8px;
}

.section__empty {
  font-family: 'DM Sans', sans-serif;
  color: rgba(26, 32, 24, 0.45);
  margin: 0;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.project-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(61, 122, 47, 0.1);
  box-shadow: 0 4px 16px rgba(26, 60, 18, 0.04);
}

.project-card__cover {
  aspect-ratio: 16 / 9;
  background: #eef3ea;
}

.project-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.project-card__cover-ph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(61, 122, 47, 0.35);
}

.project-card__body {
  padding: 16px;
}

.project-card__title {
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 6px;
  line-height: 1.35;
}

.project-card__desc {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem;
  line-height: 1.5;
  color: rgba(26, 32, 24, 0.72);
  margin: 0 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-card__meta {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.82rem;
  color: rgba(26, 32, 24, 0.55);
  margin: 0 0 4px;
}

.project-card__date {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  color: rgba(26, 32, 24, 0.4);
  margin: 0;
}
</style>
