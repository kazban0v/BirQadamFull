<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchPublicVolunteerDetail, type PublicVolunteer, type PublicVolunteerReview } from '@/services/webPortal';
import PublicBreadcrumbs from '@/components/public/PublicBreadcrumbs.vue';
import VolunteerSidebarCard from '@/components/public/VolunteerSidebarCard.vue';
import HowItWorksStrip from '@/components/public/HowItWorksStrip.vue';
import RelatedVolunteersCarousel from '@/components/public/RelatedVolunteersCarousel.vue';
import VolunteerReviewCard from '@/components/public/VolunteerReviewCard.vue';
import { getVolunteerDisplayName } from '@/utils/publicVolunteer';

const route = useRoute();
const router = useRouter();

const volunteer = ref<PublicVolunteer | null>(null);
const relatedVolunteers = ref<PublicVolunteer[]>([]);
const reviews = ref<PublicVolunteerReview[]>([]);
const loading = ref(true);
const error = ref(false);
const activeTab = ref<'about' | 'achievements'>('about');

const displayName = computed(() =>
  volunteer.value ? getVolunteerDisplayName(volunteer.value) : ''
);

watch(
  () => route.params.id,
  async () => {
    activeTab.value = 'about';
    await loadVolunteer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  { immediate: true },
);

async function loadVolunteer() {
  const id = route.params.id as string;
  if (!id) return;

  loading.value = true;
  error.value = false;
  try {
    const data = await fetchPublicVolunteerDetail(id);
    volunteer.value = data.volunteer;
    relatedVolunteers.value = data.related_volunteers;
    reviews.value = data.reviews ?? [];
  } catch (err) {
    console.error('Failed to fetch volunteer', err);
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

    <div v-else-if="error || !volunteer" class="pg__state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <h2>Волонтёр не найден</h2>
      <p>Возможно, профиль был скрыт или удалён.</p>
      <button type="button" @click="router.push({ name: 'public-volunteers' })" class="btn-back">Вернуться к списку</button>
    </div>

    <div v-else class="detail">
      <div class="detail__inner">
        <PublicBreadcrumbs
          :items="[
            { label: 'Главная', to: { name: 'home' } },
            { label: 'Волонтёры', to: { name: 'public-volunteers' } },
            { label: displayName },
          ]"
        />

        <header class="detail__header">
          <h1 class="detail__title">{{ displayName }}</h1>
          <p class="detail__subtitle">Публичный профиль волонтёра BirQadam</p>
        </header>

        <div class="detail__layout">
          <main class="detail__main">
            <!-- Mobile sidebar -->
            <VolunteerSidebarCard :volunteer="volunteer" class="detail__sidebar-mobile" />

            <div class="tabs">
              <button
                type="button"
                class="tabs__btn"
                :class="{ 'tabs__btn--active': activeTab === 'about' }"
                @click="activeTab = 'about'"
              >
                О волонтёре
              </button>
              <button
                type="button"
                class="tabs__btn"
                :class="{ 'tabs__btn--active': activeTab === 'achievements' }"
                @click="activeTab = 'achievements'"
              >
                Достижения
                <span v-if="volunteer.achievements.length" class="tabs__count">{{ volunteer.achievements.length }}</span>
              </button>
            </div>

            <!-- About tab -->
            <div v-show="activeTab === 'about'" class="tab-panel">
              <section class="section">
                <h2 class="section__title">О волонтёре</h2>
                <p v-if="volunteer.bio" class="section__bio">{{ volunteer.bio }}</p>
                <p v-else class="section__empty">Волонтёр пока не заполнил описание.</p>
              </section>

              <section class="section">
                <h2 class="section__title">Документы</h2>
                <div class="docs">
                  <div v-for="doc in volunteer.documents ?? []" :key="doc.doc_type" class="docs__row">
                    <div class="docs__info">
                      <span class="docs__label">{{ doc.label }}</span>
                      <span v-if="doc.original_name" class="docs__fname">{{ doc.original_name }}</span>
                    </div>
                    <a
                      v-if="doc.download_url"
                      :href="doc.download_url"
                      class="docs__dl docs__dl--active"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Скачать
                    </a>
                    <span v-else class="docs__missing">Не загружено</span>
                  </div>
                </div>
              </section>

              <section class="section">
                <div class="section__head">
                  <h2 class="section__title">Отзывы</h2>
                  <span class="section__badge">{{ volunteer.reviews_count }}</span>
                </div>

                <div v-if="reviews.length" class="reviews-list">
                  <VolunteerReviewCard
                    v-for="review in reviews"
                    :key="review.id"
                    :review="review"
                  />
                </div>

                <div v-else class="reviews-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <p>Отзывы появятся после завершения проектов с фондами.</p>
                </div>
              </section>
            </div>

            <!-- Achievements tab -->
            <div v-show="activeTab === 'achievements'" class="tab-panel">
              <section class="section">
                <h2 class="section__title">Достижения</h2>
                <div v-if="volunteer.achievements.length" class="ach-grid">
                  <div v-for="(ach, i) in volunteer.achievements" :key="i" class="ach-card">
                    <div class="ach-card__icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 class="ach-card__name">{{ ach.name }}</h3>
                      <p class="ach-card__desc">{{ ach.description }}</p>
                    </div>
                  </div>
                </div>
                <p v-else class="section__empty">Достижения появятся по мере активности на платформе.</p>
              </section>
            </div>

            <HowItWorksStrip />
            <RelatedVolunteersCarousel :volunteers="relatedVolunteers" />
          </main>

          <VolunteerSidebarCard :volunteer="volunteer" class="detail__sidebar-desktop" />
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
  text-align: center;
  padding: 100px 20px;
  color: rgba(26, 32, 24, 0.6);
  font-family: 'DM Sans', sans-serif;
}

.pg__state svg {
  margin-bottom: 20px;
  color: rgba(26, 32, 24, 0.3);
}

.pg__state h2 {
  font-family: 'Lora', serif;
  font-size: 2rem;
  color: var(--ink);
  margin-bottom: 8px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(61, 122, 47, 0.2);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin { 100% { transform: rotate(360deg); } }

.btn-back {
  background: var(--green);
  color: #fff;
  border: none;
  border-radius: 100px;
  padding: 12px 24px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  margin-top: 24px;
  cursor: pointer;
}

.detail__inner {
  max-width: 1200px;
  margin: 0 auto;
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
  line-height: 1.2;
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
  .detail__layout {
    grid-template-columns: 1fr;
  }

  .detail__sidebar-desktop {
    display: none;
  }
}

@media (min-width: 901px) {
  .detail__sidebar-mobile {
    display: none;
  }
}

.detail__sidebar-mobile {
  margin-bottom: 32px;
}

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid rgba(61, 122, 47, 0.12);
  margin-bottom: 32px;
}

.tabs__btn {
  background: none;
  border: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(26, 32, 24, 0.45);
  padding: 12px 20px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: color 0.2s;
}

.tabs__btn--active {
  color: var(--green);
  border-bottom-color: var(--green);
}

.tabs__count {
  background: rgba(61, 122, 47, 0.12);
  color: var(--green);
  font-size: 0.75rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 100px;
}

.section {
  margin-bottom: 40px;
}

.section__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.section__title {
  font-family: 'Lora', serif;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 16px;
}

.section__head .section__title {
  margin-bottom: 0;
}

.section__bio {
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(26, 32, 24, 0.8);
  margin: 0;
  white-space: pre-wrap;
}

.section__empty {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  color: rgba(26, 32, 24, 0.45);
  margin: 0;
  font-style: italic;
}

.section__badge {
  background: rgba(26, 32, 24, 0.08);
  color: rgba(26, 32, 24, 0.55);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 100px;
}

.docs {
  border: 1px solid rgba(61, 122, 47, 0.12);
  border-radius: 16px;
  overflow: hidden;
}

.docs__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  gap: 16px;
}

.docs__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.docs__fname {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  color: rgba(26, 32, 24, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.docs__row:last-child {
  border-bottom: none;
}

.docs__label {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ink);
}

.docs__dl {
  background: none;
  border: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  color: #2a9d8f;
  cursor: not-allowed;
  opacity: 0.5;
  text-decoration: none;
}

.docs__dl--active {
  cursor: pointer;
  opacity: 1;
}

.docs__dl--active:hover {
  text-decoration: underline;
}

.docs__missing {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  color: rgba(26, 32, 24, 0.45);
}

.reviews-empty {
  text-align: center;
  padding: 40px 24px;
  background: #fff;
  border-radius: 16px;
  border: 1px dashed rgba(61, 122, 47, 0.2);
}

.reviews-empty svg {
  color: rgba(26, 32, 24, 0.2);
  margin-bottom: 12px;
}

.reviews-empty p {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  color: rgba(26, 32, 24, 0.5);
  margin: 0;
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ach-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ach-card {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(61, 122, 47, 0.08);
  box-shadow: 0 4px 16px rgba(26, 60, 18, 0.04);
}

.ach-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(61, 122, 47, 0.1);
  color: var(--green);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ach-card__name {
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 4px;
}

.ach-card__desc {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.875rem;
  color: rgba(26, 32, 24, 0.6);
  margin: 0;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .pg {
    padding: 88px 16px 64px;
  }

  .docs__row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
