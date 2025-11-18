<script setup lang="ts">
import { computed } from 'vue';
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
const isPending = computed(() => status.value === 'pending');

if (organizerStore.isOrganizer) {
  organizerStore.loadProjects();
}

const quickActions = [
  {
    title: 'Создать проект',
    description: 'Опишите идею, укажите город и тип волонтёров. Проект автоматически появится в приложении.',
    icon: 'mdi-rocket-launch-outline',
    color: 'primary',
    to: '/organizer/projects',
    chip: 'Проекты',
  },
  {
    title: 'Команда волонтёров',
    description: 'Просматривайте участников, назначайте роли и отслеживайте активность по проектам.',
    icon: 'mdi-account-multiple-check-outline',
    color: 'teal-darken-1',
    to: '/organizer/volunteers',
    chip: 'Команда',
  },
  {
    title: 'Назначить задачу',
    description: 'Создавайте задания, прикрепляйте инструкции и уведомляйте волонтёров в одно касание.',
    icon: 'mdi-clipboard-plus-outline',
    color: 'indigo-darken-1',
    to: '/organizer/tasks',
    chip: 'Задачи',
  },
  {
    title: 'Проверить фото',
    description: 'Утверждайте фотоотчёты, оставляйте комментарии и возвращайте на доработку.',
    icon: 'mdi-image-filter-center-focus-strong-outline',
    color: 'deep-orange-darken-1',
    to: '/organizer/photo-moderation',
    chip: 'Модерация',
  },
  {
    title: 'Мои проекты',
    description: 'Отслеживайте статус заявок, количество волонтёров и прогресс по задачам.',
    icon: 'mdi-view-list-outline',
    color: 'purple-darken-1',
    to: '/organizer/projects',
    chip: 'Статистика',
  },
];

const onboardingSteps = computed(() => {
  const steps = [
    {
      key: 'submitted',
      title: 'Заявка отправлена',
      description: 'Вы заполнили профиль организатора и указали контактные данные.',
      status: 'done' as const,
    },
    {
      key: 'review',
      title: 'Проверка модератором',
      description: isApproved.value
        ? 'Команда BirQadam завершила проверку и подтвердила заявку.'
        : 'Команда BirQadam оценивает ваш проект и проверяет документы.',
      status: isApproved.value ? 'done' : isRejected.value ? 'error' : 'active',
    },
  ];

  if (isApproved.value) {
    steps.push({
      key: 'approval',
      title: 'Доступ к созданию проектов',
      description: 'Теперь вы можете создавать проекты, приглашать команду и управлять задачами.',
      status: 'done' as const,
    });
  }

  const currentKey = isApproved.value ? 'approval' : 'review';
  const total = steps.length;

  return steps.map((step) => ({
    ...step,
    isCurrent: step.key === currentKey,
    total,
  }));
});

const reviewStepState = computed<'success' | 'error' | 'pending'>(() => {
  if (isApproved.value) return 'success';
  if (isRejected.value) return 'error';
  return 'pending';
});

const reviewAlertConfig = computed(() => {
  if (isApproved.value) {
    return {
      color: 'success',
      icon: 'mdi-check-decagram',
      title: 'Заявка одобрена',
      text: 'Мы уже отправили уведомление в Telegram и email. Можете переходить к созданию проектов.',
      details: [
        { icon: 'mdi-rocket-launch-outline', text: 'Создайте первый проект и добавьте команду волонтёров.' },
        { icon: 'mdi-bell-ring-outline', text: 'Все уведомления будут приходить в Telegram и приложение.' },
      ],
      action: {
        label: 'Перейти к созданию проекта',
        to: '/organizer/projects',
      },
    };
  }

  if (isRejected.value) {
    return {
      color: 'error',
      icon: 'mdi-alert-circle',
      title: 'Нужны доработки',
      text: 'Проверьте комментарии модератора, обновите данные и отправьте заявку повторно.',
      details: [
        { icon: 'mdi-pencil-outline', text: 'Обновите профиль организатора.' },
        { icon: 'mdi-headset', text: 'Если остались вопросы — напишите в поддержку BirQadam.' },
      ],
    };
  }

  return {
    color: 'warning',
    icon: 'mdi-progress-clock',
    title: 'Заявка на рассмотрении',
    text: 'Обычно проверка занимает до 24 часов. Мы уведомим вас сразу после решения.',
    details: [
      { icon: 'mdi-telegram', text: 'Уведомим в Telegram и email, как только появится решение.' },
      { icon: 'mdi-clipboard-text-outline', text: 'Соберите описание проекта, список задач и требования к команде.' },
    ],
  };
});

const onboardingProgress = computed(() => {
  if (isApproved.value) return 100;
  if (isRejected.value) return 33;
  if (isPending.value) return 66;
  return 0;
});

const onboardingChip = computed(() => {
  if (isApproved.value) {
    return {
      color: 'success',
      text: 'Одобрено',
    };
  }

  if (isRejected.value) {
    return {
      color: 'error',
      text: 'Требуются правки',
    };
  }

  return {
    color: 'warning',
    text: 'На модерации',
  };
});

const onboardingStatusMessage = computed(() => {
  if (isApproved.value) {
    return 'Доступ открыт';
  }
  if (isRejected.value) {
    return 'Нужно обновить данные';
  }
  if (onboardingProgress.value === 66) {
    return 'Ожидаем подтверждения';
  }
  return 'На рассмотрении';
});

const infoCards = [
  {
    title: 'Синхронизация с Telegram',
    text: 'Все действия из веб-портала автоматически появляются в Telegram-боте.',
    iconSrc: telegramIcon,
    avatarColor: '#E0F2FF',
  },
  {
    title: 'Уведомления',
    text: 'Команда моментально получает пуш-уведомления о задачах и комментариях.',
    icon: 'mdi-bell-badge-outline',
    iconColor: '#FF6F00',
    avatarColor: '#FFF3E0',
  },
  {
    title: 'Аналитика',
    text: 'В разработке — подробная статистика по проектам, фото и активности волонтёров.',
    icon: 'mdi-chart-areaspline',
    iconColor: '#6A1B9A',
    avatarColor: '#F3E5F5',
  },
];

const navigate = (to: string) => {
  router.push(to);
};
</script>

<template>
  <div class="dashboard">
    <v-row class="ga-6">
      <v-col cols="12">
        <v-card class="hero-card" elevation="8">
          <div class="hero-card__content">
            <div class="hero-card__badge">
              <v-icon icon="mdi-account-tie-outline" size="20" />
              Кабинет организатора
            </div>
            <h1>
              Управляйте проектами,<br />
              задачами и командой BirQadam
            </h1>
            <p>
              Быстрый доступ ко всем функциям из Telegram: проекты, волонтёры, задачи и модерация фото. Весь прогресс
              сохраняется в одной системе.
            </p>
            <div class="hero-card__actions">
              <v-btn
                color="white"
                variant="flat"
                class="text-none font-weight-bold hero-card__btn"
                @click="navigate('/organizer/projects')"
              >
                Начать с проекта
              </v-btn>
              <v-btn
                color="white"
                variant="outlined"
                class="text-none font-weight-bold hero-card__btn"
                @click="navigate('/organizer/tasks')"
              >
                Назначить задачу
              </v-btn>
            </div>
          </div>
          <div class="hero-card__visual">
            <div class="hero-card__orb hero-card__orb--primary" />
            <div class="hero-card__orb hero-card__orb--secondary" />
            <v-icon icon="mdi-account-group-outline" size="120" class="hero-card__icon" />
          </div>
        </v-card>
      </v-col>

      <v-col cols="12">
        <v-card class="onboarding-card" rounded="xl" elevation="8">
          <div class="onboarding-card__header">
            <div>
              <v-chip
                :color="onboardingChip.color"
                variant="tonal"
                class="text-none font-weight-bold mb-2"
                size="small"
              >
                {{ onboardingChip.text }}
              </v-chip>
              <h2 class="text-h6 font-weight-bold mb-1">Онбординг организатора</h2>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Мы собрали основные этапы и подсказки, пока заявка готовится к одобрению.
              </p>
            </div>
            <div class="onboarding-card__progress">
              <span class="text-caption text-medium-emphasis">Готовность</span>
              <div class="d-flex align-center ga-2">
                <v-progress-circular
                  :model-value="onboardingProgress"
                  :color="isRejected ? 'error' : 'primary'"
                  size="46"
                  width="5"
                >
                  {{ onboardingProgress }}%
                </v-progress-circular>
                <div class="text-body-2 text-medium-emphasis">{{ onboardingStatusMessage }}</div>
              </div>
            </div>
          </div>

          <v-divider class="my-4" />

          <v-row class="ga-4 ga-md-0">
          <v-col
            v-for="(step, index) in onboardingSteps"
            :key="step.key"
              cols="12"
              md="4"
            >
              <v-sheet
              class="onboarding-step pa-5"
              :class="[
                `onboarding-step--${step.status}`,
                step.key === 'review' ? `onboarding-step--review-${reviewStepState}` : null,
                step.isCurrent ? 'onboarding-step--current' : null,
              ]"
                rounded="lg"
                :border="step.status !== 'active'"
                :color="step.status === 'active' ? 'primary-lighten-5' : (step.status === 'error' ? 'error-lighten-5' : 'grey-lighten-5')"
              >
              <div class="onboarding-step__stage" :class="{ 'onboarding-step__stage--current': step.isCurrent }">
                Шаг {{ index + 1 }} из {{ onboardingSteps.length }}
                <span v-if="step.isCurrent" class="onboarding-step__stage-badge">Сейчас</span>
              </div>
                <div class="onboarding-step__icon" :class="`onboarding-step__icon--${step.status}`">
                  <v-icon
                    :icon="step.status === 'done' ? 'mdi-check' : step.status === 'active' ? 'mdi-progress-clock' : step.status === 'error' ? 'mdi-alert' : 'mdi-dots-horizontal'"
                    size="22"
                  />
                </div>
                <h3 class="text-subtitle-1 font-weight-semibold mb-2">{{ step.title }}</h3>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  {{ step.description }}
                </p>
              </v-sheet>
            </v-col>
          </v-row>

          <v-alert
            class="mt-6 onboarding-review-alert"
            variant="flat"
            rounded="xl"
            :color="reviewAlertConfig.color"
          >
            <div class="onboarding-review-alert__content">
              <div class="onboarding-review-alert__text">
                <div class="d-flex align-center mb-2">
                  <v-avatar size="42" color="white" class="mr-3">
                    <v-icon :icon="reviewAlertConfig.icon" :color="reviewAlertConfig.color" size="24" />
                  </v-avatar>
                  <div>
                    <div class="text-subtitle-1 font-weight-semibold">
                      {{ reviewAlertConfig.title }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ reviewAlertConfig.text }}
                    </div>
                  </div>
                </div>
                <ul class="onboarding-review-alert__list">
                  <li v-for="item in reviewAlertConfig.details" :key="item.text">
                    <v-icon :icon="item.icon" size="18" class="mr-2" />
                    <span>{{ item.text }}</span>
                  </li>
                </ul>
              </div>
              <v-btn
                v-if="reviewAlertConfig.action"
                :color="reviewAlertConfig.color"
                variant="flat"
                class="text-none font-weight-semibold"
                rounded="lg"
                @click="navigate(reviewAlertConfig.action.to)"
              >
                {{ reviewAlertConfig.action.label }}
                <v-icon end>mdi-arrow-top-right</v-icon>
              </v-btn>
            </div>
          </v-alert>
        </v-card>
      </v-col>

      <v-col cols="12">
        <v-card class="info-card" rounded="xl" elevation="8">
          <div class="info-card__header">
            <div>
              <h2 class="text-h6 font-weight-bold mb-1">Как работает кабинет</h2>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Все функции полностью синхронизированы с Telegram-ботом.
              </p>
            </div>
            <v-chip color="primary" variant="flat" class="text-none font-weight-bold">
              Интегрировано с ботом
            </v-chip>
          </div>
          <v-divider class="my-4" />
          <v-row>
            <v-col v-for="card in infoCards" :key="card.title" cols="12" md="4" class="d-flex">
              <v-sheet class="info-card__item pa-4" rounded="lg" border color="grey-lighten-5">
                <v-avatar size="40" :color="card.avatarColor ?? 'primary-lighten-4'" class="mb-3">
                  <template v-if="card.iconSrc">
                    <v-img :src="card.iconSrc" width="28" height="28" cover />
                  </template>
                  <v-icon v-else :icon="card.icon" :color="card.iconColor ?? 'primary'" />
                </v-avatar>
                <h3 class="text-subtitle-1 font-weight-semibold mb-2">{{ card.title }}</h3>
                <p class="text-body-2 text-medium-emphasis mb-0">{{ card.text }}</p>
              </v-sheet>
            </v-col>
          </v-row>
        </v-card>
      </v-col>

      <v-col cols="12">
        <h2 class="section-title">Быстрые действия</h2>
        <v-row class="ga-5">
          <v-col v-for="action in quickActions" :key="action.title" cols="12" md="6" lg="4">
            <v-card class="action-card" rounded="xl" elevation="4">
              <div class="action-card__header">
                <v-avatar :color="action.color" size="48">
                  <v-icon :icon="action.icon" color="white" />
                </v-avatar>
                <div class="d-flex flex-column ga-1">
                  <v-chip class="action-card__chip text-none text-caption font-weight-bold" size="small">
                    {{ action.chip }}
                  </v-chip>
                  <h3 class="text-subtitle-1 font-weight-semibold mb-0">{{ action.title }}</h3>
                </div>
              </div>
              <p class="text-body-2 text-medium-emphasis mb-6">
                {{ action.description }}
              </p>
              <v-btn :color="action.color" variant="flat" class="text-none font-weight-semibold" @click="navigate(action.to)">
                Открыть
              </v-btn>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.hero-card {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  overflow: hidden;
  background: linear-gradient(115deg, rgba(139, 195, 74, 0.95), rgba(139, 195, 74, 0.85) 45%, rgba(227, 121, 77, 0.9) 90%); /* BirQadam colors */
  border-radius: 28px;
  color: #fff;
  position: relative;
  min-height: 260px;
}

.hero-card__content {
  padding: clamp(24px, 4vw, 48px);
  width: 100%;
  max-width: 620px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  z-index: 2;
}

.hero-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  padding: 8px 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.75rem;
}

.hero-card__content h1 {
  font-size: clamp(1.8rem, 3.2vw, 2.6rem);
  line-height: 1.25;
  margin: 0;
  font-weight: 700;
}

.hero-card__content p {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: clamp(0.95rem, 1.8vw, 1.05rem);
  line-height: 1.6;
}

.hero-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-card__btn {
  min-width: 180px;
}

.hero-card__visual {
  position: relative;
  flex: 1;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-card__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(0);
  opacity: 0.65;
}

.hero-card__orb--primary {
  width: 220px;
  height: 220px;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4), transparent 65%);
  top: 18%;
  right: 20%;
}

.hero-card__orb--secondary {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(227, 121, 77, 0.25), transparent 70%); /* BirQadam accent */
  bottom: -40px;
  right: -10%;
}

.hero-card__icon {
  position: relative;
  color: rgba(255, 255, 255, 0.25);
}

.info-card {
  padding: 24px;
}

.info-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.info-card__item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  background: linear-gradient(145deg, #ffffff, #f8ecc4); /* BirQadam background */
}

.onboarding-review-alert {
  border: none;
  color: #fff;
}

.onboarding-review-alert__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (min-width: 960px) {
  .onboarding-review-alert__content {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.onboarding-review-alert__text ul {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.onboarding-review-alert__text li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-weight: 500;
}

.onboarding-card {
  padding: clamp(24px, 4vw, 32px);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 250, 246, 0.92)); /* BirQadam background */
  border: 1px solid rgba(139, 195, 74, 0.08); /* BirQadam primary */
}

.onboarding-card__header {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

@media (min-width: 960px) {
  .onboarding-card__header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 32px;
  }
}

.onboarding-card__progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 160px;
}

.onboarding-step {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.onboarding-step__stage {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(33, 33, 33, 0.5);
  display: flex;
  align-items: center;
  gap: 8px;
}

.onboarding-step__stage--current {
  color: rgba(33, 33, 33, 0.85);
}

.onboarding-step__stage-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(33, 33, 33, 0.08);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.onboarding-step__icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  color: #fff;
}

.onboarding-step__icon--done {
  background: linear-gradient(135deg, #4caf50, #2e7d32);
}

.onboarding-step__icon--active {
  background: linear-gradient(135deg, #8BC34A, #689F38); /* BirQadam primary */
}

.onboarding-step__icon--waiting {
  background: linear-gradient(135deg, #90a4ae, #607d8b);
}

.onboarding-step__icon--error {
  background: linear-gradient(135deg, #e53935, #b71c1c);
}

.onboarding-step--review-success {
  background: linear-gradient(135deg, rgba(200, 230, 201, 0.4), rgba(165, 214, 167, 0.3));
  border-color: rgba(76, 175, 80, 0.35);
}

.onboarding-step--review-pending {
  background: linear-gradient(135deg, rgba(255, 224, 130, 0.4), rgba(255, 213, 79, 0.3));
  border-color: rgba(251, 192, 45, 0.35);
}

.onboarding-step--review-error {
  background: linear-gradient(135deg, rgba(255, 205, 210, 0.5), rgba(239, 154, 154, 0.35));
  border-color: rgba(229, 57, 53, 0.35);
}

.onboarding-step--current {
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.08);
  transform: translateY(-4px);
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}

.onboarding-step p {
  color: rgba(33, 33, 33, 0.7);
  line-height: 1.5;
}

.section-title {
  font-size: 1.35rem;
  font-weight: 700;
  margin-bottom: 16px;
}

.action-card {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
  border: 1px solid rgba(33, 33, 33, 0.06);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.action-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 18px 36px rgba(139, 195, 74, 0.18); /* BirQadam primary */
}

.action-card__header {
  display: flex;
  gap: 16px;
  align-items: center;
}

.action-card__chip {
  background-color: rgba(33, 33, 33, 0.08) !important;
  color: rgba(33, 33, 33, 0.8) !important;
  letter-spacing: 0.08em;
}

@media (max-width: 960px) {
  .hero-card {
    flex-direction: column;
  }

  .hero-card__visual {
    min-height: 180px;
  }

  .hero-card__icon {
    font-size: 96px;
  }
}

@media (max-width: 600px) {
  .hero-card__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .status-card,
  .info-card,
  .action-card {
    padding: 20px;
  }
}
</style>


