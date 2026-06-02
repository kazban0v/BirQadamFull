<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';

import { registerOrganizer, verifyEmail, resendVerificationCode, cancelRegistration } from '@/services/webPortal';
import { useAuthStore } from '@/stores/auth';

interface OrganizerFormState {
  fullName: string; phoneNumber: string; email: string; password: string;
  organizationName: string; description: string; city: string;
  website: string; contactPerson: string; projectsPlan: string;
}

const router    = useRouter();
const authStore = useAuthStore();

const step       = ref(1);
const stepsTotal = 3;

const personalForm     = ref<VForm | null>(null);
const organizationForm = ref<VForm | null>(null);
const additionalForm   = ref<VForm | null>(null);

const loading               = ref(false);
const successDialog         = ref(false);
const submittedOrganization = ref<string | null>(null);
const showPassword          = ref(false);
const snackbar = reactive({ show: false, color: 'success', message: '' });

const showVerificationDialog = ref(false);
const verificationEmail   = ref('');
const verificationCode    = ref('');
const verificationLoading = ref(false);
const resendLoading       = ref(false);
const resendCooldown      = ref(0);
let resendTimer: ReturnType<typeof setInterval> | null = null;

const formState = reactive<OrganizerFormState>({
  fullName: '', phoneNumber: '', email: '', password: '',
  organizationName: '', description: '', city: '',
  website: '', contactPerson: '', projectsPlan: '',
});

const rules = {
  required: (v: string) => !!v || 'Поле обязательно для заполнения.',
  phone: (v: string) => v.replace(/[^0-9+]/g, '').length >= 11 || 'Введите корректный номер.',
  email: (v: string) => !v || /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v) || 'Введите корректный email.',
  password: (v: string) => (!!v && v.length >= 8) || 'Минимум 8 символов.',
  url: (v: string) => {
    if (!v) return true;
    const t = v.trim();
    if (/^https?:\/\//i.test(t)) { try { new URL(t); return true; } catch { /* fall */ } }
    return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(\/.*)?$/i.test(t) || 'Введите корректный URL';
  },
};

const showSnackbar = (message: string, color: string) => {
  snackbar.message = message; snackbar.color = color; snackbar.show = true;
};

const validateCurrentStep = async () => {
  if (step.value === 1) { const { valid } = (await personalForm.value?.validate()) ?? { valid: false }; return valid; }
  if (step.value === 2) { const { valid } = (await organizationForm.value?.validate()) ?? { valid: false }; return valid; }
  const { valid } = (await additionalForm.value?.validate()) ?? { valid: false }; return valid;
};

const goNext = async () => { if (await validateCurrentStep() && step.value < stepsTotal) step.value++; };
const goPrev = () => { if (step.value > 1) step.value--; };

const resetForms = () => {
  [personalForm, organizationForm, additionalForm].forEach(f => { f.value?.reset(); f.value?.resetValidation(); });
  step.value = 1;
};

const startResendTimer = () => {
  resendCooldown.value = 30;
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    resendCooldown.value--;
    if (resendCooldown.value <= 0) { clearInterval(resendTimer!); resendTimer = null; }
  }, 1000);
};

const submit = async () => {
  if (!await validateCurrentStep()) return;
  loading.value = true;
  try {
    const orgSnap = formState.organizationName;
    let website = formState.website?.trim();
    if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website;

    const response = await registerOrganizer({
      full_name: formState.fullName, phone_number: formState.phoneNumber,
      email: formState.email || undefined, password: formState.password,
      organization_name: formState.organizationName, description: formState.description,
      city: formState.city, website: website || undefined,
      contact_person: formState.contactPerson || formState.fullName,
      notes: formState.projectsPlan,
    });

    if (response?.requires_email_verification && response?.user?.email) {
      verificationEmail.value = response.user.email;
      submittedOrganization.value = orgSnap;
      startResendTimer();
      showVerificationDialog.value = true;
      showSnackbar('Код подтверждения отправлен на ваш email.', 'info');
    } else {
      authStore.persistAccessToken(response);
      await authStore.loadUser();
      showSnackbar('Заявка отправлена. Вы вошли в систему.', 'success');
      resetForms();
      setTimeout(() => router.push(response?.dashboard_url || { name: 'organizer-dashboard' }), 1000);
    }
  } catch (e: any) {
    showSnackbar(e?.response?.data?.detail || 'Не удалось отправить заявку.', 'error');
  } finally { loading.value = false; }
};

const handleVerifyEmail = async () => {
  if (verificationCode.value.length !== 6) { showSnackbar('Введите 6-значный код', 'error'); return; }
  verificationLoading.value = true;
  try {
    const response = await verifyEmail(verificationEmail.value, verificationCode.value);
    authStore.persistAccessToken(response);
    await authStore.loadUser();
    showSnackbar('Email подтверждён! Заявка отправлена.', 'success');
    showVerificationDialog.value = false;
    resetForms();
    setTimeout(() => {
      const u = authStore.user;
      if (u && (u.role === 'organizer' || u.is_organizer) && u.organizer_status === 'rejected') {
        router.push({ name: 'organizer-application-rejected' });
      } else {
        router.push({ name: 'organizer-dashboard' });
      }
    }, 1000);
  } catch (e: any) {
    showSnackbar(e?.response?.data?.detail || 'Неверный код.', 'error');
  } finally { verificationLoading.value = false; }
};

const handleResendCode = async () => {
  if (resendCooldown.value > 0) return;
  resendLoading.value = true;
  try {
    await resendVerificationCode(verificationEmail.value);
    showSnackbar('Код отправлен повторно.', 'success');
    startResendTimer();
  } catch (e: any) {
    showSnackbar(e?.response?.data?.detail || 'Не удалось отправить код.', 'error');
  } finally { resendLoading.value = false; }
};

const handleCancelRegistration = async () => {
  try { await cancelRegistration(verificationEmail.value); } catch { /* silent */ }
  showVerificationDialog.value = false;
  verificationCode.value = '';
  showSnackbar('Регистрация отменена.', 'info');
};

const STEPS = [
  { n: 1, label: 'Контакты',    icon: 'mdi-account-outline' },
  { n: 2, label: 'Организация', icon: 'mdi-domain' },
  { n: 3, label: 'Итог',        icon: 'mdi-check-decagram-outline' },
];
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
          <v-icon size="14">mdi-domain</v-icon>
          Организатор
        </div>

        <div class="brand-headline-wrap">
          <p class="brand-eyebrow">Платформа BirQadam</p>
          <h2 class="brand-headline">
            Создавайте<br>
            <em>проекты,</em><br>
            меняйте мир
          </h2>
          <p class="brand-sub">
            Зарегистрируйтесь как организатор —<br>
            создавайте акции, управляйте командой<br>
            волонтёров и отслеживайте результат.
          </p>
        </div>

        <!-- Возможности -->
        <div class="brand-features">
          <div v-for="f in [
            { icon: 'mdi-plus-circle-outline',     text: 'Создание проектов и акций' },
            { icon: 'mdi-account-group-outline',   text: 'Управление командой волонтёров' },
            { icon: 'mdi-chart-bar',               text: 'Аналитика и статистика' },
            { icon: 'mdi-bell-outline',            text: 'Push-уведомления участникам' },
          ]" :key="f.text" class="brand-feature">
            <div class="brand-feature-icon">
              <v-icon size="16" color="white">{{ f.icon }}</v-icon>
            </div>
            <span>{{ f.text }}</span>
          </div>
        </div>
      </div>

      <p class="brand-footer-note">
        <v-icon size="13" style="opacity:.6;margin-right:4px">mdi-shield-check-outline</v-icon>
        После регистрации — проверка модератором
      </p>
    </div>

    <!-- ── Правая панель формы ───────────────────────────── -->
    <div class="form-panel">
      <div class="form-card">

        <!-- Шапка -->
        <div class="form-header">
          <div class="form-icon-wrap">
            <v-icon size="22" color="white">mdi-domain</v-icon>
          </div>
          <div style="flex:1">
            <h1 class="form-title">Регистрация организатора</h1>
            <p class="form-subtitle">Шаг {{ step }} из {{ stepsTotal }}</p>
          </div>
          <RouterLink to="/instructions" class="instr-link" title="Инструкция по заполнению">
            <v-icon size="15">mdi-help-circle-outline</v-icon>
            Инструкция
          </RouterLink>
        </div>

        <!-- Степпер -->
        <div class="stepper">
          <div
            v-for="s in STEPS"
            :key="s.n"
            class="stepper-item"
            :class="{ 'stepper-item--active': step === s.n, 'stepper-item--done': step > s.n }"
            @click="step > s.n ? (step = s.n) : undefined"
          >
            <div class="stepper-circle">
              <v-icon v-if="step > s.n" size="14" color="#2e7d32">mdi-check</v-icon>
              <span v-else class="stepper-num">{{ s.n }}</span>
            </div>
            <span class="stepper-label">{{ s.label }}</span>
            <div v-if="s.n < STEPS.length" class="stepper-line" :class="{ 'stepper-line--done': step > s.n }" />
          </div>
        </div>

        <!-- ── Шаг 1: Личные данные ── -->
        <div v-show="step === 1" class="step-block">
          <v-form ref="personalForm">
            <div class="fields-grid">
              <div class="field-wrap field-wrap--half">
                <label class="field-label">Полное имя <span class="req">*</span></label>
                <div class="field-box">
                  <v-icon size="16" class="field-ico">mdi-account-outline</v-icon>
                  <v-text-field
                    v-model="formState.fullName"
                    placeholder="Иван Иванов"
                    variant="plain" density="compact"
                    :rules="[rules.required]"
                    autocomplete="name"
                    hide-details="auto" class="vf"
                  />
                </div>
              </div>

              <div class="field-wrap field-wrap--half">
                <label class="field-label">Контактное лицо</label>
                <div class="field-box">
                  <v-icon size="16" class="field-ico">mdi-account-tie-outline</v-icon>
                  <v-text-field
                    v-model="formState.contactPerson"
                    placeholder="Если отличается от имени"
                    variant="plain" density="compact"
                    hide-details="auto" class="vf"
                  />
                </div>
              </div>

              <div class="field-wrap field-wrap--half">
                <label class="field-label">Телефон <span class="req">*</span></label>
                <div class="field-box">
                  <v-icon size="16" class="field-ico">mdi-phone-outline</v-icon>
                  <v-text-field
                    v-model="formState.phoneNumber"
                    placeholder="+7 (700) 000-00-00"
                    variant="plain" density="compact"
                    :rules="[rules.required, rules.phone]"
                    autocomplete="tel"
                    hide-details="auto" class="vf"
                  />
                </div>
              </div>

              <div class="field-wrap field-wrap--half">
                <label class="field-label">Email <span class="req">*</span></label>
                <div class="field-box">
                  <v-icon size="16" class="field-ico">mdi-email-outline</v-icon>
                  <v-text-field
                    v-model="formState.email"
                    placeholder="you@example.kz"
                    variant="plain" density="compact"
                    :rules="[rules.required, rules.email]"
                    autocomplete="email"
                    hide-details="auto" class="vf"
                  />
                </div>
              </div>

              <div class="field-wrap field-wrap--full">
                <label class="field-label">Пароль <span class="req">*</span></label>
                <div class="field-box">
                  <v-icon size="16" class="field-ico">mdi-lock-outline</v-icon>
                  <v-text-field
                    v-model="formState.password"
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
            </div>
          </v-form>
        </div>

        <!-- ── Шаг 2: Организация ── -->
        <div v-show="step === 2" class="step-block">
          <v-form ref="organizationForm">
            <div class="fields-grid">
              <div class="field-wrap field-wrap--full">
                <label class="field-label">Название организации <span class="req">*</span></label>
                <div class="field-box">
                  <v-icon size="16" class="field-ico">mdi-domain</v-icon>
                  <v-text-field
                    v-model="formState.organizationName"
                    placeholder="ОФ «Зелёный город»"
                    variant="plain" density="compact"
                    :rules="[rules.required]"
                    hide-details="auto" class="vf"
                  />
                </div>
              </div>

              <div class="field-wrap field-wrap--full">
                <label class="field-label">Описание деятельности <span class="req">*</span></label>
                <div class="field-box field-box--area">
                  <v-textarea
                    v-model="formState.description"
                    placeholder="Расскажите о вашей организации и её миссии…"
                    variant="plain" density="compact"
                    rows="3" auto-grow
                    :rules="[rules.required]"
                    hide-details="auto" class="vf"
                  />
                </div>
              </div>

              <div class="field-wrap field-wrap--half">
                <label class="field-label">Город <span class="req">*</span></label>
                <div class="field-box">
                  <v-icon size="16" class="field-ico">mdi-map-marker-outline</v-icon>
                  <v-text-field
                    v-model="formState.city"
                    placeholder="Алматы"
                    variant="plain" density="compact"
                    :rules="[rules.required]"
                    hide-details="auto" class="vf"
                  />
                </div>
              </div>

              <div class="field-wrap field-wrap--half">
                <label class="field-label">Сайт или соцсети</label>
                <div class="field-box">
                  <v-icon size="16" class="field-ico">mdi-web</v-icon>
                  <v-text-field
                    v-model="formState.website"
                    placeholder="example.kz"
                    variant="plain" density="compact"
                    :rules="[rules.url]"
                    hide-details="auto" class="vf"
                  />
                </div>
              </div>
            </div>
          </v-form>
        </div>

        <!-- ── Шаг 3: Итог ── -->
        <div v-show="step === 3" class="step-block">
          <div class="info-notice">
            <div class="info-notice-icon">
              <v-icon size="18" color="#2e7d32">mdi-information-outline</v-icon>
            </div>
            <div>
              <strong>Что происходит дальше</strong>
              <p>После отправки заявки администратор проверит данные и свяжется с вами. Статус будет доступен в личном кабинете.</p>
            </div>
          </div>

          <v-form ref="additionalForm">
            <div class="fields-grid">
              <div class="field-wrap field-wrap--full">
                <label class="field-label">Планируемые проекты</label>
                <div class="field-box field-box--area">
                  <v-textarea
                    v-model="formState.projectsPlan"
                    placeholder="Расскажите, какие мероприятия вы планируете организовывать…"
                    variant="plain" density="compact"
                    rows="4" auto-grow
                    hide-details="auto" class="vf"
                  />
                </div>
              </div>
            </div>
          </v-form>
        </div>

        <!-- Навигация -->
        <div class="form-nav">
          <button v-if="step > 1" class="nav-btn nav-btn--back" type="button" @click="goPrev">
            <v-icon size="16">mdi-arrow-left</v-icon>
            Назад
          </button>
          <div style="flex:1" />
          <button v-if="step < stepsTotal" class="nav-btn nav-btn--next" type="button" @click="goNext">
            Далее
            <v-icon size="16">mdi-arrow-right</v-icon>
          </button>
          <button v-else class="nav-btn nav-btn--submit" type="button" :disabled="loading" @click="submit">
            <v-icon v-if="!loading" size="16">mdi-send-outline</v-icon>
            <v-progress-circular v-else size="16" width="2" indeterminate color="white" />
            {{ loading ? 'Отправка…' : 'Отправить заявку' }}
          </button>
        </div>

        <!-- Ссылка на вход -->
        <p class="form-login-hint">
          Уже есть аккаунт?
          <RouterLink to="/login" class="form-login-link">Войти</RouterLink>
        </p>
      </div>
    </div>

    <!-- ── Snackbar ──────────────────────────────────────── -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000" location="top" rounded="pill">
      <div class="d-flex align-center ga-2">
        <v-icon size="15">
          {{ snackbar.color === 'success' ? 'mdi-check-circle' : snackbar.color === 'info' ? 'mdi-information' : 'mdi-alert-circle' }}
        </v-icon>
        {{ snackbar.message }}
      </div>
    </v-snackbar>

    <!-- ── Email верификация ─────────────────────────────── -->
    <v-dialog v-model="showVerificationDialog" max-width="400" persistent>
      <v-card class="verify-card pa-6">
        <div class="d-flex align-center ga-3 mb-4">
          <div class="verify-icon">
            <v-icon size="22" color="white">mdi-email-check-outline</v-icon>
          </div>
          <div class="flex-grow-1">
            <h2 class="verify-title">Подтверждение email</h2>
            <p class="verify-sub">Код отправлен на <strong>{{ verificationEmail }}</strong></p>
          </div>
          <v-btn icon size="small" variant="text" @click="handleCancelRegistration">
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </div>

        <p class="verify-hint">Введите 6-значный код из письма.</p>

        <label class="field-label mb-2">Код подтверждения</label>
        <div class="field-box mb-5">
          <v-icon size="16" class="field-ico">mdi-key-outline</v-icon>
          <v-text-field
            v-model="verificationCode"
            placeholder="000000"
            variant="plain" density="compact"
            maxlength="6"
            autofocus
            hide-details="auto" class="vf"
            @keyup.enter="handleVerifyEmail"
          />
        </div>

        <div class="d-flex flex-column ga-2">
          <button
            class="nav-btn nav-btn--submit"
            type="button"
            :disabled="verificationLoading || verificationCode.length !== 6"
            @click="handleVerifyEmail"
          >
            <v-progress-circular v-if="verificationLoading" size="16" width="2" indeterminate color="white" />
            <v-icon v-else size="16">mdi-check</v-icon>
            Подтвердить
          </button>
          <button
            class="nav-btn nav-btn--back"
            type="button"
            :disabled="resendLoading || resendCooldown > 0"
            @click="handleResendCode"
          >
            {{ resendCooldown > 0 ? `Повторить (${resendCooldown}с)` : 'Отправить повторно' }}
          </button>
          <button class="cancel-link" type="button" @click="handleCancelRegistration">Отменить регистрацию</button>
        </div>
      </v-card>
    </v-dialog>

  </div>
</template>

<style scoped>
/* ── Корень ──────────────────────────────────────────── */
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

/* Фичи */
.brand-features {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.brand-feature {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255,255,255,0.85);
  font-size: 0.85rem;
  font-weight: 500;
}
.brand-feature-icon {
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
  max-width: 520px;
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
  margin-bottom: 24px;
}
.form-icon-wrap {
  width: 48px; height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2e7d32, #43a047);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(46,125,50,0.3);
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

/* Степпер */
.stepper {
  display: flex;
  align-items: center;
  margin-bottom: 28px;
  gap: 0;
}
.stepper-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
}
.stepper-item--done { cursor: pointer; }

.stepper-circle {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 2px solid rgba(0,0,0,0.12);
  background: white;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: all 0.22s;
}
.stepper-item--active .stepper-circle {
  border-color: #2e7d32;
  background: #2e7d32;
  box-shadow: 0 3px 10px rgba(46,125,50,0.3);
}
.stepper-item--done .stepper-circle {
  border-color: #a5d6a7;
  background: #f1f8e9;
}

.stepper-num {
  font-size: 0.78rem;
  font-weight: 700;
  color: #aaa;
}
.stepper-item--active .stepper-num { color: white; }

.stepper-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #bbb;
  white-space: nowrap;
  transition: color 0.2s;
}
.stepper-item--active .stepper-label { color: #2e7d32; }
.stepper-item--done  .stepper-label  { color: #888; }

.stepper-line {
  flex: 1;
  height: 2px;
  background: #e8e8e8;
  margin: 0 10px;
  min-width: 28px;
  border-radius: 1px;
  transition: background 0.25s;
}
.stepper-line--done { background: #a5d6a7; }

/* Поля */
.step-block { animation: fadeUp 0.25s ease both; }

.fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.field-wrap--half { grid-column: span 1; }
.field-wrap--full { grid-column: span 2; }

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
.field-box--area { align-items: flex-start; padding-top: 10px; }
.field-box:focus-within {
  border-color: #66bb6a;
  box-shadow: 0 0 0 3px rgba(102,187,106,0.15);
  background: white;
}
.field-ico {
  flex-shrink: 0;
  margin-right: 8px;
  color: rgba(0,0,0,0.28) !important;
}
.field-box--area .field-ico { margin-top: 3px; }

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

/* Инструкция */
.instr-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: #2e7d32;
  text-decoration: none;
  padding: 5px 11px;
  border-radius: 20px;
  background: #f1f8e9;
  border: 1px solid rgba(46,125,50,0.2);
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.instr-link:hover { background: #c8e6c9; color: #1b5e20; }

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
  margin-bottom: 18px;
}
.info-notice-icon {
  flex-shrink: 0;
  width: 30px; height: 30px;
  border-radius: 8px;
  background: #c8e6c9;
  display: flex; align-items: center; justify-content: center;
}
.info-notice strong { display: block; font-weight: 700; margin-bottom: 3px; }
.info-notice p { margin: 0; color: rgba(46,125,50,0.72); font-size: 0.8rem; }

/* Навигация */
.form-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 28px;
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

.nav-btn--next {
  background: linear-gradient(135deg, #2e7d32, #43a047);
  color: white;
  box-shadow: 0 4px 14px rgba(46,125,50,0.3);
}
.nav-btn--next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(46,125,50,0.4); }

.nav-btn--submit {
  background: linear-gradient(135deg, #2e7d32, #43a047);
  color: white;
  box-shadow: 0 4px 16px rgba(46,125,50,0.35);
  padding: 12px 24px;
}
.nav-btn--submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(46,125,50,0.45); }

.form-login-hint {
  text-align: center;
  margin: 18px 0 0;
  font-size: 0.82rem;
  color: #aaa;
}
.form-login-link {
  color: #2e7d32;
  font-weight: 700;
  text-decoration: none;
  margin-left: 4px;
}
.form-login-link:hover { text-decoration: underline; }

/* Verify dialog */
.verify-card { border-radius: 24px !important; }
.verify-icon {
  width: 46px; height: 46px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2e7d32, #43a047);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(46,125,50,0.3);
}
.verify-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 2px;
}
.verify-sub {
  font-size: 0.78rem;
  color: #888;
  margin: 0;
}
.verify-hint {
  font-size: 0.82rem;
  color: #888;
  margin: 0 0 14px;
  line-height: 1.55;
}
.cancel-link {
  background: none; border: none; cursor: pointer;
  color: #bbb; font-size: 0.8rem; font-weight: 600;
  text-align: center; padding: 8px; width: 100%;
  border-radius: 8px; transition: color 0.15s, background 0.15s;
}
.cancel-link:hover { color: #e53935; background: rgba(229,57,53,0.06); }

/* Анимация */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Адаптив */
@media (max-width: 600px) {
  .fields-grid { grid-template-columns: 1fr; }
  .field-wrap--half, .field-wrap--full { grid-column: span 1; }
  .stepper-label { display: none; }
  .stepper-line { min-width: 16px; margin: 0 6px; }
  .form-card { padding: 24px 20px 28px; border-radius: 16px; }
}
</style>