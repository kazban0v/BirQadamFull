<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { VForm } from 'vuetify/components';

import { useOrganizerStore } from '@/stores/organizer';

const organizerStore = useOrganizerStore();

const isOrganizer = computed(() => organizerStore.isOrganizer);
const isApproved = computed(() => organizerStore.isApproved);

const statusOptions = [
  { label: 'Все', value: 'all' as const },
  { label: 'На проверке', value: 'pending' as const },
  { label: 'Одобренные', value: 'approved' as const },
  { label: 'Отклонённые', value: 'rejected' as const },
];

const selectedStatus = ref<'all' | 'pending' | 'approved' | 'rejected'>(organizerStore.photoStatus);
const selectedProjectId = ref<number | null>(organizerStore.photoProjectFilter ?? null);

watch(
  () => organizerStore.photoStatus,
  (value) => {
    selectedStatus.value = value;
  },
  { immediate: true },
);

watch(
  () => organizerStore.photoProjectFilter,
  (value) => {
    selectedProjectId.value = value ?? null;
  },
  { immediate: true },
);

const snackbar = reactive({
  show: false,
  color: 'success',
  message: '',
});

const detailDialog = reactive({
  open: false,
  photoId: null as number | null,
  slide: 0,
});

const approveDialog = reactive({
  open: false,
  photoId: null as number | null,
  rating: 5,
  feedback: '',
  error: '',
});

const rejectDialog = reactive({
  open: false,
  photoId: null as number | null,
  feedback: '',
  error: '',
});

const rejectFormRef = ref<VForm | null>(null);
const rejectRules = [(value: string) => !!value?.trim() || 'Укажите причину отклонения.'];

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return dateTimeFormatter.format(new Date(value));
}

function formatTime(value: string | null | undefined) {
  if (!value) return null;
  return timeFormatter.format(new Date(`1970-01-01T${value}`));
}

function handleStatusChange(value: 'all' | 'pending' | 'approved' | 'rejected') {
  if (selectedStatus.value === value && organizerStore.photoReports.length) return;
  selectedStatus.value = value;
  organizerStore.loadPhotoReports({
    status: value,
    projectId: selectedProjectId.value,
    offset: 0,
    force: true,
  });
}

function handleProjectChange(value: number | null) {
  if (selectedProjectId.value === value && organizerStore.photoReports.length) return;
  selectedProjectId.value = value;
  organizerStore.loadPhotoReports({
    status: selectedStatus.value,
    projectId: value,
    offset: 0,
    force: true,
  });
}

async function openPhotoDetail(photoId: number) {
  detailDialog.photoId = photoId;
  detailDialog.open = true;
  detailDialog.slide = 0;
  try {
    await organizerStore.ensurePhotoDetail(photoId);
  } catch (error) {
    // Ошибка уже сохранена в состоянии стора
  }
}

function closePhotoDetail() {
  detailDialog.open = false;
  detailDialog.photoId = null;
  detailDialog.slide = 0;
}

function openApproveDialog(photoId: number) {
  approveDialog.open = true;
  approveDialog.photoId = photoId;
  approveDialog.rating = 5;
  approveDialog.feedback = '';
  approveDialog.error = '';
}

async function submitApprove(skip = false) {
  if (!approveDialog.photoId) return;
  approveDialog.error = '';

  if (!skip) {
    if (!approveDialog.rating) {
      approveDialog.error = 'Выберите оценку от 1 до 5.';
      return;
    }
    if (approveDialog.rating <= 3 && !approveDialog.feedback.trim()) {
      approveDialog.error = 'Для оценки 1–3 звезды добавьте комментарий.';
      return;
    }
  }

  try {
    await organizerStore.approvePhotoReport(approveDialog.photoId, {
      skip,
      rating: skip ? undefined : approveDialog.rating,
      feedback: approveDialog.feedback.trim() || undefined,
    });
    approveDialog.open = false;
    snackbar.message = skip ? 'Фото одобрено без оценки.' : 'Фото одобрено.';
    snackbar.color = skip ? 'primary' : 'success';
    snackbar.show = true;
  } catch (error: any) {
    approveDialog.error =
      error?.response?.data?.error || error?.message || 'Не удалось одобрить фото. Попробуйте еще раз.';
  }
}

function openRejectDialog(photoId: number) {
  rejectDialog.open = true;
  rejectDialog.photoId = photoId;
  rejectDialog.feedback = '';
  rejectDialog.error = '';
}

async function submitReject() {
  if (!rejectDialog.photoId) return;
  rejectDialog.error = '';
  const { valid } = (await rejectFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  try {
    await organizerStore.rejectPhotoReport(rejectDialog.photoId, rejectDialog.feedback.trim());
    rejectDialog.open = false;
    snackbar.message = 'Фото отклонено и волонтёр уведомлён.';
    snackbar.color = 'info';
    snackbar.show = true;
  } catch (error: any) {
    rejectDialog.error =
      error?.response?.data?.error || error?.message || 'Не удалось отклонить фото. Попробуйте еще раз.';
  }
}

const currentDetail = computed(() =>
  detailDialog.photoId ? organizerStore.photoDetails[detailDialog.photoId] : null,
);
const currentDetailLoading = computed(() =>
  detailDialog.photoId ? !!organizerStore.photoDetailsLoading[detailDialog.photoId] : false,
);
const currentDetailError = computed(() =>
  detailDialog.photoId ? organizerStore.photoDetailsError[detailDialog.photoId] : null,
);

const projectOptions = computed(() =>
  organizerStore.projects.map((project) => ({
    title: project.title,
    value: project.id,
    subtitle: `${project.city} • ${project.volunteer_count} волонтёров • ${project.task_count} задач`,
  })),
);

const photoReports = computed(() => organizerStore.photoReports);
const photoLoading = computed(() => organizerStore.photoLoading);
const photoError = computed(() => organizerStore.photoError);
const counters = computed(() => organizerStore.photoCounters);
const hasPhotos = computed(() => photoReports.value.length > 0);

const photoActionLoading = (photoId: number) => organizerStore.photoActionLoading[photoId] ?? false;
const photoActionError = (photoId: number) => organizerStore.photoActionError[photoId];

const canSubmitApproval = computed(() => {
  if (!approveDialog.photoId) return false;
  // Если оценка выбрана (от 1 до 5)
  if (approveDialog.rating != null && approveDialog.rating >= 1 && approveDialog.rating <= 5) {
    // Для оценки 1-3 требуется комментарий
    if (approveDialog.rating <= 3 && !approveDialog.feedback.trim()) return false;
    return true;
  }
  return false;
});

function statusCount(value: 'all' | 'pending' | 'approved' | 'rejected') {
  if (value === 'all') return counters.value.total;
  return counters.value[value];
}

function refreshList() {
  organizerStore.refreshPhotoReports();
}

onMounted(async () => {
  if (!organizerStore.isOrganizer) return;
  await organizerStore.loadProjects();
  await organizerStore.loadPhotoReports({ force: true });
});

watch(
  () => detailDialog.open,
  (open) => {
    if (!open) {
      detailDialog.slide = 0;
    }
  },
);
</script>

<template>
  <div class="photos-view">
    <v-row class="ga-6">
      <v-col cols="12" lg="8">
        <v-card class="photos-card" rounded="xl" elevation="6">
          <div class="photos-card__header">
            <div>
              <h1 class="text-h5 font-weight-bold mb-1">Модерация фотоотчётов</h1>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Проверяйте фото, оставляйте обратную связь и оценивайте работу волонтёров в пару кликов.
              </p>
            </div>
            <v-btn
              icon="mdi-refresh"
              variant="text"
              color="primary"
              :loading="photoLoading"
              @click="refreshList"
            />
          </div>

          <v-divider class="my-5" />

          <template v-if="!isOrganizer">
            <v-alert type="error" variant="tonal" border="start" title="Недостаточно прав" class="mb-4">
              Управление фотоотчётами доступно только организаторам проектов.
            </v-alert>
          </template>

          <template v-else>
            <v-alert
              v-if="!isApproved"
              type="info"
              variant="tonal"
              border="start"
              class="mb-6"
              title="Доступ появится после одобрения"
            >
              После модерации заявки вы сможете подтверждать фотоотчёты волонтёров из веб-портала так же, как в Telegram.
            </v-alert>

            <div v-else class="photos-card__content">
              <div class="filters">
                <v-chip-group
                  class="filters__statuses"
                  column
                  :model-value="selectedStatus"
                  @update:model-value="handleStatusChange"
                >
                  <v-chip
                    v-for="option in statusOptions"
                    :key="option.value"
                    :value="option.value"
                    class="text-none font-weight-semibold"
                    :color="
                      option.value === 'pending'
                        ? 'deep-orange'
                        : option.value === 'approved'
                          ? 'success'
                          : option.value === 'rejected'
                            ? 'error'
                            : 'primary'
                    "
                    variant="flat"
                  >
                    {{ option.label }}
                    <span class="chip-counter">{{ statusCount(option.value) }}</span>
                  </v-chip>
                </v-chip-group>

                <v-select
                  v-model="selectedProjectId"
                  :items="projectOptions"
                  label="Фильтр по проекту"
                  variant="outlined"
                  density="comfortable"
                  clearable
                  @update:model-value="handleProjectChange"
                />
              </div>

              <v-alert v-if="photoError" type="error" variant="tonal" border="start" class="mb-4">
                {{ photoError }}
              </v-alert>

              <v-skeleton-loader
                v-else-if="photoLoading && !hasPhotos"
                type="list-item-avatar-three-line, image, list-item-two-line"
                class="mb-4"
              />

              <div v-else>
                <v-row v-if="hasPhotos" class="ga-4">
                  <v-col
                    v-for="photo in photoReports"
                    :key="photo.id"
                    cols="12"
                    md="6"
                    xl="4"
                  >
                    <v-card class="photo-card" variant="text" border rounded="lg">
                      <div class="photo-card__media">
                        <v-img
                          v-if="photo.image_url"
                          :src="photo.image_url"
                          aspect-ratio="4/3"
                          cover
                          class="rounded-lg"
                        />
                        <div v-else class="photo-card__placeholder">
                          <v-icon icon="mdi-image-off-outline" size="36" />
                          <span>Изображение недоступно</span>
                        </div>
                        <v-chip
                          class="photo-card__status text-none"
                          :color="
                            photo.status === 'pending'
                              ? 'deep-orange'
                              : photo.status === 'approved'
                                ? 'success'
                                : 'error'
                          "
                          variant="flat"
                        >
                          {{
                            photo.status === 'pending'
                              ? 'На проверке'
                              : photo.status === 'approved'
                                ? 'Одобрено'
                                : 'Отклонено'
                          }}
                        </v-chip>
                      </div>

                      <div class="photo-card__body">
                        <div class="photo-card__header">
                          <div>
                            <h3 class="text-subtitle-1 font-weight-semibold mb-1">
                              {{ photo.volunteer.name }}
                            </h3>
                            <div class="text-body-2 text-medium-emphasis">
                              {{ photo.project.title }}
                              <span v-if="photo.project.city">• {{ photo.project.city }}</span>
                            </div>
                          </div>
                          <div class="photo-card__rating" v-if="photo.rating">
                            <v-icon icon="mdi-star" color="amber" size="20" />
                            <span>{{ photo.rating }}/5</span>
                          </div>
                        </div>

                        <div class="photo-card__section">
                          <div class="photo-card__row">
                            <v-icon icon="mdi-clipboard-text-outline" size="18" class="me-1" />
                            <span class="text-body-2 text-truncate">
                              {{ photo.task.text || 'Без задания' }}
                            </span>
                          </div>
                          <div class="photo-card__row">
                            <v-icon icon="mdi-clock-outline" size="18" class="me-1" />
                            <span class="text-body-2">
                              {{ formatDate(photo.task.deadline_date) }}
                              <template v-if="formatTime(photo.task.start_time)">
                                • {{ formatTime(photo.task.start_time) }}–{{ formatTime(photo.task.end_time) }}
                              </template>
                            </span>
                          </div>
                          <div class="photo-card__row">
                            <v-icon icon="mdi-calendar" size="18" class="me-1" />
                            <span class="text-body-2 text-medium-emphasis">
                              Загружено: {{ formatDateTime(photo.uploaded_at) }}
                            </span>
                          </div>
                        </div>

                        <v-sheet
                          v-if="photo.volunteer_comment"
                          class="photo-card__comment"
                          color="primary-lighten-5"
                          rounded="lg"
                          border
                        >
                          <span class="text-caption text-medium-emphasis d-block mb-1">Комментарий волонтёра</span>
                          <p class="text-body-2 mb-0">
                            {{ photo.volunteer_comment }}
                          </p>
                        </v-sheet>

                        <v-sheet
                          v-if="photo.organizer_comment && photo.status === 'approved'"
                          class="photo-card__comment"
                          color="success-lighten-5"
                          rounded="lg"
                          border
                        >
                          <span class="text-caption text-medium-emphasis d-block mb-1">Ваш комментарий</span>
                          <p class="text-body-2 mb-0">
                            {{ photo.organizer_comment }}
                          </p>
                        </v-sheet>

                        <v-sheet
                          v-if="photo.rejection_reason && photo.status === 'rejected'"
                          class="photo-card__comment"
                          color="error-lighten-5"
                          rounded="lg"
                          border
                        >
                          <span class="text-caption text-medium-emphasis d-block mb-1">Причина отклонения</span>
                          <p class="text-body-2 mb-0">
                            {{ photo.rejection_reason }}
                          </p>
                        </v-sheet>

                        <v-alert
                          v-if="photoActionError(photo.id)"
                          type="error"
                          variant="tonal"
                          border="start"
                          density="compact"
                          class="mt-3"
                        >
                          {{ photoActionError(photo.id) }}
                        </v-alert>
                      </div>

                      <v-divider />

                      <div class="photo-card__actions">
                        <v-btn
                          variant="text"
                          color="primary"
                          class="text-none font-weight-semibold"
                          @click="openPhotoDetail(photo.id)"
                        >
                          Смотреть
                        </v-btn>
                        <div class="photo-card__actions-buttons">
                          <template v-if="photo.status === 'pending'">
                            <v-btn
                              color="success"
                              class="text-none"
                              variant="flat"
                              size="small"
                              :loading="photoActionLoading(photo.id)"
                              @click="openApproveDialog(photo.id)"
                            >
                              Одобрить
                            </v-btn>
                            <v-btn
                              color="error"
                              class="text-none"
                              variant="tonal"
                              size="small"
                              :loading="photoActionLoading(photo.id)"
                              @click="openRejectDialog(photo.id)"
                            >
                              Отклонить
                            </v-btn>
                          </template>
                          <template v-else>
                            <v-chip
                              color="success"
                              variant="tonal"
                              size="small"
                              v-if="photo.status === 'approved'"
                            >
                              Одобрено
                            </v-chip>
                            <v-chip
                              color="error"
                              variant="tonal"
                              size="small"
                              v-else
                            >
                              Отклонено
                            </v-chip>
                          </template>
                        </div>
                      </div>
                    </v-card>
                  </v-col>
                </v-row>

                <v-sheet v-else class="empty-state" rounded="lg" border>
                  <v-icon icon="mdi-image-multiple-outline" size="40" color="deep-orange" class="mb-3" />
                  <h3 class="text-subtitle-1 font-weight-semibold mb-2">Фотоотчётов пока нет</h3>
                  <p class="text-body-2 text-medium-emphasis mb-0">
                    Волонтёры ещё не отправили фото с заданиями. Как только они появятся, вы увидите их здесь и
                    сможете оперативно отреагировать.
                  </p>
                </v-sheet>
              </div>
            </div>
          </template>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card class="tips-card" rounded="xl" elevation="6">
          <div class="tips-card__header">
            <v-avatar color="deep-orange" size="48">
              <v-icon icon="mdi-lightbulb-on-outline" />
            </v-avatar>
            <div>
              <h2 class="text-h6 font-weight-bold mb-1">Лучшие практики модерации</h2>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Советы, которые помогают поддерживать высокий стандарт качества отчётов.
              </p>
            </div>
          </div>

          <v-divider class="my-4" />

          <ul class="tips-card__list">
            <li>
              <h3>Давайте обратную связь</h3>
              <p>Спасибо и короткий комментарий поднимают мотивацию и вовлечённость волонтёров.</p>
            </li>
            <li>
              <h3>Используйте рейтинги</h3>
              <p>Оценка 4–5 звёзд ускоряет рост рейтинга и открывает волонтёрам новые возможности в проектах.</p>
            </li>
            <li>
              <h3>Фиксируйте причины отказа</h3>
              <p>Чёткое объяснение помогает волонтёру исправить отчёт и избежать повторных ошибок.</p>
            </li>
            <li>
              <h3>Следите за дедлайнами</h3>
              <p>Проверенные фото автоматически закрывают задачи и обновляют статистику проекта и команды.</p>
            </li>
          </ul>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="detailDialog.open" max-width="720">
      <v-card class="detail-dialog" rounded="xl">
        <v-card-title class="d-flex align-center justify-space-between">
          <div>
            <div class="text-subtitle-1 font-weight-semibold">
              {{ currentDetail?.volunteer_name || 'Фотоотчёт' }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              {{ currentDetail?.project_title }}
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="closePhotoDetail" />
        </v-card-title>

        <v-divider />

        <v-card-text>
          <v-skeleton-loader
            v-if="currentDetailLoading"
            type="image, list-item-three-line"
          />

          <v-alert
            v-else-if="currentDetailError"
            type="error"
            variant="tonal"
            border="start"
            class="mb-0"
          >
            {{ currentDetailError }}
          </v-alert>

          <div v-else-if="currentDetail" class="detail-dialog__content">
            <v-window v-model="detailDialog.slide" class="detail-dialog__window">
              <v-window-item
                v-for="(item, index) in currentDetail.photos"
                :key="item.id"
                :value="index"
              >
                <v-img
                  v-if="item.image_url"
                  :src="item.image_url"
                  aspect-ratio="4/3"
                  rounded="lg"
                  cover
                />
                <div v-else class="detail-dialog__placeholder">
                  <v-icon icon="mdi-image-off-outline" size="40" />
                  <span>Изображение недоступно</span>
                </div>
              </v-window-item>
            </v-window>

            <div class="detail-dialog__thumbnails" v-if="currentDetail.photos.length > 1">
              <v-avatar
                v-for="(item, index) in currentDetail.photos"
                :key="`thumb-${item.id}`"
                :color="detailDialog.slide === index ? 'primary' : undefined"
                class="detail-dialog__thumbnail"
                size="56"
                rounded="lg"
                @click="detailDialog.slide = index"
              >
                <v-img
                  v-if="item.image_url"
                  :src="item.image_url"
                  cover
                />
                <v-icon v-else icon="mdi-image-off-outline" />
              </v-avatar>
            </div>

            <div class="detail-dialog__meta">
              <div class="detail-dialog__meta-row">
                <span class="text-medium-emphasis">Задача:</span>
                <span>{{ currentDetail.task_text || 'Без задания' }}</span>
              </div>
              <div class="detail-dialog__meta-row">
                <span class="text-medium-emphasis">Статус:</span>
                <span>
                  {{
                    currentDetail.status === 'pending'
                      ? 'На проверке'
                      : currentDetail.status === 'approved'
                        ? 'Одобрено'
                        : 'Отклонено'
                  }}
                </span>
              </div>
              <div class="detail-dialog__meta-row">
                <span class="text-medium-emphasis">Загружено:</span>
                <span>{{ formatDateTime(currentDetail.uploaded_at) }}</span>
              </div>
              <div class="detail-dialog__meta-row" v-if="currentDetail.moderated_at">
                <span class="text-medium-emphasis">Проверено:</span>
                <span>{{ formatDateTime(currentDetail.moderated_at) }}</span>
              </div>
              <div class="detail-dialog__meta-row" v-if="currentDetail.rating">
                <span class="text-medium-emphasis">Оценка:</span>
                <span>{{ currentDetail.rating }}/5</span>
              </div>
            </div>

            <v-sheet
              v-if="currentDetail.volunteer_comment"
              class="detail-dialog__note"
              color="primary-lighten-5"
              rounded="lg"
              border
            >
              <span class="text-caption text-medium-emphasis d-block mb-1">Комментарий волонтёра</span>
              <p class="text-body-2 mb-0">
                {{ currentDetail.volunteer_comment }}
              </p>
            </v-sheet>

            <v-sheet
              v-if="currentDetail.organizer_comment"
              class="detail-dialog__note"
              color="success-lighten-5"
              rounded="lg"
              border
            >
              <span class="text-caption text-medium-emphasis d-block mb-1">Ваш комментарий</span>
              <p class="text-body-2 mb-0">
                {{ currentDetail.organizer_comment }}
              </p>
            </v-sheet>

            <v-sheet
              v-if="currentDetail.rejection_reason"
              class="detail-dialog__note"
              color="error-lighten-5"
              rounded="lg"
              border
            >
              <span class="text-caption text-medium-emphasis d-block mb-1">Причина отклонения</span>
              <p class="text-body-2 mb-0">
                {{ currentDetail.rejection_reason }}
              </p>
            </v-sheet>
          </div>
        </v-card-text>

        <v-divider />

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" color="primary" class="text-none font-weight-semibold" @click="closePhotoDetail">
            Закрыть
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="approveDialog.open" max-width="420">
      <v-card rounded="xl">
        <v-card-title class="font-weight-semibold">Оценка фото</v-card-title>
        <v-card-text class="pt-0">
          <p class="text-body-2 text-medium-emphasis mb-4">
            Выберите оценку, как в Telegram. Для низких оценок добавьте комментарий, чтобы волонтёр понял, что улучшить.
          </p>
          <div class="d-flex justify-center mb-4">
            <v-rating
              v-model="approveDialog.rating"
              length="5"
              color="amber"
              active-color="amber"
              size="36"
            />
          </div>
          <v-textarea
            v-model="approveDialog.feedback"
            label="Комментарий"
            variant="outlined"
            rows="3"
            auto-grow
            counter="400"
            maxlength="400"
            hint="Комментарий обязателен для оценки 1–3 звезды"
          />
          <v-alert
            v-if="approveDialog.error"
            type="error"
            variant="tonal"
            border="start"
            density="compact"
            class="mt-3"
          >
            {{ approveDialog.error }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="px-6 pb-5 d-flex flex-column ga-3">
          <v-btn
            block
            color="success"
            variant="flat"
            size="large"
            class="text-none font-weight-semibold"
            :disabled="!canSubmitApproval"
            :loading="approveDialog.photoId ? photoActionLoading(approveDialog.photoId) : false"
            @click="submitApprove(false)"
          >
            <v-icon icon="mdi-check-circle" start />
            Подтвердить
          </v-btn>
          <div class="d-flex ga-3">
            <v-btn
              block
              variant="tonal"
              color="primary"
              class="text-none font-weight-semibold"
              :loading="approveDialog.photoId ? photoActionLoading(approveDialog.photoId) : false"
              @click="submitApprove(true)"
            >
              Одобрить без оценки
            </v-btn>
            <v-btn
              block
              variant="text"
              color="primary"
              class="text-none font-weight-semibold"
              @click="approveDialog.open = false"
            >
              Отмена
            </v-btn>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="rejectDialog.open" max-width="420">
      <v-card rounded="xl">
        <v-card-title class="font-weight-semibold">Причина отклонения</v-card-title>
        <v-card-text class="pt-0">
          <p class="text-body-2 text-medium-emphasis mb-3">
            Укажите, чего не хватает в отчёте. Волонтёр получит уведомление и сможет оперативно отправить исправления.
          </p>
          <v-form ref="rejectFormRef" @submit.prevent="submitReject">
            <v-textarea
              v-model="rejectDialog.feedback"
              label="Комментарий волонтёру"
              variant="outlined"
              rows="4"
              auto-grow
              counter="400"
              maxlength="400"
              :rules="rejectRules"
              required
            />
          </v-form>
          <v-alert
            v-if="rejectDialog.error"
            type="error"
            variant="tonal"
            border="start"
            density="compact"
            class="mt-3"
          >
            {{ rejectDialog.error }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="px-6 pb-5 d-flex flex-column flex-sm-row ga-3">
          <v-btn
            block
            color="error"
            class="text-none font-weight-semibold"
            :loading="rejectDialog.photoId ? photoActionLoading(rejectDialog.photoId) : false"
            @click="submitReject"
          >
            Отклонить
          </v-btn>
          <v-btn
            block
            variant="text"
            color="primary"
            class="text-none font-weight-semibold"
            @click="rejectDialog.open = false"
          >
            Отмена
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.photos-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.photos-card {
  padding: clamp(24px, 5vw, 40px);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 224, 178, 0.9));
}

.photos-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.photos-card__content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (min-width: 960px) {
  .filters {
    flex-direction: row;
    align-items: flex-end;
  }
  .filters__statuses {
    flex: 1;
  }
}

.chip-counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  min-width: 22px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 0.75rem;
}

.photo-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  backdrop-filter: blur(6px);
  background-color: rgba(255, 255, 255, 0.8);
}

.photo-card__media {
  position: relative;
}

.photo-card__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 220px;
  border-radius: 16px;
  background: repeating-linear-gradient(
    135deg,
    rgba(255, 183, 77, 0.12),
    rgba(255, 183, 77, 0.12) 12px,
    rgba(255, 183, 77, 0.2) 12px,
    rgba(255, 183, 77, 0.2) 24px
  );
  color: rgba(255, 111, 0, 0.8);
  font-weight: 600;
}

.photo-card__status {
  position: absolute;
  left: 12px;
  bottom: 12px;
  backdrop-filter: blur(4px);
}

.photo-card__body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.photo-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.photo-card__rating {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  color: rgba(255, 179, 0, 0.95);
}

.photo-card__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.photo-card__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.photo-card__comment {
  padding: 12px 14px;
}

.photo-card__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
}

.photo-card__actions-buttons {
  display: flex;
  gap: 8px;
}

.empty-state {
  padding: 36px;
  text-align: center;
  background: rgba(255, 255, 255, 0.7);
}

.tips-card {
  padding: clamp(24px, 5vw, 36px);
  background: linear-gradient(160deg, rgba(255, 112, 67, 0.1), rgba(255, 204, 128, 0.18));
}

.tips-card__header {
  display: flex;
  gap: 16px;
  align-items: center;
}

.tips-card__list {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  list-style: none;
}

.tips-card__list h3 {
  margin: 0 0 4px;
  font-size: 0.95rem;
  font-weight: 600;
}

.tips-card__list p {
  margin: 0;
  color: rgba(33, 33, 33, 0.7);
}

.detail-dialog__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-dialog__window {
  border-radius: 16px;
  overflow: hidden;
}

.detail-dialog__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 280px;
  background: rgba(255, 183, 77, 0.12);
  color: rgba(255, 111, 0, 0.9);
  font-weight: 600;
}

.detail-dialog__thumbnails {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.detail-dialog__thumbnail {
  cursor: pointer;
  overflow: hidden;
}

.detail-dialog__meta {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.detail-dialog__meta-row {
  display: flex;
  gap: 8px;
  font-size: 0.95rem;
}

.detail-dialog__note {
  padding: 14px 16px;
}
</style>

