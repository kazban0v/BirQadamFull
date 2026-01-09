<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { VForm } from 'vuetify/components';

import { httpClient } from '@/services/http';
import { getTelegramSyncStatus, generateTelegramLinkCode } from '@/services/auth';
import { useAuthStore } from '@/stores/auth';
import { useOrganizerStore } from '@/stores/organizer';
import { getOrganizerProfile, updateOrganizerProfile, type OrganizerProfile } from '@/services/webPortal';

const authStore = useAuthStore();
const organizerStore = useOrganizerStore();
const loading = ref(false);
const formRef = ref<VForm | null>(null);
const snackbar = reactive({
  show: false,
  color: 'success',
  message: '',
});

const formState = reactive({
  name: '',
  organization_name: '',
});

const portfolioState = reactive({
  age: null as number | null,
  gender: null as string | null,
  bio: '',
  work_experience_years: null as number | null,
  work_history: '',
  portfolio_photo: null as File | null,
  portfolio_photo_url: null as string | null,
});

const portfolioFormRef = ref<VForm | null>(null);
const portfolioLoading = ref(false);

const rules = {
  required: (value: string) => !!value || 'Поле обязательно для заполнения.',
};

const stats = ref<{
  projects_count: number;
  active_projects_count: number;
  completed_projects_count: number;
  volunteers_count: number;
  tasks_count: number;
  completed_tasks_count: number;
  photo_reports_count: number;
  approved_photos_count: number;
  current_rating: number;
} | null>(null);
const statsLoading = ref(false);

// Telegram синхронизация
const telegramSync = ref<{
  is_linked: boolean;
  telegram_id: string | null;
  active_code: string | null;
  registration_source: string;
} | null>(null);
const telegramLoading = ref(false);
const linkCode = ref<string | null>(null);

const status = computed(() => authStore.user?.organizer_status ?? 'pending');
const statusConfig = computed(() => {
  switch (status.value) {
    case 'approved':
      return {
        color: 'success',
        icon: 'mdi-check-decagram',
        title: 'Статус: одобрено',
        subtitle: 'Вы можете создавать проекты и управлять командой.',
      };
    case 'rejected':
      return {
        color: 'error',
        icon: 'mdi-alert-circle',
        title: 'Статус: отклонено',
        subtitle: 'Свяжитесь с администратором или отправьте заявку повторно.',
      };
    default:
      return {
        color: 'warning',
        icon: 'mdi-timer-sand',
        title: 'Заявка на рассмотрении',
        subtitle: 'Обычно проверка занимает до 24 часов. Мы уведомим вас после решения.',
      };
  }
});

const loadProfile = async () => {
  loading.value = true;
  try {
    const { data } = await httpClient.get('/api/v1/profile/');
    formState.name = data.name || '';
    formState.organization_name = authStore.user?.organization_name || '';
    
    // Загружаем портфолио
    await loadPortfolio();
  } finally {
    loading.value = false;
  }
};

const loadPortfolio = async () => {
  portfolioLoading.value = true;
  try {
    const profile = await getOrganizerProfile();
    portfolioState.age = profile.portfolio?.age || null;
    portfolioState.gender = profile.portfolio?.gender || null;
    portfolioState.bio = profile.portfolio?.bio || '';
    portfolioState.work_experience_years = profile.portfolio?.work_experience_years || null;
    portfolioState.work_history = profile.portfolio?.work_history || '';
    portfolioState.portfolio_photo_url = profile.portfolio?.portfolio_photo_url || null;
  } catch (error: any) {
    console.error('Failed to load portfolio:', error);
  } finally {
    portfolioLoading.value = false;
  }
};

const submitPortfolio = async () => {
  const { valid } = (await portfolioFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  portfolioLoading.value = true;
  try {
    await updateOrganizerProfile({
      portfolio: {
        age: portfolioState.age,
        gender: portfolioState.gender,
        bio: portfolioState.bio,
        work_experience_years: portfolioState.work_experience_years,
        work_history: portfolioState.work_history,
      },
      portfolio_photo: portfolioState.portfolio_photo || undefined,
    });

    await loadPortfolio();
    portfolioState.portfolio_photo = null;

    snackbar.message = 'Портфолио успешно обновлено';
    snackbar.color = 'success';
    snackbar.show = true;
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось сохранить портфолио.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    portfolioLoading.value = false;
  }
};

const handlePortfolioPhotoChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    portfolioState.portfolio_photo = target.files[0];
  }
};

const loadStats = async () => {
  statsLoading.value = true;
  try {
    const { data } = await httpClient.get('/custom-admin/api/v1/user/stats/');
    if (data.success && data.stats) {
      stats.value = {
        projects_count: data.stats.projects_count || 0,
        active_projects_count: data.stats.active_projects_count || 0,
        completed_projects_count: data.stats.completed_projects_count || 0,
        volunteers_count: data.stats.volunteers_count || 0,
        tasks_count: data.stats.tasks_count || 0,
        completed_tasks_count: data.stats.completed_tasks_count || 0,
        photo_reports_count: data.stats.photo_reports_count || 0,
        approved_photos_count: data.stats.approved_photos_count || 0,
        current_rating: data.stats.current_rating || 0,
      };
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  } finally {
    statsLoading.value = false;
  }
};

const submit = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  loading.value = true;
  try {
    const { data } = await httpClient.patch('/api/v1/profile/', {
      name: formState.name,
    });

    await authStore.loadUser();

    snackbar.message = 'Профиль успешно обновлён';
    snackbar.color = 'success';
    snackbar.show = true;

    formState.name = data.name || '';
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

onMounted(async () => {
  await Promise.all([
    loadProfile(),
    loadStats(),
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
            <v-icon size="50" color="white">mdi-office-building</v-icon>
          </v-avatar>
          <div class="flex-grow-1">
            <h1 class="text-h4 font-weight-bold mb-2">{{ formState.organization_name || authStore.user?.username }}</h1>
            <p class="text-body-1 text-medium-emphasis mb-0">
              {{ authStore.user?.name || authStore.user?.username || 'Организатор' }}
            </p>
          </div>
          <v-chip
            :color="statusConfig.color"
            size="large"
            variant="flat"
            :prepend-icon="statusConfig.icon"
            class="chip-status"
          >
            {{ statusConfig.title }}
          </v-chip>
        </div>
      </div>
    </v-card>

    <!-- Статистика -->
    <div class="stats-section mt-6">
      <h2 class="section-title mb-4">
        <v-icon color="primary" size="28" class="mr-2">mdi-chart-line</v-icon>
        Статистика и аналитика
      </h2>
      
      <v-row class="ga-4">
        <!-- Проекты -->
        <v-col cols="12" sm="6" md="4">
          <v-card class="stat-card" elevation="0" rounded="xl">
            <div v-if="statsLoading" class="loading-state">
              <v-progress-circular indeterminate color="primary" size="40" />
            </div>
            <template v-else>
              <div class="stat-icon-wrapper">
                <v-icon size="32" color="primary">mdi-briefcase</v-icon>
              </div>
              <div class="stat-title">Проекты</div>
              <div class="stat-main-value">
                <span class="rating-number">{{ stats?.projects_count ?? '—' }}</span>
                <span class="text-body-2 text-medium-emphasis ml-2">всего</span>
              </div>
              <v-divider class="my-3" />
              <div class="stat-detail">
                <v-icon size="16" class="mr-1">mdi-check-circle</v-icon>
                Активных: <strong>{{ stats?.active_projects_count ?? 0 }}</strong>
              </div>
              <div class="stat-detail">
                <v-icon size="16" class="mr-1">mdi-check-all</v-icon>
                Завершённых: <strong>{{ stats?.completed_projects_count ?? 0 }}</strong>
              </div>
            </template>
          </v-card>
        </v-col>

        <!-- Волонтёры -->
        <v-col cols="12" sm="6" md="4">
          <v-card class="stat-card" elevation="0" rounded="xl">
            <div v-if="statsLoading" class="loading-state">
              <v-progress-circular indeterminate color="primary" size="40" />
            </div>
            <template v-else>
              <div class="stat-icon-wrapper">
                <v-icon size="32" color="primary">mdi-account-multiple</v-icon>
              </div>
              <div class="stat-title">Волонтёры</div>
              <div class="stat-main-value">
                <span class="rating-number">{{ stats?.volunteers_count ?? '—' }}</span>
                <span class="text-body-2 text-medium-emphasis ml-2">участников</span>
              </div>
              <v-divider class="my-3" />
              <v-btn
                variant="text"
                color="primary"
                class="text-none mt-2 w-100"
                rounded="lg"
                :to="{ name: 'organizer-volunteers' }"
              >
                Управление командой
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
            </template>
          </v-card>
        </v-col>

        <!-- Задачи -->
        <v-col cols="12" sm="6" md="4">
          <v-card class="stat-card" elevation="0" rounded="xl">
            <div v-if="statsLoading" class="loading-state">
              <v-progress-circular indeterminate color="primary" size="40" />
            </div>
            <template v-else>
              <div class="stat-icon-wrapper">
                <v-icon size="32" color="primary">mdi-clipboard-check</v-icon>
              </div>
              <div class="stat-title">Задачи</div>
              <div class="stat-main-value">
                <span class="rating-number">{{ stats?.tasks_count ?? '—' }}</span>
                <span class="text-body-2 text-medium-emphasis ml-2">создано</span>
              </div>
              <v-divider class="my-3" />
              <div class="stat-detail">
                <v-icon size="16" class="mr-1" color="success">mdi-check-circle</v-icon>
                Выполнено: <strong>{{ stats?.completed_tasks_count ?? 0 }}</strong>
              </div>
              <v-btn
                variant="text"
                color="primary"
                class="text-none mt-2 w-100"
                rounded="lg"
                :to="{ name: 'organizer-tasks' }"
              >
                Все задачи
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
            </template>
          </v-card>
        </v-col>

        <!-- Фотоотчёты -->
        <v-col cols="12" sm="6" md="4">
          <v-card class="stat-card" elevation="0" rounded="xl">
            <div v-if="statsLoading" class="loading-state">
              <v-progress-circular indeterminate color="primary" size="40" />
            </div>
            <template v-else>
              <div class="stat-icon-wrapper">
                <v-icon size="32" color="primary">mdi-camera</v-icon>
              </div>
              <div class="stat-title">Фотоотчёты</div>
              <div class="stat-main-value">
                <span class="rating-number">{{ stats?.photo_reports_count ?? '—' }}</span>
                <span class="text-body-2 text-medium-emphasis ml-2">получено</span>
              </div>
              <v-divider class="my-3" />
              <div class="stat-detail">
                <v-icon size="16" class="mr-1" color="success">mdi-check-circle</v-icon>
                Одобрено: <strong>{{ stats?.approved_photos_count ?? 0 }}</strong>
              </div>
              <v-btn
                variant="text"
                color="primary"
                class="text-none mt-2 w-100"
                rounded="lg"
                :to="{ name: 'organizer-photo-moderation' }"
              >
                Модерация фото
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
            </template>
          </v-card>
        </v-col>

        <!-- Рейтинг -->
        <v-col cols="12" sm="6" md="4">
          <v-card class="stat-card" elevation="0" rounded="xl">
            <div v-if="statsLoading" class="loading-state">
              <v-progress-circular indeterminate color="primary" size="40" />
            </div>
            <template v-else>
              <div class="stat-icon-wrapper">
                <v-icon size="32" color="amber">mdi-star</v-icon>
              </div>
              <div class="stat-title">Рейтинг организатора</div>
              <div class="stat-main-value">
                <span class="rating-number">{{ stats?.current_rating?.toFixed(1) ?? '—' }}</span>
                <v-icon color="amber" size="24" class="ml-2">mdi-star</v-icon>
              </div>
              <v-divider class="my-3" />
              <div class="stat-detail text-medium-emphasis">
                Средняя оценка от волонтёров
              </div>
            </template>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Форма профиля -->
    <v-card class="profile-form mt-6" elevation="0" rounded="xl">
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
              v-model="formState.organization_name"
              label="Название организации"
              prepend-inner-icon="mdi-office-building"
              variant="solo-filled"
              flat
              :rules="[rules.required]"
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

    <!-- Портфолио организатора -->
    <v-card class="portfolio-card mt-6" elevation="0" rounded="xl">
      <div class="form-header">
        <v-icon color="primary" size="28" class="mr-3">mdi-briefcase-account</v-icon>
        <h2 class="text-h5 font-weight-bold">Портфолио организатора</h2>
      </div>
      
      <v-alert type="info" variant="tonal" rounded="lg" class="mb-4">
        <div class="d-flex align-center">
          <v-icon class="mr-3">mdi-information</v-icon>
          <div>
            <div class="font-weight-bold mb-1">Заполните портфолио</div>
            <div class="text-caption">Эта информация будет видна волонтёрам при просмотре ваших проектов</div>
          </div>
        </div>
      </v-alert>
      
      <v-form ref="portfolioFormRef" @submit.prevent="submitPortfolio">
        <v-row class="mt-2">
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="portfolioState.age"
              label="Возраст"
              prepend-inner-icon="mdi-calendar"
              variant="solo-filled"
              flat
              type="number"
              :min="18"
              :max="100"
              :loading="portfolioLoading"
              bg-color="grey-lighten-5"
              rounded="lg"
              hide-details="auto"
              class="input-field"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="portfolioState.gender"
              label="Пол"
              prepend-inner-icon="mdi-account"
              variant="solo-filled"
              flat
              :items="[
                { title: 'Мужской', value: 'male' },
                { title: 'Женский', value: 'female' },
                { title: 'Другое', value: 'other' },
              ]"
              :loading="portfolioLoading"
              bg-color="grey-lighten-5"
              rounded="lg"
              hide-details="auto"
              class="input-field"
            />
          </v-col>
          <v-col cols="12">
            <v-textarea
              v-model="portfolioState.bio"
              label="О себе"
              prepend-inner-icon="mdi-account-circle"
              variant="solo-filled"
              flat
              rows="4"
              :loading="portfolioLoading"
              bg-color="grey-lighten-5"
              rounded="lg"
              hide-details="auto"
              class="input-field"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="portfolioState.work_experience_years"
              label="Стаж работы (лет)"
              prepend-inner-icon="mdi-briefcase-clock"
              variant="solo-filled"
              flat
              type="number"
              :min="0"
              :max="100"
              :loading="portfolioLoading"
              bg-color="grey-lighten-5"
              rounded="lg"
              hide-details="auto"
              class="input-field"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-file-input
              label="Фото 3х4 (по желанию)"
              prepend-inner-icon="mdi-camera"
              variant="solo-filled"
              flat
              accept="image/*"
              :loading="portfolioLoading"
              bg-color="grey-lighten-5"
              rounded="lg"
              hide-details="auto"
              class="input-field"
              @change="handlePortfolioPhotoChange"
            />
            <div v-if="portfolioState.portfolio_photo_url" class="mt-2">
              <v-img
                :src="portfolioState.portfolio_photo_url"
                max-width="150"
                max-height="200"
                cover
                class="rounded-lg"
              />
            </div>
          </v-col>
          <v-col cols="12">
            <v-textarea
              v-model="portfolioState.work_history"
              label="Опыт работы (где что делали)"
              prepend-inner-icon="mdi-briefcase-edit"
              variant="solo-filled"
              flat
              rows="5"
              :loading="portfolioLoading"
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
            :loading="portfolioLoading"
            elevation="0"
          >
            <v-icon start>mdi-content-save</v-icon>
            Сохранить портфолио
          </v-btn>
          <v-btn
            variant="tonal"
            size="large"
            class="text-none font-weight-medium"
            rounded="lg"
            color="grey"
            :disabled="portfolioLoading"
            @click="loadPortfolio"
          >
            <v-icon start>mdi-refresh</v-icon>
            Отменить
          </v-btn>
        </div>
      </v-form>
    </v-card>

    <!-- Синхронизация с Telegram -->
    <v-card class="telegram-sync-card mt-6" elevation="0" rounded="xl">
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

    <!-- Snackbar для уведомлений -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="4000"
      location="top right"
    >
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">Закрыть</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 1400px;
  margin: 0 auto;
}

.profile-header {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(139, 195, 74, 0.95), rgba(227, 121, 77, 0.88));
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.header-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(139, 195, 74, 0.1), rgba(227, 121, 77, 0.1));
  opacity: 0.5;
}

.header-content {
  position: relative;
  z-index: 1;
  padding: 32px;
}

.avatar-main {
  border: 4px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.chip-status {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.stats-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
}

.stat-card {
  padding: 24px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  height: 100%;
}

.stat-card:hover {
  box-shadow: 0 8px 24px rgba(139, 195, 74, 0.15);
  transform: translateY(-4px);
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.stat-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(139, 195, 74, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.stat-title {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-main-value {
  font-size: 2rem;
  font-weight: 700;
  color: #333;
  display: flex;
  align-items: baseline;
  margin-bottom: 8px;
}

.rating-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: #8BC34A;
}

.stat-detail {
  font-size: 0.875rem;
  color: #666;
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.profile-form {
  padding: 32px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.form-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid rgba(139, 195, 74, 0.2);
}

.input-field {
  margin-bottom: 8px;
}

/* Telegram синхронизация */
.portfolio-card {
  padding: 32px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.telegram-sync-card {
  padding: 32px;
  border: 1px solid rgba(0, 0, 0, 0.08);
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
  background: rgba(139, 195, 74, 0.1);
  border-radius: 8px;
}

.telegram-not-linked .link-code-section {
  margin-bottom: 16px;
}

.code-card {
  background: linear-gradient(135deg, rgba(139, 195, 74, 0.1) 0%, rgba(139, 195, 74, 0.15) 100%);
  border: 2px solid rgba(139, 195, 74, 0.3);
}

.code-text {
  font-family: 'Courier New', monospace;
  letter-spacing: 4px;
  color: #8BC34A;
}

@media (max-width: 960px) {
  .header-content {
    padding: 24px;
  }

  .profile-form {
    padding: 24px;
  }

  .stat-main-value {
    font-size: 1.75rem;
  }

  .rating-number {
    font-size: 2rem;
  }
}
</style>

