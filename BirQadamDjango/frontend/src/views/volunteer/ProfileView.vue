<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { VForm } from 'vuetify/components';

import { fetchVolunteerProfile, updateVolunteerProfile, getTelegramSyncStatus, generateTelegramLinkCode } from '@/services/auth';
import { fetchVolunteerStats, fetchVolunteerActivity } from '@/services/stats';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const loading = ref(false);
const formRef = ref<VForm | null>(null);
const snackbar = reactive({
  show: false,
  color: 'success',
  message: '',
});

const formState = reactive({
  name: '',
});

const rules = {
  required: (value: string) => !!value || 'Поле обязательно для заполнения.',
};

const stats = ref<Awaited<ReturnType<typeof fetchVolunteerStats>> | null>(null);
const activity = ref<Awaited<ReturnType<typeof fetchVolunteerActivity>> | null>(null);
const statsLoading = ref(false);
const activityLoading = ref(false);

// Telegram синхронизация
const telegramSync = ref<{
  is_linked: boolean;
  telegram_id: string | null;
  active_code: string | null;
  registration_source: string;
} | null>(null);
const telegramLoading = ref(false);
const linkCode = ref<string | null>(null);

const loadProfile = async () => {
  loading.value = true;
  try {
    const profile = await fetchVolunteerProfile();
    formState.name = profile.name || '';
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  statsLoading.value = true;
  try {
    stats.value = await fetchVolunteerStats();
  } finally {
    statsLoading.value = false;
  }
};

const loadActivity = async () => {
  activityLoading.value = true;
  try {
    activity.value = await fetchVolunteerActivity(6);
  } finally {
    activityLoading.value = false;
  }
};

const activityMonths = computed(() => activity.value?.months ?? []);
const taskCompletedSeries = computed(() => activity.value?.series?.task_completed ?? []);
const photoUploadedSeries = computed(() => activity.value?.series?.photo_uploaded ?? []);
const projectJoinedSeries = computed(() => activity.value?.series?.project_joined ?? []);

const hasTaskCompletedSeries = computed(() => taskCompletedSeries.value.some((value) => value > 0));

const copyToClipboard = async (text: string | null) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    snackbar.message = 'Код скопирован в буфер обмена';
    snackbar.color = 'success';
    snackbar.show = true;
  } catch (error) {
    snackbar.message = 'Не удалось скопировать код';
    snackbar.color = 'error';
    snackbar.show = true;
  }
};

const openTelegramBot = () => {
  window.open('https://t.me/VolunteerDlyaLyudei_bot', '_blank');
};

const submit = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  loading.value = true;
  try {
    const updated = await updateVolunteerProfile({
      name: formState.name,
    });

    authStore.refreshProfile();

    snackbar.message = 'Профиль успешно обновлён';
    snackbar.color = 'success';
    snackbar.show = true;

    formState.name = updated.name || '';
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось сохранить профиль.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    loading.value = false;
  }
};

const loadTelegramSync = async () => {
  telegramLoading.value = true;
  try {
    telegramSync.value = await getTelegramSyncStatus();
    if (telegramSync.value.active_code) {
      linkCode.value = telegramSync.value.active_code;
    }
  } catch (error: any) {
    console.error('Failed to load Telegram sync status:', error);
  } finally {
    telegramLoading.value = false;
  }
};

const generateCode = async () => {
  telegramLoading.value = true;
  try {
    const result = await generateTelegramLinkCode();
    linkCode.value = result.code;
    await loadTelegramSync();
    snackbar.message = 'Код для привязки Telegram сгенерирован! Откройте бот и используйте команду /link с кодом.';
    snackbar.color = 'success';
    snackbar.show = true;
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось сгенерировать код.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    telegramLoading.value = false;
  }
};

onMounted(async () => {
  await Promise.all([
    loadProfile(),
    loadStats(),
    loadActivity(),
    loadTelegramSync(),
  ]);
});
</script>

<template>
  <div class="profile-page">
    <!-- Заголовок профиля -->
    <v-card class="profile-header" elevation="0" rounded="xl">
      <div class="header-gradient"></div>
      <div class="header-content">
        <div class="d-flex flex-column flex-md-row align-center align-md-start ga-6">
          <v-avatar size="100" color="primary" class="avatar-main">
            <v-icon size="50" color="white">mdi-account-circle</v-icon>
          </v-avatar>
          <div class="flex-grow-1">
            <h1 class="text-h4 font-weight-bold mb-2">{{ authStore.user?.username }}</h1>
            <p class="text-body-1 text-medium-emphasis mb-0">
              Обновите личные данные для быстрой связи с организаторами
            </p>
          </div>
          <v-chip
            color="primary"
            size="large"
            variant="flat"
            prepend-icon="mdi-shield-check"
            class="chip-verified"
          >
            Волонтёр
          </v-chip>
        </div>
      </div>
    </v-card>

    <!-- Форма профиля -->
    <v-card class="profile-form" elevation="0" rounded="xl">
      <div class="form-header">
        <v-icon color="primary" size="28" class="mr-3">mdi-account-edit</v-icon>
        <h2 class="text-h5 font-weight-bold">Личная информация</h2>
      </div>
      
      <v-form ref="formRef" @submit.prevent="submit">
        <v-row class="mt-2">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="formState.name"
              label="Полное имя"
              prepend-inner-icon="mdi-account"
              variant="solo-filled"
              flat
              :rules="[rules.required]"
              autocomplete="name"
              :loading="loading"
              bg-color="grey-lighten-5"
              rounded="lg"
              hide-details="auto"
              class="input-field"
            />
          </v-col>
        </v-row>

        <div class="d-flex flex-wrap ga-3 mt-8">
          <v-btn
            type="submit"
            color="primary"
            size="large"
            class="text-none font-weight-bold px-8"
            rounded="lg"
            :loading="loading"
            elevation="0"
          >
            <v-icon start>mdi-content-save</v-icon>
            Сохранить изменения
          </v-btn>
          <v-btn
            variant="tonal"
            size="large"
            class="text-none font-weight-medium"
            rounded="lg"
            color="grey"
            :disabled="loading"
            @click="loadProfile"
          >
            <v-icon start>mdi-refresh</v-icon>
            Отменить
          </v-btn>
        </div>
      </v-form>
    </v-card>

    <!-- Статистика -->
    <div class="stats-section">
      <h2 class="section-title mb-4">
        <v-icon color="primary" size="28" class="mr-2">mdi-chart-line</v-icon>
        Статистика и достижения
      </h2>
      
      <v-row class="ga-4">
        <!-- Рейтинг -->
        <v-col cols="12" sm="6" md="4">
          <v-card class="stat-card" elevation="0" rounded="xl">
            <div v-if="statsLoading" class="loading-state">
              <v-progress-circular indeterminate color="primary" size="40" />
            </div>
            <template v-else>
              <div class="stat-icon-wrapper">
                <v-icon size="32" color="primary">mdi-trophy</v-icon>
              </div>
              <div class="stat-title">Рейтинг и уровень</div>
              <div class="stat-main-value">
                <span class="rating-number">{{ stats?.rating ?? '—' }}</span>
                <v-chip 
                  color="primary" 
                  variant="flat" 
                  size="small" 
                  class="ml-2 level-chip"
                >
                  Lvl {{ stats?.level ?? '—' }}
                </v-chip>
              </div>
              <v-progress-linear
                v-if="stats"
                :model-value="Math.round((stats.progress || 0) * 100)"
                color="primary"
                bg-color="grey-lighten-3"
                height="8"
                rounded
                class="my-3"
              />
              <div class="stat-detail">
                <v-icon size="16" class="mr-1">mdi-arrow-up-circle</v-icon>
                До {{ stats?.level ? (stats.level + 1) : '—' }} уровня: {{ stats?.next_level_rating ?? '—' }} очков
              </div>
              <v-divider class="my-3" />
              <div class="achievements-row">
                <v-icon color="amber" size="20" class="mr-2">mdi-star</v-icon>
                <span class="text-body-2">
                  <strong>{{ stats?.unlocked_achievements ?? 0 }}</strong> из {{ stats?.total_achievements ?? 0 }} достижений
                </span>
              </div>
              <v-btn
                variant="text"
                color="primary"
                class="text-none mt-2 w-100"
                rounded="lg"
                :to="{ name: 'volunteer-achievements' }"
              >
                Все достижения
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
            </template>
          </v-card>
        </v-col>

        <!-- Активность -->
        <v-col cols="12" sm="6" md="4">
          <v-card class="stat-card" elevation="0" rounded="xl">
            <div v-if="activityLoading" class="loading-state">
              <v-progress-circular indeterminate color="primary" size="40" />
            </div>
            <template v-else>
              <div class="stat-icon-wrapper">
                <v-icon size="32" color="success">mdi-lightning-bolt</v-icon>
              </div>
              <div class="stat-title">Активность за 6 месяцев</div>
              
              <div class="activity-stats">
                <div class="activity-item">
                  <v-icon size="20" color="info" class="mr-2">mdi-clipboard-check</v-icon>
                  <div class="flex-grow-1">
                    <div class="activity-label">Задач взято</div>
                    <div class="activity-value">{{ activity?.totals?.task_assigned ?? 0 }}</div>
                  </div>
                </div>
                
                <div class="activity-item">
                  <v-icon size="20" color="success" class="mr-2">mdi-check-circle</v-icon>
                  <div class="flex-grow-1">
                    <div class="activity-label">Задач выполнено</div>
                    <div class="activity-value">{{ activity?.totals?.task_completed ?? 0 }}</div>
                  </div>
                </div>
                
                <div class="activity-item">
                  <v-icon size="20" color="purple" class="mr-2">mdi-camera</v-icon>
                  <div class="flex-grow-1">
                    <div class="activity-label">Фотоотчётов</div>
                    <div class="activity-value">{{ activity?.totals?.photo_uploaded ?? 0 }}</div>
                  </div>
                </div>
                
                <div class="activity-item">
                  <v-icon size="20" color="orange" class="mr-2">mdi-folder-multiple</v-icon>
                  <div class="flex-grow-1">
                    <div class="activity-label">Новые проекты</div>
                    <div class="activity-value">{{ activity?.totals?.project_joined ?? 0 }}</div>
                  </div>
                </div>
              </div>
            </template>
          </v-card>
        </v-col>

        <!-- График -->
        <v-col cols="12" sm="6" md="4">
          <v-card class="stat-card" elevation="0" rounded="xl">
            <div v-if="activityLoading" class="loading-state">
              <v-progress-circular indeterminate color="primary" size="40" />
            </div>
            <template v-else>
              <div class="stat-icon-wrapper">
                <v-icon size="32" color="success">mdi-chart-timeline-variant</v-icon>
              </div>
              <div class="stat-title">График активности</div>
              <div class="chart-container">
                <v-sparkline
                  v-if="hasTaskCompletedSeries"
                  :value="taskCompletedSeries"
                  color="success"
                  :labels="activityMonths"
                  line-width="3"
                  padding="16"
                  auto-draw
                  smooth
                  height="120"
                />
                <div v-else class="no-data">
                  <v-icon size="40" color="grey-lighten-1">mdi-chart-line-variant</v-icon>
                  <div class="text-caption mt-2">Нет активности за выбранный период</div>
                </div>
              </div>
              <v-divider class="my-3" />
              <div class="chart-legend">
                <div class="d-flex align-center">
                  <div class="legend-dot success"></div>
                  <span class="text-caption">Выполненные задачи по месяцам</span>
                </div>
              </div>
            </template>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Синхронизация с Telegram -->
    <v-card class="telegram-sync-card" elevation="0" rounded="xl">
      <div class="form-header">
        <v-icon color="primary" size="28" class="mr-3">mdi-telegram</v-icon>
        <h2 class="text-h5 font-weight-bold">Синхронизация с Telegram</h2>
      </div>
      
      <div v-if="telegramLoading" class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" size="40" />
      </div>
      
      <div v-else-if="telegramSync">
        <div v-if="telegramSync.is_linked" class="telegram-linked">
          <v-alert type="success" variant="tonal" rounded="lg" class="mb-4">
            <div class="d-flex align-center">
              <v-icon class="mr-3">mdi-check-circle</v-icon>
              <div>
                <div class="font-weight-bold mb-1">Telegram аккаунт привязан</div>
                <div class="text-caption">Ваш прогресс синхронизирован между веб-порталом и Telegram ботом</div>
              </div>
            </div>
          </v-alert>
          <div class="telegram-info">
            <div class="info-item">
              <v-icon size="20" class="mr-2">mdi-identifier</v-icon>
              <span class="text-body-2">Telegram ID: <strong>{{ telegramSync.telegram_id }}</strong></span>
            </div>
          </div>
        </div>
        
        <div v-else class="telegram-not-linked">
          <v-alert type="info" variant="tonal" rounded="lg" class="mb-4">
            <div class="d-flex align-center">
              <v-icon class="mr-3">mdi-information</v-icon>
              <div>
                <div class="font-weight-bold mb-1">Telegram не привязан</div>
                <div class="text-caption">Привяжите аккаунт для синхронизации прогресса</div>
              </div>
            </div>
          </v-alert>
          
          <div v-if="linkCode" class="link-code-section mb-4">
            <div class="text-subtitle-2 font-weight-bold mb-2">Код для привязки:</div>
            <v-card class="code-card" elevation="0" rounded="lg">
              <div class="d-flex align-center justify-space-between pa-4">
                <div>
                  <div class="text-h4 font-weight-bold code-text">{{ linkCode }}</div>
                  <div class="text-caption text-medium-emphasis mt-1">Код действителен 10 минут</div>
                </div>
                <v-btn
                  icon="mdi-content-copy"
                  variant="text"
                  size="small"
                  @click="copyToClipboard(linkCode)"
                />
              </div>
            </v-card>
            <div class="text-body-2 mt-3 mb-3">
              <v-icon size="16" class="mr-1">mdi-information-outline</v-icon>
              Откройте Telegram бот и используйте команду <strong>/link {{ linkCode }}</strong> или просто отправьте код <strong>{{ linkCode }}</strong>
            </div>
            <v-btn
              color="primary"
              variant="outlined"
              size="large"
              class="text-none font-weight-bold"
              rounded="lg"
              @click="openTelegramBot"
              block
            >
              <v-icon start>mdi-telegram</v-icon>
              Открыть Telegram бот
            </v-btn>
          </div>
          
          <v-btn
            color="primary"
            size="large"
            class="text-none font-weight-bold"
            rounded="lg"
            :loading="telegramLoading"
            @click="generateCode"
            block
          >
            <v-icon start>mdi-link</v-icon>
            {{ linkCode ? 'Сгенерировать новый код' : 'Получить код для привязки' }}
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- Быстрые ссылки -->
    <v-card class="quick-links" elevation="0" rounded="xl">
      <div class="links-header">
        <div>
          <h2 class="text-h6 font-weight-bold mb-1">Быстрый доступ</h2>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Переход к фотоотчётам и уведомлениям
          </p>
        </div>
      </div>
      <v-row class="mt-4">
        <v-col cols="12" sm="6">
          <v-card
            class="link-card"
            elevation="0"
            rounded="lg"
            :to="{ name: 'volunteer-photo-reports' }"
            hover
          >
            <div class="d-flex align-center ga-3">
              <v-avatar color="purple-lighten-5" size="48">
                <v-icon color="purple" size="24">mdi-camera-outline</v-icon>
              </v-avatar>
              <div class="flex-grow-1">
                <div class="text-subtitle-1 font-weight-bold">Фотоотчёты</div>
                <div class="text-caption text-medium-emphasis">История и статусы модерации</div>
              </div>
              <v-icon color="grey">mdi-chevron-right</v-icon>
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6">
          <v-card
            class="link-card"
            elevation="0"
            rounded="lg"
            :to="{ name: 'volunteer-notifications' }"
            hover
          >
            <div class="d-flex align-center ga-3">
              <v-avatar color="primary-lighten-5" size="48">
                <v-icon color="primary" size="24">mdi-bell-outline</v-icon>
              </v-avatar>
              <div class="flex-grow-1">
                <div class="text-subtitle-1 font-weight-bold">Уведомления</div>
                <div class="text-caption text-medium-emphasis">Важные сообщения и обновления</div>
              </div>
              <v-icon color="grey">mdi-chevron-right</v-icon>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-card>

    <v-snackbar 
      v-model="snackbar.show" 
      :color="snackbar.color" 
      timeout="3500"
      rounded="lg"
      location="top"
    >
      <div class="d-flex align-center">
        <v-icon 
          :icon="snackbar.color === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle'" 
          class="mr-3"
        />
        {{ snackbar.message }}
      </div>
    </v-snackbar>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: clamp(16px, 4vw, 32px);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Заголовок профиля */
.profile-header {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px;
}

.header-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%);
}

.header-content {
  position: relative;
  z-index: 1;
  color: white;
}

.avatar-main {
  border: 4px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.chip-verified {
  font-weight: 600;
  letter-spacing: 0.5px;
}

/* Форма */
.profile-form {
  background: white;
  padding: 32px;
}

.form-header {
  display: flex;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 2px solid rgb(var(--v-theme-grey-lighten-4));
}

.input-field :deep(.v-field) {
  transition: all 0.3s ease;
}

.input-field:hover :deep(.v-field) {
  background-color: rgb(var(--v-theme-grey-lighten-4)) !important;
}

/* Секция статистики */
.stats-section {
  margin-top: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f1f1f;
}

/* Карточки статистики */
.stat-card {
  background: white;
  padding: 28px;
  height: 100%;
  transition: all 0.3s ease;
  border: 1px solid rgb(var(--v-theme-grey-lighten-4));
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.stat-icon-wrapper {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, rgb(var(--v-theme-primary-lighten-5)) 0%, rgb(var(--v-theme-primary-lighten-4)) 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.stat-title {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #1f1f1f;
  margin-bottom: 12px;
}

.stat-main-value {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.rating-number {
  font-size: 2.5rem;
  font-weight: 800;
  color: rgb(var(--v-theme-primary));
  line-height: 1;
}

.level-chip {
  font-weight: 700;
}

.stat-detail {
  font-size: 0.875rem;
  color: #1f1f1f;
  display: flex;
  align-items: center;
}

.achievements-row {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgb(var(--v-theme-grey-lighten-5));
  border-radius: 8px;
}

/* Активность */
.activity-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.activity-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgb(var(--v-theme-grey-lighten-5));
  border-radius: 8px;
  transition: all 0.2s ease;
}

.activity-item:hover {
  background: rgb(var(--v-theme-grey-lighten-4));
}

.activity-label {
  font-size: 0.75rem;
  color: #1f1f1f;
  font-weight: 500;
}

.activity-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f1f1f;
}

/* График */
.chart-container {
  margin-top: 16px;
  min-height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-data {
  text-align: center;
  padding: 32px;
}

.no-data .text-caption {
  color: #1f1f1f;
}

.chart-legend {
  background: rgb(var(--v-theme-grey-lighten-5));
  padding: 12px;
  border-radius: 8px;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
}

.legend-dot.success {
  background-color: rgb(var(--v-theme-success));
}

/* Telegram синхронизация */
.telegram-sync-card {
  background: white;
  padding: 32px;
}

.telegram-linked .telegram-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgb(var(--v-theme-grey-lighten-5));
  border-radius: 8px;
}

.telegram-not-linked .link-code-section {
  margin-bottom: 16px;
}

.code-card {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary-lighten-5)) 0%, rgb(var(--v-theme-primary-lighten-4)) 100%);
  border: 2px solid rgb(var(--v-theme-primary-lighten-3));
}

.code-text {
  font-family: 'Courier New', monospace;
  letter-spacing: 4px;
  color: rgb(var(--v-theme-primary));
}

/* Быстрые ссылки */
.quick-links {
  background: white;
  padding: 28px;
}

.links-header {
  padding-bottom: 16px;
}

.quick-links :deep(.text-medium-emphasis),
.quick-links :deep(.text-caption),
.quick-links :deep(.text-body-2) {
  color: #1f1f1f !important;
}

.link-card .text-subtitle-1 {
  color: #1f1f1f;
}

.link-card {
  padding: 20px;
  background: rgb(var(--v-theme-grey-lighten-5));
  transition: all 0.3s ease;
  cursor: pointer;
  border: 2px solid transparent;
}

.link-card:hover {
  background: white;
  border-color: rgb(var(--v-theme-primary));
  transform: translateX(4px);
}

/* Загрузка */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

/* Адаптивность */
@media (max-width: 960px) {
  .profile-header {
    padding: 24px;
  }
  
  .profile-form {
    padding: 20px;
  }
  
  .stat-card {
    padding: 20px;
  }
  
  .quick-links {
    padding: 20px;
  }
}

@media (max-width: 600px) {
  .profile-page {
    padding: 12px;
    gap: 16px;
  }
  
  .profile-header {
    padding: 20px;
  }
  
  .header-content .d-flex {
    text-align: center;
  }
  
  .rating-number {
    font-size: 2rem;
  }
  
  .section-title {
    font-size: 1.25rem;
  }
}
</style>