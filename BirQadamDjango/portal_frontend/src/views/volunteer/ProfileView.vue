<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { VForm } from 'vuetify/components';

import { fetchVolunteerProfile, updateVolunteerProfile, getTelegramSyncStatus, generateTelegramLinkCode } from '@/services/auth';
import { fetchVolunteerStats, fetchVolunteerActivity } from '@/services/stats';
import { useAuthStore } from '@/stores/auth';
import { fetchTrustFactorHistory, type TrustFactorHistoryResponse } from '@/services/trustFactor';

const authStore = useAuthStore();
const loading = ref(false);
const formRef = ref<VForm | null>(null);
const snackbar = reactive({ show: false, color: 'success', message: '' });
const formState = reactive({ name: '', phone_number: '', email: '' });

const passwordDialog = ref(false);
const passwordFormRef = ref<VForm | null>(null);
const passwordLoading = ref(false);
const passwordFormState = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });

const rules = {
  required: (value: string) => !!value || 'Поле обязательно для заполнения.',
  phoneMaxLength: (value: string) => {
    if (!value) return true;
    return value.length <= 15 || 'Номер телефона не должен превышать 15 символов.';
  },
};

const stats = ref<Awaited<ReturnType<typeof fetchVolunteerStats>> | null>(null);
const activity = ref<Awaited<ReturnType<typeof fetchVolunteerActivity>> | null>(null);
const statsLoading = ref(false);
const activityLoading = ref(false);

const profile = computed(() => ({
  trust_factor:    authStore.user?.trust_factor    ?? 20,
  average_rating:  authStore.user?.average_rating  ?? 5.0,
}));

const trustFactorHistory = ref<TrustFactorHistoryResponse | null>(null);
const trustFactorHistoryDialog = ref(false);
const trustFactorHistoryLoading = ref(false);
const trustFactorInfoDialog = ref(false);
const ratingInfoDialog = ref(false);

const telegramSync = ref<{
  is_linked: boolean; telegram_id: string | null;
  active_code: string | null; registration_source: string;
} | null>(null);
const telegramLoading = ref(false);
const linkCode = ref<string | null>(null);

/* ── loaders ─────────────────────────────── */
const loadProfile = async () => {
  loading.value = true;
  try {
    const d = await fetchVolunteerProfile();
    formState.name = d.name || ''; formState.phone_number = d.phone_number || ''; formState.email = d.email || '';
    await authStore.refreshProfile();
  } finally { loading.value = false; }
};

const loadTrustFactorHistory = async () => {
  trustFactorHistoryLoading.value = true;
  try { trustFactorHistory.value = await fetchTrustFactorHistory(); }
  catch (e: any) { if (e?.response?.status !== 404) { snackbar.message = 'Не удалось загрузить историю Trust Factor'; snackbar.color = 'error'; snackbar.show = true; } }
  finally { trustFactorHistoryLoading.value = false; }
};

const openTrustFactorHistory = async () => { trustFactorHistoryDialog.value = true; if (!trustFactorHistory.value) await loadTrustFactorHistory(); };

const loadStats    = async () => { statsLoading.value    = true; try { stats.value    = await fetchVolunteerStats();      } finally { statsLoading.value    = false; } };
const loadActivity = async () => { activityLoading.value = true; try { activity.value = await fetchVolunteerActivity(6); } finally { activityLoading.value = false; } };

const activityMonths = computed(() => activity.value?.months ?? []);

const combinedActivitySeries = computed(() => {
  if (!activity.value?.series) return [];
  const s = activity.value.series, n = activity.value.months?.length ?? 0;
  if (!n) return [];
  return Array.from({ length: n }, (_, i) =>
    (s.task_completed?.[i] ?? 0) + (s.photo_uploaded?.[i] ?? 0) + (s.project_joined?.[i] ?? 0) + (s.task_assigned?.[i] ?? 0));
});

const maxActivity = computed(() => Math.max(...combinedActivitySeries.value, 1));

function formatMonthLabel(m: string): string {
  const n = parseInt((m.split('-')[1] ?? '0'), 10);
  return ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][n - 1] ?? m;
}

const copyToClipboard = async (text: string | null) => {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); snackbar.message = 'Скопировано'; snackbar.color = 'success'; snackbar.show = true; }
  catch  { snackbar.message = 'Не удалось скопировать'; snackbar.color = 'error'; snackbar.show = true; }
};

const openTelegramBot = () => window.open('https://t.me/VolunteerDlyaLyudei_bot', '_blank');

const submit = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  if ((formState.phone_number?.trim().length ?? 0) > 15) {
    snackbar.message = 'Номер телефона слишком длинный (макс. 15 символов).'; snackbar.color = 'error'; snackbar.show = true; return;
  }
  loading.value = true;
  try {
    const payload: any = {};
    if (formState.name?.trim())         payload.name         = formState.name.trim();
    if (formState.phone_number?.trim()) payload.phone_number = formState.phone_number.trim();
    if (formState.email?.trim())        payload.email        = formState.email.trim();
    const updated = await updateVolunteerProfile(payload);
    await authStore.refreshProfile();
    snackbar.message = 'Профиль обновлён'; snackbar.color = 'success'; snackbar.show = true;
    formState.name = updated.name || ''; formState.phone_number = updated.phone_number || ''; formState.email = updated.email || '';
  } catch (e: any) {
    const r = e?.response?.data;
    let msg = 'Не удалось сохранить профиль.';
    if (typeof r === 'string' && r.includes('value too long')) msg = 'Номер телефона слишком длинный.';
    else if (e?.response?.status === 500) msg = 'Ошибка сервера. Попробуйте позже.';
    else if (r?.detail) msg = r.detail;
    else if (r?.error)  msg = r.error;
    snackbar.message = msg; snackbar.color = 'error'; snackbar.show = true;
  } finally { loading.value = false; }
};

const loadTelegramSync = async () => {
  telegramLoading.value = true;
  try { telegramSync.value = await getTelegramSyncStatus(); if (telegramSync.value.active_code) linkCode.value = telegramSync.value.active_code; }
  catch { /* silent */ } finally { telegramLoading.value = false; }
};

const generateCode = async () => {
  telegramLoading.value = true;
  try {
    const r = await generateTelegramLinkCode(); linkCode.value = r.code; await loadTelegramSync();
    snackbar.message = 'Код сгенерирован. Используйте /link в боте.'; snackbar.color = 'success'; snackbar.show = true;
  } catch (e: any) { snackbar.message = e?.response?.data?.detail || 'Не удалось сгенерировать код.'; snackbar.color = 'error'; snackbar.show = true; }
  finally { telegramLoading.value = false; }
};

const changePassword = async () => {
  const { valid } = (await passwordFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  if (passwordFormState.newPassword !== passwordFormState.confirmPassword) {
    snackbar.message = 'Пароли не совпадают.'; snackbar.color = 'error'; snackbar.show = true; return;
  }
  passwordLoading.value = true;
  try {
    const { httpClient } = await import('@/services/http');
    await httpClient.post('/api/web/change-password/', { current_password: passwordFormState.currentPassword, new_password: passwordFormState.newPassword });
    snackbar.message = 'Пароль изменён.'; snackbar.color = 'success'; snackbar.show = true;
    passwordDialog.value = false; passwordFormState.currentPassword = passwordFormState.newPassword = passwordFormState.confirmPassword = '';
  } catch (e: any) { snackbar.message = e?.response?.data?.detail || 'Не удалось изменить пароль.'; snackbar.color = 'error'; snackbar.show = true; }
  finally { passwordLoading.value = false; }
};

/* derived */
const tfColor  = computed(() => profile.value.trust_factor >= 20 ? '#3d7a1a' : profile.value.trust_factor >= 10 ? '#d97706' : '#dc2626');
const tfBg     = computed(() => profile.value.trust_factor >= 20 ? 'rgba(61,122,26,.07)' : profile.value.trust_factor >= 10 ? 'rgba(217,119,6,.07)' : 'rgba(220,38,38,.07)');
const tfPct    = computed(() => (profile.value.trust_factor / 30) * 100);
const levelPct = computed(() => Math.round((stats.value?.progress ?? 0) * 100));

onMounted(() => Promise.all([loadProfile(), loadStats(), loadActivity(), loadTelegramSync()]));
</script>

<template>
  <div class="pv">

    <!-- ═══════════════════════════════
         HERO
    ═══════════════════════════════ -->
    <div class="hero">
      <div class="hero__bg">
        <div class="hero__orb hero__orb--a" />
        <div class="hero__orb hero__orb--b" />
        <div class="hero__grid" />
      </div>
      <div class="hero__body">
        <div class="hero__avatar">
          <v-icon size="48" color="white">mdi-account</v-icon>
        </div>
        <div class="hero__text">
          <h1 class="hero__name">
            {{ authStore.user?.full_name || formState.name || authStore.user?.username || 'Волонтёр' }}
          </h1>
          <div class="hero__contacts">
            <span v-if="authStore.user?.phone_number || formState.phone_number" class="hero__contact">
              <v-icon size="13">mdi-phone</v-icon>
              {{ authStore.user?.phone_number || formState.phone_number }}
            </span>
            <span v-if="authStore.user?.email || formState.email" class="hero__contact">
              <v-icon size="13">mdi-email</v-icon>
              {{ authStore.user?.email || formState.email }}
            </span>
          </div>
        </div>
        <div class="hero__badge">
          <v-icon size="13">mdi-shield-check</v-icon>
          Волонтёр BirQadam
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════
         STATS ROW
    ═══════════════════════════════ -->
    <div class="qs">
      <div class="qs__item" @click="ratingInfoDialog = true" style="cursor: pointer;">
        <span class="qs__val">{{ statsLoading ? '—' : (stats?.rating ?? '—') }}</span>
        <div class="qs__lbl-wrap">
          <span class="qs__lbl">Общая оценка</span>
          <v-icon size="11" color="rgba(0,0,0,0.25)" class="ms-1">mdi-information-outline</v-icon>
        </div>
      </div>
      <div class="qs__sep"/>
      <div class="qs__item">
        <span class="qs__val">{{ statsLoading ? '—' : (stats?.level ?? '—') }}</span>
        <span class="qs__lbl">уровень</span>
      </div>
      <div class="qs__sep"/>
      <div class="qs__item">
        <span class="qs__val" :style="{ color: tfColor }">{{ profile.trust_factor }}<span class="qs__sub">/30</span></span>
        <span class="qs__lbl">trust factor</span>
      </div>
      <div class="qs__sep"/>
      <div class="qs__item" @click="ratingInfoDialog = true" style="cursor: pointer;">
        <span class="qs__val">{{ profile.average_rating.toFixed(1) }}</span>
        <div class="qs__lbl-wrap">
          <span class="qs__lbl">Средняя оценка</span>
          <v-icon size="11" color="rgba(0,0,0,0.25)" class="ms-1">mdi-information-outline</v-icon>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════
         MAIN GRID
    ═══════════════════════════════ -->
    <div class="grid">

      <!-- ── LEFT ── -->
      <div class="col col--main">

        <!-- Personal info -->
        <div class="card">
          <div class="card__head">
            <div class="card__ico"><v-icon size="18" color="#3d7a1a">mdi-account-edit</v-icon></div>
            <div>
              <h2 class="card__title">Личная информация</h2>
              <p class="card__sub">Данные для связи с организаторами</p>
            </div>
          </div>

          <v-form ref="formRef" @submit.prevent="submit">
            <div class="form-grid">
              <v-text-field v-model="formState.name" label="Полное имя" prepend-inner-icon="mdi-account-outline" variant="outlined" density="comfortable" :rules="[rules.required]" :loading="loading" hide-details="auto" class="pf"/>
              <v-text-field v-model="formState.phone_number" label="Телефон" prepend-inner-icon="mdi-phone-outline" variant="outlined" density="comfortable" :rules="[rules.required, rules.phoneMaxLength]" :loading="loading" hide-details="auto" class="pf" maxlength="15"/>
              <v-text-field v-model="formState.email" label="Email" prepend-inner-icon="mdi-email-outline" variant="outlined" density="comfortable" :loading="loading" hide-details="auto" class="pf pf--full" disabled/>
            </div>
            <div class="form-actions">
              <button class="btn btn--primary" type="submit" :disabled="loading">
                <v-icon size="15">mdi-content-save-outline</v-icon>
                {{ loading ? 'Сохранение…' : 'Сохранить' }}
              </button>
              <button class="btn btn--outline" type="button" @click="passwordDialog = true">
                <v-icon size="15">mdi-lock-reset</v-icon>
                Изменить пароль
              </button>
              <button class="btn btn--ghost" type="button" @click="loadProfile" :disabled="loading">
                <v-icon size="15">mdi-refresh</v-icon>
                Отменить
              </button>
            </div>
          </v-form>
        </div>

        <!-- Activity -->
        <div class="card">
          <div class="card__head">
            <div class="card__ico"><v-icon size="18" color="#3d7a1a">mdi-chart-bar</v-icon></div>
            <div>
              <h2 class="card__title">Активность за 6 месяцев</h2>
              <p class="card__sub">Задачи · Фотоотчёты · Проекты</p>
            </div>
          </div>

          <div v-if="activityLoading" class="state-center"><v-progress-circular indeterminate color="#8bc34a" size="30"/></div>

          <template v-else-if="activityMonths.length && combinedActivitySeries.length">
            <!-- Total pill -->
            <div class="act-pill">
              <span class="act-pill__n">{{ combinedActivitySeries.reduce((a,b) => a+b, 0) }}</span>
              <span class="act-pill__lbl">всего действий</span>
            </div>

            <!-- Bar chart -->
            <div class="act-bars">
              <div v-for="(m, i) in activityMonths" :key="i" class="act-bar">
                <span class="act-bar__val">{{ combinedActivitySeries[i] ?? 0 }}</span>
                <div class="act-bar__track">
                  <div class="act-bar__fill" :style="{ height: `${Math.max(5, ((combinedActivitySeries[i] ?? 0) / maxActivity) * 100)}%` }"/>
                </div>
                <span class="act-bar__lbl">{{ formatMonthLabel(m) }}</span>
              </div>
            </div>

            <!-- Totals grid -->
            <div class="act-totals">
              <div class="act-tot"><v-icon size="13" color="#5c9bd6">mdi-clipboard-check</v-icon><span>Взято: <b>{{ activity?.totals?.task_assigned ?? 0 }}</b></span></div>
              <div class="act-tot"><v-icon size="13" color="#3d7a1a">mdi-check-circle</v-icon><span>Завершено: <b>{{ activity?.totals?.task_completed ?? 0 }}</b></span></div>
              <div class="act-tot"><v-icon size="13" color="#7b5ea7">mdi-camera</v-icon><span>Фото: <b>{{ activity?.totals?.photo_uploaded ?? 0 }}</b></span></div>
              <div class="act-tot"><v-icon size="13" color="#d97706">mdi-folder-multiple</v-icon><span>Проекты: <b>{{ activity?.totals?.project_joined ?? 0 }}</b></span></div>
            </div>
          </template>

          <div v-else class="state-empty">
            <v-icon size="40" color="rgba(0,0,0,0.13)">mdi-chart-bar</v-icon>
            <p>Пока нет активности</p>
          </div>
        </div>

        <!-- Quick links -->
        <div class="card">
          <div class="card__head">
            <div class="card__ico"><v-icon size="18" color="#3d7a1a">mdi-link-variant</v-icon></div>
            <h2 class="card__title">Быстрый доступ</h2>
          </div>
          <div class="ql">
            <router-link :to="{ name: 'volunteer-photo-reports' }" class="ql__item">
              <div class="ql__ico ql__ico--purple"><v-icon size="19" color="#7b5ea7">mdi-camera-outline</v-icon></div>
              <div class="ql__text">
                <span class="ql__name">Фотоотчёты</span>
                <span class="ql__sub">История и статусы</span>
              </div>
              <v-icon size="15" color="rgba(0,0,0,0.22)">mdi-chevron-right</v-icon>
            </router-link>
            <router-link :to="{ name: 'volunteer-notifications' }" class="ql__item">
              <div class="ql__ico ql__ico--green"><v-icon size="19" color="#3d7a1a">mdi-bell-outline</v-icon></div>
              <div class="ql__text">
                <span class="ql__name">Уведомления</span>
                <span class="ql__sub">Важные сообщения</span>
              </div>
              <v-icon size="15" color="rgba(0,0,0,0.22)">mdi-chevron-right</v-icon>
            </router-link>
          </div>
        </div>

      </div>

      <!-- ── RIGHT ── -->
      <div class="col col--side">

        <!-- Level -->
        <div class="card">
          <div class="card__head">
            <div class="card__ico"><v-icon size="18" color="#3d7a1a">mdi-trophy-outline</v-icon></div>
            <h2 class="card__title">Уровень</h2>
          </div>

          <div v-if="statsLoading" class="state-center"><v-progress-circular indeterminate color="#8bc34a" size="30"/></div>

          <template v-else-if="stats">
            <div class="lv">
              <!-- Ring -->
              <div class="lv__ring-wrap">
                <svg viewBox="0 0 100 100" class="lv__ring-svg">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(139,195,74,.13)" stroke-width="7"/>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="url(#lgg)" stroke-width="7"
                    stroke-linecap="round"
                    :stroke-dasharray="251.2"
                    :stroke-dashoffset="251.2 - 251.2 * levelPct / 100"
                    transform="rotate(-90 50 50)"
                    style="transition:stroke-dashoffset 1s ease"
                  />
                  <defs>
                    <linearGradient id="lgg" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#c6ea5a"/>
                      <stop offset="100%" stop-color="#3d7a1a"/>
                    </linearGradient>
                  </defs>
                </svg>
                <div class="lv__ring-txt">
                  <span class="lv__ring-n">{{ stats.level }}</span>
                  <span class="lv__ring-lbl">уровень</span>
                </div>
              </div>
              <!-- Info -->
              <div class="lv__info">
                <div class="lv__row"><span>Общая оценка</span><b>{{ stats.rating }}</b></div>
                <div class="lv__row"><span>До {{ stats.level + 1 }} ур.</span><b>{{ stats.next_level_rating }}</b></div>
                <div class="lv__row"><span>Прогресс</span><b>{{ levelPct }}%</b></div>
              </div>
            </div>

            <v-divider class="my-3"/>

            <div class="ach-row">
              <v-icon size="16" color="#e8b84b">mdi-star</v-icon>
              <span class="ach-row__txt"><b>{{ stats.unlocked_achievements }}</b> из {{ stats.total_achievements }} достижений</span>
              <router-link :to="{ name: 'volunteer-achievements' }" class="ach-row__link">Все →</router-link>
            </div>
          </template>
        </div>

        <!-- Trust Factor -->
        <div class="card">
          <div class="card__head">
            <div class="card__ico"><v-icon size="18" color="#3d7a1a">mdi-shield-check</v-icon></div>
            <div class="card__head-grow">
              <h2 class="card__title">Trust Factor</h2>
            </div>
            <button class="card__info-btn" type="button" @click="trustFactorInfoDialog = true">
              <v-icon size="15">mdi-information-outline</v-icon>
            </button>
          </div>

          <!-- Number -->
          <div class="tf-num">
            <span class="tf-num__val" :style="{ color: tfColor }">{{ profile.trust_factor }}</span>
            <span class="tf-num__den">/30</span>
          </div>

          <!-- Bar -->
          <div class="prog">
            <div class="prog__fill" :style="{ width: tfPct + '%', background: tfColor }"/>
          </div>

          <!-- Low warning -->
          <div v-if="profile.trust_factor < 10" class="tf-warn">
            <v-icon size="13">mdi-alert</v-icon>
            {{ profile.trust_factor < 5 ? 'Критически низкий! ' : '' }}При TF = 0 нельзя вступать в проекты.
          </div>

          <v-divider class="my-3"/>

          <!-- Average rating -->
          <div class="avg-rat">
            <div class="avg-rat__stars">
              <v-icon v-for="i in 5" :key="i" size="15" :color="i <= Math.round(profile.average_rating) ? '#e8b84b' : 'rgba(0,0,0,0.1)'">mdi-star</v-icon>
            </div>
            <span class="avg-rat__val">{{ profile.average_rating.toFixed(2) }}</span>
            <span class="avg-rat__lbl">Средняя оценка</span>
          </div>

          <button class="btn-link" type="button" @click="openTrustFactorHistory">
            <v-icon size="13">mdi-history</v-icon> История изменений
          </button>
        </div>


      </div>
    </div>

    <!-- ═══════════════════════════════
         DIALOGS
    ═══════════════════════════════ -->

    <!-- Password -->
    <v-dialog v-model="passwordDialog" max-width="460">
      <v-card class="dlg" rounded="xl">
        <div class="dlg__head">
          <div class="card__ico"><v-icon size="18" color="#3d7a1a">mdi-lock-reset</v-icon></div>
          <h2 class="dlg__title">Изменить пароль</h2>
          <button class="dlg__close" type="button" @click="passwordDialog = false"><v-icon size="17">mdi-close</v-icon></button>
        </div>
        <div class="dlg__body">
          <v-form ref="passwordFormRef" @submit.prevent="changePassword">
            <v-text-field v-model="passwordFormState.currentPassword" label="Текущий пароль" variant="outlined" density="comfortable" type="password" prepend-inner-icon="mdi-lock-outline" :rules="[rules.required]" hide-details="auto" class="mb-3"/>
            <v-text-field v-model="passwordFormState.newPassword" label="Новый пароль" variant="outlined" density="comfortable" type="password" prepend-inner-icon="mdi-lock-plus-outline" :rules="[rules.required, v => v.length >= 8 || 'Минимум 8 символов']" hint="Минимум 8 символов" class="mb-3"/>
            <v-text-field v-model="passwordFormState.confirmPassword" label="Подтвердить пароль" variant="outlined" density="comfortable" type="password" prepend-inner-icon="mdi-lock-check-outline" :rules="[rules.required, v => v === passwordFormState.newPassword || 'Пароли не совпадают']" hide-details="auto"/>
          </v-form>
        </div>
        <div class="dlg__foot">
          <button class="btn btn--ghost" type="button" @click="passwordDialog = false">Отмена</button>
          <button class="btn btn--primary" type="button" :disabled="passwordLoading" @click="changePassword">
            {{ passwordLoading ? 'Сохранение…' : 'Изменить' }}
          </button>
        </div>
      </v-card>
    </v-dialog>

    <!-- TF History -->
    <v-dialog v-model="trustFactorHistoryDialog" max-width="640" scrollable>
      <v-card class="dlg" rounded="xl">
        <div class="dlg__head">
          <div class="card__ico"><v-icon size="18" color="#3d7a1a">mdi-history</v-icon></div>
          <h2 class="dlg__title">История Trust Factor</h2>
          <button class="dlg__close" type="button" @click="trustFactorHistoryDialog = false"><v-icon size="17">mdi-close</v-icon></button>
        </div>
        <v-card-text style="max-height:60vh;overflow-y:auto;padding:16px 22px">
          <div v-if="trustFactorHistoryLoading" class="state-center" style="min-height:140px"><v-progress-circular indeterminate color="#8bc34a" size="30"/></div>
          <template v-else-if="trustFactorHistory">
            <div class="tfh-summary">
              <div class="tfh-stat"><span class="tfh-stat__val">{{ trustFactorHistory.current_trust_factor }}</span><span class="tfh-stat__lbl">Trust Factor</span></div>
              <div class="tfh-stat"><span class="tfh-stat__val">{{ trustFactorHistory.current_average_rating.toFixed(2) }}</span><span class="tfh-stat__lbl">Средняя оценка</span></div>
            </div>
            <div v-if="!trustFactorHistory.history.length" class="state-empty" style="min-height:100px">
              <v-icon size="36" color="rgba(0,0,0,0.13)">mdi-history</v-icon><p>История пуста</p>
            </div>
            <div v-else class="tfh-list">
              <div v-for="item in trustFactorHistory.history" :key="item.id" class="tfh-item">
                <div class="tfh-item__dot" :class="item.change_amount > 0 ? 'tfh-item__dot--up' : item.change_amount < 0 ? 'tfh-item__dot--dn' : 'tfh-item__dot--neu'"/>
                <div class="tfh-item__body">
                  <div class="tfh-item__row">
                    <span class="tfh-item__reason">{{ item.reason_display }}</span>
                    <span class="tfh-item__delta" :class="item.change_amount > 0 ? 'tfh-item__delta--up' : 'tfh-item__delta--dn'">{{ item.change_amount > 0 ? '+' : '' }}{{ item.change_amount }}</span>
                  </div>
                  <div class="tfh-item__meta">{{ item.old_value }} → {{ item.new_value }} · {{ new Date(item.created_at).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) }}</div>
                </div>
              </div>
            </div>
          </template>
        </v-card-text>
        <div class="dlg__foot">
          <button class="btn btn--ghost" type="button" @click="trustFactorHistoryDialog = false">Закрыть</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- Rating Info -->
    <v-dialog v-model="ratingInfoDialog" max-width="540" scrollable>
      <v-card class="dlg" rounded="xl">
        <div class="dlg__head">
          <div class="card__ico"><v-icon size="18" color="#3d7a1a">mdi-calculator</v-icon></div>
          <h2 class="dlg__title">Система оценок</h2>
          <button class="dlg__close" type="button" @click="ratingInfoDialog = false"><v-icon size="17">mdi-close</v-icon></button>
        </div>
        <v-card-text style="max-height:62vh;overflow-y:auto;padding:18px 22px">
          <p class="dlg__desc">На платформе <b>BirQadam</b> используются два типа оценок, которые помогают отслеживать ваш вклад и качество работы.</p>

          <div class="tfi-section">
            <div class="tfi-section__head"><v-icon size="15" color="#3d7a1a">mdi-chart-line</v-icon> Общая оценка (Рейтинг)</div>
            <p class="dlg__text mt-2"><b>Общая оценка</b> — это накопительный показатель вашего опыта. Она влияет на ваш <b>уровень</b>.</p>
            <div class="tfi-row"><span>Завершение задачи</span><b class="tfi-row__up">+балл задачи</b></div>
            <div class="tfi-row"><span>Одобрение фотоотчёта</span><b class="tfi-row__up">+от 1 до 5</b></div>
            <div class="tfi-tip mt-2">
              <v-icon size="12" color="#3d7a1a">mdi-information-outline</v-icon>
              Чем сложнее задача и выше оценка от организатора, тем больше баллов вы получаете.
            </div>
          </div>

          <div class="tfi-section mt-4">
            <div class="tfi-section__head"><v-icon size="15" color="#e8b84b">mdi-star</v-icon> Средняя оценка</div>
            <p class="dlg__text mt-2"><b>Средняя оценка</b> — это показатель качества вашей работы по мнению организаторов проектов.</p>
            <div class="calc-box mt-3">
              <div class="calc-label">Формула расчета:</div>
              <div class="calc-formula">Сумма всех звёзд / Количество оценок</div>
            </div>
            <p class="dlg__text mt-3">Каждая ваша задача оценивается организатором по 5-балльной шкале. Чем выше средняя оценка, тем больше доверия к вам со стороны новых организаторов.</p>
          </div>
        </v-card-text>
        <div class="dlg__foot">
          <button class="btn btn--primary" type="button" @click="ratingInfoDialog = false">Понятно</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- TF Info -->
    <v-dialog v-model="trustFactorInfoDialog" max-width="540" scrollable>
      <v-card class="dlg" rounded="xl">
        <div class="dlg__head">
          <div class="card__ico"><v-icon size="18" color="#3d7a1a">mdi-shield-check</v-icon></div>
          <h2 class="dlg__title">Как работает Trust Factor?</h2>
          <button class="dlg__close" type="button" @click="trustFactorInfoDialog = false"><v-icon size="17">mdi-close</v-icon></button>
        </div>
        <v-card-text style="max-height:62vh;overflow-y:auto;padding:18px 22px">
          <p class="dlg__desc"><b>Trust Factor (TF)</b> — показатель надёжности волонтёра. Максимум: <b>30 баллов</b>. При TF = 0 нельзя вступать в проекты.</p>

          <div class="tfi-section tfi-section--plus">
            <div class="tfi-section__head"><v-icon size="15" color="#3d7a1a">mdi-plus-circle</v-icon> Начисляются баллы</div>
            <div class="tfi-row"><span>Оценка фотоотчёта 5 ⭐</span><b class="tfi-row__up">+2</b></div>
            <div class="tfi-row"><span>Оценка фотоотчёта 4 ⭐</span><b class="tfi-row__up">+1</b></div>
            <div class="tfi-row"><span>Оценка фотоотчёта 3 ⭐</span><b style="color:rgba(0,0,0,0.4)">0</b></div>
          </div>

          <div class="tfi-section tfi-section--minus">
            <div class="tfi-section__head"><v-icon size="15" color="#dc2626">mdi-minus-circle</v-icon> Снимаются баллы</div>
            <div class="tfi-row"><span>Выход из проекта</span><b class="tfi-row__dn">−5</b></div>
            <div class="tfi-row"><span>Оценка фотоотчёта 1–2 ⭐</span><b class="tfi-row__dn">−1</b></div>
            <div class="tfi-row"><span>Отклонение задачи</span><b class="tfi-row__dn">−2</b></div>
          </div>

          <div class="tfi-tip">
            <v-icon size="13" color="#3d7a1a">mdi-lightbulb-outline</v-icon>
            Загружайте качественные фотоотчёты и завершайте начатые проекты.
          </div>
        </v-card-text>
        <div class="dlg__foot">
          <button class="btn btn--primary" type="button" @click="trustFactorInfoDialog = false">Понятно</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3500" rounded="pill" location="top">
      <div style="display:flex;align-items:center;gap:8px">
        <v-icon size="17">{{ snackbar.color === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
        {{ snackbar.message }}
      </div>
    </v-snackbar>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════
   TOKENS
═══════════════════════════════════════ */
.pv {
  --g:    #3d7a1a;
  --gm:   #8bc34a;
  --gl:   #c6ea5a;
  --gp:   #e8f5e2;
  --ink:  #111a0e;
  --ink2: rgba(17,26,14,.50);
  --card: #ffffff;
  --surf: #f5f7f3;
  --r:    16px;

  max-width: 1200px;
  margin: 0 auto;
  padding: clamp(14px,3vw,28px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: 'DM Sans','Segoe UI',sans-serif;
}

.qs__lbl-wrap {
  display: flex;
  align-items: center;
  margin-top: 2px;
}

/* ═══════════════════════════════════════
   HERO
═══════════════════════════════════════ */
.hero {
  position: relative;
  background: #0e1f08;
  border-radius: 20px;
  padding: clamp(20px,4vw,32px) clamp(20px,4vw,36px);
  overflow: hidden;
}

.hero__bg { position: absolute; inset: 0; pointer-events: none; }

.hero__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: .45;
}
.hero__orb--a { width: 340px; height: 340px; background: radial-gradient(circle,rgba(139,195,74,.55),transparent); top:-110px; left:-60px; }
.hero__orb--b { width: 240px; height: 240px; background: radial-gradient(circle,rgba(198,234,90,.3),transparent);  bottom:-70px; right:-30px; }

.hero__grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(139,195,74,.05) 1px,transparent 1px),
    linear-gradient(90deg,rgba(139,195,74,.05) 1px,transparent 1px);
  background-size: 36px 36px;
}

.hero__body {
  position: relative; z-index: 2;
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.hero__avatar {
  flex-shrink: 0;
  width: 72px; height: 72px;
  border-radius: 50%;
  background: rgba(139,195,74,.18);
  border: 2px solid rgba(139,195,74,.28);
  display: flex; align-items: center; justify-content: center;
}

.hero__text  { flex: 1; color: #fff; min-width: 0; }

.hero__name {
  font-size: clamp(1.15rem,2.5vw,1.65rem);
  font-weight: 800;
  letter-spacing: -.4px;
  line-height: 1.2;
  margin: 0 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero__contacts { display: flex; flex-wrap: wrap; gap: 12px; }

.hero__contact {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: .78rem;
  font-weight: 600;
  color: rgba(255,255,255,.5);
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 100px;
  background: rgba(198,234,90,.12);
  border: 1px solid rgba(198,234,90,.25);
  color: #c6ea5a;
  font-size: .72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .8px;
  white-space: nowrap;
}

/* ═══════════════════════════════════════
   QUICK STATS
═══════════════════════════════════════ */
.qs {
  display: flex;
  align-items: center;
  background: var(--card);
  border-radius: var(--r);
  border: 1px solid rgba(0,0,0,.07);
  overflow: hidden;
}

.qs__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px 10px;
  gap: 3px;
}

.qs__val  { font-size: 1.4rem; font-weight: 900; color: var(--g); letter-spacing: -.5px; line-height: 1; }
.qs__sub  { font-size: .7em; color: var(--ink2); }
.qs__lbl  { font-size: .67rem; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--ink2); }
.qs__sep  { width: 1px; height: 34px; background: rgba(0,0,0,.07); flex-shrink: 0; }

/* ═══════════════════════════════════════
   MAIN GRID
═══════════════════════════════════════ */
.grid {
  display: grid;
  grid-template-columns: 1fr 292px;
  gap: 16px;
  align-items: start;
}

.col { display: flex; flex-direction: column; gap: 16px; }

/* ═══════════════════════════════════════
   CARD
═══════════════════════════════════════ */
.card {
  background: var(--card);
  border-radius: var(--r);
  border: 1px solid rgba(0,0,0,.07);
  padding: 22px;
}

.card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.card__ico {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: var(--gp);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.card__ico--tg { background: rgba(43,122,191,.1); }

.card__head-grow { flex: 1; }
.card__title { font-size: .94rem; font-weight: 800; color: var(--ink); margin: 0; line-height: 1.2; }
.card__sub   { font-size: .74rem; color: var(--ink2); margin: 2px 0 0; }

.card__info-btn {
  flex-shrink: 0;
  width: 28px; height: 28px;
  border-radius: 50%;
  background: rgba(0,0,0,.04);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--ink2);
  transition: background .15s;
}
.card__info-btn:hover { background: rgba(0,0,0,.09); }

/* ═══════════════════════════════════════
   FORM
═══════════════════════════════════════ */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.pf--full { grid-column: 1 / -1; }

/* Vuetify field focus colour */
.pf :deep(.v-field--focused .v-field__outline) { --v-field-border-color: #8bc34a !important; }

.form-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 18px;
}

/* ═══════════════════════════════════════
   BUTTONS
═══════════════════════════════════════ */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 100px;
  font-size: .83rem;
  font-weight: 800;
  border: none;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s, background .15s, opacity .15s;
  white-space: nowrap;
  text-decoration: none;
}
.btn:hover:not(:disabled)  { transform: translateY(-1px); }
.btn:disabled              { opacity: .5; cursor: not-allowed; }

.btn--primary { background: var(--g); color: #fff; box-shadow: 0 4px 14px rgba(61,122,26,.28); }
.btn--primary:hover:not(:disabled) { background: #2e6313; box-shadow: 0 6px 18px rgba(61,122,26,.38); }

.btn--outline { background: transparent; color: var(--g); border: 1.5px solid rgba(61,122,26,.28); }
.btn--outline:hover:not(:disabled) { background: var(--gp); }

.btn--ghost { background: transparent; color: var(--ink2); }
.btn--ghost:hover:not(:disabled) { background: rgba(0,0,0,.04); color: var(--ink); }

.btn--tg { background: #2b7abf; color: #fff; width: 100%; justify-content: center; box-shadow: 0 4px 12px rgba(43,122,191,.22); }
.btn--tg:hover:not(:disabled) { background: #1e5f96; }

.btn--block { width: 100%; justify-content: center; }

.btn-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: .76rem;
  font-weight: 700;
  color: var(--g);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background .15s;
  margin-top: 8px;
}
.btn-link:hover { background: var(--gp); }

/* ═══════════════════════════════════════
   PROGRESS BAR
═══════════════════════════════════════ */
.prog {
  height: 7px;
  background: rgba(0,0,0,.07);
  border-radius: 100px;
  overflow: hidden;
  margin: 8px 0;
}
.prog__fill {
  height: 100%;
  border-radius: 100px;
  transition: width 1s ease;
}

/* ═══════════════════════════════════════
   LEVEL CARD
═══════════════════════════════════════ */
.lv { display: flex; align-items: center; gap: 14px; }

.lv__ring-wrap { position: relative; width: 88px; height: 88px; flex-shrink: 0; }
.lv__ring-svg  { width: 100%; height: 100%; }

.lv__ring-txt {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}
.lv__ring-n   { font-size: 1.55rem; font-weight: 900; color: var(--ink); letter-spacing: -1px; line-height: 1; }
.lv__ring-lbl { font-size: .58rem; font-weight: 700; color: var(--ink2); text-transform: uppercase; letter-spacing: .5px; }

.lv__info { flex: 1; display: flex; flex-direction: column; gap: 7px; }
.lv__row  { display: flex; justify-content: space-between; font-size: .8rem; color: var(--ink2); }
.lv__row b { color: var(--ink); }

.ach-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 11px;
  background: var(--surf);
  border-radius: 10px;
  font-size: .8rem;
}
.ach-row__txt  { flex: 1; color: var(--ink2); }
.ach-row__link { font-size: .76rem; font-weight: 800; color: var(--g); text-decoration: none; }
.ach-row__link:hover { color: #2e6313; }

/* ═══════════════════════════════════════
   TRUST FACTOR
═══════════════════════════════════════ */
.tf-num { display: flex; align-items: baseline; gap: 3px; margin-bottom: 4px; }
.tf-num__val { font-size: 2.5rem; font-weight: 900; letter-spacing: -2px; line-height: 1; }
.tf-num__den { font-size: .95rem; color: var(--ink2); font-weight: 700; }

.tf-warn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: .73rem;
  color: #dc2626;
  padding: 7px 10px;
  border-radius: 8px;
  background: rgba(220,38,38,.06);
  border: 1px solid rgba(220,38,38,.14);
  margin-top: 6px;
}

.avg-rat { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.avg-rat__stars { display: flex; gap: 2px; }
.avg-rat__val   { font-size: 1.05rem; font-weight: 900; color: #e8b84b; }
.avg-rat__lbl   { font-size: .7rem; color: var(--ink2); font-weight: 600; }

/* ═══════════════════════════════════════
   ACTIVITY
═══════════════════════════════════════ */
.act-pill {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 11px 14px;
  background: rgba(139,195,74,.08);
  border-radius: 12px;
  margin-bottom: 14px;
}
.act-pill__n   { font-size: 1.9rem; font-weight: 900; color: var(--g); letter-spacing: -1px; line-height: 1; }
.act-pill__lbl { font-size: .72rem; font-weight: 700; color: var(--ink2); text-transform: uppercase; letter-spacing: .5px; }

.act-bars {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 76px;
  margin-bottom: 4px;
}

.act-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  height: 100%;
}

.act-bar__val  { font-size: .64rem; font-weight: 800; color: var(--g); }

.act-bar__track {
  flex: 1;
  width: 100%;
  background: rgba(0,0,0,.06);
  border-radius: 4px 4px 0 0;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}
.act-bar__fill {
  width: 100%;
  background: linear-gradient(180deg,#c6ea5a,#8bc34a);
  border-radius: 4px 4px 0 0;
  transition: height .6s ease;
}

.act-bar__lbl {
  font-size: .62rem;
  font-weight: 700;
  color: var(--ink2);
  text-transform: uppercase;
  letter-spacing: .3px;
}

.act-totals {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0,0,0,.06);
}
.act-tot {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: .74rem;
  color: var(--ink2);
}
.act-tot b { color: var(--ink); }

/* ═══════════════════════════════════════
   QUICK LINKS
═══════════════════════════════════════ */
.ql { display: flex; flex-direction: column; gap: 8px; }

.ql__item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 13px;
  border-radius: 12px;
  background: var(--surf);
  text-decoration: none;
  transition: background .15s, transform .15s;
}
.ql__item:hover { background: #ddefd4; transform: translateX(3px); }

.ql__ico {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ql__ico--green  { background: var(--gp); }
.ql__ico--purple { background: rgba(123,94,167,.1); }

.ql__text { flex: 1; }
.ql__name { display: block; font-size: .855rem; font-weight: 700; color: var(--ink); }
.ql__sub  { display: block; font-size: .71rem; color: var(--ink2); margin-top: 1px; }

/* ═══════════════════════════════════════
   TELEGRAM
═══════════════════════════════════════ */
.tg-ok__row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: .855rem;
  font-weight: 700;
  color: var(--g);
  padding: 10px 12px;
  background: rgba(61,122,26,.07);
  border-radius: 10px;
  margin-bottom: 8px;
}
.tg-ok__id {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: .76rem;
  color: var(--ink2);
  padding: 4px 12px;
}

.tg-no__hint { font-size: .81rem; color: var(--ink2); margin: 0 0 12px; line-height: 1.5; }

.tg-code { margin-bottom: 4px; }
.tg-code__lbl { font-size: .67rem; font-weight: 800; text-transform: uppercase; letter-spacing: .7px; color: var(--ink2); margin-bottom: 6px; }

.tg-code__box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 13px;
  background: rgba(43,122,191,.06);
  border: 1.5px solid rgba(43,122,191,.18);
  border-radius: 11px;
  margin-bottom: 9px;
}
.tg-code__val {
  font-family: 'Fira Code',monospace;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 3px;
  color: #2b7abf;
}
.tg-code__copy {
  width: 28px; height: 28px;
  border-radius: 7px;
  background: rgba(43,122,191,.1);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #2b7abf;
  transition: background .15s;
}
.tg-code__copy:hover { background: rgba(43,122,191,.2); }

.tg-code__hint {
  font-size: .76rem;
  color: var(--ink2);
  line-height: 1.5;
  margin: 0 0 9px;
}

/* ═══════════════════════════════════════
   STATES
═══════════════════════════════════════ */
.state-center {
  display: flex; align-items: center; justify-content: center;
  min-height: 110px;
}
.state-empty {
  display: flex; flex-direction: column;
  align-items: center; gap: 8px;
  padding: 28px 0;
  color: var(--ink2); font-size: .8rem; text-align: center;
}
.state-empty p { margin: 0; }

/* ═══════════════════════════════════════
   DIALOGS
═══════════════════════════════════════ */
.dlg { background: #fff; overflow: hidden; }

.dlg__head {
  display: flex; align-items: center; gap: 11px;
  padding: 18px 20px 15px;
  border-bottom: 1px solid rgba(0,0,0,.07);
}
.dlg__title { flex: 1; font-size: .96rem; font-weight: 800; color: var(--ink); margin: 0; }

.dlg__close {
  width: 28px; height: 28px;
  border-radius: 50%; border: none;
  background: rgba(0,0,0,.05);
  color: var(--ink2); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.dlg__close:hover { background: rgba(0,0,0,.1); }

.dlg__body { padding: 18px 20px; }

.dlg__foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 13px 20px;
  border-top: 1px solid rgba(0,0,0,.07);
}

.dlg__desc { font-size: .855rem; color: var(--ink2); line-height: 1.6; margin-bottom: 14px; }

/* TF Info sections */
.tfi-section {
  border-radius: 12px; padding: 13px; margin-bottom: 10px;
}
.tfi-section--plus  { background: rgba(61,122,26,.06);  border: 1px solid rgba(61,122,26,.12); }
.tfi-section--minus { background: rgba(220,38,38,.05);  border: 1px solid rgba(220,38,38,.12); }

.tfi-section__head {
  display: flex; align-items: center; gap: 6px;
  font-size: .78rem; font-weight: 800; margin-bottom: 9px; color: var(--ink);
}

.tfi-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: .8rem; color: var(--ink2);
  padding: 5px 0;
  border-bottom: 1px solid rgba(0,0,0,.05);
}
.tfi-row:last-child { border-bottom: none; }
.tfi-row__up { font-size: .87rem; font-weight: 900; color: var(--g); }
.tfi-row__dn { font-size: .87rem; font-weight: 900; color: #dc2626; }

.tfi-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--gp);
  color: var(--g);
  padding: 10px 14px;
  border-radius: 12px;
  font-size: .8rem;
  font-weight: 600;
  line-height: 1.4;
}

.dlg__text {
  font-size: .88rem;
  color: var(--ink);
  line-height: 1.5;
}

.calc-box {
  background: #f8faf7;
  border: 1px dashed rgba(0,0,0,.1);
  border-radius: 10px;
  padding: 12px;
}

.calc-label {
  font-size: .72rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--ink2);
  margin-bottom: 6px;
}

.calc-formula {
  font-size: .94rem;
  font-weight: 700;
  color: var(--g);
  font-family: 'DM Mono', monospace;
}

/* TF History */
.tfh-summary {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  margin-bottom: 14px;
}
.tfh-stat {
  padding: 13px; background: var(--surf);
  border-radius: 11px; text-align: center;
}
.tfh-stat__val { display: block; font-size: 1.35rem; font-weight: 900; color: var(--g); }
.tfh-stat__lbl { display: block; font-size: .68rem; color: var(--ink2); margin-top: 2px; text-transform: uppercase; letter-spacing: .4px; }

.tfh-list { display: flex; flex-direction: column; }

.tfh-item {
  display: flex; gap: 11px;
  padding: 11px 0;
  border-bottom: 1px solid rgba(0,0,0,.06);
}
.tfh-item:last-child { border-bottom: none; }

.tfh-item__dot {
  width: 9px; height: 9px; border-radius: 50%;
  flex-shrink: 0; margin-top: 5px;
}
.tfh-item__dot--up  { background: var(--g); }
.tfh-item__dot--dn  { background: #dc2626; }
.tfh-item__dot--neu { background: rgba(0,0,0,.2); }

.tfh-item__body { flex: 1; min-width: 0; }
.tfh-item__row  { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 3px; }
.tfh-item__reason { font-size: .82rem; font-weight: 700; color: var(--ink); flex: 1; }
.tfh-item__delta  { font-size: .82rem; font-weight: 900; white-space: nowrap; }
.tfh-item__delta--up { color: var(--g); }
.tfh-item__delta--dn { color: #dc2626; }
.tfh-item__meta { font-size: .7rem; color: var(--ink2); }

/* ═══════════════════════════════════════
   RESPONSIVE
═══════════════════════════════════════ */
@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
  .col--side {
    order: -1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px,1fr));
    gap: 16px;
  }
}

@media (max-width: 640px) {
  .hero__body { flex-direction: column; text-align: center; }
  .hero__contacts { justify-content: center; }
  .hero__badge { align-self: center; }

  .qs { flex-wrap: wrap; }
  .qs__item { flex: 1 0 40%; }
  .qs__sep  { display: none; }

  .form-grid { grid-template-columns: 1fr; }
  .pf--full  { grid-column: auto; }
  .form-actions { flex-direction: column; }
  .form-actions .btn { width: 100%; justify-content: center; }

  .col--side { grid-template-columns: 1fr; }
  .act-totals { grid-template-columns: 1fr 1fr; }
}
</style>