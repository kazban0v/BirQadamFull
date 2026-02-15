<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
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

const mapPreviewUrl = computed(() => {
  const parts = [createFormState.city?.trim(), createFormState.address?.trim()].filter(Boolean);
  if (!parts.length) return null;
  return `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(parts.join(', '))}`;
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
  cover_image: null as File | File[] | null,
});

const volunteerTypeOptions = [
  { title: 'Социальная помощь', value: 'social' },
  { title: 'Экологические проекты', value: 'environmental' },
  { title: 'Культурные мероприятия', value: 'cultural' },
];

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  
  // Парсим дату как локальную, чтобы избежать проблем с часовыми поясами
  // Если дата в формате YYYY-MM-DD, добавляем время для локального парсинга
  let date: Date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Формат YYYY-MM-DD - парсим как локальную дату
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    // ISO формат с временем - парсим как есть
    date = new Date(value);
  }
  
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const roadmap = [
  {
    title: 'Шаг 1. Подготовьте информацию',
    points: ['Название и цель проекта', 'Город и точка встречи', 'Тип волонтёрства и теги', 'Формат и дедлайны'],
  },
  {
    title: 'Шаг 2. Создайте проект',
    points: [
      'Заполните форму проекта — она сразу появится в приложении и ботe.',
      'Отправьте проект на модерацию администратору.',
      'Получите уведомление об одобрении в Telegram.',
    ],
  },
  {
    title: 'Шаг 3. Управляйте командой',
    points: ['Добавляйте волонтёров', 'Назначайте задачи и дедлайны', 'Отслеживайте отчёты и статистику'],
  },
];

const rules = {
  required: (value: string) => !!value || 'Поле обязательно к заполнению.',
};

onMounted(() => {
  if (organizerStore.isOrganizer) {
    organizerStore.loadProjects(true);
  }
});

// Автоматическое геокодирование отключено из-за требований API ключа Yandex
// Пользователь может использовать кнопку "Определить по адресу" для ручного геокодирования

const openCreateDialog = () => {
  createFormState.title = '';
  createFormState.description = '';
  createFormState.city = '';
  createFormState.volunteer_type = 'social';
  createFormState.start_date = null;
  createFormState.end_date = null;
  createFormState.address = '';
  createFormState.tags = [];
  createFormState.latitude = null;
  createFormState.longitude = null;
  createFormState.contact_person = '';
  createFormState.contact_phone = '';
  createFormState.contact_email = '';
  createFormState.contact_telegram = '';
  createFormState.info_url = '';
  createFormState.cover_image = null;
  createDialog.value = true;
};

const closeCreateDialog = () => {
  createDialog.value = false;
};

const parseCoordinate = (value: string | null) => {
  if (value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const detectCoordinates = () => {
  if (!geolocationSupported) {
    snackbar.message = 'Ваш браузер не поддерживает автоматическое определение местоположения.';
    snackbar.color = 'warning';
    snackbar.show = true;
    return;
  }

  geolocationLoading.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      createFormState.latitude = position.coords.latitude.toFixed(6);
      createFormState.longitude = position.coords.longitude.toFixed(6);
      geolocationLoading.value = false;
      snackbar.message = 'Координаты определены автоматически.';
      snackbar.color = 'success';
      snackbar.show = true;
    },
    (error) => {
      geolocationLoading.value = false;
      let message = 'Не удалось получить координаты.';
      if (error.code === error.PERMISSION_DENIED) {
        message = 'Доступ к геолокации отклонён. Разрешите доступ в браузере.';
      }
      snackbar.message = message;
      snackbar.color = 'error';
      snackbar.show = true;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  );
};

const geocodeAddress = async () => {
  // Разрешаем геокодирование только по городу, если адрес не указан
  const city = createFormState.city?.trim() || '';
  const addr = createFormState.address?.trim() || '';
  const address = [city, addr].filter(Boolean).join(', ');
  
  if (!city) {
    snackbar.message = 'Укажите город для определения координат.';
    snackbar.color = 'error';
    snackbar.show = true;
    return;
  }

  geolocationLoading.value = true;
  try {
    // Используем Yandex Geocoder API через прокси или напрямую
    // Для работы нужен API ключ, но можно использовать публичный геокодер
    const response = await fetch(
      `https://geocode-maps.yandex.ru/1.x/?geocode=${encodeURIComponent(address)}&format=json`
    );
    const data = await response.json();
    
    if (data.response?.GeoObjectCollection?.featureMember?.length > 0) {
      const coords = data.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos.split(' ');
      createFormState.longitude = parseFloat(coords[0]).toFixed(6);
      createFormState.latitude = parseFloat(coords[1]).toFixed(6);
      snackbar.message = 'Координаты определены по адресу.';
      snackbar.color = 'success';
      snackbar.show = true;
    } else {
      snackbar.message = 'Адрес не найден. Попробуйте уточнить адрес или используйте геолокацию.';
      snackbar.color = 'error';
      snackbar.show = true;
    }
  } catch (error) {
    snackbar.message = 'Не удалось определить координаты по адресу. Используйте геолокацию или введите координаты вручную.';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    geolocationLoading.value = false;
  }
};

const detectCoordinatesForEdit = () => {
  if (!geolocationSupported) {
    snackbar.message = 'Ваш браузер не поддерживает автоматическое определение местоположения.';
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
      snackbar.message = 'Координаты определены автоматически.';
      snackbar.color = 'success';
      snackbar.show = true;
    },
    (error) => {
      geolocationLoading.value = false;
      let message = 'Не удалось получить координаты.';
      if (error.code === error.PERMISSION_DENIED) {
        message = 'Доступ к геолокации отклонён. Разрешите доступ в браузере.';
      }
      snackbar.message = message;
      snackbar.color = 'error';
      snackbar.show = true;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  );
};

const geocodeAddressForEdit = async () => {
  // Разрешаем геокодирование только по городу, если адрес не указан
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
    const response = await fetch(
      `https://geocode-maps.yandex.ru/1.x/?geocode=${encodeURIComponent(address)}&format=json`
    );
    const data = await response.json();
    
    if (data.response?.GeoObjectCollection?.featureMember?.length > 0) {
      const coords = data.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos.split(' ');
      editFormState.longitude = parseFloat(coords[0]).toFixed(6);
      editFormState.latitude = parseFloat(coords[1]).toFixed(6);
      snackbar.message = 'Координаты определены по адресу.';
      snackbar.color = 'success';
      snackbar.show = true;
    } else {
      snackbar.message = 'Адрес не найден. Попробуйте уточнить адрес или используйте геолокацию.';
      snackbar.color = 'error';
      snackbar.show = true;
    }
  } catch (error) {
    snackbar.message = 'Не удалось определить координаты по адресу. Используйте геолокацию или введите координаты вручную.';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    geolocationLoading.value = false;
  }
};

const combineDateTime = (date: string | null, time: string | null): string | undefined => {
  if (!date) return undefined;
  // Для дат периода проекта отправляем только дату без времени,
  // чтобы избежать проблем с часовыми поясами
  // Время используется только для задач, не для периода проекта
  return date;
};

const submitCreateProject = async () => {
  const { valid } = (await createFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  createLoading.value = true;
  try {
    await organizerStore.createProject({
      title: createFormState.title,
      description: createFormState.description,
      city: createFormState.city,
      volunteer_type: createFormState.volunteer_type,
      start_date: combineDateTime(createFormState.start_date, createFormState.start_time),
      end_date: combineDateTime(createFormState.end_date, createFormState.end_time),
      address: createFormState.address || undefined,
      tags: createFormState.tags,
      latitude: parseCoordinate(createFormState.latitude),
      longitude: parseCoordinate(createFormState.longitude),
      contact_person: createFormState.contact_person || undefined,
      contact_phone: createFormState.contact_phone || undefined,
      contact_email: createFormState.contact_email || undefined,
      contact_telegram: createFormState.contact_telegram || undefined,
      info_url: createFormState.info_url || undefined,
      cover_image: Array.isArray(createFormState.cover_image)
        ? createFormState.cover_image[0]
        : createFormState.cover_image || undefined,
    });
    snackbar.message = 'Проект отправлен на модерацию.';
    snackbar.color = 'success';
    snackbar.show = true;
    closeCreateDialog();
  } catch (error: any) {
    const detail =
      error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      'Не удалось создать проект.';
    snackbar.message = detail;
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
    // Проверяем наличие участников в проекте
    if (project.volunteer_count && project.volunteer_count > 0) {
      snackbar.message = 'Редактирование проекта запрещено, так как в проекте уже есть участники. Удалите всех участников перед редактированием.';
      snackbar.color = 'error';
      snackbar.show = true;
      return;
    }
    
    console.log('Opening edit dialog for project:', project);
    projectToEdit.value = project;
    editFormState.title = project.title || '';
    editFormState.description = project.description || '';
    editFormState.city = project.city || '';
    editFormState.volunteer_type = project.volunteer_type || 'social';
    
    // Парсим даты
    console.log('Parsing dates for edit:', {
      start_date: project.start_date,
      end_date: project.end_date,
    });
    
    if (project.start_date) {
      // Если дата в формате ISO (YYYY-MM-DD или YYYY-MM-DDTHH:mm:ss), извлекаем только дату
      const startDateStr = typeof project.start_date === 'string' ? project.start_date : project.start_date.toString();
      const startDateParts = startDateStr.split('T');
      editFormState.start_date = startDateParts[0] || null;
      editFormState.start_time = startDateParts[1] ? startDateParts[1].substring(0, 5) : null;
    } else {
      editFormState.start_date = null;
      editFormState.start_time = null;
    }
    
    if (project.end_date) {
      // Если дата в формате ISO (YYYY-MM-DD или YYYY-MM-DDTHH:mm:ss), извлекаем только дату
      const endDateStr = typeof project.end_date === 'string' ? project.end_date : project.end_date.toString();
      const endDateParts = endDateStr.split('T');
      editFormState.end_date = endDateParts[0] || null;
      editFormState.end_time = endDateParts[1] ? endDateParts[1].substring(0, 5) : null;
      console.log('Parsed end_date:', {
        original: project.end_date,
        parsed: editFormState.end_date,
      });
    } else {
      editFormState.end_date = null;
      editFormState.end_time = null;
    }
    
    editFormState.address = project.address || '';
    editFormState.tags = project.tags || [];
    editFormState.latitude = project.latitude !== null && project.latitude !== undefined ? String(project.latitude) : null;
    editFormState.longitude = project.longitude !== null && project.longitude !== undefined ? String(project.longitude) : null;
    editFormState.contact_person = project.contact_person || '';
    editFormState.contact_phone = project.contact_phone || '';
    editFormState.contact_email = project.contact_email || '';
    editFormState.contact_telegram = project.contact_telegram || '';
    editFormState.info_url = project.info_url || '';
    editFormState.cover_image = null;
    editDialog.value = true;
    console.log('Edit dialog opened successfully');
  } catch (error) {
    console.error('Error opening edit dialog:', error);
    snackbar.message = 'Ошибка при открытии формы редактирования';
    snackbar.color = 'error';
    snackbar.show = true;
  }
};

const closeEditDialog = () => {
  editDialog.value = false;
  projectToEdit.value = null;
};

const openDeleteDialog = (project: OrganizerProject) => {
  projectToDelete.value = project;
  deleteDialog.value = true;
};

const closeDeleteDialog = () => {
  deleteDialog.value = false;
  projectToDelete.value = null;
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
      cover_image: Array.isArray(editFormState.cover_image)
        ? editFormState.cover_image[0]
        : editFormState.cover_image || undefined,
    });
    // Закрываем диалог перед перезагрузкой
    closeEditDialog();
    // Перезагружаем проекты для обновления статуса и фото
    await organizerStore.loadProjects(true);
    snackbar.message = 'Проект успешно обновлён и отправлен на модерацию.';
    snackbar.color = 'success';
    snackbar.show = true;
  } catch (error: any) {
    const detail =
      error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      'Не удалось обновить проект.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    editLoading.value = false;
  }
};

const submitDeleteProject = async () => {
  if (!projectToDelete.value) return;

  deleteLoading.value = true;
  try {
    await organizerStore.removeProject(projectToDelete.value.id);
    snackbar.message = 'Проект успешно отозван.';
    snackbar.color = 'success';
    snackbar.show = true;
    closeDeleteDialog();
  } catch (error: any) {
    const detail =
      error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      'Не удалось отозвать проект.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <div class="projects-view">
    <v-row class="ga-6">
      <v-col cols="12" lg="7">
        <v-card class="projects-card" rounded="xl" elevation="6">
          <div class="d-flex align-center justify-space-between ga-4 flex-wrap">
            <div>
              <h1 class="text-h5 font-weight-bold mb-1">Проекты организации</h1>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Управляйте всеми инициативами {{ organizationName }}: отслеживайте статус и подготавливайте задачи для команды.
              </p>
            </div>
            <v-btn
              color="primary"
              class="text-none font-weight-bold"
              variant="flat"
              :disabled="!isOrganizer || !isApproved"
              @click="openCreateDialog"
            >
              Создать проект
            </v-btn>
          </div>
          <v-divider class="my-5" />

          <v-alert
            v-if="!isOrganizer"
            type="error"
            border="start"
            variant="tonal"
            class="mb-4"
          >
            У вас нет прав организатора. Войдите под аккаунтом организатора, чтобы управлять проектами.
          </v-alert>

          <v-alert
            v-else-if="!isApproved"
            type="warning"
            variant="tonal"
            border="start"
            class="mb-6"
            title="Ждём подтверждения"
          >
            После одобрения заявки вы сможете создавать проекты напрямую из портала. Пока подготовьте информацию по чек-листу справа.
          </v-alert>

          <v-alert
            v-else-if="projectsError"
            type="error"
            variant="tonal"
            border="start"
            class="mb-6"
          >
            {{ projectsError }}
          </v-alert>

          <v-skeleton-loader
            v-else-if="loadingProjects"
            type="card, card"
            class="mb-4"
          />

          <div v-else>
            <v-row v-if="projects.length > 0" class="ga-3">
              <v-col
                v-for="project in projects"
                :key="project.id"
                cols="12"
                md="6"
              >
                <v-sheet class="project-card" rounded="lg" border>
                  <v-img
                    v-if="project.cover_image_url"
                    :src="project.cover_image_url"
                    height="160"
                    class="mb-3 rounded-lg"
                    cover
                  />
                  <div class="d-flex align-center justify-space-between mb-3">
                    <v-chip
                      size="small"
                      :color="project.status === 'approved' ? 'success' : project.status === 'rejected' ? 'error' : 'warning'"
                      variant="flat"
                      class="text-none"
                    >
                      {{ project.status === 'approved' ? 'Одобрен' : project.status === 'rejected' ? 'Отклонён' : 'На модерации' }}
                    </v-chip>
                    <span class="text-caption text-medium-emphasis">
                      создан {{ formatDate(project.created_at) }}
                    </span>
                  </div>
                  <h3 class="text-subtitle-1 font-weight-semibold mb-2">{{ project.title }}</h3>
                  <p class="text-body-2 text-medium-emphasis mb-4">{{ project.description }}</p>
                  <p class="text-body-2 text-medium-emphasis mb-3" v-if="project.start_date || project.end_date">
                    Период: {{ formatDate(project.start_date) }} — {{ formatDate(project.end_date) }}
                  </p>
                  <div class="d-flex flex-wrap ga-2 mb-3" v-if="project.tags?.length">
                    <v-chip
                      v-for="tag in project.tags"
                      :key="tag"
                      size="small"
                      color="primary-lighten-4"
                      class="text-none"
                    >
                      {{ tag }}
                    </v-chip>
                  </div>
                  <div class="d-flex ga-3 mb-4 flex-wrap">
                    <v-chip size="small" color="primary-lighten-3" class="text-none">
                      <v-icon icon="mdi-map-marker" start />
                      {{ project.address || project.city }}
                    </v-chip>
                    <v-chip size="small" color="primary-lighten-3" class="text-none">
                      <v-icon icon="mdi-account-group-outline" start />
                      {{ project.volunteer_count }} волонтёров
                    </v-chip>
                    <v-chip size="small" color="primary-lighten-3" class="text-none">
                      <v-icon icon="mdi-clipboard-check-outline" start />
                      {{ project.task_count }} задач
                    </v-chip>
                  </div>
                  <div class="project-contact" v-if="project.contact_person || project.contact_phone || project.contact_telegram || project.info_url">
                    <div class="text-caption text-medium-emphasis mb-1">Контакты</div>
                    <ul class="text-body-2 text-medium-emphasis pa-0 ma-0 contact-list">
                      <li v-if="project.contact_person">
                        <v-icon icon="mdi-account-tie" size="16" class="me-1" />
                        {{ project.contact_person }}
                      </li>
                      <li v-if="project.contact_phone">
                        <v-icon icon="mdi-phone" size="16" class="me-1" />
                        <a :href="`tel:${project.contact_phone}`" class="link">{{ project.contact_phone }}</a>
                      </li>
                      <li v-if="project.contact_email">
                        <v-icon icon="mdi-email-outline" size="16" class="me-1" />
                        <a :href="`mailto:${project.contact_email}`" class="link">{{ project.contact_email }}</a>
                      </li>
                      <li v-if="project.contact_telegram">
                        <v-icon icon="mdi-send" size="16" class="me-1" />
                        <a :href="project.contact_telegram" class="link" target="_blank">Telegram</a>
                      </li>
                      <li v-if="project.info_url">
                        <v-icon icon="mdi-web" size="16" class="me-1" />
                        <a :href="project.info_url" class="link" target="_blank">Подробнее</a>
                      </li>
                    </ul>
                  </div>
                  <div
                    class="d-flex ga-2 flex-wrap mb-3"
                    v-if="project.latitude !== null && project.latitude !== undefined && project.longitude !== null && project.longitude !== undefined"
                  >
                    <v-btn
                      variant="outlined"
                      size="small"
                      class="text-none"
                      :href="`https://maps.google.com/?q=${project.latitude},${project.longitude}`"
                      target="_blank"
                    >
                      Открыть на карте
                      <v-icon icon="mdi-map" end size="16" />
                    </v-btn>
                  </div>
                  <div class="d-flex ga-2 flex-wrap align-center">
                    <v-btn
                      color="warning"
                      variant="outlined"
                      size="small"
                      class="text-none"
                      :disabled="(project.volunteer_count || 0) > 0"
                      @click="openEditDialog(project)"
                    >
                      <v-icon icon="mdi-pencil" start size="16" />
                      Редактировать
                    </v-btn>
                    <v-tooltip
                      v-if="project.volunteer_count && project.volunteer_count > 0"
                      text="Редактирование запрещено, так как в проекте уже есть участники"
                      location="top"
                    >
                      <template #activator="{ props }">
                        <v-icon
                          v-bind="props"
                          icon="mdi-information-outline"
                          color="warning"
                          size="20"
                          class="ml-1"
                        />
                      </template>
                    </v-tooltip>
                    <v-btn
                      color="error"
                      variant="outlined"
                      size="small"
                      class="text-none"
                      @click="openDeleteDialog(project)"
                    >
                      <v-icon icon="mdi-delete" start size="16" />
                      {{ project.status === 'pending' ? 'Отозвать' : 'Удалить' }}
                    </v-btn>
                    <v-btn
                      color="primary"
                      variant="text"
                      class="text-none font-weight-semibold"
                      @click="goToTasks(project.id)"
                    >
                      Открыть задачи
                      <v-icon icon="mdi-arrow-right" end size="18" />
                    </v-btn>
                  </div>
                </v-sheet>
              </v-col>
            </v-row>

            <v-row v-else class="ga-3">
              <v-col cols="12">
                <v-sheet class="empty-state" rounded="lg" border>
                  <v-icon icon="mdi-folder-outline" size="40" color="primary" class="mb-3" />
                  <h3 class="text-subtitle-1 font-weight-semibold mb-2">Проектов пока нет</h3>
                  <p class="text-body-2 text-medium-emphasis mb-4">
                    Создайте первый проект — он появится здесь и в Telegram боте после модерации.
                  </p>
                  <v-btn
                    color="primary"
                    class="text-none font-weight-bold"
                    variant="flat"
                    :disabled="!isApproved"
                    @click="openCreateDialog"
                  >
                    Создать проект
                  </v-btn>
                </v-sheet>
              </v-col>
            </v-row>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" lg="5">
        <v-card rounded="xl" elevation="6" class="roadmap-card">
          <div class="d-flex align-center ga-3 mb-4">
            <v-avatar color="primary" size="48">
              <v-icon icon="mdi-map-marker-path" />
            </v-avatar>
            <div>
              <h2 class="text-h6 font-weight-bold mb-1">Чек-лист перед запуском</h2>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Мы подготовили шаблон, чтобы подготовка к проекту заняла минимум времени.
              </p>
            </div>
          </div>
          <div class="roadmap-card__steps">
            <v-sheet
              v-for="(step, index) in roadmap"
              :key="step.title"
              color="grey-lighten-5"
              class="pa-5 roadmap-card__step"
              rounded="lg"
            >
              <div class="d-flex ga-3 mb-3 align-center">
                <v-avatar color="primary" size="32">
                  <span class="text-body-2 font-weight-bold">{{ index + 1 }}</span>
                </v-avatar>
                <h3 class="text-subtitle-1 font-weight-semibold mb-0">{{ step.title }}</h3>
              </div>
              <ul class="roadmap-card__list">
                <li v-for="point in step.points" :key="point">{{ point }}</li>
              </ul>
            </v-sheet>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="createDialog" max-width="720">
      <v-card class="create-dialog pa-6 pa-md-8">
        <div class="d-flex align-center ga-3 mb-4">
          <v-avatar color="primary" size="48">
            <v-icon icon="mdi-rocket-launch-outline" />
          </v-avatar>
          <div>
            <h2 class="text-h6 font-weight-bold mb-1">Создать новый проект</h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Укажите ключевую информацию — после модерации волонтёры увидят проект и смогут присоединиться.
            </p>
          </div>
        </div>
        <v-form ref="createFormRef" @submit.prevent="submitCreateProject">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createFormState.title"
                label="Название проекта"
                variant="outlined"
                prepend-inner-icon="mdi-format-title"
                :rules="[rules.required]"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createFormState.city"
                label="Город"
                variant="outlined"
                prepend-inner-icon="mdi-map-marker"
                :rules="[rules.required]"
              />
            </v-col>
            <v-col cols="12">
              <YandexMapPicker
                v-model:latitude="createFormState.latitude"
                v-model:longitude="createFormState.longitude"
                :city="createFormState.city"
                height="300px"
                @update:address="(address) => { createFormState.address = address; }"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="createFormState.description"
                label="Описание проекта"
                variant="outlined"
                rows="4"
                prepend-inner-icon="mdi-text-box-outline"
                :rules="[rules.required]"
                auto-grow
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="createFormState.volunteer_type"
                :items="volunteerTypeOptions"
                item-title="title"
                item-value="value"
                label="Тип волонтёрства"
                variant="outlined"
                prepend-inner-icon="mdi-account-heart-outline"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-combobox
                v-model="createFormState.tags"
                label="Теги"
                variant="outlined"
                multiple
                chips
                small-chips
                prepend-inner-icon="mdi-tag"
                hint="Например: #экология, #уборка"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-dialog max-width="320">
                <template #activator="{ props }">
                  <v-text-field
                    v-model="createFormState.start_date"
                    label="Дата начала (опционально)"
                    variant="outlined"
                    prepend-inner-icon="mdi-calendar-start"
                    readonly
                    v-bind="props"
                  />
                </template>
                <template #default="{ isActive }">
                  <v-date-picker
                    v-model="createFormState.start_date"
                    @update:modelValue="(value) => { 
                      // Преобразуем объект Date в строку YYYY-MM-DD
                      if (value instanceof Date) {
                        const year = value.getFullYear();
                        const month = String(value.getMonth() + 1).padStart(2, '0');
                        const day = String(value.getDate()).padStart(2, '0');
                        createFormState.start_date = `${year}-${month}-${day}`;
                      } else if (typeof value === 'string') {
                        createFormState.start_date = value;
                      } else {
                        createFormState.start_date = null;
                      }
                      isActive.value = false;
                    }"
                  />
                </template>
              </v-dialog>
            </v-col>
            <v-col cols="12" md="6">
              <v-dialog max-width="320">
                <template #activator="{ props }">
                  <v-text-field
                    v-model="createFormState.start_time"
                    label="Время начала (опционально)"
                    variant="outlined"
                    prepend-inner-icon="mdi-clock-outline"
                    readonly
                    v-bind="props"
                    :disabled="!createFormState.start_date"
                  />
                </template>
                <template #default="{ isActive }">
                  <v-time-picker
                    v-model="createFormState.start_time"
                    format="24hr"
                    @update:modelValue="isActive.value = false"
                  />
                </template>
              </v-dialog>
            </v-col>
            <v-col cols="12" md="6">
              <v-dialog max-width="320">
                <template #activator="{ props }">
                  <v-text-field
                    v-model="createFormState.end_date"
                    label="Дата завершения (опционально)"
                    variant="outlined"
                    prepend-inner-icon="mdi-calendar-end"
                    readonly
                    v-bind="props"
                  />
                </template>
                <template #default="{ isActive }">
                  <v-date-picker
                    v-model="createFormState.end_date"
                    @update:modelValue="(value) => { 
                      // Преобразуем объект Date в строку YYYY-MM-DD
                      if (value instanceof Date) {
                        const year = value.getFullYear();
                        const month = String(value.getMonth() + 1).padStart(2, '0');
                        const day = String(value.getDate()).padStart(2, '0');
                        createFormState.end_date = `${year}-${month}-${day}`;
                      } else if (typeof value === 'string') {
                        createFormState.end_date = value;
                      } else {
                        createFormState.end_date = null;
                      }
                      isActive.value = false;
                      console.log('End date selected (create):', createFormState.end_date);
                    }"
                  />
                </template>
              </v-dialog>
            </v-col>
            <v-col cols="12" md="6">
              <v-dialog max-width="320">
                <template #activator="{ props }">
                  <v-text-field
                    v-model="createFormState.end_time"
                    label="Время завершения (опционально)"
                    variant="outlined"
                    prepend-inner-icon="mdi-clock-outline"
                    readonly
                    v-bind="props"
                    :disabled="!createFormState.end_date"
                  />
                </template>
                <template #default="{ isActive }">
                  <v-time-picker
                    v-model="createFormState.end_time"
                    format="24hr"
                    @update:modelValue="isActive.value = false"
                  />
                </template>
              </v-dialog>
            </v-col>
            <v-col cols="12" md="6" class="d-none">
              <v-text-field
                v-model="createFormState.latitude"
                type="number"
                label="Широта"
                variant="outlined"
                prepend-inner-icon="mdi-crosshairs-gps"
              />
            </v-col>
            <v-col cols="12" md="6" class="d-none">
              <v-text-field
                v-model="createFormState.longitude"
                type="number"
                label="Долгота"
                variant="outlined"
                prepend-inner-icon="mdi-crosshairs"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createFormState.contact_person"
                label="Контактное лицо"
                variant="outlined"
                prepend-inner-icon="mdi-account-tie"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createFormState.contact_phone"
                label="Телефон"
                variant="outlined"
                prepend-inner-icon="mdi-phone"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createFormState.contact_email"
                label="Email"
                variant="outlined"
                prepend-inner-icon="mdi-email-outline"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createFormState.contact_telegram"
                label="Telegram"
                variant="outlined"
                prepend-inner-icon="mdi-send"
                hint="Например: https://t.me/birqadam"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createFormState.info_url"
                label="Сайт / дополнительная информация"
                variant="outlined"
                prepend-inner-icon="mdi-web"
              />
            </v-col>
            <v-col cols="12">
              <v-file-input
                v-model="createFormState.cover_image"
                label="Обложка проекта"
                variant="outlined"
                prepend-icon="mdi-image"
                accept="image/*"
                show-size
              />
            </v-col>
          </v-row>
          <div class="d-flex flex-column flex-sm-row ga-3 mt-6">
            <v-btn
              color="primary"
              class="text-none font-weight-bold"
              size="large"
              type="submit"
              :loading="createLoading"
            >
              Отправить на модерацию
            </v-btn>
            <v-btn
              variant="text"
              color="primary"
              class="text-none font-weight-semibold"
              size="large"
              @click="closeCreateDialog"
            >
              Отменить
            </v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>

    <!-- Диалог редактирования проекта -->
    <v-dialog v-model="editDialog" max-width="720">
      <v-card class="create-dialog pa-6 pa-md-8">
        <div class="d-flex align-center ga-3 mb-4">
          <v-avatar color="primary" size="48">
            <v-icon icon="mdi-pencil" />
          </v-avatar>
          <div>
            <h2 class="text-h6 font-weight-bold mb-1">Редактировать проект</h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Измените информацию о проекте. Изменения будут сохранены сразу.
            </p>
          </div>
        </div>
        <v-form ref="editFormRef" @submit.prevent="submitEditProject">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editFormState.title"
                label="Название проекта"
                variant="outlined"
                prepend-inner-icon="mdi-format-title"
                :rules="[rules.required]"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editFormState.city"
                label="Город"
                variant="outlined"
                prepend-inner-icon="mdi-map-marker"
                :rules="[rules.required]"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="editFormState.address"
                label="Адрес / место проведения"
                variant="outlined"
                prepend-inner-icon="mdi-map-marker-outline"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="editFormState.description"
                label="Описание проекта"
                variant="outlined"
                rows="4"
                prepend-inner-icon="mdi-text-box-outline"
                :rules="[rules.required]"
                auto-grow
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="editFormState.volunteer_type"
                :items="volunteerTypeOptions"
                item-title="title"
                item-value="value"
                label="Тип волонтёрства"
                variant="outlined"
                prepend-inner-icon="mdi-account-heart-outline"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-combobox
                v-model="editFormState.tags"
                label="Теги"
                variant="outlined"
                multiple
                chips
                small-chips
                prepend-inner-icon="mdi-tag"
                hint="Например: #экология, #уборка"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-dialog max-width="320">
                <template #activator="{ props }">
                  <v-text-field
                    v-model="editFormState.start_date"
                    label="Дата начала (опционально)"
                    variant="outlined"
                    prepend-inner-icon="mdi-calendar-start"
                    readonly
                    v-bind="props"
                  />
                </template>
                <template #default="{ isActive }">
                  <v-date-picker
                    v-model="editFormState.start_date"
                    @update:modelValue="(value) => { 
                      // Преобразуем объект Date в строку YYYY-MM-DD
                      if (value instanceof Date) {
                        const year = value.getFullYear();
                        const month = String(value.getMonth() + 1).padStart(2, '0');
                        const day = String(value.getDate()).padStart(2, '0');
                        editFormState.start_date = `${year}-${month}-${day}`;
                      } else if (typeof value === 'string') {
                        editFormState.start_date = value;
                      } else {
                        editFormState.start_date = null;
                      }
                      isActive.value = false;
                    }"
                  />
                </template>
              </v-dialog>
            </v-col>
            <v-col cols="12" md="6">
              <v-dialog max-width="320">
                <template #activator="{ props }">
                  <v-text-field
                    v-model="editFormState.start_time"
                    label="Время начала (опционально)"
                    variant="outlined"
                    prepend-inner-icon="mdi-clock-outline"
                    readonly
                    v-bind="props"
                    :disabled="!editFormState.start_date"
                  />
                </template>
                <template #default="{ isActive }">
                  <v-time-picker
                    v-model="editFormState.start_time"
                    format="24hr"
                    @update:modelValue="isActive.value = false"
                  />
                </template>
              </v-dialog>
            </v-col>
            <v-col cols="12" md="6">
              <v-dialog max-width="320">
                <template #activator="{ props }">
                  <v-text-field
                    v-model="editFormState.end_date"
                    label="Дата завершения (опционально)"
                    variant="outlined"
                    prepend-inner-icon="mdi-calendar-end"
                    readonly
                    v-bind="props"
                  />
                </template>
                <template #default="{ isActive }">
                  <v-date-picker
                    v-model="editFormState.end_date"
                    @update:modelValue="(value) => { 
                      // Преобразуем объект Date в строку YYYY-MM-DD
                      if (value instanceof Date) {
                        const year = value.getFullYear();
                        const month = String(value.getMonth() + 1).padStart(2, '0');
                        const day = String(value.getDate()).padStart(2, '0');
                        editFormState.end_date = `${year}-${month}-${day}`;
                      } else if (typeof value === 'string') {
                        editFormState.end_date = value;
                      } else {
                        editFormState.end_date = null;
                      }
                      isActive.value = false;
                      console.log('End date selected:', editFormState.end_date);
                    }"
                  />
                </template>
              </v-dialog>
            </v-col>
            <v-col cols="12" md="6">
              <v-dialog max-width="320">
                <template #activator="{ props }">
                  <v-text-field
                    v-model="editFormState.end_time"
                    label="Время завершения (опционально)"
                    variant="outlined"
                    prepend-inner-icon="mdi-clock-outline"
                    readonly
                    v-bind="props"
                    :disabled="!editFormState.end_date"
                  />
                </template>
                <template #default="{ isActive }">
                  <v-time-picker
                    v-model="editFormState.end_time"
                    format="24hr"
                    @update:modelValue="isActive.value = false"
                  />
                </template>
              </v-dialog>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editFormState.latitude"
                type="number"
                label="Широта"
                variant="outlined"
                prepend-inner-icon="mdi-crosshairs-gps"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editFormState.longitude"
                type="number"
                label="Долгота"
                variant="outlined"
                prepend-inner-icon="mdi-crosshairs"
              />
            </v-col>
            <v-col cols="12" class="d-flex flex-wrap ga-3">
              <v-btn
                variant="tonal"
                color="primary"
                class="text-none font-weight-semibold"
                @click="detectCoordinatesForEdit"
                :loading="geolocationLoading"
                :disabled="!geolocationSupported || geolocationLoading"
              >
                Определить по текущему местоположению
              </v-btn>
              <v-btn
                variant="tonal"
                color="primary"
                class="text-none font-weight-semibold"
                @click="geocodeAddressForEdit"
                :loading="geolocationLoading"
                :disabled="geolocationLoading || !editFormState.city"
              >
                Определить по адресу
              </v-btn>
            </v-col>
            <v-col cols="12" v-if="editMapPreviewUrl">
              <v-responsive aspect-ratio="16/9" class="map-preview rounded-lg">
                <iframe
                  :src="editMapPreviewUrl"
                  frameborder="0"
                  allowfullscreen
                  loading="lazy"
                  referrerpolicy="no-referrer-when-downgrade"
                />
              </v-responsive>
              <p class="text-caption text-medium-emphasis mt-2 mb-0">
                Проверьте, что карта показывает нужное место. При необходимости уточните адрес или координаты.
              </p>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editFormState.contact_person"
                label="Контактное лицо"
                variant="outlined"
                prepend-inner-icon="mdi-account-tie"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editFormState.contact_phone"
                label="Телефон"
                variant="outlined"
                prepend-inner-icon="mdi-phone"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editFormState.contact_email"
                label="Email"
                variant="outlined"
                prepend-inner-icon="mdi-email-outline"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editFormState.contact_telegram"
                label="Telegram"
                variant="outlined"
                prepend-inner-icon="mdi-send"
                hint="Например: https://t.me/birqadam"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editFormState.info_url"
                label="Сайт / дополнительная информация"
                variant="outlined"
                prepend-inner-icon="mdi-web"
              />
            </v-col>
            <v-col cols="12">
              <v-file-input
                v-model="editFormState.cover_image"
                label="Обложка проекта"
                variant="outlined"
                prepend-inner-icon="mdi-image-outline"
                accept="image/*"
                hint="Загрузите изображение для обложки проекта"
                persistent-hint
              />
            </v-col>
          </v-row>
          <v-card-actions class="pa-0 mt-4">
            <v-spacer />
            <v-btn variant="text" class="text-none" @click="closeEditDialog">Отмена</v-btn>
            <v-btn
              color="primary"
              variant="flat"
              class="text-none font-weight-semibold"
              type="submit"
              :loading="editLoading"
            >
              Сохранить изменения
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <!-- Диалог удаления проекта -->
    <v-dialog v-model="deleteDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h6 font-weight-bold">
          {{ projectToDelete?.status === 'pending' ? 'Отозвать проект?' : 'Удалить проект?' }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-1 mb-2">
            Вы уверены, что хотите {{ projectToDelete?.status === 'pending' ? 'отозвать' : 'удалить' }} проект <strong>{{ projectToDelete?.title }}</strong>?
          </p>
          <p class="text-body-2 text-medium-emphasis" v-if="projectToDelete?.status === 'pending'">
            Проект будет удалён и больше не будет виден волонтёрам. Это действие нельзя отменить.
          </p>
          <p class="text-body-2 text-medium-emphasis" v-else>
            Проект будет удалён. Если в проекте есть активные волонтёры или задачи, они также будут затронуты. Это действие нельзя отменить.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" class="text-none" @click="closeDeleteDialog" :disabled="deleteLoading">
            Отмена
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            class="text-none font-weight-semibold"
            @click="submitDeleteProject"
            :loading="deleteLoading"
          >
            {{ projectToDelete?.status === 'pending' ? 'Отозвать проект' : 'Удалить проект' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.projects-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.projects-card {
  padding: clamp(24px, 4vw, 40px);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.96), rgba(244, 247, 253, 0.98));
}

.project-card {
  padding: 20px;
  background: #ffffff;
  border: 1px solid rgba(33, 33, 33, 0.05);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.project-card:hover {
  box-shadow: 0 16px 32px rgba(139, 195, 74, 0.15); /* BirQadam primary */
  transform: translateY(-4px);
}

.empty-state {
  padding: 32px;
  text-align: center;
  background: linear-gradient(150deg, rgba(139, 195, 74, 0.08), rgba(227, 121, 77, 0.08)); /* BirQadam colors */
}

.roadmap-card {
  padding: clamp(24px, 4vw, 36px);
  background: linear-gradient(160deg, rgba(139, 195, 74, 0.08), rgba(227, 121, 77, 0.08)); /* BirQadam colors */
}

.roadmap-card__steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.roadmap-card__step {
  border: 1px dashed rgba(139, 195, 74, 0.25); /* BirQadam primary */
}

.roadmap-card__list {
  margin: 0;
  padding-left: 20px;
  color: rgba(33, 33, 33, 0.72);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.roadmap-card__list li {
  font-size: 0.95rem;
  line-height: 1.5;
}

.create-dialog {
  border-radius: 28px;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.98), rgba(236, 245, 255, 0.96));
}

:deep(.v-picker-title) {
  display: none;
}

.project-card .link {
  color: inherit;
  text-decoration: none;
}

.project-card .link:hover {
  text-decoration: underline;
}

.contact-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.map-preview iframe {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: inherit;
}
</style>


