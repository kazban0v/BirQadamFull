<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

onMounted(async () => {
  // Инициализируем auth store если еще не инициализирован
  if (!authStore.initialized) {
    await authStore.initialize();
  }
  
  // Если пользователь уже залогинен, перенаправляем на соответствующий дашборд
  if (authStore.isAuthenticated && authStore.user) {
    const isOrganizer = authStore.user.role === 'organizer' || authStore.user.is_organizer;
    if (isOrganizer) {
      router.push({ name: 'organizer-dashboard' });
    } else {
      router.push({ name: 'volunteer-dashboard' });
    }
  }
});
</script>

<template>
<section class="hero">
  <div class="hero__overlay">
    <v-container class="py-16">
      <v-row class="align-center">
        <v-col cols="12" md="7" class="hero__content">
          <div class="hero__badge">BirQadam Web Portal</div>
          <h1 class="hero__title">
            Один портал для волонтёров и организаторов BirQadam
          </h1>
          <p class="hero__subtitle">
            Управляйте проектами, заданиями и фотоотчётами из браузера. Портал синхронизирован с Telegram-ботом 
             — все данные автоматически остаются в единой системе.
          </p>
          <div class="hero__cta">
            <v-btn color="warning" size="x-large" class="text-none font-weight-bold px-8" to="/register/volunteer">
              Стать волонтёром
            </v-btn>
            <v-btn
              size="x-large"
              variant="outlined"
              color="white"
              class="text-none font-weight-bold px-8"
              to="/register/organizer"
            >
              Стать организатором
            </v-btn>
          </div>
        </v-col>
        <v-col cols="12" md="5">
          <v-card class="hero__card pa-6 pa-md-8">
            <v-card-title class="text-h6 font-weight-bold mb-4 text-primary">
              Возможности портала
            </v-card-title>
            <v-list class="hero__list" density="comfortable" lines="two">
              <v-list-item prepend-icon="mdi-account-check-outline">
                <v-list-item-title class="font-weight-semibold">Быстрая регистрация волонтёров</v-list-item-title>
                <v-list-item-subtitle>
                  Подтверждение телефона, связка с Telegram и доступ к личному кабинету.
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-clipboard-text-outline">
                <v-list-item-title class="font-weight-semibold">Инструменты организатора</v-list-item-title>
                <v-list-item-subtitle>
                  Создание проектов, назначение задач, модерация фотоотчётов и управление командой.
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-shield-check-outline">
                <v-list-item-title class="font-weight-semibold">Единый контроль админа</v-list-item-title>
                <v-list-item-subtitle>
                  Все действия фиксируются в админ-панели и доступны к модерации в реальном времени.
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</section>

  <section id="services" class="py-16">
    <v-container>
      <h2 class="text-h4 text-center font-weight-bold mb-8">Что нового в веб-версии</h2>
      <v-row class="ga-8 ga-md-0">
        <v-col cols="12" md="4">
          <v-card class="h-100 feature-card">
            <v-card-item>
              <v-avatar color="primary" class="mb-4" size="48">
                <v-icon icon="mdi-account-plus-outline" />
              </v-avatar>
              <v-card-title class="font-weight-bold text-h6 mb-2">Портал волонтёра</v-card-title>
              <v-card-text>
                Просматривайте проекты, принимайте задачи и отправляйте фотоотчёты прямо с компьютера.
              </v-card-text>
            </v-card-item>
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card class="h-100 feature-card">
            <v-card-item>
              <v-avatar color="warning" class="mb-4" size="48">
                <v-icon icon="mdi-clipboard-list-outline" />
              </v-avatar>
              <v-card-title class="font-weight-bold text-h6 mb-2">Инструменты организатора</v-card-title>
              <v-card-text>
                Управляйте командами, назначайте задания и отслеживайте прогресс по проектам в едином кабинете.
              </v-card-text>
            </v-card-item>
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card class="h-100 feature-card">
            <v-card-item>
              <v-avatar color="success" class="mb-4" size="48">
                <v-icon icon="mdi-bell-check-outline" />
              </v-avatar>
              <v-card-title class="font-weight-bold text-h6 mb-2">Мгновенные уведомления</v-card-title>
              <v-card-text>
                Telegram, push и email-уведомления запускаются автоматически.
              </v-card-text>
            </v-card-item>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </section>

  <section id="faq" class="py-14 bg-surface">
    <v-container>
      <h2 class="text-h4 text-center font-weight-bold mb-8">Частые вопросы</h2>
      <v-row class="ga-8 ga-md-0">
        <v-col cols="12" md="6">
          <v-expansion-panels>
            <v-expansion-panel title="Как связать аккаунт из Telegram с веб-порталом?">
              <v-expansion-panel-text>
                После регистрации на сайте откройте бот BirQadam в Telegram и введите команду /link. Следуйте
                инструкциям, чтобы подтвердить аккаунт и синхронизировать данные.
              </v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel title="Нужно ли проходить повторную модерацию?">
              <v-expansion-panel-text>
                Если вы уже подтверждены в системе, повторная модерация не требуется. Новые организаторы проходят
                проверку один раз при подаче заявки.
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-col>
        <v-col cols="12" md="6">
          <v-expansion-panels>
            <v-expansion-panel title="Можно ли управлять проектами с телефона?">
              <v-expansion-panel-text>
                Да. Все действия, выполненные в Telegram боте, автоматически отображаются в
                веб-кабинете и наоборот.
              </v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel title="Куда поступают фотоотчёты?">
              <v-expansion-panel-text>
                Фото сохраняются в общей базе данных и доступны организаторам и администраторам для модерации. При одобрении
                волонтёры получают уведомления в Telegram боте.
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  background: url('https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80')
    center/cover no-repeat;
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: stretch;
}

.hero__overlay {
  position: relative;
  flex: 1;
  background: linear-gradient(135deg, rgba(139, 195, 74, 0.95), rgba(227, 121, 77, 0.88)); /* BirQadam colors */
  padding-top: 88px;
  padding-bottom: 24px;
}

.hero__content {
  color: #fff;
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 9999px;
  padding: 6px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 18px;
}

.hero__title {
  font-size: clamp(2.4rem, 3vw, 3.4rem);
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 24px;
}

.hero__subtitle {
  font-size: clamp(1.05rem, 2.2vw, 1.35rem);
  line-height: 1.6;
  margin-bottom: 36px;
  max-width: 560px;
  color: rgba(255, 255, 255, 0.92);
}

.hero__cta {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero__card {
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.18);
}

.hero__list {
  --v-list-padding: 0;
  color: rgba(33, 33, 33, 0.82);
}

.feature-card {
  border-radius: 20px;
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 24px 42px rgba(139, 195, 74, 0.18); /* BirQadam primary color */
}

@media (min-width: 600px) {
  .hero__cta {
    flex-direction: row;
  }
}

@media (max-width: 960px) {
  .hero__overlay {
    padding-top: 120px;
    padding-bottom: 48px;
  }
}
</style>

