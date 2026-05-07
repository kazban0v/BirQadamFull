<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useOrganizerStore } from '@/stores/organizer';
import telegramIcon from '@/assets/icons/telegram.png';

const router = useRouter();
const authStore = useAuthStore();
const organizerStore = useOrganizerStore();

const status = computed(() => authStore.user?.organizer_status ?? 'pending');
const isApproved = computed(() => status.value === 'approved');
const isRejected = computed(() => status.value === 'rejected');

if (organizerStore.isOrganizer) {
  organizerStore.loadProjects();
}

// Автоматическое обновление статуса онбординга
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null);
const isRefreshing = ref(false);

const refreshOrganizerStatus = async () => {
  if (isRefreshing.value) return;
  try {
    isRefreshing.value = true;
    await authStore.loadUser();
    if (organizerStore.isOrganizer) {
      await organizerStore.loadProjects(true);
    }
  } catch (error) {
    console.error('Failed to refresh organizer status:', error);
  } finally {
    isRefreshing.value = false;
  }
};

// Автоматическое обновление каждые 30 секунд, если статус pending
watch(() => status.value, (newStatus) => {
  if (newStatus === 'pending' && !refreshInterval.value) {
    refreshInterval.value = setInterval(refreshOrganizerStatus, 30000); // 30 секунд
  } else if (newStatus !== 'pending' && refreshInterval.value) {
    clearInterval(refreshInterval.value);
    refreshInterval.value = null;
  }
}, { immediate: true });

onMounted(() => {
  if (status.value === 'rejected') {
    void router.replace({ name: 'organizer-application-rejected' });
    return;
  }
  refreshOrganizerStatus();
  if (status.value === 'pending') {
    refreshInterval.value = setInterval(refreshOrganizerStatus, 30000);
  }
});

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
});

const quickActionsList = [
  {
    title: 'Создать проект',
    description: 'Опишите идею, укажите город и тип волонтёров.',
    icon: 'mdi-rocket-launch-outline',
    accent: '#558b2f',
    bg: 'rgba(139, 195, 74, 0.1)',
    to: '/organizer/projects',
    tag: 'Проекты',
  },
  {
    title: 'Команда волонтёров',
    description: 'Просматривайте участников и отслеживайте активность.',
    icon: 'mdi-account-multiple-check-outline',
    accent: '#00695c',
    bg: 'rgba(0, 137, 123, 0.1)',
    to: '/organizer/volunteers',
    tag: 'Команда',
  },
  {
    title: 'Назначить задачу',
    description: 'Создавайте задания и уведомляйте волонтёров.',
    icon: 'mdi-clipboard-plus-outline',
    accent: '#283593',
    bg: 'rgba(57, 73, 171, 0.1)',
    to: '/organizer/tasks',
    tag: 'Задачи',
  },
  {
    title: 'Проверить фото',
    description: 'Утверждайте фотоотчёты и оставляйте комментарии.',
    icon: 'mdi-image-filter-center-focus-strong-outline',
    accent: '#bf360c',
    bg: 'rgba(230, 74, 25, 0.1)',
    to: '/organizer/photo-moderation',
    tag: 'Модерация',
  },
  {
    title: 'Мои проекты',
    description: 'Отслеживайте статус заявок и прогресс по задачам.',
    icon: 'mdi-view-list-outline',
    accent: '#4527a0',
    bg: 'rgba(94, 53, 177, 0.1)',
    to: '/organizer/projects',
    tag: 'Статистика',
  },
];

const quickActions = computed(() => (isApproved.value ? quickActionsList : []));

const approvalSnackbar = ref(false);

watch(status, (val, oldVal) => {
  if (oldVal !== undefined && oldVal === 'pending' && val === 'approved') {
    approvalSnackbar.value = true;
    void organizerStore.loadProjects(true);
  }
});

const onboardingSteps = computed(() => {
  const steps = [
    {
      key: 'submitted',
      title: 'Заявка отправлена',
      description: 'Профиль заполнен, контактные данные указаны.',
      status: 'done' as const,
    },
    {
      key: 'review',
      title: 'Проверка модератором',
      description: isApproved.value
        ? 'Команда BirQadam завершила проверку и подтвердила заявку.'
        : 'Команда BirQadam оценивает документы — обычно до 24 часов.',
      status: isApproved.value ? 'done' : isRejected.value ? 'error' : 'active',
    },
  ];
  if (isApproved.value) {
    steps.push({
      key: 'approval',
      title: 'Доступ открыт',
      description: 'Можно создавать проекты, приглашать команду и управлять задачами.',
      status: 'done' as const,
    });
  }
  const currentKey = isApproved.value ? 'approval' : 'review';
  return steps.map((s, i) => ({ ...s, index: i, isCurrent: s.key === currentKey, total: steps.length }));
});

const statusConfig = computed(() => {
  if (isApproved.value) return {
    color: '#2e7d32', bg: 'rgba(46,125,50,0.07)', border: 'rgba(46,125,50,0.18)',
    icon: 'mdi-check-decagram', chip: 'Одобрено',
    title: 'Заявка одобрена',
    text: 'Уведомление отправлено в Telegram и email. Можно создавать проекты.',
    details: [
      { icon: 'mdi-rocket-launch-outline', text: 'Создайте первый проект и добавьте команду.' },
      { icon: 'mdi-bell-ring-outline', text: 'Уведомления — в Telegram и приложении.' },
    ],
    action: { label: 'Создать проект', to: '/organizer/projects' },
  };
  if (isRejected.value) return {
    color: '#c62828', bg: 'rgba(198,40,40,0.06)', border: 'rgba(198,40,40,0.16)',
    icon: 'mdi-alert-circle', chip: 'Нужны правки',
    title: 'Нужны доработки',
    text: 'Проверьте комментарии модератора, обновите данные и отправьте заявку повторно.',
    details: [
      { icon: 'mdi-pencil-outline', text: 'Обновите профиль организатора.' },
      { icon: 'mdi-headset', text: 'Вопросы — напишите в поддержку BirQadam.' },
    ],
    action: null,
  };
  return {
    color: '#e65100', bg: 'rgba(230,81,0,0.06)', border: 'rgba(230,81,0,0.16)',
    icon: 'mdi-progress-clock', chip: 'На модерации',
    title: 'Заявка на рассмотрении',
    text: 'Обычно проверка занимает до 24 часов. Уведомим сразу после решения.',
    details: [
      { icon: 'mdi-telegram', text: 'Уведомим в Telegram и email после решения.' },
      { icon: 'mdi-clipboard-text-outline', text: 'Подготовьте описание проекта и список задач.' },
    ],
    action: null,
  };
});

const onboardingProgress = computed(() => {
  if (isApproved.value) return 100;
  if (isRejected.value) return 33;
  return 66;
});

const stepIconConfig = (st: string) => {
  const map: Record<string, { icon: string; bg: string }> = {
    done:    { icon: 'mdi-check',            bg: 'linear-gradient(135deg,#4caf50,#2e7d32)' },
    active:  { icon: 'mdi-progress-clock',   bg: 'linear-gradient(135deg,#8bc34a,#558b2f)' },
    error:   { icon: 'mdi-alert',            bg: 'linear-gradient(135deg,#e53935,#c62828)' },
    waiting: { icon: 'mdi-dots-horizontal',  bg: 'linear-gradient(135deg,#90a4ae,#607d8b)' },
  };
  return map[st] || map.waiting;
};

const infoCards = [
  {
    title: 'Синхронизация с Telegram',
    text: 'Все действия из веб-портала сразу появляются в Telegram-боте.',
    iconSrc: telegramIcon,
    accent: '#0088cc',
    bg: 'rgba(0,136,204,0.08)',
  },
  {
    title: 'Мгновенные уведомления',
    text: 'Команда получает пуш-уведомления о задачах и комментариях.',
    icon: 'mdi-bell-badge-outline',
    accent: '#e65100',
    bg: 'rgba(230,81,0,0.08)',
  },
  {
    title: 'Аналитика',
    text: 'Подробная статистика по проектам, фото и активности волонтёров.',
    icon: 'mdi-chart-areaspline',
    accent: '#4527a0',
    bg: 'rgba(94,53,177,0.08)',
  },
];

const navigate = (to: string) => router.push(to);
</script>

<template>
  <div class="dashboard">

    <!-- ─── Hero ─── -->
    <div class="hero">
      <div class="hero__content">
        <div class="hero__badge">
          <v-icon icon="mdi-account-tie-outline" size="15" />
          Кабинет организатора
        </div>
        <h1 class="hero__title">
          Управляйте проектами,<br />командой и задачами
        </h1>
        <p class="hero__sub">
          Весь инструментарий в одном месте — синхронизировано с Telegram-ботом.
        </p>
        <div v-if="isApproved" class="hero__btns">
          <button class="hero__btn hero__btn--solid" @click="navigate('/organizer/projects')">
            <v-icon icon="mdi-rocket-launch-outline" size="17" />
            Начать с проекта
          </button>
          <button class="hero__btn hero__btn--outline" @click="navigate('/organizer/tasks')">
            <v-icon icon="mdi-clipboard-plus-outline" size="17" />
            Назначить задачу
          </button>
        </div>
      </div>
      <div class="hero__art" aria-hidden="true">
        <div class="hero__orb hero__orb--1" />
        <div class="hero__orb hero__orb--2" />
        <v-icon icon="mdi-account-group-outline" class="hero__art-icon" />
      </div>
    </div>

    <!-- ─── Onboarding ─── -->
    <div class="section-card">
      <div class="onboarding-top">
        <div>
          <div class="status-pill" :style="{ color: statusConfig.color, background: statusConfig.bg, borderColor: statusConfig.border }">
            <v-icon :icon="statusConfig.icon" size="13" />
            {{ statusConfig.chip }}
          </div>
          <h2 class="card-title mt-2">Онбординг организатора</h2>
          <p class="card-sub">Этапы подготовки к запуску проектов.</p>
        </div>
        <div class="progress-widget">
          <v-progress-circular
            :model-value="onboardingProgress"
            :color="isRejected ? '#c62828' : '#8bc34a'"
            size="54"
            width="5"
            bg-color="rgba(0,0,0,0.07)"
          >
            <span class="progress-pct">{{ onboardingProgress }}%</span>
          </v-progress-circular>
          <span class="progress-lbl">
            {{ isApproved ? 'Готово' : isRejected ? 'Правки' : 'В процессе' }}
          </span>
        </div>
      </div>

      <!-- Steps -->
      <div class="steps-grid">
        <div
          v-for="(step, index) in onboardingSteps"
          :key="step.key"
          class="step-card"
          :class="[`step-card--${step.status}`, { 'step-card--current': step.isCurrent }]"
          :style="{ animationDelay: `${index * 0.15}s` }"
        >
          <!-- Анимированная линия соединения -->
          <div 
            v-if="index < onboardingSteps.length - 1" 
            class="step-connector"
            :class="{ 'step-connector--active': step.status === 'done' }"
          >
            <div class="step-connector__line"></div>
            <div 
              class="step-connector__progress" 
              :style="{ width: step.status === 'done' ? '100%' : '0%' }"
            ></div>
          </div>
          
          <div class="step-card__num">{{ step.index + 1 }} / {{ step.total }}</div>
          <div 
            class="step-card__icon" 
            :style="{ background: stepIconConfig(step.status)?.bg || 'rgba(0,0,0,0.1)' }"
            :class="{ 
              'step-card__icon--pulse': step.isCurrent && step.status === 'active',
              'step-card__icon--success': step.status === 'done'
            }"
          >
            <v-icon :icon="stepIconConfig(step.status)?.icon || 'mdi-circle'" size="20" color="white" />
            <!-- Анимация для активного шага -->
            <div v-if="step.isCurrent && step.status === 'active'" class="step-card__icon-ring"></div>
          </div>
          <div class="step-card__title">{{ step.title }}</div>
          <p class="step-card__desc">{{ step.description }}</p>
          <div v-if="step.isCurrent" class="step-card__now">
            <span class="step-card__now-dot"></span>
            Сейчас
          </div>
        </div>
      </div>

      <!-- Status banner -->
      <div class="status-banner" :style="{ background: statusConfig.bg, borderColor: statusConfig.border }">
        <div class="status-banner__icon-box" :style="{ background: statusConfig.color + '18' }">
          <v-icon :icon="statusConfig.icon" size="24" :style="{ color: statusConfig.color }" />
        </div>
        <div class="status-banner__body">
          <div class="status-banner__title" :style="{ color: statusConfig.color }">{{ statusConfig.title }}</div>
          <p class="status-banner__text">{{ statusConfig.text }}</p>
          <div class="status-banner__details">
            <div v-for="d in statusConfig.details" :key="d.text" class="status-banner__detail">
              <v-icon :icon="d.icon" size="14" :style="{ color: statusConfig.color }" />
              {{ d.text }}
            </div>
          </div>
        </div>
        <button
          v-if="statusConfig.action"
          class="status-banner__btn"
          :style="{ background: statusConfig.color }"
          @click="navigate(statusConfig.action.to)"
        >
          {{ statusConfig.action.label }}
          <v-icon icon="mdi-arrow-right" size="16" />
        </button>
      </div>
    </div>

    <!-- ─── How it works ─── -->
    <div class="section-card">
      <div class="section-card__row">
        <div>
          <h2 class="card-title">Как работает кабинет</h2>
          <p class="card-sub">Синхронизировано с Telegram-ботом</p>
        </div>
        <div class="bot-badge">
          <v-icon icon="mdi-robot-outline" size="15" />
          Telegram бот
        </div>
      </div>

      <div class="info-row">
        <div
          v-for="card in infoCards"
          :key="card.title"
          class="info-tile"
          :style="{ background: card.bg }"
        >
          <div class="info-tile__icon">
            <v-img v-if="card.iconSrc" :src="card.iconSrc" width="22" height="22" />
            <v-icon v-else :icon="card.icon" size="22" :style="{ color: card.accent }" />
          </div>
          <div class="info-tile__title">{{ card.title }}</div>
          <p class="info-tile__text">{{ card.text }}</p>
        </div>
      </div>
    </div>

    <!-- ─── Quick actions ─── -->
    <div v-if="isApproved">
      <div class="actions-head">Быстрые действия</div>
      <div class="actions-grid">
        <div
          v-for="action in quickActions"
          :key="action.title"
          class="action-tile"
          @click="navigate(action.to)"
        >
          <div class="action-tile__tag" :style="{ color: action.accent, background: action.bg }">
            {{ action.tag }}
          </div>
          <div class="action-tile__icon" :style="{ background: action.bg }">
            <v-icon :icon="action.icon" size="26" :style="{ color: action.accent }" />
          </div>
          <div class="action-tile__title">{{ action.title }}</div>
          <p class="action-tile__desc">{{ action.description }}</p>
          <div class="action-tile__arrow" :style="{ color: action.accent }">
            <v-icon icon="mdi-arrow-right" size="18" />
          </div>
        </div>
      </div>
    </div>

  <v-snackbar v-model="approvalSnackbar" color="success" timeout="5000" location="top">
    Заявка одобрена — доступны все разделы кабинета.
  </v-snackbar>
  </div>
</template>

<style scoped>
/* ─── Base ─── */
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ─── Hero ─── */
.hero {
  display: flex;
  align-items: stretch;
  background: linear-gradient(118deg, #2d5a1b 0%, #4a8f2a 48%, #d4631a 100%);
  border-radius: 24px;
  overflow: hidden;
  min-height: 230px;
  position: relative;
}

.hero__content {
  padding: clamp(24px, 4vw, 44px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  z-index: 2;
  max-width: 560px;
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 100px;
  padding: 5px 14px;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  width: fit-content;
}

.hero__title {
  font-size: clamp(1.45rem, 3vw, 2.15rem);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.4px;
  color: #fff;
  margin: 0;
}

.hero__sub {
  font-size: 0.925rem;
  color: rgba(255,255,255,0.7);
  margin: 0;
  line-height: 1.5;
}

.hero__btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.hero__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 20px;
  border-radius: 100px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}
.hero__btn:hover { opacity: 0.88; transform: translateY(-1px); }
.hero__btn--solid  { background: #fff; color: #2d5a1b; border: none; }
.hero__btn--outline { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,0.45); }

.hero__art {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 150px;
}

.hero__orb {
  position: absolute;
  border-radius: 50%;
}
.hero__orb--1 {
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%);
  top: 10%; right: 15%;
}
.hero__orb--2 {
  width: 280px; height: 280px;
  background: radial-gradient(circle, rgba(212,99,26,0.2), transparent 70%);
  bottom: -30px; right: -5%;
}
.hero__art-icon {
  font-size: 110px !important;
  color: rgba(255,255,255,0.15) !important;
  position: relative;
}

@media (max-width: 768px) {
  .hero { flex-direction: column; }
  .hero__art { min-height: 110px; }
}

/* ─── Section card ─── */
.section-card {
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(0,0,0,0.07);
  padding: clamp(18px, 3vw, 26px);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-card__row {
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
  margin: 0;
}

.card-sub {
  font-size: 0.825rem;
  color: rgba(0,0,0,0.44);
  margin: 3px 0 0;
}

/* ─── Onboarding top row ─── */
.onboarding-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  border-radius: 100px;
  border: 1px solid;
  font-size: 0.78rem;
  font-weight: 700;
  width: fit-content;
}

.progress-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.progress-pct {
  font-size: 0.7rem;
  font-weight: 800;
  color: #1a1a1a;
}

.progress-lbl {
  font-size: 0.72rem;
  color: rgba(0,0,0,0.42);
  font-weight: 600;
}

/* ─── Steps ─── */
.steps-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
}

.step-card {
  position: relative;
  background: #fafafa;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.07);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: stepSlideIn 0.6s ease-out forwards;
}

@keyframes stepSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-card--current {
  border-color: rgba(139,195,74,0.32);
  background: rgba(139,195,74,0.04);
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(139,195,74,0.12);
  animation: stepCurrentPulse 2s ease-in-out infinite;
}

@keyframes stepCurrentPulse {
  0%, 100% {
    box-shadow: 0 8px 22px rgba(139,195,74,0.12);
  }
  50% {
    box-shadow: 0 12px 28px rgba(139,195,74,0.18);
  }
}

.step-card--error {
  border-color: rgba(198,40,40,0.18);
  background: rgba(198,40,40,0.03);
}

.step-card--done {
  animation: stepDoneSuccess 0.6s ease-out;
}

@keyframes stepDoneSuccess {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

.step-card__num {
  font-size: 0.67rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(0,0,0,0.32);
}

.step-card__icon {
  position: relative;
  width: 38px; 
  height: 38px;
  border-radius: 10px;
  display: flex; 
  align-items: center; 
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 1;
}

.step-card__icon--pulse {
  animation: iconPulse 2s ease-in-out infinite;
}

@keyframes iconPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(139, 195, 74, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 8px rgba(139, 195, 74, 0);
  }
}

.step-card__icon--success {
  animation: iconSuccess 0.6s ease-out;
}

@keyframes iconSuccess {
  0% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.2) rotate(180deg);
  }
  100% {
    transform: scale(1) rotate(360deg);
  }
}

.step-card__icon-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  border: 2px solid rgba(139, 195, 74, 0.5);
  transform: translate(-50%, -50%);
  animation: ringPulse 2s ease-out infinite;
}

@keyframes ringPulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0;
  }
}

.step-card__title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1a1a1a;
  transition: color 0.3s;
}

.step-card--current .step-card__title {
  color: #558b2f;
}

.step-card__desc {
  font-size: 0.8rem;
  color: rgba(0,0,0,0.5);
  line-height: 1.45;
  margin: 0;
  flex: 1;
}

.step-card__now {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 100px;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: #fff;
  font-size: 0.67rem;
  font-weight: 800;
  width: fit-content;
  animation: nowBadgePulse 2s ease-in-out infinite;
}

@keyframes nowBadgePulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(139, 195, 74, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(139, 195, 74, 0);
  }
}

.step-card__now-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: white;
  animation: dotBlink 1.5s ease-in-out infinite;
}

@keyframes dotBlink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* Соединительная линия между шагами */
.step-connector {
  position: absolute;
  top: 50%;
  right: -10px;
  width: 20px;
  height: 2px;
  transform: translateY(-50%);
  z-index: 0;
  display: none; /* Скрываем на мобильных */
}

@media (min-width: 600px) {
  .step-connector {
    display: block;
  }
}

.step-connector__line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.step-connector__progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #8bc34a, #558b2f);
  border-radius: 2px;
  transition: width 0.6s ease-out;
}

.step-connector--active .step-connector__progress {
  animation: connectorProgress 1s ease-out;
}

@keyframes connectorProgress {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}

/* Анимации появления шагов */
.step-fade-enter-active {
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-fade-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.9);
}

.step-fade-move {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ─── Status banner ─── */
.status-banner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid;
  flex-wrap: wrap;
}

.status-banner__icon-box {
  width: 40px; height: 40px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.status-banner__body { flex: 1; min-width: 0; }

.status-banner__title {
  font-size: 0.925rem;
  font-weight: 800;
  margin-bottom: 4px;
}

.status-banner__text {
  font-size: 0.815rem;
  color: rgba(0,0,0,0.58);
  margin: 0 0 9px;
  line-height: 1.45;
}

.status-banner__details {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.status-banner__detail {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 0.8rem;
  color: rgba(0,0,0,0.58);
  line-height: 1.4;
}

.status-banner__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
  border-radius: 100px;
  border: none;
  color: #fff;
  font-size: 0.825rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
  align-self: center;
}
.status-banner__btn:hover { opacity: 0.88; }

/* ─── Mobile adaptation ─── */
@media (max-width: 600px) {
  .status-banner {
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .status-banner__icon-box {
    width: 36px;
    height: 36px;
  }

  .status-banner__icon-box .v-icon {
    font-size: 20px !important;
  }

  .status-banner__body {
    width: 100%;
  }

  .status-banner__title {
    font-size: 0.9rem;
    margin-bottom: 6px;
  }

  .status-banner__text {
    font-size: 0.8rem;
    margin-bottom: 10px;
  }

  .status-banner__details {
    gap: 6px;
    margin-bottom: 8px;
  }

  .status-banner__detail {
    font-size: 0.78rem;
    gap: 6px;
  }

  .status-banner__detail .v-icon {
    font-size: 13px !important;
    margin-top: 2px;
  }

  .status-banner__btn {
    width: 100%;
    justify-content: center;
    padding: 11px 20px;
    font-size: 0.85rem;
    align-self: stretch;
  }
}

/* ─── Bot badge ─── */
.bot-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 100px;
  background: rgba(139,195,74,0.1);
  border: 1px solid rgba(139,195,74,0.2);
  color: #558b2f;
  font-size: 0.75rem;
  font-weight: 700;
}

/* ─── Info tiles ─── */
.info-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}

.info-tile {
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-tile__icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: rgba(255,255,255,0.7);
  display: flex; align-items: center; justify-content: center;
}

.info-tile__title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1a1a1a;
}

.info-tile__text {
  font-size: 0.8rem;
  color: rgba(0,0,0,0.5);
  line-height: 1.45;
  margin: 0;
}

/* ─── Quick actions ─── */
.actions-head {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: rgba(0,0,0,0.4);
  margin-bottom: 12px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
}

.action-tile {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.07);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}

.action-tile:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 28px rgba(0,0,0,0.09);
}

.action-tile__tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 0.67rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  width: fit-content;
}

.action-tile__icon {
  width: 46px; height: 46px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  margin: 4px 0;
}

.action-tile__title {
  font-size: 0.925rem;
  font-weight: 800;
  color: #1a1a1a;
}

.action-tile__desc {
  font-size: 0.8rem;
  color: rgba(0,0,0,0.5);
  line-height: 1.45;
  margin: 0;
  flex: 1;
}

.action-tile__arrow {
  margin-top: 4px;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.18s, transform 0.18s;
}

.action-tile:hover .action-tile__arrow {
  opacity: 1;
  transform: translateX(0);
}
</style>