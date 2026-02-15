<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useDashboardStore } from '@/stores/dashboard';
import { fetchVolunteerStats, type VolunteerAchievement } from '@/services/stats';
import { useAuthStore } from '@/stores/auth';

const dashboardStore = useDashboardStore();
const authStore = useAuthStore();
const loading = ref(false);
const stats = ref<Awaited<ReturnType<typeof fetchVolunteerStats>> | null>(null);
const achievements = ref<VolunteerAchievement[]>([]);

const loadAchievements = async () => {
  loading.value = true;
  try {
    const response = await fetchVolunteerStats();
    console.log('🔍 Full response:', response);
    console.log('🔍 Response type:', typeof response);
    console.log('🔍 Response.achievements:', response?.achievements);
    console.log('🔍 Response.achievements type:', typeof response?.achievements);
    console.log('🔍 Is array?', Array.isArray(response?.achievements));
    console.log('🔍 Achievements length:', response?.achievements?.length);
    
    if (response) {
      stats.value = response;
      // Проверяем наличие achievements в ответе
      if (response.achievements !== undefined && Array.isArray(response.achievements)) {
        achievements.value = response.achievements;
        console.log('✅ Achievements loaded:', achievements.value.length);
        console.log('✅ First achievement:', achievements.value[0]);
      } else {
        console.warn('⚠️ Achievements is not an array or undefined');
        console.warn('⚠️ Response.achievements:', response.achievements);
        console.warn('⚠️ Response keys:', Object.keys(response));
        achievements.value = [];
      }
    } else {
      console.warn('⚠️ Empty response');
      achievements.value = [];
    }
  } catch (error: any) {
    console.error('❌ Failed to load achievements:', error);
    achievements.value = [];
    stats.value = null;
  } finally {
    loading.value = false;
    console.log('Loading finished. Achievements count:', achievements.value.length);
  }
};

const getProgress = (achievement: VolunteerAchievement): number => {
  if (achievement.unlocked) return 100;
  if (!stats.value) return 0;
  const currentRating = stats.value.rating || 0;
  const requiredRating = achievement.required_rating || 0;
  if (requiredRating === 0) return 0;
  return Math.min(100, Math.round((currentRating / requiredRating) * 100));
};

const getIcon = (achievement: VolunteerAchievement): string => {
  if (achievement.icon) return achievement.icon;
  return achievement.unlocked ? 'mdi-trophy' : 'mdi-trophy-outline';
};

// Computed для отладки
const hasAchievements = computed(() => {
  const has = achievements.value.length > 0;
  console.log('hasAchievements computed:', has, 'count:', achievements.value.length);
  return has;
});

onMounted(async () => {
  await loadAchievements();
});
</script>

<template>
  <div class="achievements-view">
    <v-row class="ga-6">
      <v-col cols="12" lg="7">
        <v-card class="hero-card" elevation="6" rounded="xl">
          <div class="hero-card__content">
            <div class="hero-card__badge">
              <v-icon icon="mdi-trophy-outline" size="20" />
              Личные достижения
            </div>
            <h1 class="text-h5 text-md-h4 font-weight-bold mb-3">Ваши достижения</h1>
            <p class="text-body-1 text-medium-emphasis mb-0">
              <template v-if="stats">
                Вы разблокировали <strong>{{ stats.unlocked_achievements }}</strong> из <strong>{{ stats.total_achievements }}</strong> достижений.
                Ваш текущий рейтинг: <strong>{{ stats.rating }}</strong> очков (Уровень {{ stats.level }}).
              </template>
              <template v-else>
                Загружаем информацию о ваших достижениях...
              </template>
            </p>
          </div>
          <div class="hero-card__visual">
            <v-icon icon="mdi-medal-outline" size="120" color="white" />
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" lg="5">
        <v-card class="info-card" elevation="6" rounded="xl">
          <h2 class="text-h6 font-weight-bold mb-3">Как будет работать система</h2>
          <v-list density="comfortable">
            <v-list-item
              prepend-icon="mdi-check-circle-outline"
              title="Награды за задачи и фотоотчёты"
              subtitle="Каждое выполненное задание увеличивает рейтинг и открывает бейджи."
            />
            <v-list-item
              prepend-icon="mdi-timer-sand"
              title="Еженедельно обновляемый прогресс"
              subtitle="Активность синхронизируется между приложением и веб-порталом."
            />
            <v-list-item
              prepend-icon="mdi-account-group-outline"
              title="Командные достижения"
              subtitle="Отмечаем вклад проектов, если команда закрывает план вовремя."
            />
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12">
        <v-card class="achievements-card" elevation="6" rounded="xl">
          <div class="d-flex align-center justify-space-between flex-wrap ga-4 mb-4">
            <h2 class="text-h6 font-weight-bold mb-0">Все достижения</h2>
            <v-progress-circular
              v-if="loading"
              indeterminate
              color="primary"
            />
          </div>
          <v-divider class="mb-4" />
          
          <v-alert
            v-if="!loading && achievements.length === 0"
            type="info"
            variant="tonal"
            rounded="lg"
          >
            <div class="font-weight-bold mb-1">Достижения не найдены</div>
            <div class="text-caption">
              <template v-if="stats">
                <template v-if="stats.total_achievements === 0">
                  В системе пока нет достижений. Обратитесь к администратору для их добавления.
                </template>
                <template v-else>
                  Загружено {{ stats.total_achievements }} достижений, но они не отображаются. Попробуйте обновить страницу.
                </template>
              </template>
              <template v-else>
                Не удалось загрузить данные. Проверьте подключение к интернету и обновите страницу.
              </template>
            </div>
          </v-alert>
          
          <v-row v-else class="ga-4">
            <v-col
              v-for="achievement in achievements"
              :key="achievement.id"
              cols="12"
              md="6"
              lg="4"
            >
              <v-sheet
                class="achievement-card pa-4"
                rounded="lg"
                border
                :color="achievement.unlocked ? 'success-lighten-5' : 'grey-lighten-5'"
                :class="{ 'achievement-unlocked': achievement.unlocked }"
              >
                <div class="d-flex align-center justify-space-between mb-3">
                  <v-avatar size="48" :color="achievement.unlocked ? 'success' : 'grey'">
                    <v-icon :icon="getIcon(achievement)" color="white" size="24" />
                  </v-avatar>
                  <v-chip
                    size="small"
                    :color="achievement.unlocked ? 'success' : 'warning'"
                    variant="flat"
                    class="text-none font-weight-semibold"
                  >
                    {{ achievement.unlocked ? 'Получено' : 'В процессе' }}
                  </v-chip>
                </div>
                <h3 class="text-subtitle-1 font-weight-semibold mb-2">{{ achievement.name }}</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">{{ achievement.description }}</p>
                
                <div class="mb-3">
                  <div class="d-flex align-center justify-space-between mb-2">
                    <span class="text-caption text-medium-emphasis">Требуется рейтинг:</span>
                    <span class="text-caption font-weight-bold">{{ achievement.required_rating }} очков</span>
                  </div>
                  <v-progress-linear
                    :model-value="getProgress(achievement)"
                    :color="achievement.unlocked ? 'success' : 'primary'"
                    height="8"
                    rounded
                    class="mb-2"
                  />
                  <div class="d-flex align-center justify-space-between mb-1">
                    <span class="text-caption text-medium-emphasis">
                      <template v-if="achievement.unlocked">
                        Получено!
                      </template>
                      <template v-else>
                        {{ stats?.rating || 0 }} / {{ achievement.required_rating }} очков
                        <span class="ml-1">(осталось {{ Math.max(0, achievement.required_rating - (stats?.rating || 0)) }} очков)</span>
                      </template>
                    </span>
                    <span class="text-caption font-weight-semibold text-success">+{{ achievement.xp }} XP</span>
                  </div>
                  <div class="d-flex align-center justify-space-between">
                    <span class="text-caption text-medium-emphasis">{{ getProgress(achievement) }}% прогресса</span>
                  </div>
                </div>
                
                <div v-if="achievement.unlocked && achievement.unlocked_at" class="mt-2 pt-2" style="border-top: 1px solid rgba(0,0,0,0.1);">
                  <span class="text-caption text-medium-emphasis">
                    Получено: {{ new Date(achievement.unlocked_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }) }}
                  </span>
                </div>
              </v-sheet>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.achievements-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.hero-card {
  display: flex;
  gap: 24px;
  align-items: stretch;
  background: linear-gradient(120deg, #8BC34A, #689F38); /* BirQadam primary */
  color: #fff;
  border-radius: 28px;
  padding: clamp(24px, 5vw, 36px);
  overflow: hidden;
}

.hero-card__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.75rem;
}

.hero-card__visual {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 160px;
}

.info-card {
  padding: clamp(24px, 4vw, 36px);
  background: linear-gradient(160deg, rgba(227, 242, 253, 0.95), rgba(240, 244, 248, 0.96));
}

.achievements-card {
  padding: clamp(24px, 4vw, 40px);
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.98));
}

.achievement-card {
  background: #ffffff;
  border: 1px solid rgba(33, 33, 33, 0.06);
  min-height: 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.3s ease;
}

.achievement-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.achievement-unlocked {
  border-color: rgb(var(--v-theme-success));
  border-width: 2px;
}

@media (max-width: 960px) {
  .hero-card {
    flex-direction: column;
  }

  .hero-card__visual {
    min-height: 120px;
  }
}
</style>


