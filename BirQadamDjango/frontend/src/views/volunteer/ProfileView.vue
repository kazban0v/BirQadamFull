<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { VForm } from 'vuetify/components';

import { fetchVolunteerProfile, updateVolunteerProfile, getTelegramSyncStatus, generateTelegramLinkCode } from '@/services/auth';
import { fetchVolunteerStats, fetchVolunteerActivity } from '@/services/stats';
import { useAuthStore } from '@/stores/auth';
import { fetchTrustFactorHistory, type TrustFactorHistoryResponse } from '@/services/trustFactor';

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
  phone_number: '',
  email: '',
});

const passwordDialog = ref(false);
const passwordFormRef = ref<VForm | null>(null);
const passwordLoading = ref(false);
const passwordFormState = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const rules = {
  required: (value: string) => !!value || 'Поле обязательно для заполнения.',
  phoneMaxLength: (value: string) => {
    if (!value) return true;
    if (value.length > 15) {
      return 'Номер телефона не должен превышать 15 символов.';
    }
    return true;
  },
};

const stats = ref<Awaited<ReturnType<typeof fetchVolunteerStats>> | null>(null);
const activity = ref<Awaited<ReturnType<typeof fetchVolunteerActivity>> | null>(null);
const statsLoading = ref(false);
const activityLoading = ref(false);

// TrustFactor - используем computed для реактивности
const profile = computed(() => {
  if (authStore.user?.trust_factor !== undefined || authStore.user?.average_rating !== undefined) {
    return {
      trust_factor: authStore.user.trust_factor ?? 20,
      average_rating: authStore.user.average_rating ?? 5.0,
    };
  }
  return {
    trust_factor: 20,
    average_rating: 5.0,
  };
});

const trustFactorHistory = ref<TrustFactorHistoryResponse | null>(null);
const trustFactorHistoryDialog = ref(false);
const trustFactorHistoryLoading = ref(false);

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
    const profileData = await fetchVolunteerProfile();
    formState.name = profileData.name || '';
    formState.phone_number = profileData.phone_number || '';
    formState.email = profileData.email || '';
    // Обновляем через refreshProfile, который обновит authStore
    await authStore.refreshProfile();
  } finally {
    loading.value = false;
  }
};

const loadTrustFactorHistory = async () => {
  trustFactorHistoryLoading.value = true;
  try {
    trustFactorHistory.value = await fetchTrustFactorHistory();
  } catch (error: any) {
    console.error('Failed to load TrustFactor history:', error);
    // Показываем сообщение пользователю только если это не 404 (может быть просто пустая история)
    if (error?.response?.status !== 404) {
      snackbar.message = 'Не удалось загрузить историю изменений Trust Factor';
      snackbar.color = 'error';
      snackbar.show = true;
    }
  } finally {
    trustFactorHistoryLoading.value = false;
  }
};

const openTrustFactorHistory = async () => {
  trustFactorHistoryDialog.value = true;
  if (!trustFactorHistory.value) {
    await loadTrustFactorHistory();
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

// Комбинированная серия для графика (сумма всех активностей)
const combinedActivitySeries = computed(() => {
  if (!activity.value?.series) return [];
  const series = activity.value.series;
  
  // Используем длину месяцев как основу
  const monthsLength = activity.value.months?.length ?? 0;
  if (monthsLength === 0) return [];
  
  const combined = [];
  for (let i = 0; i < monthsLength; i++) {
    const taskCompleted = Array.isArray(series.task_completed) ? (series.task_completed[i] ?? 0) : 0;
    const photoUploaded = Array.isArray(series.photo_uploaded) ? (series.photo_uploaded[i] ?? 0) : 0;
    const projectJoined = Array.isArray(series.project_joined) ? (series.project_joined[i] ?? 0) : 0;
    const taskAssigned = Array.isArray(series.task_assigned) ? (series.task_assigned[i] ?? 0) : 0;
    combined.push(taskCompleted + photoUploaded + projectJoined + taskAssigned);
  }
  return combined;
});

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

function formatMonthLabel(monthStr: string): string {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  if (parts.length < 2 || !parts[1]) return monthStr;
  const month = parts[1];
  const monthNum = parseInt(month, 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return monthStr;
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  return monthNames[monthNum - 1] || monthStr;
}

const openTelegramBot = () => {
  window.open('https://t.me/VolunteerDlyaLyudei_bot', '_blank');
};

const submit = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  loading.value = true;
  try {
    // Проверяем длину номера телефона перед отправкой
    if (formState.phone_number && formState.phone_number.trim().length > 15) {
      snackbar.message = 'Номер телефона слишком длинный. Максимальная длина - 15 символов.';
      snackbar.color = 'error';
      snackbar.show = true;
      loading.value = false;
      return;
    }
    
    // Формируем payload только с заполненными полями
    const payload: Partial<{ name: string; phone_number: string; email: string }> = {};
    
    if (formState.name && formState.name.trim()) {
      payload.name = formState.name.trim();
    }
    if (formState.phone_number && formState.phone_number.trim()) {
      payload.phone_number = formState.phone_number.trim();
    }
    if (formState.email && formState.email.trim()) {
      payload.email = formState.email.trim();
    }
    
    const updated = await updateVolunteerProfile(payload);

    await authStore.refreshProfile();

    snackbar.message = 'Профиль успешно обновлён';
    snackbar.color = 'success';
    snackbar.show = true;

    formState.name = updated.name || '';
    formState.phone_number = updated.phone_number || '';
    formState.email = updated.email || '';
  } catch (error: any) {
    console.error('Ошибка обновления профиля:', error);
    let errorMessage = 'Не удалось сохранить профиль.';
    
    // Проверяем, является ли ошибка связанной с длиной номера телефона
    const errorResponse = error?.response?.data;
    if (typeof errorResponse === 'string' && errorResponse.includes('value too long for type character varying(15)')) {
      errorMessage = 'Номер телефона слишком длинный. Максимальная длина - 15 символов.';
    } else if (error?.response?.status === 500) {
      // Проверяем HTML ответ на наличие информации об ошибке
      if (typeof errorResponse === 'string' && errorResponse.includes('DataError')) {
        if (errorResponse.includes('value too long')) {
          errorMessage = 'Номер телефона слишком длинный. Максимальная длина - 15 символов.';
        } else {
          errorMessage = 'Ошибка базы данных. Проверьте правильность введенных данных.';
        }
      } else {
        errorMessage = 'Ошибка сервера. Пожалуйста, попробуйте позже или обратитесь в поддержку.';
      }
    } else if (error?.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    } else if (error?.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    snackbar.message = errorMessage;
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

const changePassword = async () => {
  const { valid } = (await passwordFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  if (passwordFormState.newPassword !== passwordFormState.confirmPassword) {
    snackbar.message = 'Пароли не совпадают.';
    snackbar.color = 'error';
    snackbar.show = true;
    return;
  }

  passwordLoading.value = true;
  try {
    const { httpClient } = await import('@/services/http');
    await httpClient.post('/api/web/change-password/', {
      current_password: passwordFormState.currentPassword,
      new_password: passwordFormState.newPassword,
    });
    
    snackbar.message = 'Пароль успешно изменён.';
    snackbar.color = 'success';
    snackbar.show = true;
    passwordDialog.value = false;
    passwordFormState.currentPassword = '';
    passwordFormState.newPassword = '';
    passwordFormState.confirmPassword = '';
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось изменить пароль.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    passwordLoading.value = false;
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
            <h1 class="text-h4 font-weight-bold mb-2 text-white">
              {{ authStore.user?.full_name || formState.name || authStore.user?.username || 'Волонтёр' }}
            </h1>
            <div class="text-body-2 text-white mb-3">
              <div v-if="authStore.user?.phone_number || formState.phone_number" class="d-flex align-center mb-2">
                <v-icon size="18" class="mr-2">mdi-phone</v-icon>
                <span class="font-weight-medium">{{ authStore.user?.phone_number || formState.phone_number }}</span>
              </div>
              <div v-if="authStore.user?.email || formState.email" class="d-flex align-center mb-2">
                <v-icon size="18" class="mr-2">mdi-email</v-icon>
                <span class="font-weight-medium">{{ authStore.user?.email || formState.email }}</span>
              </div>
            </div>
            <p class="text-body-2 text-white opacity-90 mb-0">
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
          <v-col cols="12" md="6">
            <v-text-field
              v-model="formState.phone_number"
              label="Номер телефона"
              prepend-inner-icon="mdi-phone"
              variant="solo-filled"
              flat
              :rules="[rules.required, rules.phoneMaxLength]"
              autocomplete="tel"
              :loading="loading"
              bg-color="grey-lighten-5"
              rounded="lg"
              hide-details="auto"
              class="input-field"
              maxlength="15"
              counter="15"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="formState.email"
              label="Email"
              prepend-inner-icon="mdi-email"
              variant="solo-filled"
              flat
              :rules="[rules.required]"
              autocomplete="email"
              :loading="loading"
              bg-color="grey-lighten-5"
              rounded="lg"
              hide-details="auto"
              class="input-field"
              disabled
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
            variant="outlined"
            color="primary"
            size="large"
            class="text-none font-weight-medium"
            rounded="lg"
            :disabled="loading"
            @click="passwordDialog = true"
          >
            <v-icon start>mdi-lock-reset</v-icon>
            Изменить пароль
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
              <div class="stat-title">Уровень</div>
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

        <!-- TrustFactor и рейтинг -->
        <v-col cols="12" sm="6" md="4">
          <v-card class="stat-card" elevation="0" rounded="xl">
            <div class="stat-icon-wrapper">
              <v-icon size="32" color="info">mdi-shield-check</v-icon>
            </div>
            <div class="stat-title">Trust Factor</div>
            <div class="stat-main-value">
              <span class="rating-number" :class="{
                'text-success': (profile?.trust_factor ?? 20) >= 20,
                'text-warning': (profile?.trust_factor ?? 20) >= 10 && (profile?.trust_factor ?? 20) < 20,
                'text-error': (profile?.trust_factor ?? 20) < 10
              }">{{ profile?.trust_factor ?? 20 }}</span>
              <span class="text-body-2 text-medium-emphasis ml-2">/ 30</span>
            </div>
            <v-progress-linear
              :model-value="((profile?.trust_factor ?? 20) / 30) * 100"
              :color="(profile?.trust_factor ?? 20) >= 20 ? 'success' : (profile?.trust_factor ?? 20) >= 10 ? 'warning' : 'error'"
              bg-color="grey-lighten-3"
              height="8"
              rounded
              class="my-3"
            />
            <div class="average-rating-display mb-3 pa-3" style="background: linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 235, 59, 0.1)); border-radius: 12px;">
              <div class="d-flex align-center justify-center">
                <v-icon size="40" color="amber" class="mr-3">mdi-star</v-icon>
                <div class="text-center">
                  <div class="text-caption text-medium-emphasis mb-1">Средний рейтинг</div>
                  <div class="text-h3 font-weight-bold" style="color: #FFA000;">{{ profile?.average_rating?.toFixed(2) ?? '5.00' }}</div>
                </div>
              </div>
            </div>
            <v-divider class="my-3" />
            <v-btn
              variant="text"
              color="primary"
              class="text-none w-100"
              rounded="lg"
              @click="openTrustFactorHistory"
            >
              История изменений
              <v-icon end>mdi-history</v-icon>
            </v-btn>
            <v-alert
              v-if="profile && profile.trust_factor !== undefined && profile.trust_factor < 10"
              type="warning"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              <div class="text-caption">
                <strong v-if="profile.trust_factor < 5">Критическое предупреждение!</strong>
                <strong v-else>Предупреждение!</strong>
                Ваш Trust Factor низкий. При TF = 0 вы не сможете присоединяться к проектам.
              </div>
            </v-alert>
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
                <v-icon size="32" color="success">mdi-chart-line</v-icon>
              </div>
              <div class="stat-title">Активность по месяцам</div>
              
              <template v-if="activityMonths.length > 0 && combinedActivitySeries.length > 0">
                <div class="chart-summary mb-3">
                  <div class="chart-summary-value">
                    {{ combinedActivitySeries.reduce((a, b) => a + b, 0) }}
                  </div>
                  <div class="chart-summary-label">всего действий</div>
                </div>
                
                <div class="chart-container">
                  <v-sparkline
                    :model-value="combinedActivitySeries"
                    color="success"
                    line-width="4"
                    padding="20"
                    auto-draw
                    smooth
                    height="100"
                    :gradient="['#4CAF50', '#8BC34A', '#CDDC39']"
                  />
                </div>
                
                <div class="chart-months mt-3">
                    <div 
                      v-for="(month, index) in activityMonths" 
                      :key="index"
                      class="chart-month-item"
                    >
                      <div class="chart-month-bar">
                        <div 
                          class="chart-month-fill"
                          :style="{ height: `${Math.max(10, combinedActivitySeries[index] && combinedActivitySeries.length > 0 ? (combinedActivitySeries[index] / Math.max(...combinedActivitySeries, 1)) * 100 : 10)}%` }"
                        ></div>
                      </div>
                      <div class="chart-month-label">
                        {{ formatMonthLabel(month) }}
                      </div>
                      <div class="chart-month-value">
                        {{ combinedActivitySeries[index] ?? 0 }}
                      </div>
                    </div>
                </div>
                
                <div class="chart-footer mt-3 pt-3">
                  <div class="text-caption text-medium-emphasis" style="font-size: 0.65rem; line-height: 1.4;">
                    Учитываются: выполненные задачи, отправленные фотоотчёты, присоединения к проектам, взятые задачи
                  </div>
                </div>
              </template>
              
              <div v-else class="no-data">
                <v-icon size="48" color="grey-lighten-1">mdi-chart-line-variant</v-icon>
                <div class="text-body-2 mt-3 text-medium-emphasis">Пока нет активности</div>
                <div class="text-caption mt-1 text-medium-emphasis">Выполняйте задачи и отправляйте фотоотчёты</div>
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
          <v-alert type="info" variant="tonal" rounded="lg" class="mb-4 telegram-alert">
            <div class="telegram-alert-text">
              <div class="font-weight-bold mb-1">Telegram не привязан</div>
              <div class="text-caption">Привяжите аккаунт для синхронизации прогресса</div>
            </div>
          </v-alert>
          
          <div v-if="linkCode" class="link-code-section mb-4">
            <div class="text-subtitle-2 font-weight-bold mb-2">Код для привязки:</div>
            <v-card class="code-card" elevation="0" rounded="lg">
              <div class="d-flex align-center justify-space-between code-card-content">
                <div class="code-card-text">
                  <div class="text-h4 font-weight-bold code-text">{{ linkCode }}</div>
                  <div class="text-caption text-medium-emphasis mt-1">Код действителен 10 минут</div>
                </div>
                <v-btn
                  icon="mdi-content-copy"
                  variant="text"
                  size="small"
                  class="code-copy-btn"
                  @click="copyToClipboard(linkCode)"
                />
              </div>
            </v-card>
            <div class="text-body-2 mt-3 mb-3 code-instruction">
              <v-icon size="16" class="mr-1">mdi-information-outline</v-icon>
              <span>Откройте Telegram бот и используйте команду <strong>/link {{ linkCode }}</strong> или просто отправьте код <strong>{{ linkCode }}</strong></span>
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

    <!-- Диалог изменения пароля -->
    <v-dialog v-model="passwordDialog" :max-width="$vuetify.display.mobile ? '100%' : '500'" :fullscreen="$vuetify.display.mobile">
      <v-card class="pa-6">
        <v-card-title class="d-flex align-center justify-space-between mb-4">
          <div class="d-flex align-center">
            <v-icon icon="mdi-lock-reset" color="primary" size="32" class="mr-3" />
            <h2 class="text-h5 font-weight-bold">Изменить пароль</h2>
          </div>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="passwordDialog = false"
          />
        </v-card-title>

        <v-card-text>
          <v-form ref="passwordFormRef" @submit.prevent="changePassword">
            <v-text-field
              v-model="passwordFormState.currentPassword"
              label="Текущий пароль"
              variant="outlined"
              prepend-inner-icon="mdi-lock-outline"
              :rules="[rules.required]"
              type="password"
              autocomplete="current-password"
              class="mb-4"
            />
            <v-text-field
              v-model="passwordFormState.newPassword"
              label="Новый пароль"
              variant="outlined"
              prepend-inner-icon="mdi-lock-plus-outline"
              :rules="[rules.required, (v) => v.length >= 8 || 'Пароль должен содержать не менее 8 символов']"
              type="password"
              autocomplete="new-password"
              hint="Минимум 8 символов"
              persistent-hint
              class="mb-4"
            />
            <v-text-field
              v-model="passwordFormState.confirmPassword"
              label="Подтвердите новый пароль"
              variant="outlined"
              prepend-inner-icon="mdi-lock-check-outline"
              :rules="[rules.required, (v) => v === passwordFormState.newPassword || 'Пароли не совпадают']"
              type="password"
              autocomplete="new-password"
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-6 pt-0">
          <v-spacer />
          <v-btn
            variant="text"
            class="text-none"
            @click="passwordDialog = false"
          >
            Отменить
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            class="text-none font-weight-bold"
            :loading="passwordLoading"
            @click="changePassword"
          >
            Изменить пароль
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Диалог истории изменений TrustFactor -->
    <v-dialog 
      v-model="trustFactorHistoryDialog" 
      :max-width="$vuetify.display.mobile ? '100%' : '800'"
      :fullscreen="$vuetify.display.mobile"
      scrollable
    >
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between flex-wrap pa-4">
          <div class="d-flex align-center flex-grow-1">
            <v-icon icon="mdi-history" color="primary" :size="$vuetify.display.mobile ? 24 : 32" class="mr-3" />
            <h2 class="text-h6 font-weight-bold text-wrap" :class="$vuetify.display.mobile ? 'text-subtitle-1' : 'text-h5'">
              История изменений Trust Factor
            </h2>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" @click="trustFactorHistoryDialog = false" />
        </v-card-title>
        <v-card-text class="pa-4">
          <div v-if="trustFactorHistoryLoading" class="d-flex justify-center py-8">
            <v-progress-circular indeterminate color="primary" size="40" />
          </div>
          <div v-else-if="trustFactorHistory">
            <div class="mb-4">
              <v-row class="ga-2">
                <v-col cols="12" md="6">
                  <v-card variant="tonal" color="info" class="pa-3">
                    <div class="text-caption text-medium-emphasis">Текущий Trust Factor</div>
                    <div class="text-h5 font-weight-bold">{{ trustFactorHistory.current_trust_factor }}</div>
                  </v-card>
                </v-col>
                <v-col cols="12" md="6">
                  <v-card variant="tonal" color="primary" class="pa-3">
                    <div class="text-caption text-medium-emphasis">Средний рейтинг</div>
                    <div class="text-h5 font-weight-bold">{{ trustFactorHistory.current_average_rating.toFixed(2) }}</div>
                  </v-card>
                </v-col>
              </v-row>
            </div>
            <v-divider class="mb-4" />
            <div v-if="trustFactorHistory.history.length === 0" class="text-center py-8">
              <v-icon size="48" color="grey-lighten-1" class="mb-3">mdi-history</v-icon>
              <div class="text-body-1 text-medium-emphasis">История изменений пуста</div>
            </div>
            <v-timeline v-else density="compact" align="start" :side="$vuetify.display.mobile ? 'start' : 'end'">
              <v-timeline-item
                v-for="(item, index) in trustFactorHistory.history"
                :key="item.id"
                :dot-color="item.change_amount > 0 ? 'success' : item.change_amount < 0 ? 'error' : 'grey'"
                size="small"
              >
                <template v-if="!$vuetify.display.mobile" #opposite>
                  <div class="text-caption text-medium-emphasis">
                    {{ new Date(item.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
                  </div>
                </template>
                <v-card variant="outlined" class="pa-3">
                  <div v-if="$vuetify.display.mobile" class="text-caption text-medium-emphasis mb-2">
                    {{ new Date(item.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
                  </div>
                  <div class="d-flex align-center justify-space-between mb-2 flex-wrap">
                    <div class="font-weight-bold text-wrap" style="word-wrap: break-word; overflow-wrap: break-word; flex: 1; min-width: 0;">{{ item.reason_display }}</div>
                    <v-chip
                      :color="item.change_amount > 0 ? 'success' : item.change_amount < 0 ? 'error' : 'grey'"
                      size="small"
                      variant="flat"
                      class="ml-2 flex-shrink-0"
                    >
                      {{ item.change_amount > 0 ? '+' : '' }}{{ item.change_amount }}
                    </v-chip>
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ item.old_value }} → {{ item.new_value }}
                  </div>
                </v-card>
              </v-timeline-item>
            </v-timeline>
          </div>
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="trustFactorHistoryDialog = false" :block="$vuetify.display.mobile">
            Закрыть
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
.chart-summary {
  text-align: center;
  padding: 12px;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(139, 195, 74, 0.1));
  border-radius: 12px;
  margin-bottom: 16px;
}

.chart-summary-value {
  font-size: 2rem;
  font-weight: 800;
  color: rgb(var(--v-theme-success));
  line-height: 1;
  margin-bottom: 4px;
}

.chart-summary-label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.chart-container {
  margin-top: 16px;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}

.chart-months {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 4px;
  margin-top: 16px;
  padding: 8px 0;
}

.chart-month-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.chart-month-bar {
  width: 100%;
  height: 60px;
  background: rgb(var(--v-theme-grey-lighten-4));
  border-radius: 4px 4px 0 0;
  position: relative;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.chart-month-fill {
  width: 100%;
  background: linear-gradient(180deg, rgb(var(--v-theme-success)), rgba(76, 175, 80, 0.8));
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
  min-height: 4px;
}

.chart-month-label {
  font-size: 0.7rem;
  color: #666;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.chart-month-value {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-success));
  font-weight: 700;
}

.chart-footer {
  border-top: 1px solid rgb(var(--v-theme-grey-lighten-4));
  text-align: center;
}

.chart-footer .text-caption {
  color: #999;
  opacity: 0.8;
}

.no-data {
  text-align: center;
  padding: 40px 20px;
}

.no-data .v-icon {
  opacity: 0.5;
}

.no-data .text-body-2 {
  color: #666;
  font-weight: 500;
}

.no-data .text-caption {
  color: #999;
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
  
  .telegram-sync-card {
    padding: 20px;
  }
  
  .quick-links {
    padding: 20px;
  }
  
  .form-header {
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .form-header h2 {
    font-size: 1.25rem;
  }
  
  .profile-form .d-flex.flex-wrap {
    flex-direction: column;
  }
  
  .profile-form .d-flex.flex-wrap .v-btn {
    width: 100%;
  }
}

@media (max-width: 600px) {
  .profile-page {
    padding: 12px;
    gap: 16px;
  }
  
  .profile-header {
    padding: 16px;
  }
  
  .header-content .d-flex {
    flex-direction: column;
    text-align: center;
  }
  
  .avatar-main {
    margin-bottom: 16px;
  }
  
  .chip-verified {
    margin-top: 12px;
  }
  
  .profile-form {
    padding: 16px;
  }
  
  .form-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .form-header .v-icon {
    margin-right: 0;
    margin-bottom: 8px;
  }
  
  .form-header h2 {
    font-size: 1.125rem;
  }
  
  .rating-number {
    font-size: 2rem;
  }
  
  .average-rating-display {
    padding: 12px !important;
  }
  
  .average-rating-display .v-icon {
    font-size: 28px !important;
    margin-right: 8px !important;
  }
  
  .average-rating-display .text-h3 {
    font-size: 1.5rem !important;
  }
  
  .average-rating-display .text-caption {
    font-size: 0.7rem !important;
  }
  
  .average-rating-display .d-flex {
    flex-direction: column;
    gap: 8px;
  }
  
  .average-rating-display .text-center {
    width: 100%;
  }
  
  .section-title {
    font-size: 1.125rem;
    flex-wrap: wrap;
  }
  
  .section-title .v-icon {
    margin-right: 8px;
    margin-bottom: 4px;
  }
  
  .stat-card {
    padding: 16px;
  }
  
  .stat-icon-wrapper {
    width: 48px;
    height: 48px;
  }
  
  .stat-icon-wrapper .v-icon {
    font-size: 24px !important;
  }
  
  .telegram-sync-card {
    padding: 16px;
  }
  
  .telegram-sync-card .form-header {
    margin-bottom: 16px;
  }
  
  .telegram-linked .v-alert,
  .telegram-not-linked .v-alert {
    padding: 12px;
  }
  
  .telegram-linked .v-alert .d-flex,
  .telegram-not-linked .v-alert .d-flex {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .telegram-linked .v-alert .v-icon,
  .telegram-not-linked .v-alert .v-icon {
    margin-right: 0;
    margin-bottom: 8px;
  }
  
  .link-code-section {
    margin-bottom: 16px;
  }
  
  .code-card {
    padding: 12px !important;
  }
  
  .code-card-content {
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .code-card-text {
    flex: 1 1 auto;
    min-width: 200px;
  }
  
  .code-copy-btn {
    flex-shrink: 0;
  }
  
  .code-text {
    font-size: 1.5rem !important;
    letter-spacing: 2px;
    word-break: break-all;
  }
  
  .code-instruction {
    word-break: break-word;
    line-height: 1.5;
  }
  
  .code-instruction .v-icon {
    vertical-align: middle;
  }
  
  .telegram-not-linked .text-body-2 {
    font-size: 0.8125rem;
    line-height: 1.5;
  }
  
  .telegram-not-linked .v-btn {
    width: 100%;
    margin-top: 8px;
  }
  
  .telegram-alert {
    padding: 12px !important;
  }
  
  .telegram-alert-text {
    width: 100%;
  }
  
  .quick-links {
    padding: 16px;
  }
  
  .link-card {
    padding: 16px;
  }
  
  .link-card .d-flex {
    flex-wrap: wrap;
  }
  
  .link-card .v-avatar {
    margin-bottom: 8px;
  }
  
  /* Диалог изменения пароля */
  .profile-page :deep(.v-dialog .v-card) {
    padding: 16px !important;
  }
  
  .profile-page :deep(.v-dialog .v-card-title) {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .profile-page :deep(.v-dialog .v-card-title .d-flex) {
    width: 100%;
  }
  
  .profile-page :deep(.v-dialog .v-card-actions) {
    flex-direction: column;
    gap: 8px;
  }
  
  .profile-page :deep(.v-dialog .v-card-actions .v-btn) {
    width: 100%;
    margin: 0 !important;
  }
}
</style>