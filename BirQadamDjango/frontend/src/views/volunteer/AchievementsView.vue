<script setup lang="ts">
import { computed, ref } from 'vue';

import { useDashboardStore } from '@/stores/dashboard';

const dashboardStore = useDashboardStore();
const loading = computed(() => dashboardStore.loading);
const achievements = ref([
  {
    title: 'Первые шаги',
    description: 'Выполните первое задание и получите благодарность от команды BirQadam.',
    progress: 100,
    reward: 'Бейдж «Новичок»',
    unlocked: true,
  },
  {
    title: 'Фото эксперт',
    description: 'Отправьте 5 успешных фотоотчётов и помогите проекту с визуальными материалами.',
    progress: 40,
    reward: 'Дополнительные 25 рейтинга',
    unlocked: false,
  },
  {
    title: 'Командный игрок',
    description: 'Примите участие в трёх проектах подряд без пропусков и задержек.',
    progress: 60,
    reward: 'Доступ к закрытым мероприятиям',
    unlocked: false,
  },
]);
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
            <h1 class="text-h5 text-md-h4 font-weight-bold mb-3">Здесь будут ваши награды и прогресс</h1>
            <p class="text-body-1 text-medium-emphasis mb-0">
              Раздел подключится к основному трекеру рейтинга после интеграции. Пока вы можете посмотреть, какие награды
              будут доступны в ближайших релизах.
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
            <h2 class="text-h6 font-weight-bold mb-0">Предстоящие награды</h2>
            <v-progress-circular
              v-if="loading"
              indeterminate
              color="primary"
            />
          </div>
          <v-divider class="mb-4" />
          <v-row class="ga-4">
            <v-col
              v-for="achievement in achievements"
              :key="achievement.title"
              cols="12"
              md="4"
            >
              <v-sheet
                class="achievement-card pa-4"
                rounded="lg"
                border
                :color="achievement.unlocked ? 'primary-lighten-5' : 'grey-lighten-5'"
              >
                <div class="d-flex align-center justify-space-between mb-3">
                  <v-avatar size="40" :color="achievement.unlocked ? 'primary' : 'grey'">
                    <v-icon icon="mdi-trophy-variant-outline" color="white" />
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
                <h3 class="text-subtitle-1 font-weight-semibold mb-2">{{ achievement.title }}</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">{{ achievement.description }}</p>
                <v-progress-linear
                  :model-value="achievement.progress"
                  :color="achievement.unlocked ? 'success' : 'primary'"
                  height="8"
                  rounded
                  class="mb-3"
                />
                <div class="d-flex align-center justify-space-between">
                  <span class="text-caption text-medium-emphasis">{{ achievement.progress }}% прогресса</span>
                  <span class="text-caption font-weight-semibold">{{ achievement.reward }}</span>
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
  min-height: 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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


