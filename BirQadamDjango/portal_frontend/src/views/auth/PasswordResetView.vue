<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';
import { RouterLink } from 'vue-router';
import { httpClient } from '@/services/http';
import { WEB_ENDPOINT } from '@/services/webPortal';

const router = useRouter();

const formRef = ref<VForm | null>(null);
const step    = ref<'request' | 'confirm'>('request');
const loading = ref(false);
const showPassword        = ref(false);
const showConfirmPassword = ref(false);
const snackbar = reactive({ show: false, color: 'success' as 'success' | 'error', message: '' });

const formState = reactive({
  email: '', code: '', newPassword: '', confirmPassword: '',
});

const rules = {
  required:      (v: string) => !!v || 'Поле обязательно для заполнения.',
  email:         (v: string) => !v || /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v) || 'Введите корректный email.',
  password:      (v: string) => !v || v.length >= 8 || 'Минимум 8 символов.',
  passwordMatch: (v: string) => !v || v === formState.newPassword || 'Пароли не совпадают.',
};

const showSnackbar = (message: string, color: 'success' | 'error') => {
  snackbar.message = message; snackbar.color = color; snackbar.show = true;
};

const requestPasswordReset = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  loading.value = true;
  try {
    const response = await httpClient.post(`${WEB_ENDPOINT}/password-reset/`, { email: formState.email });
    const msg = response.data?.message ?? 'Готово.';
    showSnackbar(msg, 'success');
    // На бэкенде при несуществующем email тоже 200, но без реальной отправки — не показываем шаг с кодом
    if (typeof msg === 'string' && msg.includes('отправлен на ваш email')) {
      step.value = 'confirm';
    }
  } catch (error: any) {
    let msg = 'Не удалось отправить код. Попробуйте позже.';
    if (error?.response?.data?.detail) msg = error.response.data.detail;
    else if (error?.response?.data?.message) msg = error.response.data.message;
    else if (error?.code === 'ERR_NETWORK') msg = 'Ошибка подключения к серверу.';
    showSnackbar(msg, 'error');
  } finally { loading.value = false; }
};

const confirmPasswordReset = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  if (formState.newPassword !== formState.confirmPassword) {
    showSnackbar('Пароли не совпадают.', 'error'); return;
  }
  loading.value = true;
  try {
    const response = await httpClient.post(`${WEB_ENDPOINT}/password-reset/confirm/`, {
      email: formState.email, code: formState.code, new_password: formState.newPassword,
    });
    showSnackbar(response.data.message || 'Пароль успешно изменён!', 'success');
    setTimeout(() => router.push('/login'), 2000);
  } catch (error: any) {
    let msg = 'Не удалось изменить пароль. Попробуйте позже.';
    if (error?.response?.data?.detail) msg = error.response.data.detail;
    else if (error?.response?.data?.message) msg = error.response.data.message;
    else if (error?.code === 'ERR_NETWORK') msg = 'Ошибка подключения к серверу.';
    showSnackbar(msg, 'error');
  } finally { loading.value = false; }
};

const backToRequest = () => {
  step.value = 'request';
  formState.code = ''; formState.newPassword = ''; formState.confirmPassword = '';
  formRef.value?.resetValidation();
};
</script>

<template>
  <div class="reg-root">

    <!-- ── Левая брендинг-панель ─────────────────────────── -->
    <div class="brand-panel d-none d-lg-flex">
      <div class="brand-deco brand-deco--1" />
      <div class="brand-deco brand-deco--2" />
      <div class="brand-deco brand-deco--3" />

      <div class="brand-inner">
        <div class="brand-badge">
          <v-icon size="14">mdi-lock-reset</v-icon>
          Безопасность
        </div>

        <div class="brand-headline-wrap">
          <p class="brand-eyebrow">Платформа BirQadam</p>
          <h2 class="brand-headline">
            Восстановите<br>
            <em>доступ</em><br>
            к кабинету
          </h2>
          <p class="brand-sub">
            Укажите email — мы отправим код<br>
            для безопасного сброса пароля.<br>
            Это займёт меньше минуты.
          </p>
        </div>

        <!-- Шаги процесса -->
        <div class="brand-steps">
          <div
            v-for="(s, i) in [
              { icon: 'mdi-email-outline',     text: 'Введите ваш email'          },
              { icon: 'mdi-key-outline',        text: 'Получите код в письме'      },
              { icon: 'mdi-lock-check-outline', text: 'Установите новый пароль'   },
            ]"
            :key="i"
            class="brand-step"
          >
            <div class="brand-step-num">{{ i + 1 }}</div>
            <div class="brand-step-icon">
              <v-icon size="16" color="white">{{ s.icon }}</v-icon>
            </div>
            <span>{{ s.text }}</span>
          </div>
        </div>
      </div>

      <p class="brand-footer-note">
        <v-icon size="13" style="opacity:.6;margin-right:4px">mdi-shield-check-outline</v-icon>
        Безопасный сброс пароля · BirQadam
      </p>
    </div>

    <!-- ── Правая панель формы ───────────────────────────── -->
    <div class="form-panel">
      <div class="form-card">

        <!-- Шапка -->
        <div class="form-header">
          <div class="form-icon-wrap">
            <v-icon size="22" color="white">
              {{ step === 'request' ? 'mdi-lock-reset' : 'mdi-key-variant' }}
            </v-icon>
          </div>
          <div>
            <h1 class="form-title">
              {{ step === 'request' ? 'Сброс пароля' : 'Новый пароль' }}
            </h1>
            <p class="form-subtitle">
              {{ step === 'request'
                ? 'Введите email — отправим код'
                : 'Введите код из письма' }}
            </p>
          </div>
        </div>

        <!-- Прогресс-бар шагов -->
        <div class="progress-bar mb-6">
          <div class="progress-bar-fill" :class="{ 'progress-bar-fill--full': step === 'confirm' }" />
        </div>

        <v-form ref="formRef" @submit.prevent="step === 'request' ? requestPasswordReset() : confirmPasswordReset()">

          <!-- ── Шаг 1: Email ── -->
          <div class="step-block">
            <label class="field-label">Email <span class="req">*</span></label>
            <div class="field-box" :class="{ 'field-box--disabled': step === 'confirm' }">
              <v-icon size="16" class="field-ico">mdi-email-outline</v-icon>
              <v-text-field
                v-model="formState.email"
                placeholder="you@example.kz"
                variant="plain" density="compact"
                :rules="[rules.required, rules.email]"
                :disabled="step === 'confirm'"
                autocomplete="email"
                hide-details="auto" class="vf"
              />
              <!-- Галочка если email уже подтверждён -->
              <v-icon v-if="step === 'confirm'" size="16" color="#2e7d32" class="mr-1">mdi-check-circle</v-icon>
            </div>
          </div>

          <!-- ── Шаг 2: Код + новый пароль ── -->
          <template v-if="step === 'confirm'">
            <div class="info-notice mt-4">
              <div class="info-notice-icon">
                <v-icon size="18" color="#2e7d32">mdi-email-check-outline</v-icon>
              </div>
              <div>
                <strong>Код отправлен!</strong>
                <p>Проверьте почту <strong>{{ formState.email }}</strong> и введите 6-значный код.</p>
              </div>
            </div>

            <div class="step-block mt-4">
              <label class="field-label">Код подтверждения <span class="req">*</span></label>
              <div class="field-box">
                <v-icon size="16" class="field-ico">mdi-shield-check-outline</v-icon>
                <v-text-field
                  v-model="formState.code"
                  placeholder="000000"
                  variant="plain" density="compact"
                  :rules="[rules.required]"
                  autocomplete="one-time-code"
                  maxlength="6"
                  hide-details="auto" class="vf"
                />
              </div>
            </div>

            <div class="step-block mt-3">
              <label class="field-label">Новый пароль <span class="req">*</span></label>
              <div class="field-box">
                <v-icon size="16" class="field-ico">mdi-lock-outline</v-icon>
                <v-text-field
                  v-model="formState.newPassword"
                  placeholder="Минимум 8 символов"
                  :type="showPassword ? 'text' : 'password'"
                  variant="plain" density="compact"
                  :rules="[rules.required, rules.password]"
                  autocomplete="new-password"
                  hide-details="auto" class="vf"
                />
                <button class="eye-btn" type="button" @click="showPassword = !showPassword">
                  <v-icon size="16">{{ showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline' }}</v-icon>
                </button>
              </div>
            </div>

            <div class="step-block mt-3">
              <label class="field-label">Подтвердите пароль <span class="req">*</span></label>
              <div class="field-box">
                <v-icon size="16" class="field-ico">mdi-lock-check-outline</v-icon>
                <v-text-field
                  v-model="formState.confirmPassword"
                  placeholder="Повторите пароль"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  variant="plain" density="compact"
                  :rules="[rules.required, rules.passwordMatch]"
                  autocomplete="new-password"
                  hide-details="auto" class="vf"
                />
                <button class="eye-btn" type="button" @click="showConfirmPassword = !showConfirmPassword">
                  <v-icon size="16">{{ showConfirmPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline' }}</v-icon>
                </button>
              </div>
            </div>
          </template>

          <!-- Навигация -->
          <div class="form-nav mt-6">
            <button
              v-if="step === 'confirm'"
              class="nav-btn nav-btn--back"
              type="button"
              @click="backToRequest"
            >
              <v-icon size="16">mdi-arrow-left</v-icon>
              Назад
            </button>
            <div style="flex:1" />
            <button
              class="nav-btn nav-btn--submit"
              type="submit"
              :disabled="loading"
            >
              <v-progress-circular v-if="loading" size="16" width="2" indeterminate color="white" />
              <v-icon v-else size="16">
                {{ step === 'request' ? 'mdi-send-outline' : 'mdi-check' }}
              </v-icon>
              {{ loading ? 'Отправка…' : step === 'request' ? 'Отправить код' : 'Изменить пароль' }}
            </button>
          </div>

          <!-- Ссылка на вход -->
          <p class="form-hint mt-4">
            Вспомнили пароль?
            <RouterLink to="/login" class="form-link">Войти</RouterLink>
          </p>
        </v-form>
      </div>
    </div>

    <!-- ── Snackbar ──────────────────────────────────────── -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000" location="top" rounded="pill">
      <div class="d-flex align-center ga-2">
        <v-icon size="15">
          {{ snackbar.color === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle' }}
        </v-icon>
        {{ snackbar.message }}
      </div>
    </v-snackbar>
  </div>
</template>

<style scoped>
/* ── Корень ─────────────────────────────────────────── */
.reg-root {
  min-height: 100vh;
  display: flex;
}

/* ── Левая панель ────────────────────────────────────── */
.brand-panel {
  width: 460px;
  flex-shrink: 0;
  background: linear-gradient(160deg, #1a5c1e 0%, #2e7d32 45%, #388e3c 75%, #43a047 100%);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 44px 48px;
  position: relative;
  overflow: hidden;
}

.brand-deco {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.brand-deco--1 { width: 300px; height: 300px; top: -80px; right: -80px; background: rgba(255,255,255,0.06); }
.brand-deco--2 { width: 200px; height: 200px; bottom: 100px; left: -60px; background: rgba(255,255,255,0.05); }
.brand-deco--3 { width: 110px; height: 110px; top: 48%; right: 40px; background: rgba(255,255,255,0.04); }

.brand-inner {
  display: flex;
  flex-direction: column;
  gap: 36px;
  position: relative;
  z-index: 1;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 100px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.22);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  width: fit-content;
}

.brand-eyebrow {
  color: rgba(255,255,255,0.65);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin: 0 0 12px;
}
.brand-headline {
  color: #ffffff;
  font-size: 2.4rem;
  font-weight: 700;
  line-height: 1.15;
  margin: 0 0 14px;
}
.brand-headline em {
  font-style: italic;
  color: #ffffff;
  opacity: 0.88;
}
.brand-sub {
  color: rgba(255,255,255,0.72);
  font-size: 0.9rem;
  line-height: 1.65;
  margin: 0;
}

/* Шаги на левой панели */
.brand-steps {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.brand-step {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255,255,255,0.88);
  font-size: 0.85rem;
  font-weight: 500;
}
.brand-step-num {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
}
.brand-step-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: rgba(255,255,255,0.13);
  border: 1px solid rgba(255,255,255,0.18);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.brand-footer-note {
  color: rgba(255,255,255,0.42);
  font-size: 0.76rem;
  margin: 0;
  position: relative;
  z-index: 1;
}

/* ── Правая панель ───────────────────────────────────── */
.form-panel {
  flex: 1;
  background: #f7f8f5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  min-height: 100vh;
  overflow-y: auto;
}

.form-card {
  width: 100%;
  max-width: 440px;
  background: white;
  border-radius: 24px;
  padding: 36px 36px 40px;
  border: 1px solid rgba(0,0,0,0.07);
  box-shadow: 0 4px 32px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04);
}

/* Шапка */
.form-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}
.form-icon-wrap {
  width: 48px; height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2e7d32, #43a047);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(46,125,50,0.3);
  transition: all 0.3s ease;
}
.form-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 2px;
  line-height: 1.2;
}
.form-subtitle {
  font-size: 0.82rem;
  color: #888;
  margin: 0;
}

/* Прогресс-бар */
.progress-bar {
  height: 4px;
  background: #e8e8e8;
  border-radius: 2px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  width: 50%;
  background: linear-gradient(90deg, #2e7d32, #43a047);
  border-radius: 2px;
  transition: width 0.4s ease;
}
.progress-bar-fill--full { width: 100%; }

/* Поля */
.step-block { animation: fadeUp 0.25s ease both; }

.field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #666;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.req { color: #e53935; }

.field-box {
  display: flex;
  align-items: center;
  background: #f7f9f5;
  border: 1.5px solid rgba(0,0,0,0.1);
  border-radius: 12px;
  padding: 0 12px;
  transition: border-color 0.17s, box-shadow 0.17s, background 0.17s;
  overflow: hidden;
}
.field-box--disabled {
  background: #f0f0f0;
  opacity: 0.75;
}
.field-box:focus-within {
  border-color: #66bb6a;
  box-shadow: 0 0 0 3px rgba(102,187,106,0.14);
  background: white;
}
.field-ico {
  flex-shrink: 0;
  margin-right: 8px;
  color: rgba(0,0,0,0.28) !important;
}

.vf { flex: 1; }
.vf :deep(.v-field__input) { padding: 10px 0 !important; font-size: 0.875rem !important; font-weight: 500 !important; }
.vf :deep(.v-field__outline) { display: none !important; }

.eye-btn {
  flex-shrink: 0;
  background: none; border: none; cursor: pointer;
  color: rgba(0,0,0,0.3);
  width: 26px; height: 26px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.eye-btn:hover { color: rgba(0,0,0,0.6); background: rgba(0,0,0,0.06); }

/* Notice */
.info-notice {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #f1f8e9;
  border: 1px solid #c8e6c9;
  color: #2e7d32;
  font-size: 0.82rem;
  line-height: 1.55;
}
.info-notice-icon {
  flex-shrink: 0;
  width: 30px; height: 30px;
  border-radius: 8px;
  background: #c8e6c9;
  display: flex; align-items: center; justify-content: center;
}
.info-notice strong { display: block; font-weight: 700; margin-bottom: 3px; }
.info-notice p { margin: 0; color: rgba(46,125,50,0.75); font-size: 0.8rem; }

/* Навигация */
.form-nav {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 11px 22px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}
.nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.nav-btn--back {
  background: white;
  color: #444;
  border: 1.5px solid #e0e0e0;
}
.nav-btn--back:hover:not(:disabled) { background: #f5f5f5; border-color: #bbb; }

.nav-btn--submit {
  background: linear-gradient(135deg, #2e7d32, #43a047);
  color: white;
  box-shadow: 0 4px 16px rgba(46,125,50,0.35);
  padding: 12px 24px;
}
.nav-btn--submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 22px rgba(46,125,50,0.45);
}

.form-hint {
  text-align: center;
  font-size: 0.82rem;
  color: #aaa;
  margin: 0;
}
.form-link {
  color: #2e7d32;
  font-weight: 700;
  text-decoration: none;
  margin-left: 4px;
}
.form-link:hover { text-decoration: underline; }

/* Анимация */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Адаптив */
@media (max-width: 600px) {
  .form-card { padding: 24px 20px 28px; border-radius: 16px; }
  .form-nav  { flex-wrap: wrap; }
  .form-nav .nav-btn { width: 100%; justify-content: center; }
}
</style>