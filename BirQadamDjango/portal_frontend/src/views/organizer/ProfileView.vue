<script setup lang="ts">
import { computed, onMounted, reactive, ref, nextTick } from 'vue';
import type { VForm } from 'vuetify/components';
import { useDisplay } from 'vuetify';

import { httpClient } from '@/services/http';
import { getTelegramSyncStatus, generateTelegramLinkCode } from '@/services/auth';
import { useAuthStore } from '@/stores/auth';
import { getOrganizerProfile, updateOrganizerProfile, type OrganizerProfile } from '@/services/webPortal';

const { mobile } = useDisplay();

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
  organization_name: '',
});

const profileData = ref<OrganizerProfile | null>(null);

// Проверка, заполнена ли личная информация
const isPersonalInfoFilled = computed(() => {
  return !!(formState.name && formState.name.trim());
});

// Проверка, заполнено ли портфолио
const isPortfolioFilled = computed(() => {
  return !!(
    portfolioState.age ||
    portfolioState.gender ||
    portfolioState.bio ||
    portfolioState.work_experience_years ||
    portfolioState.portfolio_photo_url
  );
});

// Диалог редактирования личной информации
const editPersonalInfoDialog = ref(false);
const editPersonalInfoFormRef = ref<VForm | null>(null);
const editPersonalInfoLoading = ref(false);
const editPersonalInfoState = reactive({
  name: '',
});

// Диалог редактирования портфолио
const editPortfolioDialog = ref(false);
const editPortfolioFormRef = ref<VForm | null>(null);
const editPortfolioLoading = ref(false);
const editPortfolioState = reactive({
  age: null as number | null,
  gender: null as string | null,
  bio: '',
  work_experience_years: null as number | null,
  work_history: '',
  portfolio_photo: null as File | null,
  portfolio_photo_preview: null as string | null,
});

const portfolioState = reactive({
  age: null as number | null,
  gender: null as string | null,
  bio: '',
  work_experience_years: null as number | null,
  work_history: '',
  portfolio_photo: null as File | null,
  portfolio_photo_url: null as string | null,
  portfolio_photo_preview: null as string | null,
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
}>({
  projects_count: 0,
  active_projects_count: 0,
  completed_projects_count: 0,
  volunteers_count: 0,
  tasks_count: 0,
  completed_tasks_count: 0,
  photo_reports_count: 0,
  approved_photos_count: 0,
  current_rating: 0,
});
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

// Функция форматирования номера телефона в казахстанский формат +7-(XXX)-XXX-XX-XX
const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '—';
  
  // Убираем все нецифровые символы
  const digits = phone.replace(/\D/g, '');
  
  // Если номер начинается с 8, заменяем на 7
  let cleanPhone = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
  
  // Если номер не начинается с 7, добавляем 7
  if (!cleanPhone.startsWith('7')) {
    cleanPhone = '7' + cleanPhone;
  }
  
  // Форматируем в формат +7-(XXX)-XXX-XX-XX
  if (cleanPhone.length >= 11) {
    const code = cleanPhone.slice(1, 4); // код оператора (3 цифры)
    const part1 = cleanPhone.slice(4, 7); // первая часть (3 цифры)
    const part2 = cleanPhone.slice(7, 9); // вторая часть (2 цифры)
    const part3 = cleanPhone.slice(9, 11); // третья часть (2 цифры)
    return `+7-(${code})-${part1}-${part2}-${part3}`;
  } else if (cleanPhone.length >= 4) {
    // Если номер неполный, форматируем то, что есть
    const code = cleanPhone.slice(1, 4);
    const rest = cleanPhone.slice(4);
    return `+7-(${code})-${rest}`;
  }
  
  // Если номер слишком короткий, возвращаем как есть с +7
  return `+7-${cleanPhone.slice(1)}`;
};

const loadProfile = async () => {
  loading.value = true;
  try {
    // Используем правильный API endpoint для организатора
    const profile = await getOrganizerProfile();
    profileData.value = profile;
    formState.name = profile.full_name || '';
    formState.organization_name = profile.organization_name || '';
    
    // Загружаем портфолио
    await loadPortfolio();
  } finally {
    loading.value = false;
  }
};

// Функция для преобразования относительного URL в полный
const getFullImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  // Если уже полный URL, возвращаем как есть
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Если относительный путь, добавляем базовый URL
  // Используем тот же домен, что и для API (из http.ts)
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 
    (import.meta.env.PROD ? 'https://cleanup.almau.edu.kz' : window.location.origin);
  // Убираем двойные слеши и формируем правильный URL
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${cleanUrl}`;
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
    // Преобразуем URL в полный, если нужно
    portfolioState.portfolio_photo_url = getFullImageUrl(profile.portfolio?.portfolio_photo_url) || null;
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
    const updatedProfile = await updateOrganizerProfile({
      portfolio: {
        age: portfolioState.age,
        gender: portfolioState.gender,
        bio: portfolioState.bio,
        work_experience_years: portfolioState.work_experience_years,
        work_history: portfolioState.work_history,
      },
      portfolio_photo: portfolioState.portfolio_photo || undefined,
    });

    // Обновляем URL фото из ответа API и преобразуем в полный URL
    if (updatedProfile.portfolio?.portfolio_photo_url) {
      portfolioState.portfolio_photo_url = getFullImageUrl(updatedProfile.portfolio.portfolio_photo_url) || null;
    }
    
    // Сбрасываем выбранный файл и превью
    portfolioState.portfolio_photo = null;
    portfolioState.portfolio_photo_preview = null;

    // Перезагружаем портфолио для обновления состояния
    await loadPortfolio();

    snackbar.message = 'Портфолио успешно сохранено';
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
    // Создаем превью для нового файла
    const reader = new FileReader();
    reader.onload = (e) => {
      portfolioState.portfolio_photo_preview = e.target?.result as string;
    };
    reader.readAsDataURL(target.files[0]);
  }
};

const removePortfolioPhoto = () => {
  portfolioState.portfolio_photo = null;
  portfolioState.portfolio_photo_preview = null;
  // Сбрасываем input файла
  const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
  if (fileInput) {
    fileInput.value = '';
  }
};

const loadStats = async () => {
  statsLoading.value = true;
  try {
    // Используем относительный путь - прокси настроен в vite.config.ts
    const { data } = await httpClient.get('/custom-admin/api/v1/user/stats/');
    console.log('Stats API response:', data);
    
    // Проверяем, что ответ - это объект, а не HTML строка
    const isHtmlResponse = typeof data === 'string' && data.includes('<!doctype html>');
    
    if (!isHtmlResponse && data && typeof data === 'object' && data.success && data.stats) {
      // Обновляем каждое поле отдельно для правильной реактивности Vue
      stats.value.projects_count = data.stats.projects_count ?? 0;
      stats.value.active_projects_count = data.stats.active_projects_count ?? 0;
      stats.value.completed_projects_count = data.stats.completed_projects_count ?? 0;
      stats.value.volunteers_count = data.stats.volunteers_count ?? 0;
      stats.value.tasks_count = data.stats.tasks_count ?? 0;
      stats.value.completed_tasks_count = data.stats.completed_tasks_count ?? 0;
      stats.value.photo_reports_count = data.stats.photo_reports_count ?? 0;
      stats.value.approved_photos_count = data.stats.approved_photos_count ?? 0;
      stats.value.current_rating = data.stats.current_rating ?? 0;
      console.log('Stats loaded:', stats.value);
      // Принудительно обновляем реактивность
      await nextTick();
    } else {
      if (isHtmlResponse) {
        console.warn('Stats API returned HTML instead of JSON. Check proxy configuration.');
      } else {
        console.warn('Stats API returned unexpected format:', data);
      }
      // Если success = false или HTML ответ, сбрасываем статистику
      stats.value.projects_count = 0;
      stats.value.active_projects_count = 0;
      stats.value.completed_projects_count = 0;
      stats.value.volunteers_count = 0;
      stats.value.tasks_count = 0;
      stats.value.completed_tasks_count = 0;
      stats.value.photo_reports_count = 0;
      stats.value.approved_photos_count = 0;
      stats.value.current_rating = 0;
    }
  } catch (error: any) {
    console.error('Failed to load stats:', error);
    console.error('Error details:', error?.response?.data);
    // Сбрасываем статистику при ошибке
    stats.value.projects_count = 0;
    stats.value.active_projects_count = 0;
    stats.value.completed_projects_count = 0;
    stats.value.volunteers_count = 0;
    stats.value.tasks_count = 0;
    stats.value.completed_tasks_count = 0;
    stats.value.photo_reports_count = 0;
    stats.value.approved_photos_count = 0;
    stats.value.current_rating = 0;
  } finally {
    statsLoading.value = false;
  }
};

const submit = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  // Проверяем, что имя заполнено
  if (!formState.name || !formState.name.trim()) {
    snackbar.message = 'Поле "Полное имя" обязательно для заполнения.';
    snackbar.color = 'error';
    snackbar.show = true;
    return;
  }

  loading.value = true;
  try {
    // Используем правильный API endpoint для организатора
    await updateOrganizerProfile({
      full_name: formState.name,
      // organization_name не отправляем - его нельзя менять
    });

    await authStore.loadUser();
    await loadProfile(); // Перезагружаем профиль для обновления данных

    snackbar.message = 'Профиль успешно обновлён';
    snackbar.color = 'success';
    snackbar.show = true;
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось сохранить профиль.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    loading.value = false;
  }
};

const openEditPersonalInfoDialog = () => {
  editPersonalInfoState.name = formState.name || '';
  editPersonalInfoDialog.value = true;
};

const closeEditPersonalInfoDialog = () => {
  editPersonalInfoDialog.value = false;
  editPersonalInfoState.name = '';
};

const submitEditPersonalInfo = async () => {
  const { valid } = (await editPersonalInfoFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  if (!editPersonalInfoState.name || !editPersonalInfoState.name.trim()) {
    snackbar.message = 'Поле "Полное имя" обязательно для заполнения.';
    snackbar.color = 'error';
    snackbar.show = true;
    return;
  }

  editPersonalInfoLoading.value = true;
  try {
    await updateOrganizerProfile({
      full_name: editPersonalInfoState.name,
    });

    // Обновляем локальное состояние
    formState.name = editPersonalInfoState.name;
    
    await authStore.loadUser();
    await loadProfile();

    snackbar.message = 'Личная информация обновлена';
    snackbar.color = 'success';
    snackbar.show = true;
    closeEditPersonalInfoDialog();
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось сохранить изменения.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    editPersonalInfoLoading.value = false;
  }
};

const openEditPortfolioDialog = () => {
  editPortfolioState.age = portfolioState.age;
  editPortfolioState.gender = portfolioState.gender;
  editPortfolioState.bio = portfolioState.bio;
  editPortfolioState.work_experience_years = portfolioState.work_experience_years;
  editPortfolioState.work_history = portfolioState.work_history;
  editPortfolioState.portfolio_photo = null;
  editPortfolioState.portfolio_photo_preview = null;
  editPortfolioDialog.value = true;
};

const closeEditPortfolioDialog = () => {
  editPortfolioDialog.value = false;
  editPortfolioState.age = null;
  editPortfolioState.gender = null;
  editPortfolioState.bio = '';
  editPortfolioState.work_experience_years = null;
  editPortfolioState.work_history = '';
  editPortfolioState.portfolio_photo = null;
  editPortfolioState.portfolio_photo_preview = null;
};

const handleEditPortfolioPhotoChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    editPortfolioState.portfolio_photo = target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      editPortfolioState.portfolio_photo_preview = e.target?.result as string;
    };
    reader.readAsDataURL(target.files[0]);
  }
};

const removeEditPortfolioPhoto = () => {
  editPortfolioState.portfolio_photo = null;
  editPortfolioState.portfolio_photo_preview = null;
  const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
  if (fileInput) {
    fileInput.value = '';
  }
};

const submitEditPortfolio = async () => {
  const { valid } = (await editPortfolioFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  editPortfolioLoading.value = true;
  try {
    const updatedProfile = await updateOrganizerProfile({
      portfolio: {
        age: editPortfolioState.age,
        gender: editPortfolioState.gender,
        bio: editPortfolioState.bio,
        work_experience_years: editPortfolioState.work_experience_years,
        work_history: editPortfolioState.work_history,
      },
      portfolio_photo: editPortfolioState.portfolio_photo || undefined,
    });

    // Обновляем локальное состояние
    portfolioState.age = editPortfolioState.age;
    portfolioState.gender = editPortfolioState.gender;
    portfolioState.bio = editPortfolioState.bio;
    portfolioState.work_experience_years = editPortfolioState.work_experience_years;
    portfolioState.work_history = editPortfolioState.work_history;
    
    if (updatedProfile.portfolio?.portfolio_photo_url) {
      portfolioState.portfolio_photo_url = getFullImageUrl(updatedProfile.portfolio.portfolio_photo_url) || null;
    }
    
    editPortfolioState.portfolio_photo = null;
    editPortfolioState.portfolio_photo_preview = null;

    snackbar.message = 'Портфолио успешно обновлено';
    snackbar.color = 'success';
    snackbar.show = true;
    closeEditPortfolioDialog();
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось сохранить портфолио.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    editPortfolioLoading.value = false;
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

// Password change functionality
const passwordDialog = ref(false);
const passwordFormRef = ref<VForm | null>(null);
const passwordLoading = ref(false);
const passwordFormState = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

// Notification settings
const notificationSettings = reactive({
  email: {
    new_applications: true,
    new_tasks: true,
    photo_reports: true,
    project_updates: true,
  },
  telegram: {
    new_applications: true,
    new_tasks: true,
    photo_reports: true,
    project_updates: true,
    reminders: true,
  },
  reminder_frequency: '2_hours' as 'immediate' | '1_hour' | '2_hours' | '6_hours' | 'daily',
});

const notificationLoading = ref(false);
const notificationSaving = ref(false);
const notificationSettingsDialog = ref(false);

const passwordRules = {
  required: (value: string) => !!value || 'Поле обязательно для заполнения.',
  password: (value: string) => {
    if (!value) return true;
    return value.length >= 8 || 'Пароль должен содержать не менее 8 символов.';
  },
  passwordMatch: (value: string) => {
    if (!value) return true;
    return value === passwordFormState.newPassword || 'Пароли не совпадают.';
  },
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

const loadNotificationSettings = async () => {
  notificationLoading.value = true;
  try {
    // TODO: Заменить на реальный API endpoint когда будет готов
    // const { data } = await httpClient.get('/api/web/notification-settings/');
    // Object.assign(notificationSettings, data);
    
    // Временные значения по умолчанию
    // После реализации API раскомментировать выше
  } catch (error: any) {
    console.error('Failed to load notification settings:', error);
  } finally {
    notificationLoading.value = false;
  }
};

const saveNotificationSettings = async () => {
  notificationSaving.value = true;
  try {
    // TODO: Заменить на реальный API endpoint когда будет готов
    // await httpClient.put('/api/web/notification-settings/', notificationSettings);
    
    snackbar.message = 'Настройки уведомлений сохранены';
    snackbar.color = 'success';
    snackbar.show = true;
    notificationSettingsDialog.value = false;
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось сохранить настройки.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    notificationSaving.value = false;
  }
};

const reminderFrequencyOptions = [
  { title: 'Сразу', value: 'immediate' },
  { title: 'За 1 час', value: '1_hour' },
  { title: 'За 2 часа', value: '2_hours' },
  { title: 'За 6 часов', value: '6_hours' },
  { title: 'Раз в день', value: 'daily' },
];

onMounted(async () => {
  await Promise.all([
    loadProfile(),
    loadStats(),
    loadTelegramSync(),
    loadNotificationSettings(),
  ]);
});
</script>

<template>
  <div class="profile-page">
    <!-- ─── Page Header ─── -->
    <div class="page-header">
      <div class="page-header__content">
        <div class="page-header__left">
          <div class="page-header__badge">
            <v-icon icon="mdi-account-tie-outline" size="15" />
            Профиль организатора
          </div>
          <h1 class="page-title">{{ formState.name || authStore.user?.full_name || authStore.user?.username || 'Организатор' }}</h1>
          <p class="page-subtitle">{{ formState.organization_name || authStore.user?.organization_name || 'Организация' }}</p>
        </div>
        <div class="page-header__right">
          <v-chip
            :color="statusConfig.color"
            size="default"
            variant="flat"
            :prepend-icon="statusConfig.icon"
            class="status-chip"
          >
            {{ statusConfig.title }}
          </v-chip>
          <v-avatar 
            size="80" 
            class="profile-avatar"
          >
            <v-img
              v-if="portfolioState.portfolio_photo_preview || portfolioState.portfolio_photo_url"
              :src="(portfolioState.portfolio_photo_preview || portfolioState.portfolio_photo_url) || ''"
              cover
              alt="Фото профиля"
            />
            <v-icon v-else size="40" color="white">mdi-office-building</v-icon>
          </v-avatar>
              </div>
      </div>
      
      <!-- Contact info row -->
      <div class="page-header__contacts">
        <div v-if="authStore.user?.phone_number || profileData?.phone_number" class="contact-item">
          <v-icon size="16">mdi-phone</v-icon>
          <span>{{ formatPhoneNumber(authStore.user?.phone_number || profileData?.phone_number) }}</span>
        </div>
        <div v-if="authStore.user?.email || profileData?.email" class="contact-item">
          <v-icon size="16">mdi-email</v-icon>
                <span>{{ authStore.user?.email || profileData?.email }}</span>
              </div>
        <div v-if="portfolioState.age" class="contact-item">
          <v-icon size="16">mdi-calendar</v-icon>
                <span>{{ portfolioState.age }} лет</span>
              </div>
        <div v-if="portfolioState.gender" class="contact-item">
          <v-icon size="16">mdi-gender-male-female</v-icon>
                <span>{{ portfolioState.gender === 'male' ? 'Мужской' : portfolioState.gender === 'female' ? 'Женский' : 'Другое' }}</span>
              </div>
        <div v-if="portfolioState.work_experience_years" class="contact-item">
          <v-icon size="16">mdi-briefcase-clock</v-icon>
                <span>Стаж: {{ portfolioState.work_experience_years }} {{ portfolioState.work_experience_years === 1 ? 'год' : portfolioState.work_experience_years < 5 ? 'года' : 'лет' }}</span>
              </div>
              </div>
      
      <!-- Bio -->
      <div v-if="portfolioState.bio" class="page-header__bio">
        <v-icon size="18" class="mr-2">mdi-account-circle</v-icon>
        <span>{{ portfolioState.bio }}</span>
            </div>
          </div>

    <!-- ─── Статистика ─── -->
    <div class="section-card">
      <div class="section-card__head">
        <div>
          <h2 class="card-title">Статистика и аналитика</h2>
          <p class="card-sub">Обзор вашей активности и результатов</p>
        </div>
      </div>
      
      <div v-if="statsLoading" class="stats-loading">
        <v-progress-circular indeterminate color="primary" size="40" />
      </div>
      
      <div v-else class="stats-grid">
        <!-- Проекты -->
        <div class="stat-tile">
          <div class="stat-tile__icon" style="background: rgba(139, 195, 74, 0.1);">
            <v-icon size="24" color="#8bc34a">mdi-briefcase</v-icon>
            </div>
          <div class="stat-tile__content">
            <div class="stat-tile__label">Проекты</div>
            <div class="stat-tile__value">{{ stats.projects_count }}</div>
            <div class="stat-tile__details">
              <span>Активных: <strong>{{ stats.active_projects_count }}</strong></span>
              <span>Завершённых: <strong>{{ stats.completed_projects_count }}</strong></span>
              </div>
              </div>
              </div>

        <!-- Волонтёры -->
        <div class="stat-tile">
          <div class="stat-tile__icon" style="background: rgba(0, 137, 123, 0.1);">
            <v-icon size="24" color="#00897b">mdi-account-multiple</v-icon>
            </div>
          <div class="stat-tile__content">
            <div class="stat-tile__label">Волонтёры</div>
            <div class="stat-tile__value">{{ stats.volunteers_count }}</div>
              <v-btn
                variant="text"
                color="primary"
              size="small"
              class="text-none mt-2"
              rounded="pill"
                :to="{ name: 'organizer-volunteers' }"
              >
                Управление командой
              <v-icon end size="16">mdi-arrow-right</v-icon>
              </v-btn>
          </div>
        </div>

        <!-- Задачи -->
        <div class="stat-tile">
          <div class="stat-tile__icon" style="background: rgba(57, 73, 171, 0.1);">
            <v-icon size="24" color="#3949ab">mdi-clipboard-check</v-icon>
            </div>
          <div class="stat-tile__content">
            <div class="stat-tile__label">Задачи</div>
            <div class="stat-tile__value">{{ stats.tasks_count }}</div>
            <div class="stat-tile__details">
              <span>Выполнено: <strong style="color: #2e7d32;">{{ stats.completed_tasks_count }}</strong></span>
              </div>
              <v-btn
                variant="text"
                color="primary"
              size="small"
              class="text-none mt-2"
              rounded="pill"
                :to="{ name: 'organizer-tasks' }"
              >
                Все задачи
              <v-icon end size="16">mdi-arrow-right</v-icon>
              </v-btn>
          </div>
        </div>

        <!-- Фотоотчёты -->
        <div class="stat-tile">
          <div class="stat-tile__icon" style="background: rgba(230, 74, 25, 0.1);">
            <v-icon size="24" color="#e64a19">mdi-camera</v-icon>
            </div>
          <div class="stat-tile__content">
            <div class="stat-tile__label">Фотоотчёты</div>
            <div class="stat-tile__value">{{ stats.photo_reports_count }}</div>
            <div class="stat-tile__details">
              <span>Одобрено: <strong style="color: #2e7d32;">{{ stats.approved_photos_count }}</strong></span>
              </div>
              <v-btn
                variant="text"
                color="primary"
              size="small"
              class="text-none mt-2"
              rounded="pill"
                :to="{ name: 'organizer-photo-moderation' }"
              >
                Модерация фото
              <v-icon end size="16">mdi-arrow-right</v-icon>
              </v-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Личная информация ─── -->
    <div class="section-card">
      <div class="section-card__head">
        <div>
          <h2 class="card-title">Личная информация</h2>
          <p class="card-sub">Основные данные профиля</p>
        </div>
        <v-btn
          v-if="isPersonalInfoFilled"
          variant="outlined"
          size="small"
          class="text-none"
          rounded="pill"
          @click="openEditPersonalInfoDialog"
        >
          <v-icon start size="16">mdi-pencil-outline</v-icon>
          Редактировать
        </v-btn>
      </div>
      
      <!-- Форма заполнения (только если не заполнено) -->
      <v-form v-if="!isPersonalInfoFilled" ref="formRef" @submit.prevent="submit">
        <div class="form-section">
          <div class="form-section__label">Основные данные</div>
          <v-row dense>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="formState.name"
              label="Полное имя"
              prepend-inner-icon="mdi-account"
                variant="outlined"
                density="comfortable"
              :rules="[rules.required]"
              autocomplete="name"
              :loading="loading"
              rounded="lg"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
                :model-value="formState.organization_name || authStore.user?.organization_name || ''"
              label="Название организации"
              prepend-inner-icon="mdi-office-building"
                variant="outlined"
                density="comfortable"
                readonly
              :loading="loading"
              rounded="lg"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
                :model-value="formatPhoneNumber(profileData?.phone_number || authStore.user?.phone_number)"
              label="Номер телефона"
              prepend-inner-icon="mdi-phone"
                variant="outlined"
                density="comfortable"
              readonly
              rounded="lg"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              :model-value="profileData?.email || authStore.user?.email || ''"
              label="Email"
              prepend-inner-icon="mdi-email"
                variant="outlined"
                density="comfortable"
              readonly
              rounded="lg"
              hide-details="auto"
            />
          </v-col>
        </v-row>
        </div>

        <div class="form-actions">
          <v-btn
            type="submit"
            color="primary"
            size="large"
            class="text-none font-weight-bold"
            rounded="pill"
            :loading="loading"
            elevation="0"
          >
            <v-icon start>mdi-content-save</v-icon>
            Сохранить
          </v-btn>
        </div>
      </v-form>

      <!-- Просмотр информации (если заполнено) -->
      <div v-else class="personal-info-view">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-item__label">
              <v-icon size="18" class="mr-2">mdi-account</v-icon>
              Полное имя
            </div>
            <div class="info-item__value">{{ formState.name }}</div>
          </div>
          <div class="info-item">
            <div class="info-item__label">
              <v-icon size="18" class="mr-2">mdi-office-building</v-icon>
              Название организации
            </div>
            <div class="info-item__value">{{ formState.organization_name || authStore.user?.organization_name || '—' }}</div>
          </div>
          <div class="info-item">
            <div class="info-item__label">
              <v-icon size="18" class="mr-2">mdi-phone</v-icon>
              Номер телефона
            </div>
            <div class="info-item__value">{{ formatPhoneNumber(profileData?.phone_number || authStore.user?.phone_number) }}</div>
          </div>
          <div class="info-item">
            <div class="info-item__label">
              <v-icon size="18" class="mr-2">mdi-email</v-icon>
              Email
            </div>
            <div class="info-item__value">{{ profileData?.email || authStore.user?.email || '—' }}</div>
          </div>
        </div>
      </div>
      </div>
      
    <!-- ─── Портфолио организатора ─── -->
    <div class="section-card">
      <div class="section-card__head">
        <div>
          <h2 class="card-title">Портфолио организатора</h2>
          <p class="card-sub">Информация видна волонтёрам при просмотре проектов</p>
        </div>
        <v-btn
          v-if="isPortfolioFilled"
          variant="outlined"
          size="small"
          class="text-none"
          rounded="pill"
          @click="openEditPortfolioDialog"
        >
          <v-icon start size="16">mdi-pencil-outline</v-icon>
          Редактировать
        </v-btn>
      </div>
      
      <!-- Форма заполнения (только если не заполнено) -->
      <template v-if="!isPortfolioFilled">
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
        <div class="form-section">
          <div class="form-section__label">Личная информация</div>
          <v-row dense>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="portfolioState.age"
              label="Возраст"
              prepend-inner-icon="mdi-calendar"
                variant="outlined"
                density="comfortable"
              type="number"
              :min="18"
              :max="100"
              :loading="portfolioLoading"
              rounded="lg"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="portfolioState.gender"
              label="Пол"
              prepend-inner-icon="mdi-account"
                variant="outlined"
                density="comfortable"
              :items="[
                { title: 'Мужской', value: 'male' },
                { title: 'Женский', value: 'female' },
                { title: 'Другое', value: 'other' },
              ]"
              :loading="portfolioLoading"
              rounded="lg"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12">
            <v-textarea
              v-model="portfolioState.bio"
              label="О себе"
              prepend-inner-icon="mdi-account-circle"
                variant="outlined"
                density="comfortable"
              rows="4"
              :loading="portfolioLoading"
              rounded="lg"
              hide-details="auto"
                auto-grow
            />
          </v-col>
          </v-row>
        </div>

        <div class="form-section">
          <div class="form-section__label">Опыт работы</div>
          <v-row dense>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="portfolioState.work_experience_years"
              label="Стаж работы (лет)"
              prepend-inner-icon="mdi-briefcase-clock"
                variant="outlined"
                density="comfortable"
              type="number"
              :min="0"
              :max="100"
              :loading="portfolioLoading"
              rounded="lg"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-file-input
              label="Фото 3х4 (по желанию)"
              prepend-inner-icon="mdi-camera"
                variant="outlined"
                density="comfortable"
              accept="image/*"
              :loading="portfolioLoading"
              rounded="lg"
              hide-details="auto"
              @change="handlePortfolioPhotoChange"
            />
            <!-- Превью выбранного файла или текущего фото -->
            <div v-if="portfolioState.portfolio_photo_preview || portfolioState.portfolio_photo_url" class="mt-3">
              <div class="d-flex align-center ga-3">
                <v-img
                    :src="(portfolioState.portfolio_photo_preview || portfolioState.portfolio_photo_url) || ''"
                  max-width="150"
                  max-height="200"
                  cover
                  class="rounded-lg"
                />
                <v-btn
                  v-if="portfolioState.portfolio_photo_preview"
                  icon="mdi-delete"
                  color="error"
                  variant="text"
                  size="small"
                  @click="removePortfolioPhoto"
                  title="Удалить выбранное фото"
                />
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                <span v-if="portfolioState.portfolio_photo_preview">Выбрано новое фото. Нажмите "Сохранить портфолио" для применения.</span>
                <span v-else>Текущее фото. Выберите новое для замены.</span>
              </div>
            </div>
          </v-col>
        </v-row>
        </div>

        <div class="form-actions">
          <v-btn
            type="submit"
            color="primary"
            size="large"
            class="text-none font-weight-bold"
            rounded="pill"
            :loading="portfolioLoading"
            elevation="0"
          >
            <v-icon start>mdi-content-save</v-icon>
            Сохранить портфолио
          </v-btn>
        </div>
      </v-form>
      </template>

      <!-- Просмотр портфолио (если заполнено) -->
      <div v-else class="portfolio-view">
        <div class="portfolio-view__grid">
          <div v-if="portfolioState.age" class="portfolio-item">
            <div class="portfolio-item__label">
              <v-icon size="18" class="mr-2">mdi-calendar</v-icon>
              Возраст
            </div>
            <div class="portfolio-item__value">{{ portfolioState.age }} лет</div>
          </div>
          <div v-if="portfolioState.gender" class="portfolio-item">
            <div class="portfolio-item__label">
              <v-icon size="18" class="mr-2">mdi-gender-male-female</v-icon>
              Пол
            </div>
            <div class="portfolio-item__value">
              {{ portfolioState.gender === 'male' ? 'Мужской' : portfolioState.gender === 'female' ? 'Женский' : 'Другое' }}
            </div>
          </div>
          <div v-if="portfolioState.work_experience_years" class="portfolio-item">
            <div class="portfolio-item__label">
              <v-icon size="18" class="mr-2">mdi-briefcase-clock</v-icon>
              Стаж работы
            </div>
            <div class="portfolio-item__value">
              {{ portfolioState.work_experience_years }} {{ portfolioState.work_experience_years === 1 ? 'год' : portfolioState.work_experience_years < 5 ? 'года' : 'лет' }}
            </div>
          </div>
          <div v-if="portfolioState.bio" class="portfolio-item portfolio-item--full">
            <div class="portfolio-item__label">
              <v-icon size="18" class="mr-2">mdi-account-circle</v-icon>
              О себе
            </div>
            <div class="portfolio-item__value portfolio-item__value--text">{{ portfolioState.bio }}</div>
          </div>
          <div v-if="portfolioState.portfolio_photo_url" class="portfolio-item portfolio-item--full">
            <div class="portfolio-item__label">
              <v-icon size="18" class="mr-2">mdi-camera</v-icon>
              Фото
            </div>
            <div class="portfolio-item__photo">
              <v-img
                :src="portfolioState.portfolio_photo_url || ''"
                max-width="200"
                max-height="250"
                cover
                class="rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Изменение пароля ─── -->
    <div class="section-card">
      <div class="section-card__head">
        <div>
          <h2 class="card-title">Изменение пароля</h2>
          <p class="card-sub">Обновите пароль для входа в систему</p>
        </div>
      </div>
      <div class="password-change-content">
        <p class="text-body-2 text-medium-emphasis mb-4">
          Вы можете изменить свой пароль для входа в систему.
        </p>
        <v-btn
          color="primary"
          size="large"
          class="text-none font-weight-bold"
          rounded="pill"
          elevation="0"
          @click="passwordDialog = true"
        >
          <v-icon start>mdi-lock-reset</v-icon>
          Изменить пароль
        </v-btn>
      </div>
    </div>

    <!-- ─── Настройки уведомлений ─── -->
    <div class="section-card">
      <div class="section-card__head">
        <div>
          <h2 class="card-title">Настройки уведомлений</h2>
          <p class="card-sub">Управляйте уведомлениями по email и Telegram</p>
        </div>
      </div>
      <div class="notification-settings-preview">
        <div class="notification-preview-item">
          <v-icon icon="mdi-email-outline" size="24" color="primary" />
          <div class="notification-preview-info">
            <div class="notification-preview-label">Email уведомления</div>
            <div class="notification-preview-desc">
              {{ Object.values(notificationSettings.email).filter(v => v).length }} из {{ Object.keys(notificationSettings.email).length }} включено
            </div>
          </div>
        </div>
        <div class="notification-preview-item">
          <v-icon icon="mdi-telegram" size="24" color="primary" />
          <div class="notification-preview-info">
            <div class="notification-preview-label">Telegram уведомления</div>
            <div class="notification-preview-desc">
              <span v-if="telegramSync?.is_linked">
                {{ Object.values(notificationSettings.telegram).filter(v => v).length }} из {{ Object.keys(notificationSettings.telegram).length }} включено
              </span>
              <span v-else class="text-warning">Telegram не привязан</span>
            </div>
          </div>
        </div>
        <v-btn
          color="primary"
          size="large"
          class="text-none font-weight-bold mt-4"
          rounded="pill"
          block
          @click="notificationSettingsDialog = true"
        >
          <v-icon start>mdi-cog-outline</v-icon>
          Настроить уведомления
        </v-btn>
      </div>
    </div>

    <!-- ─── Синхронизация с Telegram ─── -->
    <div class="section-card">
      <div class="section-card__head">
        <div>
          <h2 class="card-title">Синхронизация с Telegram</h2>
          <p class="card-sub">Привяжите аккаунт для синхронизации прогресса</p>
        </div>
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
            <div class="font-weight-bold mb-1">Telegram не привязан</div>
            <div class="text-caption">Привяжите аккаунт для синхронизации прогресса</div>
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
              Откройте Telegram бот и используйте команду <strong>/link {{ linkCode }}</strong>
            </div>
            <v-btn
              color="primary"
              variant="outlined"
              size="large"
              class="text-none font-weight-bold"
              rounded="pill"
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
            rounded="pill"
            :loading="telegramLoading"
            @click="generateCode"
            block
          >
            <v-icon start>mdi-link</v-icon>
            {{ linkCode ? 'Сгенерировать новый код' : 'Получить код для привязки' }}
          </v-btn>
        </div>
      </div>
    </div>

    <!-- ─── Диалог редактирования личной информации ─── -->
    <v-dialog v-model="editPersonalInfoDialog" max-width="580" persistent>
      <v-card class="edit-personal-info-dialog" rounded="2xl">
        <div class="edit-personal-info-dialog__header">
          <div class="edit-personal-info-dialog__header-icon">
            <v-icon icon="mdi-account-edit" size="22" />
          </div>
          <div>
            <h2 class="edit-personal-info-dialog__title">Редактировать личную информацию</h2>
            <p class="edit-personal-info-dialog__subtitle">Обновите данные профиля</p>
          </div>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="closeEditPersonalInfoDialog"
          />
        </div>
        <v-divider />
        <v-card-text class="edit-personal-info-dialog__body">
          <v-form ref="editPersonalInfoFormRef" @submit.prevent="submitEditPersonalInfo">
            <v-text-field
              v-model="editPersonalInfoState.name"
              label="Полное имя"
              prepend-inner-icon="mdi-account"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required]"
              autocomplete="name"
              rounded="lg"
              hide-details="auto"
              class="mb-4"
            />
            <v-text-field
              :model-value="formState.organization_name || authStore.user?.organization_name || ''"
              label="Название организации"
              prepend-inner-icon="mdi-office-building"
              variant="outlined"
              density="comfortable"
              readonly
              rounded="lg"
              hide-details="auto"
              class="mb-4"
            />
            <v-text-field
              :model-value="formatPhoneNumber(profileData?.phone_number || authStore.user?.phone_number)"
              label="Номер телефона"
              prepend-inner-icon="mdi-phone"
              variant="outlined"
              density="comfortable"
              readonly
              rounded="lg"
              hide-details="auto"
              class="mb-4"
            />
            <v-text-field
              :model-value="profileData?.email || authStore.user?.email || ''"
              label="Email"
              prepend-inner-icon="mdi-email"
              variant="outlined"
              density="comfortable"
              readonly
              rounded="lg"
              hide-details="auto"
            />
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions class="edit-personal-info-dialog__footer">
          <v-btn
            variant="text"
            class="text-none"
            @click="closeEditPersonalInfoDialog"
          >
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            class="text-none font-weight-bold"
            rounded="pill"
            :loading="editPersonalInfoLoading"
            @click="submitEditPersonalInfo"
          >
            Сохранить изменения
          </v-btn>
        </v-card-actions>
    </v-card>
    </v-dialog>

    <!-- ─── Диалог редактирования портфолио ─── -->
    <v-dialog v-model="editPortfolioDialog" max-width="680" scrollable persistent>
      <v-card class="edit-portfolio-dialog" rounded="2xl">
        <div class="edit-portfolio-dialog__header">
          <div class="edit-portfolio-dialog__header-icon">
            <v-icon icon="mdi-briefcase-account" size="22" />
          </div>
          <div>
            <h2 class="edit-portfolio-dialog__title">Редактировать портфолио</h2>
            <p class="edit-portfolio-dialog__subtitle">Обновите информацию о себе</p>
          </div>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="closeEditPortfolioDialog"
          />
        </div>
        <v-divider />
        <v-card-text class="edit-portfolio-dialog__body">
          <v-form ref="editPortfolioFormRef" @submit.prevent="submitEditPortfolio">
            <div class="form-section">
              <div class="form-section__label">Личная информация</div>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="editPortfolioState.age"
                    label="Возраст"
                    prepend-inner-icon="mdi-calendar"
                    variant="outlined"
                    density="comfortable"
                    type="number"
                    :min="18"
                    :max="100"
                    rounded="lg"
                    hide-details="auto"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="editPortfolioState.gender"
                    label="Пол"
                    prepend-inner-icon="mdi-account"
                    variant="outlined"
                    density="comfortable"
                    :items="[
                      { title: 'Мужской', value: 'male' },
                      { title: 'Женский', value: 'female' },
                      { title: 'Другое', value: 'other' },
                    ]"
                    rounded="lg"
                    hide-details="auto"
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="editPortfolioState.bio"
                    label="О себе"
                    prepend-inner-icon="mdi-account-circle"
                    variant="outlined"
                    density="comfortable"
                    rows="4"
                    rounded="lg"
                    hide-details="auto"
                    auto-grow
                  />
                </v-col>
              </v-row>
            </div>

            <div class="form-section">
              <div class="form-section__label">Опыт работы</div>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="editPortfolioState.work_experience_years"
                    label="Стаж работы (лет)"
                    prepend-inner-icon="mdi-briefcase-clock"
                    variant="outlined"
                    density="comfortable"
                    type="number"
                    :min="0"
                    :max="100"
                    rounded="lg"
                    hide-details="auto"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-file-input
                    label="Фото 3х4 (по желанию)"
                    prepend-inner-icon="mdi-camera"
                    variant="outlined"
                    density="comfortable"
                    accept="image/*"
                    rounded="lg"
                    hide-details="auto"
                    @change="handleEditPortfolioPhotoChange"
                  />
                  <!-- Превью выбранного файла или текущего фото -->
                  <div v-if="editPortfolioState.portfolio_photo_preview || portfolioState.portfolio_photo_url" class="mt-3">
                    <div class="d-flex align-center ga-3">
                      <v-img
                        :src="(editPortfolioState.portfolio_photo_preview || portfolioState.portfolio_photo_url) || ''"
                        max-width="150"
                        max-height="200"
                        cover
                        class="rounded-lg"
                      />
                      <v-btn
                        v-if="editPortfolioState.portfolio_photo_preview"
                        icon="mdi-delete"
                        color="error"
                        variant="text"
                        size="small"
                        @click="removeEditPortfolioPhoto"
                        title="Удалить выбранное фото"
                      />
                    </div>
                    <div class="text-caption text-medium-emphasis mt-2">
                      <span v-if="editPortfolioState.portfolio_photo_preview">Выбрано новое фото. Нажмите "Сохранить" для применения.</span>
                      <span v-else>Текущее фото. Выберите новое для замены.</span>
                    </div>
                  </div>
                </v-col>
              </v-row>
            </div>
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions class="edit-portfolio-dialog__footer">
          <v-btn
            variant="text"
            class="text-none"
            @click="closeEditPortfolioDialog"
          >
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            class="text-none font-weight-bold"
            rounded="pill"
            :loading="editPortfolioLoading"
            @click="submitEditPortfolio"
          >
            Сохранить изменения
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─── Диалог настроек уведомлений ─── -->
    <v-dialog 
      v-model="notificationSettingsDialog" 
      :max-width="mobile ? '100%' : '700'"
      :fullscreen="mobile"
      scrollable 
      persistent
    >
      <v-card class="notification-settings-dialog" :rounded="mobile ? '0' : '2xl'">
        <div class="notification-settings-dialog__header">
          <div class="notification-settings-dialog__header-icon">
            <v-icon icon="mdi-bell-cog-outline" size="22" />
          </div>
          <div>
            <h2 class="notification-settings-dialog__title">Настройки уведомлений</h2>
            <p class="notification-settings-dialog__subtitle">Управляйте уведомлениями по email и Telegram</p>
          </div>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="notificationSettingsDialog = false"
          />
        </div>
        <v-divider />
        <v-card-text class="notification-settings-dialog__body">
          <div v-if="notificationLoading" class="d-flex justify-center py-8">
            <v-progress-circular indeterminate color="primary" size="40" />
          </div>
          
          <div v-else>
            <!-- Email уведомления -->
            <div class="notification-section">
              <div class="notification-section__header">
                <v-icon icon="mdi-email-outline" size="20" class="mr-2" color="primary" />
                <h3 class="notification-section__title">Email уведомления</h3>
              </div>
              <div class="notification-section__content">
                <div class="notification-item">
                  <div class="notification-item__info">
                    <div class="notification-item__label">Новые заявки волонтёров</div>
                    <div class="notification-item__desc">Уведомления о новых заявках на участие в проектах</div>
                  </div>
                  <v-switch
                    v-model="notificationSettings.email.new_applications"
                    color="primary"
                    hide-details
                    density="compact"
                  />
                </div>
                <v-divider class="my-2" />
                <div class="notification-item">
                  <div class="notification-item__info">
                    <div class="notification-item__label">Новые задачи</div>
                    <div class="notification-item__desc">Уведомления о создании новых задач</div>
                  </div>
                  <v-switch
                    v-model="notificationSettings.email.new_tasks"
                    color="primary"
                    hide-details
                    density="compact"
                  />
                </div>
                <v-divider class="my-2" />
                <div class="notification-item">
                  <div class="notification-item__info">
                    <div class="notification-item__label">Фотоотчёты</div>
                    <div class="notification-item__desc">Уведомления о новых фотоотчётах от волонтёров</div>
                  </div>
                  <v-switch
                    v-model="notificationSettings.email.photo_reports"
                    color="primary"
                    hide-details
                    density="compact"
                  />
                </div>
                <v-divider class="my-2" />
                <div class="notification-item">
                  <div class="notification-item__info">
                    <div class="notification-item__label">Обновления проектов</div>
                    <div class="notification-item__desc">Уведомления об изменениях в проектах</div>
                  </div>
                  <v-switch
                    v-model="notificationSettings.email.project_updates"
                    color="primary"
                    hide-details
                    density="compact"
                  />
                </div>
              </div>
            </div>

            <!-- Telegram уведомления -->
            <div class="notification-section">
              <div class="notification-section__header">
                <v-icon icon="mdi-telegram" size="20" class="mr-2" color="primary" />
                <h3 class="notification-section__title">Telegram уведомления</h3>
                <v-chip
                  v-if="telegramSync?.is_linked"
                  size="x-small"
                  color="success"
                  variant="tonal"
                  class="ml-2"
                >
                  Привязан
                </v-chip>
                <v-chip
                  v-else
                  size="x-small"
                  color="warning"
                  variant="tonal"
                  class="ml-2"
                >
                  Не привязан
                </v-chip>
              </div>
              <div class="notification-section__content">
                <div class="notification-item">
                  <div class="notification-item__info">
                    <div class="notification-item__label">Новые заявки волонтёров</div>
                    <div class="notification-item__desc">Уведомления о новых заявках на участие в проектах</div>
                  </div>
                  <v-switch
                    v-model="notificationSettings.telegram.new_applications"
                    color="primary"
                    :disabled="!telegramSync?.is_linked"
                    hide-details
                    density="compact"
                  />
                </div>
                <v-divider class="my-2" />
                <div class="notification-item">
                  <div class="notification-item__info">
                    <div class="notification-item__label">Новые задачи</div>
                    <div class="notification-item__desc">Уведомления о создании новых задач</div>
                  </div>
                  <v-switch
                    v-model="notificationSettings.telegram.new_tasks"
                    color="primary"
                    :disabled="!telegramSync?.is_linked"
                    hide-details
                    density="compact"
                  />
                </div>
                <v-divider class="my-2" />
                <div class="notification-item">
                  <div class="notification-item__info">
                    <div class="notification-item__label">Фотоотчёты</div>
                    <div class="notification-item__desc">Уведомления о новых фотоотчётах от волонтёров</div>
                  </div>
                  <v-switch
                    v-model="notificationSettings.telegram.photo_reports"
                    color="primary"
                    :disabled="!telegramSync?.is_linked"
                    hide-details
                    density="compact"
                  />
                </div>
                <v-divider class="my-2" />
                <div class="notification-item">
                  <div class="notification-item__info">
                    <div class="notification-item__label">Обновления проектов</div>
                    <div class="notification-item__desc">Уведомления об изменениях в проектах</div>
                  </div>
                  <v-switch
                    v-model="notificationSettings.telegram.project_updates"
                    color="primary"
                    :disabled="!telegramSync?.is_linked"
                    hide-details
                    density="compact"
                  />
                </div>
                <v-divider class="my-2" />
                <div class="notification-item">
                  <div class="notification-item__info">
                    <div class="notification-item__label">Напоминания</div>
                    <div class="notification-item__desc">Напоминания о дедлайнах задач и событиях</div>
                  </div>
                  <v-switch
                    v-model="notificationSettings.telegram.reminders"
                    color="primary"
                    :disabled="!telegramSync?.is_linked"
                    hide-details
                    density="compact"
                  />
                </div>
                <v-alert
                  v-if="!telegramSync?.is_linked"
                  type="info"
                  variant="tonal"
                  rounded="lg"
                  class="mt-3"
                >
                  <div class="text-caption">
                    Привяжите Telegram аккаунт в разделе "Синхронизация с Telegram" для включения уведомлений
                  </div>
                </v-alert>
              </div>
            </div>

            <!-- Частота напоминаний -->
            <div class="notification-section">
              <div class="notification-section__header">
                <v-icon icon="mdi-bell-ring-outline" size="20" class="mr-2" color="primary" />
                <h3 class="notification-section__title">Частота напоминаний</h3>
              </div>
              <div class="notification-section__content">
                <div class="notification-item notification-item--reminder">
                  <div class="notification-item__info">
                    <div class="notification-item__label">Когда отправлять напоминания</div>
                    <div class="notification-item__desc">Выберите, за сколько времени до события отправлять напоминания</div>
                  </div>
                  <v-select
                    v-model="notificationSettings.reminder_frequency"
                    :items="reminderFrequencyOptions"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    density="comfortable"
                    rounded="lg"
                    hide-details
                    class="reminder-frequency-select"
                  />
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="notification-settings-dialog__footer">
          <v-btn
            variant="text"
            class="text-none"
            @click="notificationSettingsDialog = false"
          >
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            class="text-none font-weight-bold"
            rounded="pill"
            :loading="notificationSaving"
            @click="saveNotificationSettings"
          >
            <v-icon start>mdi-content-save</v-icon>
            Сохранить настройки
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─── Диалог изменения пароля ─── -->
    <v-dialog v-model="passwordDialog" max-width="500" persistent>
      <v-card class="password-dialog" rounded="2xl">
        <div class="password-dialog__header">
          <div class="password-dialog__header-icon">
            <v-icon icon="mdi-lock-reset" size="22" />
          </div>
          <div>
            <h2 class="password-dialog__title">Изменение пароля</h2>
            <p class="password-dialog__subtitle">Введите текущий и новый пароль</p>
          </div>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="passwordDialog = false"
          />
        </div>
        <v-divider />
        <v-card-text class="password-dialog__body">
          <v-form ref="passwordFormRef" @submit.prevent="changePassword">
            <v-text-field
              v-model="passwordFormState.currentPassword"
              label="Текущий пароль"
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="mdi-lock-outline"
              :rules="[passwordRules.required]"
              type="password"
              autocomplete="current-password"
              class="mb-4"
              rounded="lg"
            />
            <v-text-field
              v-model="passwordFormState.newPassword"
              label="Новый пароль"
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="mdi-lock-outline"
              :rules="[passwordRules.required, passwordRules.password]"
              type="password"
              hint="Минимум 8 символов"
              persistent-hint
              autocomplete="new-password"
              class="mb-4"
              rounded="lg"
            />
            <v-text-field
              v-model="passwordFormState.confirmPassword"
              label="Подтвердите новый пароль"
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="mdi-lock-check-outline"
              :rules="[passwordRules.required, passwordRules.passwordMatch]"
              type="password"
              autocomplete="new-password"
              rounded="lg"
            />
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions class="password-dialog__footer">
          <v-btn
            variant="text"
            class="text-none"
            @click="passwordDialog = false"
          >
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            class="text-none font-weight-bold"
            rounded="pill"
            :loading="passwordLoading"
            @click="changePassword"
          >
            Изменить пароль
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
/* ─── Base ─── */
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ─── Page Header ─── */
.page-header {
  background: linear-gradient(135deg, #f0faf0 0%, #fafff5 100%);
  border: 1px solid rgba(139, 195, 74, 0.18);
  border-radius: 20px;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header__content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-header__left {
  flex: 1;
  min-width: 0;
}

.page-header__badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(139, 195, 74, 0.2);
  border-radius: 100px;
  padding: 5px 14px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #558b2f;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  width: fit-content;
  margin-bottom: 8px;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.5px;
  color: #1a1a1a;
  margin: 0 0 4px;
}

.page-subtitle {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.5);
  margin: 0;
}

.page-header__right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.status-chip {
  white-space: nowrap;
}

.profile-avatar {
  border: 3px solid rgba(139, 195, 74, 0.3);
  box-shadow: 0 4px 12px rgba(139, 195, 74, 0.2);
}

.page-header__contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(139, 195, 74, 0.15);
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.6);
}

.page-header__bio {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
}

/* ─── Section Card ─── */
.section-card {
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: clamp(18px, 3vw, 26px);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.card-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0 0 2px;
}

.card-sub {
  font-size: 0.825rem;
  color: rgba(0, 0, 0, 0.44);
  margin: 0;
}

/* ─── Stats ─── */
.stats-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.stat-tile {
  background: #fafafa;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 18px;
  display: flex;
  gap: 14px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.08);
}

.stat-tile__icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-tile__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-tile__label {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.5);
  font-weight: 600;
}

.stat-tile__value {
  font-size: 1.75rem;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1;
}

.stat-tile__details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.5);
  margin-top: 4px;
}

/* ─── Forms ─── */
.form-section {
  margin-bottom: 20px;
}

.form-section__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: rgba(0, 0, 0, 0.4);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

/* ─── Personal Info View ─── */
.personal-info-view {
  padding-top: 8px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item__label {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-item__value {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1a1a1a;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

/* ─── Edit Personal Info Dialog ─── */
.edit-personal-info-dialog {
  border-radius: 24px !important;
  overflow: hidden;
}

.edit-personal-info-dialog__header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
}

.edit-personal-info-dialog__header-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(139, 195, 74, 0.15), rgba(139, 195, 74, 0.08));
  border: 1px solid rgba(139, 195, 74, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #558b2f;
  flex-shrink: 0;
}

.edit-personal-info-dialog__title {
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 2px;
}

.edit-personal-info-dialog__subtitle {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.45);
  margin: 0;
}

.edit-personal-info-dialog__body {
  padding: 20px 24px !important;
}

.edit-personal-info-dialog__footer {
  padding: 16px 24px !important;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ─── Portfolio View ─── */
.portfolio-view {
  padding-top: 8px;
}

.portfolio-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.portfolio-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.portfolio-item--full {
  grid-column: 1 / -1;
}

.portfolio-item__label {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.portfolio-item__value {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1a1a1a;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.portfolio-item__value--text {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.5;
}

.portfolio-item__photo {
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

/* ─── Edit Portfolio Dialog ─── */
.edit-portfolio-dialog {
  border-radius: 24px !important;
  overflow: hidden;
}

.edit-portfolio-dialog__header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
}

.edit-portfolio-dialog__header-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(139, 195, 74, 0.15), rgba(139, 195, 74, 0.08));
  border: 1px solid rgba(139, 195, 74, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #558b2f;
  flex-shrink: 0;
}

.edit-portfolio-dialog__title {
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 2px;
}

.edit-portfolio-dialog__subtitle {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.45);
  margin: 0;
}

.edit-portfolio-dialog__body {
  padding: 20px 24px !important;
  overflow-y: auto;
}

.edit-portfolio-dialog__footer {
  padding: 16px 24px !important;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ─── Password Change ─── */
.password-change-content {
  padding-top: 8px;
}

.password-dialog {
  border-radius: 24px !important;
  overflow: hidden;
}

.password-dialog__header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
}

.password-dialog__header-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(139, 195, 74, 0.15), rgba(139, 195, 74, 0.08));
  border: 1px solid rgba(139, 195, 74, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #558b2f;
  flex-shrink: 0;
}

.password-dialog__title {
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 2px;
}

.password-dialog__subtitle {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.45);
  margin: 0;
}

.password-dialog__body {
  padding: 20px 24px !important;
}

.password-dialog__footer {
  padding: 16px 24px !important;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ─── Notification Settings Preview ─── */
.notification-settings-preview {
  padding-top: 8px;
}

.notification-preview-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 12px;
}

.notification-preview-item:last-child {
  margin-bottom: 0;
}

.notification-preview-info {
  flex: 1;
  min-width: 0;
}

.notification-preview-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.notification-preview-desc {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.5);
}

/* ─── Notification Settings Dialog ─── */
.notification-settings-dialog {
  border-radius: 24px !important;
  overflow: hidden;
}

.notification-settings-dialog__header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
}

.notification-settings-dialog__header-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(139, 195, 74, 0.15), rgba(139, 195, 74, 0.08));
  border: 1px solid rgba(139, 195, 74, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #558b2f;
  flex-shrink: 0;
}

.notification-settings-dialog__title {
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 2px;
}

.notification-settings-dialog__subtitle {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.45);
  margin: 0;
}

.notification-settings-dialog__body {
  padding: 20px 24px !important;
  max-height: 70vh;
  overflow-y: auto;
}

.notification-settings-dialog__footer {
  padding: 16px 24px !important;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ─── Mobile адаптация для диалога ─── */
@media (max-width: 600px) {
  .notification-settings-dialog__header {
    padding: 16px !important;
    flex-wrap: wrap;
  }

  .notification-settings-dialog__header-icon {
    width: 36px !important;
    height: 36px !important;
  }

  .notification-settings-dialog__title {
    font-size: 1rem !important;
  }

  .notification-settings-dialog__subtitle {
    font-size: 0.75rem !important;
  }

  .notification-settings-dialog__body {
    padding: 16px !important;
    max-height: calc(100vh - 200px) !important;
  }

  .notification-settings-dialog__footer {
    padding: 12px 16px !important;
    flex-direction: column-reverse;
    gap: 10px;
  }

  .notification-settings-dialog__footer .v-btn {
    width: 100% !important;
    margin: 0 !important;
  }

  .notification-section {
    padding: 12px !important;
    margin-bottom: 16px !important;
  }

  .notification-section__header {
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px !important;
    padding-bottom: 10px !important;
  }

  .notification-section__title {
    font-size: 0.875rem !important;
  }

  .notification-item {
    flex-direction: row;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 12px !important;
    padding: 12px 0 !important;
  }

  .notification-item__info {
    flex: 1;
    min-width: 0;
    padding-right: 8px;
  }

  .notification-item__label {
    font-size: 0.85rem !important;
    margin-bottom: 3px !important;
  }

  .notification-item__desc {
    font-size: 0.75rem !important;
    line-height: 1.3 !important;
  }

  .notification-item .v-switch {
    flex-shrink: 0;
  }

  .notification-item--reminder {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 12px !important;
  }

  .reminder-frequency-select {
    width: 100% !important;
    max-width: 100% !important;
  }

  .notification-preview-item {
    padding: 12px !important;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .notification-preview-info {
    width: 100%;
  }
}

/* ─── Notification Settings ─── */
.notification-section {
  margin-bottom: 24px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.notification-section:last-of-type {
  margin-bottom: 0;
}

.notification-section__header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.notification-section__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.notification-section__content {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.notification-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
}

.notification-item__info {
  flex: 1;
  min-width: 0;
}

.notification-item__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.notification-item__desc {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.5);
  line-height: 1.4;
}

.notification-item--reminder {
  flex-direction: column;
  align-items: flex-start;
}

.reminder-frequency-select {
  max-width: 200px;
  width: 100%;
}

.notification-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

/* ─── Telegram Sync ─── */
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

/* ─── Responsive ─── */
@media (max-width: 960px) {
  .page-header__content {
    flex-direction: column;
  }

  .page-header__right {
    width: 100%;
    justify-content: space-between;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
  }

  .form-actions .v-btn {
    width: 100%;
  }
}
</style>

