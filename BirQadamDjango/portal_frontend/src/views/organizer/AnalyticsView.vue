<template>
  <div class="analytics-view">

    <!-- ─── Page Header ─── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Аналитика</h1>
        <p class="page-subtitle">Подробная статистика по проектам, фото и активности волонтёров</p>
      </div>
    </div>

    <!-- ─── Loading ─── -->
    <div v-if="loading" class="state-center">
      <v-progress-circular indeterminate color="primary" size="52" />
      <p class="state-center__text">Загрузка аналитики...</p>
    </div>

    <!-- ─── Error ─── -->
    <div v-else-if="errorMessage" class="state-center">
      <div class="error-box">
        <div class="error-box__icon">
          <v-icon icon="mdi-alert-circle-outline" size="36" color="error" />
        </div>
        <h3 class="error-box__title">Не удалось загрузить данные</h3>
        <p class="error-box__text">{{ errorMessage }}</p>
        <button class="retry-btn" @click="loadAnalytics">
          <v-icon icon="mdi-refresh" size="16" />
          Попробовать снова
        </button>
      </div>
    </div>

    <!-- ─── Content ─── -->
    <div v-else class="analytics-body">

      <!-- Summary row -->
      <div class="summary-row">
        <div class="stat-card stat-card--green">
          <div class="stat-card__ico"><v-icon icon="mdi-folder-multiple" size="22" /></div>
          <div class="stat-card__val">{{ stats.projects_count || 0 }}</div>
          <div class="stat-card__lbl">Проектов</div>
          <div class="stat-card__sub">{{ stats.active_projects_count || 0 }} активных</div>
        </div>

        <div class="stat-card stat-card--teal">
          <div class="stat-card__ico"><v-icon icon="mdi-account-group" size="22" /></div>
          <div class="stat-card__val">{{ stats.volunteers_count || 0 }}</div>
          <div class="stat-card__lbl">Волонтёров</div>
          <div class="stat-card__sub">Участников в проектах</div>
        </div>

        <div class="stat-card stat-card--blue">
          <div class="stat-card__ico"><v-icon icon="mdi-clipboard-check" size="22" /></div>
          <div class="stat-card__val">
            {{ stats.completed_tasks_count || 0 }}<span class="stat-card__of"> / {{ stats.tasks_count || 0 }}</span>
          </div>
          <div class="stat-card__lbl">Задач выполнено</div>
          <div class="stat-card__sub">
            <template v-if="stats.tasks_count">{{ Math.round((stats.completed_tasks_count || 0) / stats.tasks_count * 100) }}% выполнено</template>
            <template v-else>Нет задач</template>
          </div>
        </div>

        <div class="stat-card stat-card--orange">
          <div class="stat-card__ico"><v-icon icon="mdi-image-multiple" size="22" /></div>
          <div class="stat-card__val">
            {{ stats.approved_photos_count || 0 }}<span class="stat-card__of"> / {{ stats.photo_reports_count || 0 }}</span>
          </div>
          <div class="stat-card__lbl">Фотоотчётов</div>
          <div class="stat-card__sub">
            <template v-if="stats.photo_reports_count">{{ Math.round((stats.approved_photos_count || 0) / stats.photo_reports_count * 100) }}% одобрено</template>
            <template v-else>Нет фото</template>
          </div>
        </div>
      </div>

      <!-- Charts grid -->
      <div class="charts-grid">

        <!-- Rating chart -->
        <div class="chart-panel">
          <div class="chart-panel__head">
            <div class="chart-panel__head-left">
              <div class="chart-panel__title-row">
                <h3 class="chart-panel__title">Динамика рейтинга</h3>
                <button class="icon-btn" @click="showRatingInfo = true">
                  <v-icon icon="mdi-information-outline" size="16" />
                </button>
              </div>
              <p class="chart-panel__sub">{{ ratingChartSubtitle }}</p>
            </div>
            <div class="rating-pill">
              <v-icon icon="mdi-star" size="14" />
              {{ stats.current_rating?.toFixed(1) || '0.0' }}
            </div>
          </div>

          <div class="chart-panel__filters">
            <div class="filter-row">
              <div class="filter-col">
                <span class="filter-label">С</span>
                <v-text-field v-model="ratingDateFrom" type="date" variant="outlined" density="compact" hide-details class="date-field" @update:model-value="applyRatingFilter" />
              </div>
              <div class="filter-col">
                <span class="filter-label">По</span>
                <v-text-field v-model="ratingDateTo" type="date" variant="outlined" density="compact" hide-details class="date-field" :min="ratingDateFrom" @update:model-value="applyRatingFilter" />
              </div>
              <button class="reset-btn" @click="resetRatingFilter">
                <v-icon icon="mdi-refresh" size="14" />
                Сбросить
              </button>
            </div>
          </div>

          <div class="chart-panel__body">
            <div v-if="ratingHistory.length > 0" class="canvas-box">
              <canvas ref="ratingChartCanvas" />
            </div>
            <div v-else class="chart-empty">
              <v-icon icon="mdi-chart-line-variant" size="44" />
              <p>Нет данных для отображения</p>
            </div>
          </div>
        </div>

        <!-- Activity chart -->
        <div class="chart-panel">
          <div class="chart-panel__head">
            <div class="chart-panel__head-left">
              <div class="chart-panel__title-row">
                <h3 class="chart-panel__title">Активность по типам</h3>
                <button class="icon-btn" @click="showActivityInfo = true">
                  <v-icon icon="mdi-information-outline" size="16" />
                </button>
              </div>
              <p class="chart-panel__sub">{{ activityChartSubtitle }}</p>
            </div>
          </div>

          <div class="chart-panel__filters">
            <div class="filter-row">
              <div class="filter-col">
                <span class="filter-label">С</span>
                <v-text-field v-model="activityDateFrom" type="date" variant="outlined" density="compact" hide-details class="date-field" @update:model-value="applyActivityFilter" />
              </div>
              <div class="filter-col">
                <span class="filter-label">По</span>
                <v-text-field v-model="activityDateTo" type="date" variant="outlined" density="compact" hide-details class="date-field" :min="activityDateFrom" @update:model-value="applyActivityFilter" />
              </div>
              <button class="reset-btn" @click="resetActivityFilter">
                <v-icon icon="mdi-refresh" size="14" />
                Сбросить
              </button>
            </div>
          </div>

          <div class="chart-panel__body">
            <div v-if="activityStats.activity_by_type && Object.keys(activityStats.activity_by_type).length > 0" class="act-list">
              <div v-for="(count, type) in activityStats.activity_by_type" :key="type" class="act-row">
                <div class="act-row__ico">
                  <v-icon :icon="getActivityIcon(String(type))" size="18" />
                </div>
                <div class="act-row__info">
                  <div class="act-row__label">{{ getActivityLabel(String(type)) }}</div>
                  <div class="act-row__count">{{ count }} {{ (count as number) === 1 ? 'активность' : 'активностей' }}</div>
                </div>
                <div class="act-row__badge">{{ count }}</div>
              </div>
            </div>
            <div v-else class="chart-empty">
              <v-icon icon="mdi-chart-bar" size="44" />
              <p>Нет активности за последние 7 дней</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Projects breakdown -->
      <div class="section-panel">
        <div class="section-panel__head">
          <h2 class="section-panel__title">Детализация по проектам</h2>
          <p class="section-panel__sub">Статистика по каждому проекту</p>
        </div>
        <div class="section-panel__body">
          <div v-if="projectsData.length > 0" class="proj-list">
            <div v-for="project in projectsData" :key="project.id" class="proj-row">
              <div class="proj-row__top">
                <div class="proj-row__icon">
                  <v-icon icon="mdi-briefcase-outline" size="16" />
                </div>
                <div class="proj-row__name">{{ project.title }}</div>
                <div class="proj-status" :class="`proj-status--${project.status}`">
                  {{ getProjectStatusLabel(project.status) }}
                </div>
              </div>
              <div class="proj-row__stats">
                <span class="proj-stat"><v-icon icon="mdi-account-group-outline" size="13" /> {{ project.volunteers_count || 0 }} волонтёров</span>
                <span class="proj-stat"><v-icon icon="mdi-clipboard-check-outline" size="13" /> {{ project.tasks_completed || 0 }} / {{ project.tasks_total || 0 }} задач</span>
                <span class="proj-stat"><v-icon icon="mdi-camera-outline" size="13" /> {{ project.photos_count || 0 }} фото</span>
              </div>
              <div v-if="(project.tasks_total || 0) > 0" class="proj-row__bar">
                <div class="proj-row__bar-fill" :style="{ width: `${Math.round((project.tasks_completed / project.tasks_total) * 100)}%` }" />
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <div class="empty-state__ico"><v-icon icon="mdi-folder-open-outline" size="34" /></div>
            <p class="empty-state__title">Нет проектов</p>
            <p class="empty-state__text">Создайте первый проект, чтобы увидеть статистику</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Rating Info Modal ─── -->
    <v-dialog v-model="showRatingInfo" max-width="560">
      <div class="info-modal">
        <div class="info-modal__hd">
          <div class="info-modal__hd-ico"><v-icon icon="mdi-chart-line" size="20" color="white" /></div>
          <span class="info-modal__hd-title">Динамика рейтинга</span>
          <button class="info-modal__close" @click="showRatingInfo = false"><v-icon icon="mdi-close" size="18" /></button>
        </div>
        <div class="info-modal__body">
          <div class="info-block">
            <div class="info-block__title"><v-icon icon="mdi-chart-line" size="15" color="#558b2f" /> Что показывает график?</div>
            <p class="info-block__text">График отображает изменение рейтинга за выбранный период. Каждая точка — рейтинг на конкретный день.</p>
            <ul class="info-block__list">
              <li>Восходящая линия — рейтинг растёт</li>
              <li>Нисходящая линия — рейтинг снижается</li>
              <li>Горизонтальная линия — рейтинг не менялся</li>
            </ul>
          </div>
          <div class="info-block">
            <div class="info-block__title"><v-icon icon="mdi-database" size="15" color="#558b2f" /> Источник данных</div>
            <div class="info-items">
              <div class="info-item"><v-icon icon="mdi-clipboard-plus" size="14" color="#2e7d32" /><span>Задачи назначены — <b>+0.5</b></span></div>
              <div class="info-item"><v-icon icon="mdi-check-circle" size="14" color="#2e7d32" /><span>Задачи выполнены — <b>+0.5</b></span></div>
              <div class="info-item"><v-icon icon="mdi-camera" size="14" color="#2e7d32" /><span>Фото загружены — <b>+0.5</b></span></div>
              <div class="info-item"><v-icon icon="mdi-account-plus" size="14" color="#2e7d32" /><span>Присоединения к проектам — <b>+0.5</b></span></div>
            </div>
          </div>
          <div class="info-block">
            <div class="info-block__title"><v-icon icon="mdi-calculator" size="15" color="#558b2f" /> Формула расчёта</div>
            <div class="formula-box">
              <div>Начальный рейтинг = Текущий − (Активности × 0.5)</div>
              <div>Рейтинг за день = Начальный + (Активности за день × 0.5)</div>
            </div>
          </div>
        </div>
        <div class="info-modal__ft">
          <button class="ok-btn" @click="showRatingInfo = false">Понятно</button>
        </div>
      </div>
    </v-dialog>

    <!-- ─── Activity Info Modal ─── -->
    <v-dialog v-model="showActivityInfo" max-width="560">
      <div class="info-modal">
        <div class="info-modal__hd">
          <div class="info-modal__hd-ico"><v-icon icon="mdi-chart-bar" size="20" color="white" /></div>
          <span class="info-modal__hd-title">Активность по типам</span>
          <button class="info-modal__close" @click="showActivityInfo = false"><v-icon icon="mdi-close" size="18" /></button>
        </div>
        <div class="info-modal__body">
          <div class="info-block">
            <div class="info-block__title"><v-icon icon="mdi-chart-bar" size="15" color="#558b2f" /> Что показывает раздел?</div>
            <p class="info-block__text">Распределение активности по типам действий за выбранный период. Помогает понять, какие действия выполняются чаще всего.</p>
          </div>
          <div class="info-block">
            <div class="info-block__title"><v-icon icon="mdi-format-list-bulleted" size="15" color="#558b2f" /> Типы активности</div>
            <div class="info-items">
              <div class="info-item info-item--col">
                <div class="info-item__row"><v-icon icon="mdi-clipboard-plus" size="14" color="#2e7d32" /><b>task_assigned — Задачи назначены</b></div>
                <div class="info-item__desc">Назначение задач волонтёрам в проектах</div>
              </div>
              <div class="info-item info-item--col">
                <div class="info-item__row"><v-icon icon="mdi-check-circle" size="14" color="#2e7d32" /><b>task_completed — Задачи выполнены</b></div>
                <div class="info-item__desc">Выполнение назначенных задач волонтёрами</div>
              </div>
              <div class="info-item info-item--col">
                <div class="info-item__row"><v-icon icon="mdi-camera" size="14" color="#2e7d32" /><b>photo_uploaded — Фото загружены</b></div>
                <div class="info-item__desc">Загрузка фотоотчётов в проекты</div>
              </div>
              <div class="info-item info-item--col">
                <div class="info-item__row"><v-icon icon="mdi-account-plus" size="14" color="#2e7d32" /><b>project_joined — Присоединения</b></div>
                <div class="info-item__desc">Новые волонтёры в проектах</div>
              </div>
            </div>
          </div>
          <div class="info-note">
            <v-icon icon="mdi-information-outline" size="14" color="#558b2f" />
            API возвращает данные за последние 7 дней. Фильтр на клиенте позволяет ограничить отображаемый период.
          </div>
        </div>
        <div class="info-modal__ft">
          <button class="ok-btn" @click="showActivityInfo = false">Понятно</button>
        </div>
      </div>
    </v-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import { httpClient } from '@/services/http';
import { useOrganizerStore } from '@/stores/organizer';
import { fetchProjectParticipants, fetchProjectTasks, fetchOrganizerPhotoReports } from '@/services/organizer';

const organizerStore = useOrganizerStore();

const loading = ref(true);
const stats = ref<any>({
  projects_count: 0,
  active_projects_count: 0,
  volunteers_count: 0,
  tasks_count: 0,
  completed_tasks_count: 0,
  photo_reports_count: 0,
  approved_photos_count: 0,
  current_rating: 0,
});
const ratingHistory = ref<any[]>([]);
const activityStats = ref<any>({ activity_by_type: {}, recent_achievements: [] });
const projectsData = ref<any[]>([]);
const ratingChartCanvas = ref<HTMLCanvasElement | null>(null);
const errorMessage = ref<string | null>(null);

const ratingDateFrom = ref<string>('');
const ratingDateTo = ref<string>('');
const activityDateFrom = ref<string>('');
const activityDateTo = ref<string>('');
const showRatingInfo = ref(false);
const showActivityInfo = ref(false);

const ratingChartSubtitle = computed(() => {
  if (ratingDateFrom.value && ratingDateTo.value) {
    const f = new Date(ratingDateFrom.value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const t = new Date(ratingDateTo.value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    return `С ${f} по ${t}`;
  }
  return 'За последние 7 дней';
});

const activityChartSubtitle = computed(() => {
  if (activityDateFrom.value && activityDateTo.value) {
    const f = new Date(activityDateFrom.value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const t = new Date(activityDateTo.value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    return `С ${f} по ${t}`;
  }
  return 'За последние 7 дней';
});

const initializeDefaultDates = () => {
  const today = new Date();
  const ago = new Date(); ago.setDate(today.getDate() - 7);
  const t = today.toISOString().split('T')[0] || '';
  const a = ago.toISOString().split('T')[0] || '';
  ratingDateTo.value = t; ratingDateFrom.value = a;
  activityDateTo.value = t; activityDateFrom.value = a;
};

const loadRatingStats = async () => {
  try {
    const res = await httpClient.get('/custom-admin/api/v1/user/stats/');
    if (res.data?.success && res.data?.stats) {
      const d = res.data.stats;
      stats.value = { ...stats.value, ...d };
      const full = d.rating_history || [];
      let filtered = full;
      if (ratingDateFrom.value && ratingDateTo.value) {
        const from = new Date(ratingDateFrom.value);
        const to = new Date(ratingDateTo.value); to.setHours(23, 59, 59, 999);
        filtered = full.filter((p: any) => p?.date && new Date(p.date) >= from && new Date(p.date) <= to);
      }
      if (filtered.length <= 1 && full.length > 0) {
        ratingHistory.value = full;
      } else if (filtered.length > 0) {
        ratingHistory.value = filtered;
      } else {
        const today = new Date(); const ago = new Date(); ago.setDate(today.getDate() - 7);
        ratingHistory.value = [
          { date: ago.toISOString().split('T')[0], rating: d.current_rating || 0 },
          { date: today.toISOString().split('T')[0], rating: d.current_rating || 0 },
        ];
      }
    }
  } catch (e: any) { console.error('loadRatingStats:', e); }
};

const loadActivityStats = async () => {
  try {
    const res = await httpClient.get('/custom-admin/api/v1/user/activity-stats/');
    activityStats.value = res.data?.success
      ? { activity_by_type: res.data.activity_by_type || {}, recent_achievements: res.data.recent_achievements || [] }
      : { activity_by_type: {}, recent_achievements: [] };
  } catch (e: any) {
    console.error('loadActivityStats:', e);
    activityStats.value = { activity_by_type: {}, recent_achievements: [] };
  }
};

const loadAnalytics = async () => {
  loading.value = true; errorMessage.value = null;
  try {
    await loadRatingStats();
    await Promise.all([
      loadActivityStats(),
      (async () => {
        if (!organizerStore.isOrganizer) return;
        await organizerStore.loadProjects(true);
        projectsData.value = organizerStore.projects.map((p: any) => ({
          id: p.id, title: p.title, status: p.status,
          volunteers_count: p.volunteer_count || 0, tasks_total: p.task_count || 0,
          tasks_completed: 0, photos_count: 0,
        }));
        const withStats = await Promise.all(organizerStore.projects.map(async (p: any) => {
          try {
            const [pp, tt, ph] = await Promise.allSettled([
              fetchProjectParticipants(p.id), fetchProjectTasks(p.id),
              fetchOrganizerPhotoReports({ project: p.id, limit: 1000, status: 'all' }),
            ]);
            const parts = pp.status === 'fulfilled' ? pp.value as any[] : [];
            const tasks = tt.status === 'fulfilled' ? tt.value as any[] : [];
            const photos = ph.status === 'fulfilled' ? (ph.value as any).photos || [] : [];
            return {
              id: p.id, title: p.title, status: p.status,
              volunteers_count: parts.length || p.volunteer_count || 0,
              tasks_total: tasks.length || p.task_count || 0,
              tasks_completed: tasks.filter((t: any) => t.status === 'completed').length,
              photos_count: photos.length,
            };
          } catch { return { id: p.id, title: p.title, status: p.status, volunteers_count: p.volunteer_count || 0, tasks_total: p.task_count || 0, tasks_completed: 0, photos_count: 0 }; }
        }));
        projectsData.value = withStats;
      })(),
    ]);
    await nextTick(); setTimeout(() => drawRatingChart(), 100);
  } catch (e: any) {
    errorMessage.value = e.response?.data?.error || e.message || 'Не удалось загрузить данные';
  } finally { loading.value = false; }
};

const drawRatingChart = () => {
  if (!ratingChartCanvas.value || !ratingHistory.value.length) return;
  const valid = ratingHistory.value.filter((p: any) => p?.date && typeof p.rating === 'number' && !isNaN(p.rating));
  if (!valid.length) return;
  const ctx = ratingChartCanvas.value.getContext('2d');
  if (!ctx) return;

  const canvas = ratingChartCanvas.value;
  const w = canvas.width = canvas.parentElement?.clientWidth || 600;
  const h = canvas.height = 280;
  ctx.clearRect(0, 0, w, h);

  let data = valid;
  if (data.length === 1) {
    const p = data[0]; const d = new Date(p.date); d.setDate(d.getDate() - 1);
    data = [{ date: d.toISOString().split('T')[0], rating: p.rating }, p];
  }

  const pad = { t: 20, r: 20, b: 32, l: 44 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const ratings = data.map((d: any) => d.rating);
  const minR = Math.min(...ratings), maxR = Math.max(...ratings);
  const range = maxR - minR || 0.5;

  // grid
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ch / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  const pts = data.map((d: any, i: number) => ({
    x: pad.l + (cw / Math.max(1, data.length - 1)) * i,
    y: pad.t + ch - ((d.rating - minR) / range) * ch,
    rating: d.rating, date: d.date,
  }));

  // area
  const aG = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
  aG.addColorStop(0, 'rgba(139,195,74,0.2)'); aG.addColorStop(1, 'rgba(139,195,74,0.01)');
  ctx.fillStyle = aG; ctx.beginPath();
  ctx.moveTo(pts[0].x, h - pad.b);
  pts.forEach((p: any) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, h - pad.b);
  ctx.closePath(); ctx.fill();

  // line
  ctx.shadowColor = 'rgba(139,195,74,0.3)'; ctx.shadowBlur = 8;
  ctx.strokeStyle = '#8bc34a'; ctx.lineWidth = 2.5;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p: any, i: number) => {
    if (i === 0) { ctx.moveTo(p.x, p.y); return; }
    const prev = pts[i - 1];
    const cpx = prev.x + (p.x - prev.x) / 2;
    ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
  });
  ctx.stroke(); ctx.shadowBlur = 0;

  // dots
  pts.forEach((p: any) => {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8bc34a'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8bc34a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke();
  });

  // Y labels
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.font = '11px system-ui'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = minR + (range / 4) * (4 - i);
    ctx.fillText(val.toFixed(1), pad.l - 7, pad.t + (ch / 4) * i + 4);
  }

  // X labels
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.font = '10px system-ui';
  const idxs = [0]; if (data.length > 2) idxs.push(Math.floor(data.length / 2)); if (data.length > 1) idxs.push(data.length - 1);
  idxs.forEach(i => {
    const p = pts[i];
    const lbl = new Date(data[i].date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    ctx.fillText(lbl, p.x, h - 5);
  });
};

const getActivityIcon = (t: string) => ({ task_completed: 'mdi-check-circle', task_assigned: 'mdi-clipboard-plus', photo_uploaded: 'mdi-camera', project_joined: 'mdi-account-plus', achievement_unlocked: 'mdi-trophy' } as Record<string, string>)[t] || 'mdi-circle';
const getActivityLabel = (t: string) => ({ task_completed: 'Задачи выполнены', task_assigned: 'Задачи назначены', photo_uploaded: 'Фото загружены', project_joined: 'Присоединения к проектам', achievement_unlocked: 'Достижения' } as Record<string, string>)[t] || t;
const getProjectStatusLabel = (s: string) => ({ approved: 'Активен', pending: 'На рассмотрении', rejected: 'Отклонён', completed: 'Завершён' } as Record<string, string>)[s] || s;

const applyRatingFilter = () => {
  if (ratingDateFrom.value && ratingDateTo.value && ratingDateFrom.value > ratingDateTo.value) return;
  loadRatingStats().then(() => nextTick(() => drawRatingChart()));
};
const resetRatingFilter = () => {
  const t = new Date(); const a = new Date(); a.setDate(t.getDate() - 7);
  ratingDateTo.value = t.toISOString().split('T')[0] || '';
  ratingDateFrom.value = a.toISOString().split('T')[0] || '';
  applyRatingFilter();
};
const applyActivityFilter = () => {
  if (activityDateFrom.value && activityDateTo.value && activityDateFrom.value > activityDateTo.value) return;
  loadActivityStats();
};
const resetActivityFilter = () => {
  const t = new Date(); const a = new Date(); a.setDate(t.getDate() - 7);
  activityDateTo.value = t.toISOString().split('T')[0] || '';
  activityDateFrom.value = a.toISOString().split('T')[0] || '';
  applyActivityFilter();
};

watch(ratingHistory, () => { nextTick(() => setTimeout(() => drawRatingChart(), 50)); }, { deep: true });
watch(ratingChartCanvas, (v) => { if (v && ratingHistory.value.length > 0) nextTick(() => setTimeout(() => drawRatingChart(), 50)); });
onMounted(() => { initializeDefaultDates(); loadAnalytics(); });
</script>

<style scoped>
/* ─── Base ─── */
.analytics-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.analytics-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ─── Page header ─── */
.page-header {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #f0faf0, #fafff5);
  border: 1px solid rgba(139,195,74,0.18);
  border-radius: 20px;
  padding: 20px 28px;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #1a1a1a;
  margin: 0 0 4px;
}

.page-subtitle {
  font-size: 0.875rem;
  color: rgba(0,0,0,0.45);
  margin: 0;
}

/* ─── States ─── */
.state-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;
}

.state-center__text {
  font-size: 0.9rem;
  color: rgba(0,0,0,0.45);
  margin: 0;
}

.error-box {
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(198,40,40,0.14);
  padding: 32px;
  text-align: center;
  max-width: 380px;
}

.error-box__icon {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: rgba(198,40,40,0.07);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px;
}

.error-box__title { font-size: 1rem; font-weight: 800; margin: 0 0 6px; }
.error-box__text { font-size: 0.85rem; color: rgba(0,0,0,0.5); margin: 0 0 16px; }

.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 100px;
  border: 1.5px solid rgba(139,195,74,0.3);
  background: transparent;
  color: #558b2f;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.retry-btn:hover { background: rgba(139,195,74,0.08); }

/* ─── Summary row ─── */
.summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.07);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }

.stat-card__ico {
  width: 40px; height: 40px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 8px;
}

.stat-card--green .stat-card__ico { background: rgba(139,195,74,0.12); color: #558b2f; }
.stat-card--teal  .stat-card__ico { background: rgba(0,137,123,0.12);  color: #00695c; }
.stat-card--blue  .stat-card__ico { background: rgba(57,73,171,0.12);  color: #283593; }
.stat-card--orange .stat-card__ico { background: rgba(230,74,25,0.12); color: #bf360c; }

.stat-card__val {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1;
}

.stat-card__of {
  font-size: 1rem;
  font-weight: 500;
  color: rgba(0,0,0,0.3);
}

.stat-card__lbl {
  font-size: 0.825rem;
  font-weight: 600;
  color: rgba(0,0,0,0.55);
  margin-top: 4px;
}

.stat-card__sub {
  font-size: 0.75rem;
  color: rgba(0,0,0,0.38);
}

/* ─── Charts grid ─── */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 14px;
}

@media (max-width: 800px) { .charts-grid { grid-template-columns: 1fr; } }

/* ─── Chart panel ─── */
.chart-panel {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.07);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chart-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}

.chart-panel__head-left { flex: 1; min-width: 0; }

.chart-panel__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.chart-panel__title {
  font-size: 0.975rem;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0;
}

.chart-panel__sub {
  font-size: 0.775rem;
  color: rgba(0,0,0,0.42);
  margin: 0;
}

.rating-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  background: rgba(139,195,74,0.1);
  border: 1px solid rgba(139,195,74,0.22);
  border-radius: 100px;
  color: #558b2f;
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
}

.icon-btn {
  width: 24px; height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(0,0,0,0.3);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.icon-btn:hover { color: #558b2f; background: rgba(139,195,74,0.1); }

/* Filters */
.chart-panel__filters {
  padding: 10px 18px;
  background: rgba(0,0,0,0.018);
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.filter-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 110px;
}

.filter-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: rgba(0,0,0,0.38);
}

.date-field { width: 100%; }

.reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border-radius: 8px;
  border: 1px solid rgba(139,195,74,0.25);
  background: transparent;
  color: #558b2f;
  font-size: 0.775rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
  height: 38px;
  align-self: flex-end;
}
.reset-btn:hover { background: rgba(139,195,74,0.08); }

/* Chart body */
.chart-panel__body { padding: 16px; flex: 1; }

.canvas-box { position: relative; width: 100%; }
.canvas-box canvas { display: block; width: 100%; }

.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  color: rgba(0,0,0,0.28);
  gap: 8px;
  text-align: center;
  font-size: 0.85rem;
}

/* Activity list */
.act-list { display: flex; flex-direction: column; gap: 8px; }

.act-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(0,0,0,0.022);
  border-radius: 10px;
  transition: background 0.15s;
}
.act-row:hover { background: rgba(139,195,74,0.06); }

.act-row__ico {
  width: 34px; height: 34px;
  border-radius: 8px;
  background: rgba(139,195,74,0.1);
  color: #558b2f;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.act-row__info { flex: 1; min-width: 0; }

.act-row__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1a1a1a;
}

.act-row__count {
  font-size: 0.75rem;
  color: rgba(0,0,0,0.45);
  margin-top: 1px;
}

.act-row__badge {
  padding: 3px 10px;
  background: rgba(139,195,74,0.12);
  border-radius: 100px;
  color: #558b2f;
  font-size: 0.8rem;
  font-weight: 700;
}

/* ─── Section panel ─── */
.section-panel {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.07);
  overflow: hidden;
}

.section-panel__head {
  padding: 16px 18px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}

.section-panel__title {
  font-size: 0.975rem;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0 0 2px;
}

.section-panel__sub {
  font-size: 0.775rem;
  color: rgba(0,0,0,0.42);
  margin: 0;
}

.section-panel__body { padding: 14px; }

/* Projects list */
.proj-list { display: flex; flex-direction: column; gap: 10px; }

.proj-row {
  background: rgba(0,0,0,0.022);
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.06);
  padding: 14px;
  transition: background 0.15s;
}
.proj-row:hover { background: rgba(139,195,74,0.04); }

.proj-row__top {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 9px;
}

.proj-row__icon {
  width: 30px; height: 30px;
  border-radius: 7px;
  background: rgba(139,195,74,0.1);
  color: #558b2f;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.proj-row__name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1a1a1a;
  flex: 1;
}

/* Project status badges */
.proj-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: 100px;
  font-size: 0.72rem;
  font-weight: 700;
}
.proj-status--approved  { background: rgba(46,125,50,0.1);  color: #2e7d32; }
.proj-status--pending   { background: rgba(230,81,0,0.1);   color: #e65100; }
.proj-status--rejected  { background: rgba(198,40,40,0.1);  color: #c62828; }
.proj-status--completed { background: rgba(21,101,192,0.1); color: #1565c0; }

.proj-row__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 10px;
}

.proj-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: rgba(0,0,0,0.5);
}

.proj-row__bar {
  height: 5px;
  background: rgba(0,0,0,0.07);
  border-radius: 100px;
  overflow: hidden;
}

.proj-row__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #8bc34a, #558b2f);
  border-radius: 100px;
  transition: width 0.4s;
}

/* ─── Empty state ─── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 24px;
  text-align: center;
}

.empty-state__ico {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: rgba(139,195,74,0.08);
  display: flex; align-items: center; justify-content: center;
  color: rgba(139,195,74,0.6);
  margin-bottom: 12px;
}

.empty-state__title { font-size: 0.975rem; font-weight: 800; margin: 0 0 5px; color: #1a1a1a; }
.empty-state__text  { font-size: 0.825rem; color: rgba(0,0,0,0.44); margin: 0; }

/* ─── Info modal ─── */
.info-modal {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
}

.info-modal__hd {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #2d5a1b, #4a8f2a);
}

.info-modal__hd-ico {
  width: 36px; height: 36px;
  border-radius: 9px;
  background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.info-modal__hd-title {
  flex: 1;
  font-size: 0.975rem;
  font-weight: 800;
  color: #fff;
}

.info-modal__close {
  width: 28px; height: 28px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.2);
  background: transparent;
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.info-modal__close:hover { background: rgba(255,255,255,0.15); }

.info-modal__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 65vh;
  overflow-y: auto;
}

.info-block { display: flex; flex-direction: column; gap: 8px; }

.info-block__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 800;
  color: #1a1a1a;
}

.info-block__text {
  font-size: 0.825rem;
  color: rgba(0,0,0,0.55);
  line-height: 1.5;
  margin: 0;
}

.info-block__list {
  margin: 0; padding-left: 18px;
  font-size: 0.825rem;
  color: rgba(0,0,0,0.55);
  line-height: 1.6;
}

.info-items { display: flex; flex-direction: column; gap: 6px; }

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: rgba(139,195,74,0.06);
  border-radius: 8px;
  font-size: 0.8rem;
  color: rgba(0,0,0,0.65);
}

.info-item--col { flex-direction: column; align-items: flex-start; gap: 3px; }
.info-item__row { display: flex; align-items: center; gap: 7px; font-size: 0.8rem; color: #1a1a1a; }
.info-item__desc { font-size: 0.75rem; color: rgba(0,0,0,0.45); padding-left: 21px; }

.formula-box {
  background: rgba(139,195,74,0.06);
  border-left: 3px solid #8bc34a;
  border-radius: 0 8px 8px 0;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.5;
}

.info-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 0.775rem;
  color: rgba(0,0,0,0.5);
  background: rgba(139,195,74,0.06);
  padding: 10px 12px;
  border-radius: 8px;
  line-height: 1.45;
}

.info-modal__ft {
  padding: 12px 16px;
  border-top: 1px solid rgba(0,0,0,0.07);
  display: flex;
  justify-content: flex-end;
}

.ok-btn {
  padding: 8px 22px;
  border-radius: 100px;
  border: none;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.ok-btn:hover { opacity: 0.88; }

@media (max-width: 600px) {
  .summary-row { grid-template-columns: 1fr 1fr; }
}
</style>