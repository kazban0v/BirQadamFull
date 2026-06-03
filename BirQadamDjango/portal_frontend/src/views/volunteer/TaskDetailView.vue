<script setup lang="ts">
import { computed, onMounted, reactive, ref, nextTick, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';

import { fetchTaskDetail, acceptTask, declineTask, completeTask, retryTask, type VolunteerTask } from '@/services/tasks';
import { uploadPhotoReport, fetchTaskPhotos, deletePhotoReport } from '@/services/photoReports';
import { useDashboardStore } from '@/stores/dashboard';

const route          = useRoute();
const router         = useRouter();
const dashboardStore = useDashboardStore();

const taskId = computed(() => Number(route.params.id));

const loading  = ref(false);
const task     = ref<VolunteerTask | null>(null);
const snackbar = reactive({ show: false, message: '', color: 'success' });

// ─── Status config ────────────────────────────────────────────────
const STATUS_MAP: Record<string, { text: string; color: string; bg: string }> = {
  open:         { text: 'Открыто',      color: '#1565c0', bg: 'rgba(21,101,192,0.1)'   },
  in_progress:  { text: 'В работе',     color: '#e65100', bg: 'rgba(230,81,0,0.1)'     },
  under_review: { text: 'На проверке',  color: '#6a1b9a', bg: 'rgba(106,27,154,0.1)'   },
  completed:    { text: 'Выполнено',    color: '#2e7d32', bg: 'rgba(46,125,50,0.1)'    },
  failed:       { text: 'Отклонено',    color: '#c62828', bg: 'rgba(198,40,40,0.1)'    },
  closed:       { text: 'Закрыто',      color: '#546e7a', bg: 'rgba(84,110,122,0.1)'   },
  revision:     { text: 'На доработке', color: '#f57c00', bg: 'rgba(255,152,0,0.1)'    },
  archived:     { text: 'В архиве',     color: '#37474f', bg: 'rgba(55,71,79,0.1)'     },
};

function statusCfg(s: string) {
  return STATUS_MAP[s] ?? { text: s, color: '#546e7a', bg: 'rgba(84,110,122,0.1)' };
}

// ─── Photo state ──────────────────────────────────────────────────
const photoFiles       = ref<File[]>([]);
const photoPreviews    = ref<string[]>([]);
const photoComment     = ref('');
const uploadingPhoto   = ref(false);
const withdrawingPhoto = ref(false);
const photoFormRef     = ref<VForm | null>(null);
const hasUploadedPhoto = ref(false);
const taskPhotos       = ref<any[]>([]);

// ─── Camera state ──────────────────────────────────────────────────
const showCameraDialog = ref(false);
const cameraStream     = ref<MediaStream | null>(null);
const videoRef         = ref<HTMLVideoElement | null>(null);
const canvasRef        = ref<HTMLCanvasElement | null>(null);

// ─── Formatters ───────────────────────────────────────────────────
const dateFmt     = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function formatDate(v: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}
function formatDateTime(v: string) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : dateTimeFmt.format(d);
}

function showSnackbar(msg: string, color = 'success') {
  Object.assign(snackbar, { message: msg, color, show: true });
}

// ─── Load ─────────────────────────────────────────────────────────
async function checkPhotoStatus() {
  if (!task.value) return;
  try {
    const res        = await fetchTaskPhotos(task.value.id);
    taskPhotos.value = res?.photos ?? [];
    hasUploadedPhoto.value = taskPhotos.value.length > 0;
  } catch {
    taskPhotos.value       = [];
    hasUploadedPhoto.value = false;
  }
}

async function loadTask(forceRefresh = false) {
  loading.value = true;
  try {
    task.value = await fetchTaskDetail(taskId.value, forceRefresh);
    if (!task.value) {
      showSnackbar('Задача не найдена.', 'error');
      router.push({ name: 'volunteer-tasks' });
      return;
    }
    await checkPhotoStatus();
  } catch (error: any) {
    if (error?.response?.status === 429) {
      showSnackbar('Слишком много запросов. Повторная попытка...', 'warning');
      if (!task.value) setTimeout(() => loadTask(false), 2000);
    } else {
      const msg = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить задачу.';
      showSnackbar(msg, 'error');
      if (!task.value) router.push({ name: 'volunteer-tasks' });
    }
  } finally {
    loading.value = false;
  }
}

// ─── Task actions ─────────────────────────────────────────────────
async function handleAcceptTask() {
  if (!task.value) return;
  loading.value = true;
  try {
    await acceptTask(task.value.id);
    showSnackbar('Вы успешно взялись за задачу!', 'success');
    await loadTask(true);
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    showSnackbar(error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось принять задачу.', 'error');
    if (error?.response?.status === 403 && error?.response?.data?.code === 'profile_incomplete') {
      router.push({ name: 'volunteer-profile', query: { complete: '1' } });
    }
  } finally { loading.value = false; }
}

async function handleDeclineTask() {
  if (!task.value) return;
  const wasAssigned = task.value.is_assigned;
  loading.value = true;
  try {
    await declineTask(task.value.id);
    showSnackbar(wasAssigned ? 'Вы отказались от задачи.' : 'Задача отклонена.', 'success');
    await loadTask(true);
    await dashboardStore.loadDashboard(true);
    if (wasAssigned) setTimeout(() => router.push({ name: 'volunteer-tasks' }), 1500);
  } catch (error: any) {
    showSnackbar(error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось отклонить задачу.', 'error');
  } finally { loading.value = false; }
}

async function handleCompleteTask() {
  if (!task.value) return;
  loading.value = true;
  try {
    await completeTask(task.value.id);
    showSnackbar('Задача отмечена как выполненная!', 'success');
    await loadTask(true);
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    showSnackbar(error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось отметить задачу.', 'error');
  } finally { loading.value = false; }
}

async function handleRetryTask() {
  if (!task.value) return;
  if (!confirm('Переделать задачу? Задача будет возвращена в статус "Открыто" и доступна для повторного выполнения.')) {
    return;
  }
  loading.value = true;
  try {
    await retryTask(task.value.id);
    showSnackbar('Задача переделана и доступна для выполнения!', 'success');
    await loadTask(true);
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    showSnackbar(error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось переделать задачу.', 'error');
  } finally { loading.value = false; }
}

// ─── Photo actions ────────────────────────────────────────────────
function handlePhotoSelect(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;
  
  const maxFiles = 5;
  const currentCount = photoFiles.value.length;
  const remainingSlots = maxFiles - currentCount;
  
  if (files.length > remainingSlots) {
    showSnackbar(`Можно загрузить максимум ${maxFiles} фотографий. Уже выбрано: ${currentCount}.`, 'error');
    const el = document.querySelector('#photo-input') as HTMLInputElement;
    if (el) el.value = '';
    return;
  }
  
  Array.from(files).slice(0, remainingSlots).forEach(file => {
    if (file.size > 10 * 1024 * 1024) {
      showSnackbar(`Файл ${file.name} превышает 10 МБ.`, 'error');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showSnackbar(`Файл ${file.name} не является изображением.`, 'error');
      return;
    }
    
    photoFiles.value.push(file);
    const reader = new FileReader();
    reader.onload = e => {
      if (e.target?.result) {
        photoPreviews.value.push(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  });
  
  const el = document.querySelector('#photo-input') as HTMLInputElement;
  if (el) el.value = '';
}

function removePhoto(index: number) {
  photoFiles.value.splice(index, 1);
  photoPreviews.value.splice(index, 1);
}

function removeAllPhotos() {
  photoFiles.value = [];
  photoPreviews.value = [];
  const el = document.querySelector('#photo-input') as HTMLInputElement;
  if (el) el.value = '';
}

// ─── Camera actions ────────────────────────────────────────────────
async function openCamera() {
  if (photoFiles.value.length >= 5) {
    showSnackbar('Можно загрузить максимум 5 фотографий.', 'error');
    return;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' }, 
      audio: false 
    });
    cameraStream.value = stream;
    showCameraDialog.value = true;
    await nextTick();
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
    }
  } catch (error: any) {
    showSnackbar('Не удалось получить доступ к камере. ' + (error.message || ''), 'error');
  }
}

function closeCamera() {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(track => track.stop());
    cameraStream.value = null;
  }
  showCameraDialog.value = false;
}

function capturePhoto() {
  if (!videoRef.value || !canvasRef.value) return;
  
  if (photoFiles.value.length >= 5) {
    showSnackbar('Можно загрузить максимум 5 фотографий.', 'error');
    return;
  }
  
  const video = videoRef.value;
  const canvas = canvasRef.value;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        photoFiles.value.push(file);
        photoPreviews.value.push(URL.createObjectURL(blob));
        closeCamera();
      }
    }, 'image/jpeg', 0.9);
  }
}

// Cleanup camera on unmount
onUnmounted(() => {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(track => track.stop());
    cameraStream.value = null;
  }
});

async function handleUploadPhoto() {
  if (!task.value || photoFiles.value.length === 0) return;
  const v = await photoFormRef.value?.validate();
  if (!v?.valid) return;
  
  if (photoFiles.value.length > 5) {
    showSnackbar('Можно загрузить максимум 5 фотографий за один отчёт.', 'error');
    return;
  }
  
  uploadingPhoto.value = true;
  try {
    // Загружаем все фото одним запросом
    await uploadPhotoReport(task.value.id, photoFiles.value, photoComment.value || undefined);
    showSnackbar(`Успешно загружено ${photoFiles.value.length} ${photoFiles.value.length === 1 ? 'фото' : 'фото'}!`, 'success');
    removeAllPhotos();
    photoComment.value     = '';
    hasUploadedPhoto.value = true;
    await loadTask(false);
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    showSnackbar(error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить фото.', 'error');
  } finally { uploadingPhoto.value = false; }
}

async function handleWithdrawPhoto() {
  if (!task.value) return;
  if (!confirm('Отозвать фотоотчёт? После этого вы сможете загрузить новый.')) return;
  withdrawingPhoto.value = true;
  try {
    const res = await deletePhotoReport(task.value.id);
    showSnackbar(res.message || 'Фотоотчёт отозван.', 'success');
    hasUploadedPhoto.value = false;
    taskPhotos.value       = [];
    removeAllPhotos();
    photoComment.value = '';
    await checkPhotoStatus();
    await loadTask(false);
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    showSnackbar(error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось отозвать фотоотчёт.', 'error');
  } finally { withdrawingPhoto.value = false; }
}

// ─── Permissions ──────────────────────────────────────────────────
// Задача в архиве — только просмотр, никаких действий
const isArchived = computed(() => task.value?.status === 'archived');
// Задача открыта и не взята
const canAccept = computed(() =>
  !isArchived.value && task.value?.status === 'open' && !task.value?.is_assigned,
);
// Взята и не завершена
const isActiveTask = computed(() =>
  !isArchived.value &&
  !!task.value?.is_assigned &&
  !['completed', 'failed', 'closed'].includes(task.value?.status ?? ''),
);
// Можно завершить — взята, не завершена, фото есть
const canComplete = computed(() => isActiveTask.value && hasUploadedPhoto.value);
// Можно загружать фото — взята, не завершена, фото ещё нет (или последнее фото отклонено)
const canUploadPhoto = computed(() => {
  if (!isActiveTask.value) return false;
  if (!hasUploadedPhoto.value) return true;
  const latestPhoto = taskPhotos.value[0];
  return latestPhoto && latestPhoto.status === 'rejected';
});
// Фотоотчёт уже загружен и задача активна
const showPhotoReport = computed(() => isActiveTask.value && hasUploadedPhoto.value);
// Завершена
const isCompleted = computed(() => task.value?.status === 'completed');
// Отклонена - можно переделать
const isFailed = computed(() => task.value?.status === 'failed');

onMounted(() => loadTask());
</script>

<template>
  <div class="task-detail">

    <!-- ─── Back ─── -->
    <button class="back-btn" @click="router.push({ name: 'volunteer-tasks' })">
      <v-icon icon="mdi-arrow-left" size="17" />
      Назад к задачам
    </button>

    <!-- ─── Skeleton ─── -->
    <div v-if="loading && !task" class="skeletons">
      <div class="skeleton-card"><v-skeleton-loader type="article" /></div>
      <div class="skeleton-card"><v-skeleton-loader type="list-item-three-line" /></div>
    </div>

    <template v-else-if="task">

      <!-- ═══ Task info ═══ -->
      <div class="card">

        <!-- Header: title + badges -->
        <div class="card__head">
          <h1 class="card__title">{{ task.text }}</h1>
          <div class="badge-row">
            <span class="badge" :style="{ color: statusCfg(task.status).color, background: statusCfg(task.status).bg }">
              {{ statusCfg(task.status).text }}
            </span>
            <span v-if="task.is_assigned" class="badge" style="color:#2e7d32; background:rgba(46,125,50,0.1)">
              <v-icon icon="mdi-check-circle" size="13" />
              Вы приняли задачу
            </span>
          </div>
        </div>

        <div class="divider" />

        <!-- Meta -->
        <div class="meta-grid">
          <div class="meta-row">
            <v-icon icon="mdi-briefcase-outline"       size="16" class="meta-row__ico" />
            <span><b>Проект:</b> {{ task.project_title }}</span>
          </div>
          <div class="meta-row">
            <v-icon icon="mdi-account-outline"         size="16" class="meta-row__ico" />
            <span><b>Создатель:</b> {{ task.creator_name }}</span>
          </div>
          <div class="meta-row">
            <v-icon icon="mdi-clock-outline"           size="16" class="meta-row__ico" />
            <span><b>Создано:</b> {{ formatDateTime(task.created_at) }}</span>
          </div>
          <div v-if="task.deadline_date" class="meta-row meta-row--warn">
            <v-icon icon="mdi-calendar-clock"          size="16" class="meta-row__ico" />
            <span><b>Срок:</b> {{ formatDate(task.deadline_date) }}</span>
          </div>
          <div v-if="task.start_time && task.end_time" class="meta-row">
            <v-icon icon="mdi-clock-time-four-outline" size="16" class="meta-row__ico" />
            <span><b>Время:</b> {{ task.start_time }} – {{ task.end_time }}</span>
          </div>
          <div class="meta-row">
            <v-icon icon="mdi-identifier"              size="16" class="meta-row__ico" />
            <span><b>ID задачи:</b> {{ task.id }}</span>
          </div>
        </div>
      </div>

      <!-- ═══ Archived: read-only banner ═══ -->
      <div v-if="isArchived" class="card">
        <div class="info-banner info-banner--archive">
          <v-icon icon="mdi-archive-outline" size="20" />
          <div>
            <div style="font-weight:800; margin-bottom:2px;">Задача в архиве</div>
            <div style="font-weight:400; opacity:0.8;">Проект был закрыт. Задача доступна только для просмотра — выполнять действия с ней невозможно.</div>
          </div>
        </div>
      </div>

      <!-- ═══ Revision warning banner ═══ -->
      <div v-if="task.status === 'revision'" class="card">
        <div class="info-banner info-banner--warn">
          <v-icon icon="mdi-alert-circle-outline" size="20" />
          <div>
            <div style="font-weight:800; margin-bottom:2px;">Задача на доработке</div>
            <div style="font-weight:400; opacity:0.8;">Ваш предыдущий фотоотчёт был отклонён организатором. Пожалуйста, учтите замечания и загрузите новый фотоотчёт.</div>
          </div>
        </div>
      </div>

      <!-- ═══ Actions ═══ -->
      <div v-if="!isArchived && (canAccept || (isActiveTask && task.status !== 'revision') || isCompleted)" class="card">
        <h2 class="card__sub">Действия с задачей</h2>

        <div class="actions">

          <!-- Open task: accept + decline -->
          <template v-if="canAccept">
            <button class="btn btn--green" :disabled="loading" @click="handleAcceptTask">
              <v-icon icon="mdi-check-circle-outline" size="17" />
              Принять задачу
            </button>
            <button class="btn btn--red-outline" :disabled="loading" @click="handleDeclineTask">
              <v-icon icon="mdi-close-circle-outline" size="17" />
              Отклонить
            </button>
          </template>

          <!-- Active task: decline (but not if in revision) -->
          <template v-else-if="isActiveTask && task.status !== 'revision'">
            <button v-if="!hasUploadedPhoto" class="btn btn--red-outline" :disabled="loading" @click="handleDeclineTask">
              <v-icon icon="mdi-close-circle-outline" size="17" />
              Отказаться от задачи
            </button>
            <button v-if="hasUploadedPhoto" class="btn btn--red-outline" :disabled="withdrawingPhoto || loading" @click="handleWithdrawPhoto">
              <v-icon :icon="withdrawingPhoto ? 'mdi-loading' : 'mdi-undo'" size="17" :class="{ spin: withdrawingPhoto }" />
              {{ withdrawingPhoto ? 'Отзываем...' : 'Отозвать фотоотчёт' }}
            </button>
          </template>

          <!-- Completed -->
          <div v-else-if="isCompleted" class="btn btn--done">
            <v-icon icon="mdi-check-circle" size="17" />
            Задача выполнена
          </div>

          <!-- Failed - можно переделать -->
          <template v-else-if="isFailed">
            <button class="btn btn--green" :disabled="loading" @click="handleRetryTask">
              <v-icon icon="mdi-refresh" size="17" />
              Переделать задачу
            </button>
            <div class="info-banner info-banner--warn" style="margin-top: 10px;">
              <v-icon icon="mdi-information-outline" size="17" />
              Задача была отклонена. Вы можете переделать её для повторного выполнения.
            </div>
          </template>

        </div>
      </div>

      <!-- ═══ Photo report (already uploaded, task active) ═══ -->
      <div v-if="showPhotoReport" class="card">
        <h2 class="card__sub">Фотоотчёт</h2>

        <div class="info-banner info-banner--green">
          <v-icon icon="mdi-image-check-outline" size="17" />
          Вы уже отправили фотоотчёт по этой задаче
        </div>

        <div class="photo-list">
          <div v-for="photo in taskPhotos" :key="photo.id" class="photo-item">
            <div class="photo-item__top">
              <span
                class="badge"
                :style="{
                  color:      photo.status === 'approved' ? '#2e7d32' : photo.status === 'rejected' ? '#c62828' : '#e65100',
                  background: photo.status === 'approved' ? 'rgba(46,125,50,0.1)' : photo.status === 'rejected' ? 'rgba(198,40,40,0.1)' : 'rgba(230,81,0,0.1)',
                }"
              >
                {{ photo.status === 'approved' ? 'Одобрено' : photo.status === 'rejected' ? 'Отклонено' : 'На проверке' }}
              </span>
              <span class="photo-item__date">{{ formatDateTime(photo.uploaded_at) }}</span>
            </div>
            <v-img v-if="photo.image_url" :src="photo.image_url" max-height="240" class="photo-item__img" cover />
            <p v-if="photo.volunteer_comment" class="photo-item__note"><b>Комментарий:</b> {{ photo.volunteer_comment }}</p>
            <p v-if="photo.organizer_comment" class="photo-item__note photo-item__note--ok"><b>Ответ организатора:</b> {{ photo.organizer_comment }}</p>
            <p v-if="photo.rejection_reason"  class="photo-item__note photo-item__note--err"><b>Причина отклонения:</b> {{ photo.rejection_reason }}</p>
          </div>
        </div>
      </div>

      <!-- ═══ Upload photo (active, no photo yet) ═══ -->
      <div v-if="canUploadPhoto" class="card">
        <h2 class="card__sub">Загрузить фотоотчёт</h2>

        <v-form ref="photoFormRef" @submit.prevent="handleUploadPhoto">

          <!-- Drop zone and camera button -->
          <div class="d-flex gap-2 mb-3">
            <div
              class="upload-zone flex-grow-1"
              :class="{ 'upload-zone--has-file': photoFiles.length > 0, 'upload-zone--disabled': photoFiles.length >= 5 || uploadingPhoto }"
              :style="{ cursor: (photoFiles.length >= 5 || uploadingPhoto) ? 'not-allowed' : 'pointer', opacity: (photoFiles.length >= 5 || uploadingPhoto) ? 0.6 : 1 }"
              @click="photoFiles.length < 5 && !uploadingPhoto && ($refs.fileInputEl as HTMLInputElement).click()"
            >
              <v-icon
                :icon="photoFiles.length > 0 ? 'mdi-image-multiple-outline' : 'mdi-image-plus-outline'"
                size="34"
              />
              <span class="upload-zone__label">
                {{ photoFiles.length > 0 ? `Выбрано фото: ${photoFiles.length} / 5` : 'Нажмите, чтобы выбрать фото' }}
              </span>
              <span class="upload-zone__hint">JPG, PNG, WebP · до 10 МБ каждое · максимум 5 фото</span>
              <input
                ref="fileInputEl"
                id="photo-input"
                type="file"
                accept="image/*"
                multiple
                style="display:none"
                @change="handlePhotoSelect"
              />
            </div>
            <button
              type="button"
              class="btn btn--green"
              @click="openCamera"
              :disabled="uploadingPhoto || photoFiles.length >= 5"
            >
              <v-icon icon="mdi-camera" size="20" />
              Камера
            </button>
          </div>

          <!-- Previews -->
          <div v-if="photoPreviews.length > 0" class="photo-previews-grid mb-3">
            <div v-for="(preview, index) in photoPreviews" :key="index" class="photo-preview-item">
              <v-img :src="preview" max-height="200" class="photo-preview__img" cover />
              <button type="button" class="btn btn--red-outline btn--sm mt-2" @click="removePhoto(index)">
                <v-icon icon="mdi-delete-outline" size="15" />
                Удалить
              </button>
            </div>
          </div>

          <!-- Comment -->
          <v-textarea
            v-model="photoComment"
            label="Комментарий к фото (необязательно)"
            variant="outlined"
            rows="3"
            :disabled="uploadingPhoto"
            class="mt-4"
          />

          <!-- Submit -->
          <button
            type="submit"
            class="btn btn--primary mt-3"
            :disabled="photoFiles.length === 0 || uploadingPhoto"
          >
            <v-icon
              :icon="uploadingPhoto ? 'mdi-loading' : 'mdi-upload'"
              size="17"
              :class="{ spin: uploadingPhoto }"
            />
            {{ uploadingPhoto ? 'Загружаем...' : `Загрузить фотоотчёт${photoFiles.length > 0 ? ` (${photoFiles.length})` : ''}` }}
          </button>
        </v-form>
      </div>

      <!-- Camera Dialog -->
      <v-dialog v-model="showCameraDialog" max-width="600" @update:model-value="(val) => { if (!val) closeCamera(); }">
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Сделать фото</span>
            <v-btn icon variant="text" size="small" @click="closeCamera">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text class="pa-0">
            <div class="camera-container" style="position: relative; background: #000; min-height: 400px;">
              <video
                ref="videoRef"
                autoplay
                playsinline
                style="width: 100%; height: auto; display: block;"
              />
              <canvas ref="canvasRef" style="display: none;" />
            </div>
          </v-card-text>
          <v-card-actions class="pa-4">
            <v-spacer />
            <v-btn color="error" variant="flat" @click="closeCamera">
              Отмена
            </v-btn>
            <v-btn color="success" variant="flat" @click="capturePhoto">
              <v-icon icon="mdi-camera" class="mr-2" />
              Сделать фото
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- ═══ Completed: read-only photos ═══ -->
      <div v-if="isCompleted && taskPhotos.length > 0" class="card">
        <h2 class="card__sub">Фотоотчёт</h2>
        <div class="photo-list">
          <div v-for="photo in taskPhotos" :key="photo.id" class="photo-item">
            <div class="photo-item__top">
              <span
                class="badge"
                :style="{
                  color:      photo.status === 'approved' ? '#2e7d32' : photo.status === 'rejected' ? '#c62828' : '#e65100',
                  background: photo.status === 'approved' ? 'rgba(46,125,50,0.1)' : photo.status === 'rejected' ? 'rgba(198,40,40,0.1)' : 'rgba(230,81,0,0.1)',
                }"
              >
                {{ photo.status === 'approved' ? 'Одобрено' : photo.status === 'rejected' ? 'Отклонено' : 'На проверке' }}
              </span>
              <span class="photo-item__date">{{ formatDateTime(photo.uploaded_at) }}</span>
            </div>
            <v-img v-if="photo.image_url" :src="photo.image_url" max-height="240" class="photo-item__img" cover />
            <p v-if="photo.organizer_comment" class="photo-item__note photo-item__note--ok"><b>Ответ организатора:</b> {{ photo.organizer_comment }}</p>
            <p v-if="photo.rejection_reason"  class="photo-item__note photo-item__note--err"><b>Причина отклонения:</b> {{ photo.rejection_reason }}</p>
          </div>
        </div>
      </div>

    </template>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<style scoped>
/* ─── Animations ─── */
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

/* ─── Layout ─── */
.task-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ─── Back button ─── */
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(139,195,74,0.25);
  background: rgba(139,195,74,0.06);
  color: #558b2f;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.back-btn:hover { background: rgba(139,195,74,0.14); }

/* ─── Skeletons ─── */
.skeletons { display: flex; flex-direction: column; gap: 14px; }
.skeleton-card { background: #fff; border-radius: 18px; border: 1px solid rgba(0,0,0,0.07); overflow: hidden; }

/* ─── Card ─── */
.card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,0.07);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.card__title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1.35;
  margin: 0;
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.card__sub {
  font-size: 1rem;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0;
}

.divider { height: 1px; background: rgba(0,0,0,0.07); }

/* ─── Badges ─── */
.badge-row { display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

/* ─── Meta ─── */
.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 28px;
}

.meta-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.875rem;
  color: rgba(0,0,0,0.65);
  line-height: 1.4;
}
.meta-row b      { color: #1a1a1a; }
.meta-row__ico   { flex-shrink: 0; margin-top: 1px; color: rgba(0,0,0,0.38); }
.meta-row--warn  { color: #e65100; }
.meta-row--warn b { color: #e65100; }

/* ─── Actions ─── */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-start;
}

.complete-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.complete-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.775rem;
  color: rgba(0,0,0,0.45);
  margin: 0;
  padding-left: 2px;
}

/* ─── Buttons ─── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 11px 20px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
  border: none;
  white-space: nowrap;
}
.btn:disabled              { opacity: 0.45; cursor: not-allowed; transform: none !important; }
.btn:not(:disabled):hover  { opacity: 0.88; transform: translateY(-1px); }

.btn--primary {
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: #fff;
}

.btn--green {
  background: linear-gradient(135deg, #43a047, #2e7d32);
  color: #fff;
}

.btn--red-outline {
  background: transparent;
  color: #c62828;
  border: 1.5px solid rgba(198,40,40,0.3);
}
.btn--red-outline:not(:disabled):hover { background: rgba(198,40,40,0.06); opacity: 1; transform: translateY(-1px); }

.btn--done {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 11px 20px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 700;
  background: rgba(46,125,50,0.09);
  color: #2e7d32;
  border: 1px solid rgba(46,125,50,0.2);
  cursor: default;
}

.btn--sm { padding: 6px 12px; font-size: 0.8rem; border-radius: 9px; }
.mt-2    { margin-top: 8px; }
.mt-3    { margin-top: 12px; }
.mt-4    { margin-top: 16px; }

/* ─── Info banner ─── */
.info-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
}

.info-banner--green {
  background: rgba(139,195,74,0.08);
  border: 1px solid rgba(139,195,74,0.22);
  color: #3a7422;
}

.info-banner--warn {
  background: rgba(230,81,0,0.08);
  border: 1px solid rgba(230,81,0,0.22);
  color: #e65100;
}

.info-banner--archive {
  background: rgba(55,71,79,0.06);
  border: 1px solid rgba(55,71,79,0.2);
  color: #37474f;
  align-items: flex-start;
  gap: 12px;
}

/* ─── Photo list ─── */
.photo-list { display: flex; flex-direction: column; gap: 14px; }

.photo-item {
  background: rgba(0,0,0,0.022);
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.06);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.photo-item__top {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.photo-item__date {
  font-size: 0.78rem;
  color: rgba(0,0,0,0.38);
}

.photo-item__img {
  border-radius: 10px;
  overflow: hidden;
}

.photo-item__note {
  font-size: 0.85rem;
  color: rgba(0,0,0,0.6);
  margin: 0;
  line-height: 1.45;
}
.photo-item__note--ok  { color: #2e7d32; }
.photo-item__note--err { color: #c62828; }

/* ─── Upload zone ─── */
.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 32px 20px;
  border: 2px dashed rgba(139,195,74,0.3);
  border-radius: 14px;
  background: rgba(139,195,74,0.03);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  text-align: center;
  color: #558b2f;
}
.upload-zone:hover,
.upload-zone--has-file { background: rgba(139,195,74,0.07); border-color: rgba(139,195,74,0.5); }

.upload-zone__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1a1a1a;
  word-break: break-all;
}

.upload-zone__hint {
  font-size: 0.775rem;
  color: rgba(0,0,0,0.38);
}

/* ─── Photo preview ─── */
.photo-preview { display: flex; flex-direction: column; gap: 0; margin-top: 12px; }
.photo-preview__img { border-radius: 12px; overflow: hidden; }

.photo-previews-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.photo-preview-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.photo-preview-item .photo-preview__img {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
}

.camera-container {
  position: relative;
  width: 100%;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}


/* ════════════════════════════
   RESPONSIVE
════════════════════════════ */

/* Tablet */
@media (max-width: 720px) {
  .card { padding: 18px 20px; }
  .meta-grid { gap: 8px 20px; }
}

/* Mobile */
@media (max-width: 600px) {
  .card { padding: 16px; gap: 12px; border-radius: 16px; }

  /* Title in its own row, badges below */
  .card__head { flex-direction: column; gap: 10px; }
  .badge-row  { align-self: flex-start; }

  /* Meta: single column */
  .meta-grid { grid-template-columns: 1fr; gap: 8px; }

  /* Actions: stack vertically, full width */
  .actions         { flex-direction: column; }
  .complete-group  { width: 100%; }
  .btn             { width: 100%; }
  .btn--done       { width: 100%; }

  /* Upload zone: less padding */
  .upload-zone { padding: 24px 16px; }
}

@media (max-width: 380px) {
  .card      { padding: 14px; }
  .card__title { font-size: 1.05rem; }
  .back-btn  { font-size: 0.82rem; padding: 7px 12px; }
  .btn       { font-size: 0.835rem; padding: 10px 16px; }
}
</style>