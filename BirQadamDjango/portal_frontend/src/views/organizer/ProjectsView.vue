<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';

import { useAuthStore } from '@/stores/auth';
import { useOrganizerStore } from '@/stores/organizer';
import type { OrganizerProject } from '@/services/organizer';
import YandexMapPicker from '@/components/YandexMapPicker.vue';

const router = useRouter();
const authStore = useAuthStore();
const organizerStore = useOrganizerStore();

const isOrganizer = computed(() => organizerStore.isOrganizer);
const isApproved = computed(() => organizerStore.isApproved);
const organizationName = computed(() => authStore.user?.organization_name || authStore.user?.full_name || 'Организация');

const projects = computed(() => organizerStore.projects);
const loadingProjects = computed(() => organizerStore.loadingProjects);
const projectsError = computed(() => organizerStore.projectError);

const createDialog = ref(false);
const editDialog = ref(false);
const deleteDialog = ref(false);
const projectToEdit = ref<OrganizerProject | null>(null);
const projectToDelete = ref<OrganizerProject | null>(null);
const createFormRef = ref<VForm | null>(null);
const editFormRef = ref<VForm | null>(null);
const createLoading = ref(false);
const editLoading = ref(false);
const deleteLoading = ref(false);
const geolocationLoading = ref(false);
const geolocationSupported = typeof window !== 'undefined' && 'geolocation' in navigator;
const snackbar = reactive({
  show: false,
  color: 'success',
  message: '',
});

const editMapPreviewUrl = computed(() => {
  const parts = [editFormState.city?.trim(), editFormState.address?.trim()].filter(Boolean);
  if (!parts.length) return null;
  return `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(parts.join(', '))}`;
});

const createFormState = reactive({
  title: '',
  description: '',
  city: '',
  volunteer_type: 'social',
  start_date: null as string | null, // Автоматически устанавливается при открытии диалога
  start_time: null as string | null,
  end_date: null as string | null,
  end_time: null as string | null,
  address: '',
  tags: [] as string[],
  latitude: '' as string | null,
  longitude: '' as string | null,
  contact_person: '',
  contact_phone: '',
  contact_email: '',
  contact_telegram: '',
  info_url: '',
  gis2_url: '', // Ссылка на 2ГИС
  cover_image: null as File | File[] | null,
});

const editFormState = reactive({
  title: '',
  description: '',
  city: '',
  volunteer_type: 'social',
  start_date: null as string | null,
  start_time: null as string | null,
  end_date: null as string | null,
  end_time: null as string | null,
  address: '',
  tags: [] as string[],
  latitude: '' as string | null,
  longitude: '' as string | null,
  contact_person: '',
  contact_phone: '',
  contact_email: '',
  contact_telegram: '',
  info_url: '',
  gis2_url: '',
  cover_image: null as File | File[] | null,
});

const volunteerTypeOptions = [
  { title: 'Социальная помощь', value: 'social' },
  { title: 'Экологические проекты', value: 'environmental' },
  { title: 'Культурные мероприятия', value: 'cultural' },
];

const volunteerTypeLabel = (value: string) => {
  return volunteerTypeOptions.find(o => o.value === value)?.title || value;
};

const getFullImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  
  try {
    // Если уже полный URL, проверяем протокол
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Для localhost принудительно используем http (не https)
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        // Заменяем https на http для localhost
        if (url.startsWith('https://')) {
          return url.replace('https://', 'http://');
        }
        return url;
      }
      // Для production всегда используем https
      if (url.startsWith('http://')) {
        return url.replace('http://', 'https://');
      }
      return url;
    }
    
    // Если относительный путь, определяем базовый URL в зависимости от окружения
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Для localhost всегда используем http (не https)
    // В production используем тот же домен, что и для API
    const baseUrl = isDevelopment 
      ? `http://${window.location.hostname}:8000`
      : (import.meta.env.VITE_API_BASE_URL || 'https://cleanup.almau.edu.kz');
    
    // Убеждаемся, что путь начинается с /
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${cleanPath}`;
  } catch (error) {
    console.error('[ProjectsView] Error building image URL:', error, url);
    return null;
  }
};

// Безопасное открытие ссылки в новой вкладке
const openUrl = (url: string) => {
  if (typeof window !== 'undefined' && window.open) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

const volunteerTypeIcon = (value: string) => {
  const icons: Record<string, string> = {
    social: 'mdi-hand-heart-outline',
    environmental: 'mdi-leaf-circle-outline',
    cultural: 'mdi-palette-outline',
  };
  return icons[value] || 'mdi-account-heart-outline';
};

// Проверка, является ли проект архивным (дата окончания прошла)
const isProjectArchived = (project: OrganizerProject): boolean => {
  if (!project.end_date) return false;
  const endDate = new Date(project.end_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return endDate < today;
};

const statusConfig = (status: string) => {
  const map: Record<string, { color: string; label: string; icon: string }> = {
    approved: { color: 'success', label: 'Одобрен', icon: 'mdi-check-circle-outline' },
    rejected: { color: 'error', label: 'Отклонён', icon: 'mdi-close-circle-outline' },
    pending: { color: 'warning', label: 'На модерации', icon: 'mdi-clock-outline' },
  };
  return map[status] || map['pending'];
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  let date: Date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const formatDateForDisplay = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return '';
  try {
    // Если пришёл объект Date (v-date-picker через v-model)
    if (dateStr instanceof Date) {
      const day   = String(dateStr.getDate()).padStart(2, '0');
      const month = String(dateStr.getMonth() + 1).padStart(2, '0');
      const year  = dateStr.getFullYear();
      return `${day}.${month}.${year}`;
    }
    // Строка YYYY-MM-DD
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}.${month}.${year}`;
    }
    return String(dateStr);
  } catch {
    return String(dateStr);
  }
};

const parseDateForSubmit = (dateStr: string | null): string | null => {
  if (!dateStr) return null;
  try {
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        if (day && month && year) return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

const combineDateTime = (date: string | Date | null, _time: string | null): string | undefined => {
  if (!date) return undefined;
  
  // Если это Date объект, преобразуем в ISO строку (YYYY-MM-DD)
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  
  // Если это строка, обрабатываем через parseDateForSubmit
  return parseDateForSubmit(date) || undefined;
};

const parseCoordinate = (value: string | null) => {
  if (value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const roadmap = [
  {
    icon: 'mdi-clipboard-list-outline',
    title: 'Подготовьте информацию',
    points: ['Название и цель проекта', 'Город и точка встречи', 'Тип волонтёрства и теги', 'Форматы и дедлайны'],
  },
  {
    icon: 'mdi-send-circle-outline',
    title: 'Создайте проект',
    points: ['Заполните форму — проект сразу появится в приложении', 'Отправьте на модерацию администратору', 'Получите уведомление в Telegram'],
  },
  {
    icon: 'mdi-account-group-outline',
    title: 'Управляйте командой',
    points: ['Добавляйте волонтёров', 'Назначайте задачи и дедлайны', 'Отслеживайте отчёты и статистику'],
  },
];

const rules = {
  required: (value: string) => !!value || 'Поле обязательно к заполнению.',
  gis2Url: (value: string) => {
    if (!value) return 'Ссылка на 2ГИС обязательна.';
    // Проверяем формат ссылки 2ГИС
    // Поддерживаем: https://go.2gis.com/vOZEO, https://2gis.kz/..., https://2gis.ru/...
    const gis2Pattern = /^https?:\/\/(go\.)?2gis\.(com|kz|ru)(\/.+)?$/i;
    if (!gis2Pattern.test(value)) {
      return 'Введите корректную ссылку на 2ГИС (например: https://go.2gis.com/vOZEO или https://2gis.kz/...)';
    }
    return true;
  },
};

onMounted(() => {
  if (organizerStore.isOrganizer) {
    organizerStore.loadProjects(true);
  }
});

const openCreateDialog = () => {
  // Устанавливаем дату начала как сегодняшний день
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // Формат YYYY-MM-DD
  
  Object.assign(createFormState, {
    title: '', description: '', city: '', volunteer_type: 'social',
    start_date: todayStr, // Автоматически устанавливаем сегодняшний день
    start_time: null, end_date: null, end_time: null,
    address: '', tags: [], latitude: null, longitude: null,
    contact_person: '', contact_phone: '', contact_email: '',
    contact_telegram: '', info_url: '', gis2_url: '', cover_image: null,
  });
  createDialog.value = true;
};

const closeCreateDialog = () => { createDialog.value = false; };

const submitCreateProject = async () => {
  const { valid } = (await createFormRef.value?.validate()) ?? { valid: false };
  if (!valid) {
    console.warn('[ProjectsView] Form validation failed');
    return;
  }
  
  // Логирование перед отправкой
  const endDateCombined = combineDateTime(createFormState.end_date, createFormState.end_time);
  console.log('[ProjectsView] Submitting project:', {
    end_date_raw: createFormState.end_date,
    end_date_combined: endDateCombined,
    gis2_url: createFormState.gis2_url,
  });
  
  createLoading.value = true;
  try {
    await organizerStore.createProject({
      title: createFormState.title,
      description: createFormState.description,
      city: createFormState.city,
      volunteer_type: createFormState.volunteer_type,
      start_date: combineDateTime(createFormState.start_date, createFormState.start_time),
      end_date: endDateCombined,
      address: createFormState.address || undefined,
      tags: createFormState.tags,
      latitude: parseCoordinate(createFormState.latitude),
      longitude: parseCoordinate(createFormState.longitude),
      contact_person: createFormState.contact_person || undefined,
      contact_phone: createFormState.contact_phone || undefined,
      contact_email: createFormState.contact_email || undefined,
      contact_telegram: createFormState.contact_telegram || undefined,
      info_url: createFormState.info_url || undefined,
      gis2_url: createFormState.gis2_url, // Обязательное поле, всегда отправляем (даже пустую строку)
      cover_image: Array.isArray(createFormState.cover_image) ? createFormState.cover_image[0] : createFormState.cover_image || undefined,
    });
    snackbar.message = 'Проект отправлен на модерацию.';
    snackbar.color = 'success';
    snackbar.show = true;
    closeCreateDialog();
  } catch (error: any) {
    // Логируем ошибку для отладки
    console.error('[ProjectsView] Error creating project:', error);
    console.error('[ProjectsView] Error response:', error?.response?.data);
    
    // Показываем понятное сообщение об ошибке
    const errorMessage = error?.response?.data?.error 
      || error?.response?.data?.detail 
      || error?.response?.data?.message
      || error?.message 
      || 'Не удалось создать проект.';
    
    snackbar.message = errorMessage;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    createLoading.value = false;
  }
};

const goToTasks = (projectId: number) => {
  router.push({ name: 'organizer-tasks', query: { project: projectId } });
};

const openEditDialog = (project: OrganizerProject) => {
  try {
    if (project.volunteer_count && project.volunteer_count > 0) {
      snackbar.message = 'Редактирование запрещено: в проекте уже есть участники.';
      snackbar.color = 'error';
      snackbar.show = true;
      return;
    }
    projectToEdit.value = project;
    editFormState.title = project.title || '';
    editFormState.description = project.description || '';
    editFormState.city = project.city || '';
    editFormState.volunteer_type = project.volunteer_type || 'social';
    if (project.start_date) {
      const s = String(project.start_date).split('T');
      editFormState.start_date = s[0] || null;
      editFormState.start_time = s[1] ? s[1].substring(0, 5) : null;
    } else {
      editFormState.start_date = null;
      editFormState.start_time = null;
    }
    if (project.end_date) {
      const e = String(project.end_date).split('T');
      editFormState.end_date = e[0] || null;
      editFormState.end_time = e[1] ? e[1].substring(0, 5) : null;
    } else {
      editFormState.end_date = null;
      editFormState.end_time = null;
    }
    editFormState.address = project.address || '';
    editFormState.tags = project.tags || [];
    editFormState.latitude = project.latitude != null ? String(project.latitude) : null;
    editFormState.longitude = project.longitude != null ? String(project.longitude) : null;
    editFormState.contact_person = project.contact_person || '';
    editFormState.contact_phone = project.contact_phone || '';
    editFormState.contact_email = project.contact_email || '';
    editFormState.contact_telegram = project.contact_telegram || '';
    editFormState.info_url = project.info_url || '';
    editFormState.gis2_url = (project as any).gis2_url || '';
    editFormState.cover_image = null;
    editDialog.value = true;
  } catch (error) {
    snackbar.message = 'Ошибка при открытии формы редактирования';
    snackbar.color = 'error';
    snackbar.show = true;
  }
};

const closeEditDialog = () => { editDialog.value = false; projectToEdit.value = null; };

const detectCoordinatesForEdit = () => {
  if (!geolocationSupported) {
    snackbar.message = 'Геолокация не поддерживается браузером.';
    snackbar.color = 'warning';
    snackbar.show = true;
    return;
  }
  geolocationLoading.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      editFormState.latitude = position.coords.latitude.toFixed(6);
      editFormState.longitude = position.coords.longitude.toFixed(6);
      geolocationLoading.value = false;
      snackbar.message = 'Координаты определены.';
      snackbar.color = 'success';
      snackbar.show = true;
    },
    (error) => {
      geolocationLoading.value = false;
      snackbar.message = error.code === error.PERMISSION_DENIED ? 'Доступ к геолокации отклонён.' : 'Не удалось получить координаты.';
      snackbar.color = 'error';
      snackbar.show = true;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  );
};

const geocodeAddressForEdit = async () => {
  const city = editFormState.city?.trim() || '';
  const addr = editFormState.address?.trim() || '';
  const address = [city, addr].filter(Boolean).join(', ');
  if (!city) {
    snackbar.message = 'Укажите город для определения координат.';
    snackbar.color = 'error';
    snackbar.show = true;
    return;
  }
  geolocationLoading.value = true;
  try {
    const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?geocode=${encodeURIComponent(address)}&format=json`);
    const data = await response.json();
    if (data.response?.GeoObjectCollection?.featureMember?.length > 0) {
      const coords = data.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos.split(' ');
      editFormState.longitude = parseFloat(coords[0]).toFixed(6);
      editFormState.latitude = parseFloat(coords[1]).toFixed(6);
      snackbar.message = 'Координаты определены по адресу.';
      snackbar.color = 'success';
      snackbar.show = true;
    } else {
      snackbar.message = 'Адрес не найден. Уточните адрес или введите координаты вручную.';
      snackbar.color = 'error';
      snackbar.show = true;
    }
  } catch {
    snackbar.message = 'Не удалось определить координаты. Введите вручную или используйте геолокацию.';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    geolocationLoading.value = false;
  }
};

const submitEditProject = async () => {
  if (!projectToEdit.value) return;
  const { valid } = (await editFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  editLoading.value = true;
  try {
    await organizerStore.updateProject(projectToEdit.value.id, {
      title: editFormState.title,
      description: editFormState.description,
      city: editFormState.city,
      volunteer_type: editFormState.volunteer_type,
      start_date: combineDateTime(editFormState.start_date, editFormState.start_time),
      end_date: combineDateTime(editFormState.end_date, editFormState.end_time),
      address: editFormState.address || undefined,
      tags: editFormState.tags,
      latitude: parseCoordinate(editFormState.latitude),
      longitude: parseCoordinate(editFormState.longitude),
      contact_person: editFormState.contact_person || undefined,
      contact_phone: editFormState.contact_phone || undefined,
      contact_email: editFormState.contact_email || undefined,
      contact_telegram: editFormState.contact_telegram || undefined,
      info_url: editFormState.info_url || undefined,
      gis2_url: editFormState.gis2_url || undefined,
      cover_image: Array.isArray(editFormState.cover_image) ? editFormState.cover_image[0] : editFormState.cover_image || undefined,
    });
    closeEditDialog();
    await organizerStore.loadProjects(true);
    snackbar.message = 'Проект обновлён и отправлен на модерацию.';
    snackbar.color = 'success';
    snackbar.show = true;
  } catch (error: any) {
    snackbar.message = error?.response?.data?.error || error?.response?.data?.detail || error?.message || 'Не удалось обновить проект.';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    editLoading.value = false;
  }
};

const openDeleteDialog = (project: OrganizerProject) => { projectToDelete.value = project; deleteDialog.value = true; };
const closeDeleteDialog = () => { deleteDialog.value = false; projectToDelete.value = null; };

const submitDeleteProject = async () => {
  if (!projectToDelete.value) return;
  deleteLoading.value = true;
  try {
    await organizerStore.removeProject(projectToDelete.value.id);
    snackbar.message = 'Проект успешно удалён.';
    snackbar.color = 'success';
    snackbar.show = true;
    closeDeleteDialog();
  } catch (error: any) {
    snackbar.message = error?.response?.data?.error || error?.response?.data?.detail || error?.message || 'Не удалось удалить проект.';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    deleteLoading.value = false;
  }
};

const datePickerHandler = (stateObj: any, field: string, isActive: any) => (value: any) => {
  if (value && typeof value === 'object' && value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    stateObj[field] = `${year}-${month}-${day}`;
  } else if (typeof value === 'string') {
    stateObj[field] = value;
  } else {
    stateObj[field] = null;
  }
  isActive.value = false;
};
</script>

<template>
  <div class="projects-view">

    <!-- ───────────── HEADER ───────────── -->
    <div class="page-header">
      <div class="page-header__content">
        <div class="page-header__text">
          <h1 class="page-title">Проекты</h1>
          <p class="page-subtitle">{{ organizationName }} · управление волонтёрскими инициативами</p>
        </div>
        <v-btn
          v-if="isOrganizer && isApproved"
          color="primary"
          size="large"
          rounded="pill"
          elevation="0"
          class="create-btn text-none font-weight-bold"
          prepend-icon="mdi-plus"
          @click="openCreateDialog"
        >
          Новый проект
        </v-btn>
      </div>
    </div>

    <!-- ───────────── ALERTS ───────────── -->
    <v-alert
      v-if="!isOrganizer"
      type="error"
      border="start"
      variant="tonal"
      rounded="xl"
      class="mb-2"
      icon="mdi-shield-alert-outline"
    >
      У вас нет прав организатора. Войдите под аккаунтом организатора.
    </v-alert>

    <v-alert
      v-else-if="!isApproved"
      type="warning"
      variant="tonal"
      border="start"
      rounded="xl"
      class="mb-2"
      icon="mdi-clock-outline"
    >
      <strong>Ждём подтверждения.</strong> После одобрения заявки вы сможете создавать проекты. Пока подготовьте информацию по чек-листу.
    </v-alert>

    <!-- ───────────── MAIN LAYOUT ───────────── -->
    <div class="main-layout">

      <!-- Projects column -->
      <div class="projects-col">

        <!-- Loading -->
        <div v-if="loadingProjects" class="projects-grid">
          <v-skeleton-loader v-for="i in 3" :key="i" type="image, article" rounded="xl" class="skeleton-card" />
        </div>

        <!-- Error -->
        <v-alert v-else-if="projectsError" type="error" variant="tonal" rounded="xl" border="start">
          {{ projectsError }}
        </v-alert>

        <!-- Projects grid -->
        <div v-else-if="projects.length > 0" class="projects-grid">
          <div v-for="project in projects" :key="project.id" class="project-card">

            <!-- Cover image -->
            <div class="project-card__cover" :class="{ 'project-card__cover--placeholder': !project.cover_image_url }">
              <v-img
                v-if="project.cover_image_url"
                :src="getFullImageUrl(project.cover_image_url) || ''"
                height="100%"
                cover
              />
              <div v-else class="project-card__cover-icon">
                <v-icon :icon="volunteerTypeIcon(project.volunteer_type)" size="40" color="white" />
              </div>
              <!-- Status badge -->
              <div class="project-card__status-badge">
                <v-chip
                  :color="statusConfig(project.status).color"
                  variant="flat"
                  size="small"
                  class="text-none font-weight-semibold"
                >
                  <v-icon :icon="statusConfig(project.status).icon" start size="14" />
                  {{ statusConfig(project.status).label }}
                </v-chip>
                <v-chip
                  v-if="isProjectArchived(project)"
                  color="grey-darken-1"
                  variant="flat"
                  size="small"
                  class="text-none font-weight-semibold ms-2"
                >
                  <v-icon icon="mdi-archive" start size="14" />
                  В архиве
                </v-chip>
              </div>
            </div>

            <!-- Card body -->
            <div class="project-card__body">
              <h3 class="project-card__title">{{ project.title }}</h3>
              <p class="project-card__desc">{{ project.description }}</p>

              <!-- Meta chips -->
              <div class="project-card__meta">
                <div class="meta-chip">
                  <v-icon icon="mdi-map-marker-outline" size="15" />
                  <span>{{ project.city }}</span>
                </div>
                <div v-if="project.start_date || project.end_date" class="meta-chip">
                  <v-icon icon="mdi-calendar-range" size="15" />
                  <span>{{ formatDate(project.start_date) }} — {{ formatDate(project.end_date) }}</span>
                </div>
                <div class="meta-chip">
                  <v-icon :icon="volunteerTypeIcon(project.volunteer_type)" size="15" />
                  <span>{{ volunteerTypeLabel(project.volunteer_type) }}</span>
                </div>
              </div>

              <!-- Stats row -->
              <div class="project-card__stats">
                <div class="stat-item">
                  <v-icon icon="mdi-account-group-outline" size="18" />
                  <span class="stat-value">{{ project.volunteer_count }}</span>
                  <span class="stat-label">волонтёров</span>
                </div>
                <div class="stat-divider" />
                <div class="stat-item">
                  <v-icon icon="mdi-clipboard-check-outline" size="18" />
                  <span class="stat-value">{{ project.task_count }}</span>
                  <span class="stat-label">задач</span>
                </div>
                <div v-if="project.tags?.length" class="stat-divider" />
                <div v-if="project.tags?.length" class="tags-inline">
                  <v-chip
                    v-for="tag in project.tags.slice(0, 2)"
                    :key="tag"
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    class="text-none"
                  >{{ tag }}</v-chip>
                  <span v-if="project.tags.length > 2" class="tags-more">+{{ project.tags.length - 2 }}</span>
                </div>
              </div>

              <!-- Contacts (compact) -->
              <div v-if="project.contact_person || project.contact_phone || project.contact_telegram || project.info_url" class="project-card__contacts">
                <a v-if="project.contact_phone" :href="`tel:${project.contact_phone}`" class="contact-link">
                  <v-icon icon="mdi-phone-outline" size="14" />
                  {{ project.contact_phone }}
                </a>
                <a v-if="project.contact_telegram" :href="project.contact_telegram" class="contact-link" target="_blank">
                  <v-icon icon="mdi-send-outline" size="14" />
                  Telegram
                </a>
                <a v-if="project.info_url" :href="project.info_url" class="contact-link" target="_blank">
                  <v-icon icon="mdi-web" size="14" />
                  Сайт
                </a>
              </div>

              <!-- Actions -->
              <div class="project-card__actions">
                <v-btn
                  color="primary"
                  variant="flat"
                  size="small"
                  rounded="pill"
                  class="text-none font-weight-semibold"
                  @click="goToTasks(project.id)"
                >
                  Задачи
                  <v-icon icon="mdi-arrow-right" end size="16" />
                </v-btn>
                <v-btn
                  v-if="project.latitude != null && project.longitude != null"
                  variant="tonal"
                  size="small"
                  rounded="pill"
                  class="text-none"
                  color="secondary"
                  :href="`https://maps.google.com/?q=${project.latitude},${project.longitude}`"
                  target="_blank"
                >
                  <v-icon icon="mdi-map-outline" size="16" />
                </v-btn>
                <v-spacer />
                <v-btn
                  variant="text"
                  size="small"
                  icon
                  :disabled="(project.volunteer_count || 0) > 0"
                  @click="openEditDialog(project)"
                >
                  <v-tooltip v-if="(project.volunteer_count || 0) > 0" activator="parent" location="top">
                    Нельзя редактировать: есть участники
                  </v-tooltip>
                  <v-icon icon="mdi-pencil-outline" size="18" />
                </v-btn>
                <v-btn
                  variant="text"
                  size="small"
                  icon
                  color="error"
                  @click="openDeleteDialog(project)"
                >
                  <v-icon icon="mdi-trash-can-outline" size="18" />
                </v-btn>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-state__illustration">
            <v-icon icon="mdi-folder-open-outline" size="56" />
          </div>
          <h3 class="empty-state__title">Нет проектов</h3>
          <p class="empty-state__text">Создайте первый проект — он появится здесь и в Telegram-боте после модерации.</p>
          <v-btn
            v-if="isApproved"
            color="primary"
            rounded="pill"
            elevation="0"
            class="text-none font-weight-bold mt-2"
            prepend-icon="mdi-plus"
            @click="openCreateDialog"
          >
            Создать проект
          </v-btn>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="sidebar-col">
        <div class="checklist-card">
          <div class="checklist-card__header">
            <v-icon icon="mdi-format-list-checks" size="22" class="checklist-card__icon" />
            <span>Чек-лист запуска</span>
          </div>
          <div class="checklist-steps">
            <div v-for="(step, i) in roadmap" :key="step.title" class="checklist-step">
              <div class="checklist-step__number">{{ i + 1 }}</div>
              <div class="checklist-step__content">
                <div class="checklist-step__title">
                  <v-icon :icon="step.icon" size="16" class="me-1" />
                  {{ step.title }}
                </div>
                <ul class="checklist-step__points">
                  <li v-for="point in step.points" :key="point">{{ point }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ───────────── CREATE DIALOG ───────────── -->
    <v-dialog v-model="createDialog" max-width="680" scrollable>
      <v-card class="form-dialog" rounded="2xl">
        <div class="form-dialog__header">
          <div class="form-dialog__header-icon">
            <v-icon icon="mdi-rocket-launch-outline" size="22" />
          </div>
          <div>
            <h2 class="form-dialog__title">Новый проект</h2>
            <p class="form-dialog__subtitle">После модерации проект увидят волонтёры</p>
          </div>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="closeCreateDialog" />
        </div>
        <v-divider />
        <v-card-text class="form-dialog__body">
          <v-form ref="createFormRef" @submit.prevent="submitCreateProject">
            <div class="form-section">
              <div class="form-section__label">Основная информация</div>
              <v-row dense>
                <v-col cols="12" md="7">
                  <v-text-field v-model="createFormState.title" label="Название проекта" variant="outlined" density="comfortable" :rules="[rules.required]" />
                </v-col>
                <v-col cols="12" md="5">
                  <v-text-field v-model="createFormState.city" label="Город" variant="outlined" density="comfortable" prepend-inner-icon="mdi-map-marker-outline" :rules="[rules.required]" />
                </v-col>
                <v-col cols="12">
                  <YandexMapPicker
                    v-model:latitude="createFormState.latitude"
                    v-model:longitude="createFormState.longitude"
                    :city="createFormState.city"
                    height="260px"
                    @update:address="(address) => { createFormState.address = address; }"
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea v-model="createFormState.description" label="Описание" variant="outlined" density="comfortable" rows="3" :rules="[rules.required]" auto-grow />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select v-model="createFormState.volunteer_type" :items="volunteerTypeOptions" item-title="title" item-value="value" label="Тип волонтёрства" variant="outlined" density="comfortable" prepend-inner-icon="mdi-heart-outline" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-combobox v-model="createFormState.tags" label="Теги" variant="outlined" density="comfortable" multiple chips small-chips prepend-inner-icon="mdi-tag-outline" hint="#экология, #уборка" />
                </v-col>
              </v-row>
            </div>

            <div class="form-section">
              <div class="form-section__label">Период проекта</div>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-text-field 
                    :model-value="formatDateForDisplay(createFormState.start_date)" 
                    label="Дата начала" 
                    variant="outlined" 
                    density="comfortable" 
                    prepend-inner-icon="mdi-calendar-start" 
                    readonly 
                    disabled
                    hint="Автоматически устанавливается на сегодняшний день"
                    persistent-hint
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-dialog max-width="360">
                    <template #activator="{ props }">
                      <v-text-field 
                        :model-value="formatDateForDisplay(createFormState.end_date)" 
                        label="Дата завершения" 
                        variant="outlined" 
                        density="comfortable" 
                        prepend-inner-icon="mdi-calendar-end" 
                        readonly 
                        v-bind="props" 
                        placeholder="дд.мм.гггг"
                        :rules="[rules.required]"
                      />
                    </template>
                    <template #default="{ isActive }">
                      <v-card rounded="xl"><v-date-picker v-model="createFormState.end_date" locale="ru" :first-day-of-week="1" color="primary" @update:model-value="datePickerHandler(createFormState, 'end_date', isActive)" /></v-card>
                    </template>
                  </v-dialog>
                </v-col>
              </v-row>
            </div>

            <div class="form-section">
              <div class="form-section__label">Контакты</div>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-text-field v-model="createFormState.contact_person" label="Контактное лицо" variant="outlined" density="comfortable" prepend-inner-icon="mdi-account-tie-outline" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field v-model="createFormState.contact_phone" label="Телефон" variant="outlined" density="comfortable" prepend-inner-icon="mdi-phone-outline" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field v-model="createFormState.contact_email" label="Email" variant="outlined" density="comfortable" prepend-inner-icon="mdi-email-outline" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field v-model="createFormState.contact_telegram" label="Telegram" variant="outlined" density="comfortable" prepend-inner-icon="mdi-send-outline" hint="https://t.me/..." />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="createFormState.info_url" label="Сайт / доп. ссылка" variant="outlined" density="comfortable" prepend-inner-icon="mdi-web" />
                </v-col>
                <v-col cols="12">
                  <v-text-field 
                    v-model="createFormState.gis2_url" 
                    label="Ссылка на 2ГИС" 
                    variant="outlined" 
                    density="comfortable" 
                    prepend-inner-icon="mdi-map-marker"
                    :rules="[rules.gis2Url]"
                    hint="Пример: https://go.2gis.com/vOZEO или https://2gis.kz/..."
                    persistent-hint
                  >
                    <template #append-inner>
                      <v-btn
                        icon="mdi-open-in-new"
                        variant="text"
                        size="small"
                        :disabled="!createFormState.gis2_url || !rules.gis2Url(createFormState.gis2_url) || rules.gis2Url(createFormState.gis2_url) !== true"
                        @click="() => { if (createFormState.gis2_url) openUrl(createFormState.gis2_url); }"
                      />
                    </template>
                  </v-text-field>
                  <div class="mt-2">
                    <v-btn
                      variant="outlined"
                      size="small"
                      color="primary"
                      prepend-icon="mdi-map-search"
                      @click="() => openUrl('https://2gis.kz')"
                    >
                      Открыть 2ГИС
                    </v-btn>
                  </div>
                </v-col>
              </v-row>
            </div>

            <div class="form-section">
              <div class="form-section__label">Обложка</div>
              <v-file-input v-model="createFormState.cover_image" label="Загрузить изображение" variant="outlined" density="comfortable" prepend-inner-icon="mdi-image-outline" prepend-icon="" accept="image/*" show-size />
            </div>
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions class="form-dialog__footer">
          <v-btn 
            variant="text" 
            class="text-none form-dialog__cancel-btn" 
            @click="closeCreateDialog"
          >
            Отмена
          </v-btn>
          <v-btn 
            color="primary" 
            variant="flat" 
            rounded="pill" 
            class="text-none font-weight-bold px-6 form-dialog__submit-btn" 
            :loading="createLoading" 
            @click="submitCreateProject"
          >
            Отправить на модерацию
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ───────────── EDIT DIALOG ───────────── -->
    <v-dialog v-model="editDialog" max-width="680" scrollable>
      <v-card class="form-dialog" rounded="2xl">
        <div class="form-dialog__header">
          <div class="form-dialog__header-icon form-dialog__header-icon--edit">
            <v-icon icon="mdi-pencil-outline" size="22" />
          </div>
          <div>
            <h2 class="form-dialog__title">Редактировать проект</h2>
            <p class="form-dialog__subtitle">Изменения отправятся на повторную модерацию</p>
          </div>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="closeEditDialog" />
        </div>
        <v-divider />
        <v-card-text class="form-dialog__body">
          <v-form ref="editFormRef" @submit.prevent="submitEditProject">
            <div class="form-section">
              <div class="form-section__label">Основная информация</div>
              <v-row dense>
                <v-col cols="12" md="7">
                  <v-text-field v-model="editFormState.title" label="Название проекта" variant="outlined" density="comfortable" :rules="[rules.required]" />
                </v-col>
                <v-col cols="12" md="5">
                  <v-text-field v-model="editFormState.city" label="Город" variant="outlined" density="comfortable" prepend-inner-icon="mdi-map-marker-outline" :rules="[rules.required]" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="editFormState.address" label="Адрес / место проведения" variant="outlined" density="comfortable" prepend-inner-icon="mdi-home-map-marker" />
                </v-col>
                <v-col cols="12">
                  <v-textarea v-model="editFormState.description" label="Описание" variant="outlined" density="comfortable" rows="3" :rules="[rules.required]" auto-grow />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select v-model="editFormState.volunteer_type" :items="volunteerTypeOptions" item-title="title" item-value="value" label="Тип волонтёрства" variant="outlined" density="comfortable" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-combobox v-model="editFormState.tags" label="Теги" variant="outlined" density="comfortable" multiple chips small-chips prepend-inner-icon="mdi-tag-outline" />
                </v-col>
              </v-row>
            </div>

            <div class="form-section">
              <div class="form-section__label">Период проекта</div>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-dialog max-width="360">
                    <template #activator="{ props }">
                      <v-text-field :model-value="editFormState.start_date" label="Дата начала" variant="outlined" density="comfortable" prepend-inner-icon="mdi-calendar-start" readonly v-bind="props" />
                    </template>
                    <template #default="{ isActive }">
                      <v-card rounded="xl"><v-date-picker v-model="editFormState.start_date" locale="ru" :first-day-of-week="1" color="primary" @update:model-value="datePickerHandler(editFormState, 'start_date', isActive)" /></v-card>
                    </template>
                  </v-dialog>
                </v-col>
                <v-col cols="12" md="6">
                  <v-dialog max-width="360">
                    <template #activator="{ props }">
                      <v-text-field :model-value="editFormState.end_date" label="Дата завершения" variant="outlined" density="comfortable" prepend-inner-icon="mdi-calendar-end" readonly v-bind="props" />
                    </template>
                    <template #default="{ isActive }">
                      <v-card rounded="xl"><v-date-picker v-model="editFormState.end_date" locale="ru" :first-day-of-week="1" color="primary" @update:model-value="datePickerHandler(editFormState, 'end_date', isActive)" /></v-card>
                    </template>
                  </v-dialog>
                </v-col>
              </v-row>
            </div>

            <div class="form-section">
              <div class="form-section__label">Координаты</div>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-text-field v-model="editFormState.latitude" type="number" label="Широта" variant="outlined" density="comfortable" prepend-inner-icon="mdi-crosshairs-gps" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field v-model="editFormState.longitude" type="number" label="Долгота" variant="outlined" density="comfortable" prepend-inner-icon="mdi-crosshairs" />
                </v-col>
                <v-col cols="12" class="d-flex flex-wrap ga-2">
                  <v-btn variant="tonal" size="small" rounded="pill" color="primary" class="text-none" :loading="geolocationLoading" :disabled="!geolocationSupported || geolocationLoading" prepend-icon="mdi-crosshairs-gps" @click="detectCoordinatesForEdit">
                    По геолокации
                  </v-btn>
                  <v-btn variant="tonal" size="small" rounded="pill" color="primary" class="text-none" :loading="geolocationLoading" :disabled="geolocationLoading || !editFormState.city" prepend-icon="mdi-map-search-outline" @click="geocodeAddressForEdit">
                    По адресу
                  </v-btn>
                </v-col>
                <v-col cols="12" v-if="editMapPreviewUrl">
                  <v-responsive aspect-ratio="16/7" class="map-preview">
                    <iframe :src="editMapPreviewUrl" frameborder="0" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" />
                  </v-responsive>
                </v-col>
              </v-row>
            </div>

            <div class="form-section">
              <div class="form-section__label">Контакты</div>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-text-field v-model="editFormState.contact_person" label="Контактное лицо" variant="outlined" density="comfortable" prepend-inner-icon="mdi-account-tie-outline" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field v-model="editFormState.contact_phone" label="Телефон" variant="outlined" density="comfortable" prepend-inner-icon="mdi-phone-outline" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field v-model="editFormState.contact_email" label="Email" variant="outlined" density="comfortable" prepend-inner-icon="mdi-email-outline" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field v-model="editFormState.contact_telegram" label="Telegram" variant="outlined" density="comfortable" prepend-inner-icon="mdi-send-outline" hint="https://t.me/..." />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="editFormState.info_url" label="Сайт / доп. ссылка" variant="outlined" density="comfortable" prepend-inner-icon="mdi-web" />
                </v-col>
                <v-col cols="12">
                  <v-text-field 
                    v-model="editFormState.gis2_url" 
                    label="Ссылка на 2ГИС" 
                    variant="outlined" 
                    density="comfortable" 
                    prepend-inner-icon="mdi-map-marker"
                    :rules="[rules.gis2Url]"
                    hint="Пример: https://go.2gis.com/vOZEO или https://2gis.kz/..."
                    persistent-hint
                  >
                    <template #append-inner>
                      <v-btn
                        icon="mdi-open-in-new"
                        variant="text"
                        size="small"
                        :disabled="!editFormState.gis2_url || !rules.gis2Url(editFormState.gis2_url) || rules.gis2Url(editFormState.gis2_url) !== true"
                        @click="() => { if (editFormState.gis2_url) openUrl(editFormState.gis2_url); }"
                      />
                    </template>
                  </v-text-field>
                  <div class="mt-2">
                    <v-btn
                      variant="outlined"
                      size="small"
                      color="primary"
                      prepend-icon="mdi-map-search"
                      @click="() => openUrl('https://2gis.kz')"
                    >
                      Открыть 2ГИС
                    </v-btn>
                  </div>
                </v-col>
              </v-row>
            </div>

            <div class="form-section">
              <div class="form-section__label">Обложка</div>
              <v-file-input v-model="editFormState.cover_image" label="Загрузить изображение" variant="outlined" density="comfortable" prepend-inner-icon="mdi-image-edit-outline" prepend-icon="" accept="image/*" show-size hint="Загрузите новое изображение, если хотите заменить текущее" persistent-hint />
            </div>
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions class="form-dialog__footer">
          <v-btn variant="text" class="text-none" @click="closeEditDialog">Отмена</v-btn>
          <v-btn color="primary" variant="flat" rounded="pill" class="text-none font-weight-bold px-6" :loading="editLoading" @click="submitEditProject">
            Сохранить изменения
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ───────────── DELETE DIALOG ───────────── -->
    <v-dialog v-model="deleteDialog" max-width="440">
      <v-card class="delete-dialog" rounded="2xl">
        <div class="delete-dialog__icon">
          <v-icon icon="mdi-trash-can-outline" size="32" color="error" />
        </div>
        <h2 class="delete-dialog__title">
          {{ projectToDelete?.status === 'pending' ? 'Отозвать проект?' : 'Удалить проект?' }}
        </h2>
        <p class="delete-dialog__text">
          Вы уверены, что хотите {{ projectToDelete?.status === 'pending' ? 'отозвать' : 'удалить' }} проект
          <strong>«{{ projectToDelete?.title }}»</strong>? Это действие нельзя отменить.
        </p>
        <div class="delete-dialog__actions">
          <v-btn variant="tonal" rounded="pill" class="text-none flex-grow-1" @click="closeDeleteDialog" :disabled="deleteLoading">
            Отмена
          </v-btn>
          <v-btn color="error" variant="flat" rounded="pill" class="text-none font-weight-semibold flex-grow-1" :loading="deleteLoading" @click="submitDeleteProject">
            {{ projectToDelete?.status === 'pending' ? 'Отозвать' : 'Удалить' }}
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- ───────────── SNACKBAR ───────────── -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000" rounded="pill" location="bottom center">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<style scoped>
/* ─── Base ─── */
.projects-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0 32px;
}

/* ─── Page Header ─── */
.page-header {
  background: linear-gradient(135deg, #f0faf0 0%, #fafff5 100%);
  border: 1px solid rgba(139, 195, 74, 0.18);
  border-radius: 20px;
  padding: 24px 28px;
}

.page-header__content {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.5px;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.5);
  margin: 0;
}

.create-btn {
  border-radius: 50px !important;
  font-size: 0.9rem;
  padding: 0 24px;
  height: 44px;
  box-shadow: 0 4px 16px rgba(139, 195, 74, 0.35) !important;
  transition: box-shadow 0.2s, transform 0.2s;
}

.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(139, 195, 74, 0.45) !important;
}

/* ─── Main Layout ─── */
.main-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
  align-items: start;
}

@media (max-width: 960px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
  .sidebar-col {
    order: -1;
  }
}

/* ─── Projects Grid ─── */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.skeleton-card {
  min-height: 320px;
}

/* ─── Project Card ─── */
.project-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.22s ease, transform 0.22s ease;
}

.project-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}

.project-card__cover {
  position: relative;
  height: 150px;
  background: linear-gradient(135deg, #8bc34a 0%, #558b2f 100%);
  flex-shrink: 0;
}

.project-card__cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-card__cover-icon {
  opacity: 0.7;
}

.project-card__status-badge {
  position: absolute;
  top: 10px;
  right: 10px;
}

.project-card__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  flex: 1;
}

.project-card__title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  color: #1a1a1a;
  margin: 0;
}

.project-card__desc {
  font-size: 0.825rem;
  color: rgba(0, 0, 0, 0.55);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Meta chips */
.project-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.55);
  background: rgba(139, 195, 74, 0.08);
  border: 1px solid rgba(139, 195, 74, 0.2);
  border-radius: 100px;
  padding: 3px 10px;
  white-space: nowrap;
}

/* Stats */
.project-card__stats {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.025);
  border-radius: 10px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgba(0, 0, 0, 0.6);
}

.stat-value {
  font-size: 0.925rem;
  font-weight: 700;
  color: #1a1a1a;
}

.stat-label {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.45);
}

.stat-divider {
  width: 1px;
  height: 20px;
  background: rgba(0, 0, 0, 0.1);
}

.tags-inline {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tags-more {
  font-size: 0.7rem;
  color: rgba(0, 0, 0, 0.4);
}

/* Contacts */
.project-card__contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.contact-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.775rem;
  color: rgba(139, 195, 74, 0.9);
  text-decoration: none;
  transition: color 0.15s;
}

.contact-link:hover {
  color: #558b2f;
}

/* Actions */
.project-card__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 4px;
}

/* ─── Empty State ─── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 24px;
  border-radius: 18px;
  border: 2px dashed rgba(139, 195, 74, 0.3);
  background: rgba(139, 195, 74, 0.03);
}

.empty-state__illustration {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(139, 195, 74, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  color: rgba(139, 195, 74, 0.8);
}

.empty-state__title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 6px;
}

.empty-state__text {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.5);
  max-width: 300px;
  line-height: 1.5;
  margin-bottom: 0;
}

/* ─── Sidebar / Checklist ─── */
.sidebar-col {
  position: sticky;
  top: 80px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  overflow-x: hidden;
}

/* Убираем sticky на мобильных и планшетах */
@media (max-width: 960px) {
  .sidebar-col {
    position: static;
    max-height: none;
    overflow: visible;
  }
}

.checklist-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 20px;
  max-height: 100%;
}

.checklist-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 20px;
}

.checklist-card__icon {
  color: #8bc34a;
}

.checklist-steps {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

/* Убираем скролл на мобильных */
@media (max-width: 960px) {
  .checklist-steps {
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }
}

/* Кастомный скроллбар для чек-листа */
.checklist-steps::-webkit-scrollbar {
  width: 6px;
}

.checklist-steps::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.checklist-steps::-webkit-scrollbar-thumb {
  background: rgba(139, 195, 74, 0.3);
  border-radius: 3px;
}

.checklist-steps::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 195, 74, 0.5);
}

.checklist-step {
  display: flex;
  gap: 14px;
  padding-bottom: 20px;
  position: relative;
}

.checklist-step:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 26px;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, rgba(139, 195, 74, 0.3), transparent);
}

.checklist-step:last-child {
  padding-bottom: 0;
}

.checklist-step__number {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: white;
  font-size: 0.75rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.checklist-step__title {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 6px;
}

.checklist-step__points {
  padding-left: 14px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.checklist-step__points li {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.55);
  line-height: 1.45;
}

/* ─── Dialogs ─── */
.form-dialog {
  border-radius: 24px !important;
  overflow: hidden;
}

.form-dialog__header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
}

.form-dialog__header-icon {
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

.form-dialog__header-icon--edit {
  background: linear-gradient(135deg, rgba(255, 167, 38, 0.15), rgba(255, 167, 38, 0.08));
  border-color: rgba(255, 167, 38, 0.2);
  color: #e65100;
}

.form-dialog__title {
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 2px;
}

.form-dialog__subtitle {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.45);
  margin: 0;
}

.form-dialog__body {
  padding: 20px 24px !important;
  overflow-y: auto;
}

.form-dialog__footer {
  padding: 16px 24px !important;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

/* Адаптация для мобильных устройств */
@media (max-width: 600px) {
  .form-dialog__footer {
    padding: 12px 16px !important;
    flex-direction: column-reverse;
    gap: 10px;
  }
  
  .form-dialog__cancel-btn,
  .form-dialog__submit-btn {
    width: 100% !important;
    margin: 0 !important;
  }
  
  .form-dialog__submit-btn {
    order: -1;
  }
  
  .form-dialog__body {
    padding: 16px !important;
  }
  
  .form-dialog__header {
    padding: 16px !important;
  }
}

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

/* ─── Delete Dialog ─── */
.delete-dialog {
  padding: 32px 28px 28px !important;
  text-align: center;
}

.delete-dialog__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(244, 67, 54, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.delete-dialog__title {
  font-size: 1.15rem;
  font-weight: 800;
  margin-bottom: 10px;
}

.delete-dialog__text {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.55);
  line-height: 1.55;
  margin-bottom: 24px;
}

.delete-dialog__actions {
  display: flex;
  gap: 10px;
}

/* ─── Map preview ─── */
.map-preview {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.map-preview iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
</style>