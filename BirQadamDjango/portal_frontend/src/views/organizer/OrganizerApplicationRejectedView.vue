<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const displayName = computed(
  () => authStore.user?.full_name || authStore.user?.username || 'Пользователь',
);

const goHome = () => router.push({ name: 'home' });
const goVolunteer = () => router.push({ name: 'register-volunteer' });

const logout = async () => {
  await authStore.logout();
  router.push({ name: 'home' });
};
</script>

<template>
  <div class="rej-page">
    <div class="rej-bg" aria-hidden="true" />

    <div class="rej-inner">
      <header class="rej-head">
        <span class="rej-eyebrow">
          <v-icon icon="mdi-file-document-remove-outline" size="16" class="rej-eyebrow__ic" />
          Статус заявки
        </span>
        <h1 class="rej-title">Заявка не прошла модерацию</h1>
        <p class="rej-lead">
          {{ displayName }}, к сожалению, мы не можем открыть вам кабинет организатора.
          Это не блокирует участие в проектах — вы по-прежнему можете помогать как волонтёр.
        </p>
      </header>

      <v-card class="rej-card" elevation="0" rounded="xl">
        <div class="rej-card__top">
          <div class="rej-icon" aria-hidden="true">
            <v-icon icon="mdi-hand-wave-outline" size="36" />
          </div>
          <div class="rej-card__intro">
            <h2 class="rej-subtitle">Что это значит</h2>
            <p class="rej-body">
              Решение могло зависеть от данных заявки, загрузки модераторов или политики площадки.
              Подробности при необходимости уточняйте у поддержки — мы подскажем, что можно сделать дальше.
            </p>
          </div>
        </div>

        <div class="rej-steps">
          <div class="rej-step">
            <span class="rej-step__n">1</span>
            <div>
              <div class="rej-step__t">Написать в поддержку</div>
              <p class="rej-step__p">Если кажется, что заявку разобрали неверно — опишите ситуацию, приложите контакты.</p>
            </div>
          </div>
          <div class="rej-step">
            <span class="rej-step__n">2</span>
            <div>
              <div class="rej-step__t">Продолжить как волонтёр</div>
              <p class="rej-step__p">Проекты, задачи и фотоотчёты доступны из кабинета волонтёра после регистрации в этой роли.</p>
            </div>
          </div>
          <div class="rej-step">
            <span class="rej-step__n">3</span>
            <div>
              <div class="rej-step__t">Выйти из аккаунта</div>
              <p class="rej-step__p">Можно сменить пользователя или зайти с другого устройства.</p>
            </div>
          </div>
        </div>

        <div class="rej-actions">
          <v-btn
            color="primary"
            variant="flat"
            size="large"
            class="rej-btn-primary text-none"
            rounded="pill"
            @click="goHome"
          >
            <v-icon icon="mdi-home-outline" start size="20" />
            На главную
          </v-btn>
          <v-btn
            variant="tonal"
            color="primary"
            size="large"
            class="text-none"
            rounded="pill"
            @click="goVolunteer"
          >
            <v-icon icon="mdi-hand-heart-outline" start size="20" />
            Стать волонтёром
          </v-btn>
          <button type="button" class="rej-link" @click="logout">
            <v-icon icon="mdi-logout" size="18" />
            Выйти из аккаунта
          </button>
        </div>
      </v-card>

      <p class="rej-footnote">
        BirQadam · экология и волонтёрство рядом с вами
      </p>
    </div>
  </div>
</template>

<style scoped>
.rej-page {
  position: relative;
  min-height: calc(100vh - 120px);
  padding: clamp(1rem, 4vw, 2.5rem) clamp(0.75rem, 3vw, 1.5rem) 2rem;
  overflow: hidden;
}

.rej-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(76, 175, 80, 0.14), transparent 55%),
    radial-gradient(ellipse 90% 60% at 100% 40%, rgba(129, 199, 132, 0.08), transparent 50%),
    linear-gradient(180deg, #f4faf4 0%, #eef5f0 45%, #e8f0ea 100%);
  pointer-events: none;
}

.rej-inner {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0 auto;
}

.rej-head {
  text-align: center;
  margin-bottom: clamp(1.25rem, 4vw, 2rem);
}

.rej-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.1);
  border: 1px solid rgba(46, 125, 50, 0.18);
  margin-bottom: 0.85rem;
}

.rej-eyebrow__ic {
  opacity: 0.9;
}

.rej-title {
  margin: 0 0 0.65rem;
  font-size: clamp(1.45rem, 4vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
  color: #1b2e1f;
}

.rej-lead {
  margin: 0 auto;
  max-width: 38rem;
  font-size: 0.98rem;
  line-height: 1.6;
  color: rgba(27, 46, 31, 0.72);
}

.rej-card {
  border: 1px solid rgba(46, 125, 80, 0.12);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 18px 48px -24px rgba(27, 60, 40, 0.18);
  padding: clamp(1.25rem, 4vw, 2rem);
}

.rej-card__top {
  display: flex;
  gap: 1.1rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

@media (max-width: 520px) {
  .rej-card__top {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}

.rej-icon {
  flex-shrink: 0;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c62828;
  background: linear-gradient(145deg, rgba(239, 83, 80, 0.12), rgba(198, 40, 40, 0.06));
  border: 1px solid rgba(198, 40, 40, 0.15);
}

.rej-card__intro {
  min-width: 0;
}

.rej-subtitle {
  margin: 0 0 0.45rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: #1b2e1f;
}

.rej-body {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.58;
  color: rgba(27, 46, 31, 0.68);
}

.rej-steps {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-bottom: 1.75rem;
}

.rej-step {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
  padding: 0.85rem 1rem;
  border-radius: 0.85rem;
  background: rgba(76, 175, 80, 0.05);
  border: 1px solid rgba(76, 175, 80, 0.1);
}

.rej-step__n {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #66bb6a, #43a047);
}

.rej-step__t {
  font-weight: 700;
  font-size: 0.88rem;
  color: #1b2e1f;
  margin-bottom: 0.2rem;
}

.rej-step__p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: rgba(27, 46, 31, 0.65);
}

.rej-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  justify-content: center;
}

.rej-btn-primary {
  min-width: 11rem;
  font-weight: 700;
}

.rej-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: 0.25rem;
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  color: rgba(27, 46, 31, 0.55);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: color 0.15s, background 0.15s;
}

.rej-link:hover {
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.08);
}

.rej-footnote {
  margin: 1.5rem 0 0;
  text-align: center;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: rgba(27, 46, 31, 0.38);
}
</style>
