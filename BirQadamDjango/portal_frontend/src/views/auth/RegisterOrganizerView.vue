<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
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

const loading              = ref(false);
const successDialog        = ref(false);
const submittedOrganization = ref<string | null>(null);
const showPassword         = ref(false);
const snackbar = reactive({ show: false, color: 'success', message: '' });

const showVerificationDialog = ref(false);
const verificationEmail  = ref('');
const verificationCode   = ref('');
const verificationLoading = ref(false);
const resendLoading      = ref(false);
const resendCooldown     = ref(0);
let resendTimer: ReturnType<typeof setInterval> | null = null;

const formState = reactive<OrganizerFormState>({
  fullName: '', phoneNumber: '', email: '', password: '',
  organizationName: '', description: '', city: '',
  website: '', contactPerson: '', projectsPlan: '',
});

const rules = {
  required: (v: string) => !!v || 'Поле обязательно для заполнения.',
  phone: (v: string) => v.replace(/[^0-9+]/g, '').length >= 11 || 'Введите корректный номер телефона.',
  email: (v: string) => !v || /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v) || 'Введите корректный email.',
  password: (v: string) => (!!v && v.length >= 8) || 'Пароль должен содержать не менее 8 символов.',
  url: (v: string) => {
    if (!v) return true;
    const t = v.trim();
    if (/^https?:\/\//i.test(t)) { try { new URL(t); return true; } catch { /* fall */ } }
    return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(\/.*)?$/i.test(t) ||
      'Введите корректный URL (например: example.kz)';
  },
};

const showSnackbar = (message: string, color: string) => { snackbar.message = message; snackbar.color = color; snackbar.show = true; };

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
  resendTimer = setInterval(() => { resendCooldown.value--; if (resendCooldown.value <= 0) { clearInterval(resendTimer!); resendTimer = null; } }, 1000);
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
      await authStore.loadUser();
      showSnackbar('Заявка отправлена. Вы вошли в систему.', 'success');
      resetForms();
      setTimeout(() => router.push(response?.dashboard_url || { name: 'organizer-dashboard' }), 1000);
    }
  } catch (e: any) {
    showSnackbar(e?.response?.data?.detail || 'Не удалось отправить заявку. Попробуйте позже.', 'error');
  } finally { loading.value = false; }
};

const handleVerifyEmail = async () => {
  if (verificationCode.value.length !== 6) { showSnackbar('Введите 6-значный код', 'error'); return; }
  verificationLoading.value = true;
  try {
    await verifyEmail(verificationEmail.value, verificationCode.value);
    await authStore.loadUser();
    showSnackbar('Email подтверждён! Заявка отправлена.', 'success');
    showVerificationDialog.value = false;
    resetForms();
    setTimeout(() => router.push({ name: 'home' }), 1000);
  } catch (e: any) {
    showSnackbar(e?.response?.data?.detail || 'Неверный код подтверждения.', 'error');
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
  showSnackbar('Регистрация отменена. Вы можете попробовать снова.', 'info');
};

/* Step meta */
const STEPS = [
  { n: 1, label: 'Контакты',     icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
  { n: 2, label: 'Организация',  icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { n: 3, label: 'Итог',         icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z' },
];
</script>

<template>
  <div class="rp">

    <!-- ══════════ BACKGROUND ══════════ -->
    <div class="rp__bg">
      <div class="rp__orb rp__orb--a" />
      <div class="rp__orb rp__orb--b" />
      <div class="rp__orb rp__orb--c" />
      <div class="rp__grid" />
    </div>

    <!-- ══════════ PAGE WRAP ══════════ -->
    <div class="rp__wrap">

      <!-- Logo -->
      <div class="rp__logo">
        <div class="rp__logo-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 3.5 2.5 6.5 6 8.5l1 .5 1-.5C16.5 15.5 19 12.5 19 9c0-3.87-3.13-7-7-7z" fill="rgba(198,234,90,.9)"/>
            <circle cx="12" cy="9" r="3" fill="#0e1f08"/>
          </svg>
        </div>
        <span class="rp__logo-name">BirQadam</span>
        <span class="rp__logo-tag">Организатор</span>
      </div>

      <!-- Card -->
      <div class="rp__card">
        <div class="rp__card-strip" />

        <div class="rp__card-inner">

          <!-- Header -->
          <div class="rp__head">
            <div class="rp__head-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
              </svg>
              Новый организатор
            </div>
            <h1 class="rp__title">Регистрация организатора</h1>
            <p class="rp__sub">Заполните форму — после модерации вы получите доступ к кабинету организатора с созданием проектов, управлением командой и задачами.</p>
          </div>

          <!-- Step indicators -->
          <div class="rp__steps">
            <div
              v-for="s in STEPS"
              :key="s.n"
              class="rp__step"
              :class="{
                'rp__step--active': step === s.n,
                'rp__step--done':   step >  s.n,
              }"
              @click="step > s.n ? step = s.n : undefined"
            >
              <div class="rp__step-circle">
                <!-- Done checkmark -->
                <svg v-if="step > s.n" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <!-- Number -->
                <span v-else class="rp__step-n">{{ s.n }}</span>
              </div>
              <span class="rp__step-lbl">{{ s.label }}</span>
              <div v-if="s.n < STEPS.length" class="rp__step-line" :class="{ 'rp__step-line--done': step > s.n }" />
            </div>
          </div>

          <!-- ── STEP 1: Contacts ── -->
          <div v-show="step === 1" class="rp__form-block">
            <v-form ref="personalForm">
              <div class="rp__fg">
                <div class="rp__fw rp__fw--half">
                  <label class="rp__lbl">Полное имя <span class="rp__req">*</span></label>
                  <div class="rp__input-box">
                    <v-icon size="16" color="rgba(0,0,0,0.3)" class="rp__fld-ico">mdi-account-outline</v-icon>
                    <v-text-field v-model="formState.fullName" placeholder="Иван Иванов" variant="plain" density="compact" :rules="[rules.required]" autocomplete="name" hide-details="auto" class="rp__vf"/>
                  </div>
                </div>
                <div class="rp__fw rp__fw--half">
                  <label class="rp__lbl">Контактное лицо</label>
                  <div class="rp__input-box">
                    <v-icon size="16" color="rgba(0,0,0,0.3)" class="rp__fld-ico">mdi-account-tie-outline</v-icon>
                    <v-text-field v-model="formState.contactPerson" placeholder="Если отличается от имени" variant="plain" density="compact" hide-details="auto" class="rp__vf"/>
                  </div>
                </div>
                <div class="rp__fw rp__fw--half">
                  <label class="rp__lbl">Телефон <span class="rp__req">*</span></label>
                  <div class="rp__input-box">
                    <v-icon size="16" color="rgba(0,0,0,0.3)" class="rp__fld-ico">mdi-phone-outline</v-icon>
                    <v-text-field v-model="formState.phoneNumber" placeholder="+7 (777) 000-00-00" variant="plain" density="compact" :rules="[rules.required, rules.phone]" autocomplete="tel" hide-details="auto" class="rp__vf"/>
                  </div>
                </div>
                <div class="rp__fw rp__fw--half">
                  <label class="rp__lbl">Email <span class="rp__req">*</span></label>
                  <div class="rp__input-box">
                    <v-icon size="16" color="rgba(0,0,0,0.3)" class="rp__fld-ico">mdi-email-outline</v-icon>
                    <v-text-field v-model="formState.email" placeholder="you@example.kz" variant="plain" density="compact" :rules="[rules.required, rules.email]" autocomplete="email" hide-details="auto" class="rp__vf"/>
                  </div>
                </div>
                <div class="rp__fw rp__fw--full">
                  <label class="rp__lbl">Пароль <span class="rp__req">*</span></label>
                  <div class="rp__input-box">
                    <v-icon size="16" color="rgba(0,0,0,0.3)" class="rp__fld-ico">mdi-lock-outline</v-icon>
                    <v-text-field v-model="formState.password" placeholder="Минимум 8 символов" :type="showPassword ? 'text' : 'password'" variant="plain" density="compact" :rules="[rules.required, rules.password]" autocomplete="new-password" hide-details="auto" class="rp__vf"/>
                    <button class="rp__eye" type="button" @click="showPassword = !showPassword" tabindex="-1">
                      <v-icon size="16">{{ showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline' }}</v-icon>
                    </button>
                  </div>
                </div>
              </div>
            </v-form>
          </div>

          <!-- ── STEP 2: Organization ── -->
          <div v-show="step === 2" class="rp__form-block">
            <v-form ref="organizationForm">
              <div class="rp__fg">
                <div class="rp__fw rp__fw--full">
                  <label class="rp__lbl">Название организации <span class="rp__req">*</span></label>
                  <div class="rp__input-box">
                    <v-icon size="16" color="rgba(0,0,0,0.3)" class="rp__fld-ico">mdi-domain</v-icon>
                    <v-text-field v-model="formState.organizationName" placeholder="ОФ «Зелёный город»" variant="plain" density="compact" :rules="[rules.required]" hide-details="auto" class="rp__vf"/>
                  </div>
                </div>
                <div class="rp__fw rp__fw--full">
                  <label class="rp__lbl">Описание деятельности <span class="rp__req">*</span></label>
                  <div class="rp__input-box rp__input-box--area">
                    <v-textarea v-model="formState.description" placeholder="Расскажите о вашей организации и её миссии…" variant="plain" density="compact" rows="3" auto-grow :rules="[rules.required]" hide-details="auto" class="rp__vf"/>
                  </div>
                </div>
                <div class="rp__fw rp__fw--half">
                  <label class="rp__lbl">Город <span class="rp__req">*</span></label>
                  <div class="rp__input-box">
                    <v-icon size="16" color="rgba(0,0,0,0.3)" class="rp__fld-ico">mdi-map-marker-outline</v-icon>
                    <v-text-field v-model="formState.city" placeholder="Алматы" variant="plain" density="compact" :rules="[rules.required]" hide-details="auto" class="rp__vf"/>
                  </div>
                </div>
                <div class="rp__fw rp__fw--half">
                  <label class="rp__lbl">Сайт или соцсети</label>
                  <div class="rp__input-box">
                    <v-icon size="16" color="rgba(0,0,0,0.3)" class="rp__fld-ico">mdi-web</v-icon>
                    <v-text-field v-model="formState.website" placeholder="example.kz" variant="plain" density="compact" :rules="[rules.url]" hide-details="auto" class="rp__vf"/>
                  </div>
                </div>
              </div>
            </v-form>
          </div>

          <!-- ── STEP 3: Additional ── -->
          <div v-show="step === 3" class="rp__form-block">
            <!-- Info notice -->
            <div class="rp__notice">
              <div class="rp__notice-ico">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                  <path d="M12 8v5M12 16v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <div>
                <strong>Что происходит дальше</strong>
                <p>После отправки заявки администратор проверит данные и свяжется с вами. Статус будет доступен в личном кабинете.</p>
              </div>
            </div>

            <v-form ref="additionalForm">
              <div class="rp__fg">
                <div class="rp__fw rp__fw--full">
                  <label class="rp__lbl">Планируемые проекты</label>
                  <div class="rp__input-box rp__input-box--area">
                    <v-textarea v-model="formState.projectsPlan" placeholder="Расскажите, какие мероприятия вы планируете организовывать в ближайшее время…" variant="plain" density="compact" rows="4" auto-grow hide-details="auto" class="rp__vf"/>
                  </div>
                </div>
              </div>
            </v-form>
          </div>

          <!-- Navigation -->
          <div class="rp__nav">
            <button v-if="step > 1" class="btn btn--outline" type="button" @click="goPrev">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
              Назад
            </button>
            <div class="rp__nav-spacer" />
            <button v-if="step < stepsTotal" class="btn btn--primary" type="button" @click="goNext">
              Далее
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            </button>
            <button v-else class="btn btn--submit" type="button" :disabled="loading" @click="submit">
              <span v-if="!loading" class="btn__inner">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Отправить заявку
              </span>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" class="spin"><circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" stroke-width="3"/><path d="M12 3a9 9 0 0 1 9 9" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>
            </button>
          </div>

        </div>
      </div>

      <p class="rp__footer">Платформа для волонтёров Казахстана</p>

    </div>

    <!-- ══════════ SNACKBAR ══════════ -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000" rounded="pill" location="top">
      <div style="display:flex;align-items:center;gap:8px">
        <v-icon size="15">{{ snackbar.color === 'success' ? 'mdi-check-circle' : snackbar.color === 'info' ? 'mdi-information' : 'mdi-alert-circle' }}</v-icon>
        {{ snackbar.message }}
      </div>
    </v-snackbar>

    <!-- ══════════ EMAIL VERIFY DIALOG ══════════ -->
    <v-dialog v-model="showVerificationDialog" max-width="420" persistent>
      <div class="vdlg">
        <div class="vdlg__head">
          <div class="vdlg__ico">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2"/>
              <polyline points="22,6 12,13 2,6" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div>
            <h2 class="vdlg__title">Подтверждение email</h2>
            <p class="vdlg__sub">Код отправлен на <strong>{{ verificationEmail }}</strong></p>
          </div>
          <button class="vdlg__close" type="button" @click="handleCancelRegistration">
            <v-icon size="16">mdi-close</v-icon>
          </button>
        </div>

        <p class="vdlg__hint">Введите 6-значный код из письма для завершения регистрации.</p>

        <!-- Code inputs -->
        <div class="vdlg__code-wrap">
          <label class="rp__lbl" style="margin-bottom:6px">Код подтверждения</label>
          <div class="rp__input-box">
            <v-icon size="16" color="rgba(0,0,0,0.3)" class="rp__fld-ico">mdi-key-outline</v-icon>
            <v-text-field
              v-model="verificationCode"
              placeholder="000000"
              variant="plain"
              density="compact"
              :rules="[v => v.length === 6 || 'Введите 6-значный код']"
              maxlength="6"
              autofocus
              hide-details="auto"
              class="rp__vf"
              @keyup.enter="handleVerifyEmail"
            />
          </div>
        </div>

        <div class="vdlg__actions">
          <button class="btn btn--verify" type="button" :disabled="verificationLoading || verificationCode.length !== 6" @click="handleVerifyEmail">
            <span v-if="!verificationLoading">Подтвердить</span>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" class="spin"><circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" stroke-width="3"/><path d="M12 3a9 9 0 0 1 9 9" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>
          </button>
          <button class="btn btn--resend" type="button" :disabled="resendLoading || resendCooldown > 0" @click="handleResendCode">
            {{ resendCooldown > 0 ? `Повторить (${resendCooldown}с)` : 'Отправить повторно' }}
          </button>
          <button class="btn btn--cancel-sm" type="button" @click="handleCancelRegistration">Отмена</button>
        </div>
      </div>
    </v-dialog>

    <!-- ══════════ SUCCESS DIALOG ══════════ -->
    <v-dialog v-model="successDialog" max-width="460">
      <div class="sdlg">
        <div class="sdlg__ico">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2 class="sdlg__title">Заявка отправлена</h2>
        <p class="sdlg__text">Мы уведомим вас после проверки. Статус заявки для <strong>{{ submittedOrganization }}</strong> доступен в кабинете организатора.</p>
        <button class="btn btn--primary" style="width:100%" type="button" @click="successDialog = false">Понятно</button>
      </div>
    </v-dialog>

  </div>
</template>

<style scoped>
/* ════════════════════════════════════
   PAGE SHELL
════════════════════════════════════ */
.rp {
  min-height: 100vh;
  background: #0b1a07;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  position: relative;
  overflow: hidden;
  font-family: 'DM Sans', 'Segoe UI', sans-serif;
  padding: clamp(20px, 4vw, 48px) 16px;
}

/* ── Background ── */
.rp__bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }

.rp__orb { position: absolute; border-radius: 50%; filter: blur(80px); }
.rp__orb--a { width: 520px; height: 520px; background: radial-gradient(circle, rgba(139,195,74,.2), transparent 70%); top: -200px; left: -140px; }
.rp__orb--b { width: 360px; height: 360px; background: radial-gradient(circle, rgba(198,234,90,.12), transparent 70%); bottom: -120px; right: -90px; }
.rp__orb--c { width: 220px; height: 220px; background: radial-gradient(circle, rgba(61,122,26,.16), transparent 70%); top: 40%; right: 10%; }

.rp__grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(139,195,74,.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139,195,74,.04) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* ── Wrap ── */
.rp__wrap {
  position: relative; z-index: 2;
  width: 100%; max-width: 680px;
  display: flex; flex-direction: column;
  align-items: center; gap: 20px;
}

/* ── Logo ── */
.rp__logo {
  display: flex; align-items: center; gap: 10px;
  animation: fadeUp .45s ease both;
}
.rp__logo-mark {
  width: 38px; height: 38px; border-radius: 11px;
  background: rgba(139,195,74,.15);
  border: 1px solid rgba(139,195,74,.25);
  display: flex; align-items: center; justify-content: center;
}
.rp__logo-name { font-size: 1.25rem; font-weight: 900; color: #c6ea5a; letter-spacing: -.4px; }
.rp__logo-tag  {
  font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .8px;
  color: rgba(198,234,90,.5);
  padding: 3px 9px; border-radius: 100px;
  border: 1px solid rgba(198,234,90,.2);
}

/* ── Card ── */
.rp__card {
  width: 100%;
  background: rgba(255,255,255,.97);
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,.35), 0 0 0 1px rgba(139,195,74,.1);
  animation: fadeUp .45s .08s ease both;
}

.rp__card-strip {
  height: 4px;
  background: linear-gradient(90deg, #3d7a1a, #8bc34a, #c6ea5a, #8bc34a, #3d7a1a);
  background-size: 200% 100%;
  animation: shimmerStrip 2.5s linear infinite;
}

.rp__card-inner { padding: clamp(22px,4vw,36px) clamp(20px,4vw,36px) clamp(24px,4vw,38px); }

/* ── Head ── */
.rp__head { margin-bottom: 28px; }

.rp__head-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px;
  border-radius: 100px;
  background: rgba(139,195,74,.1);
  border: 1px solid rgba(139,195,74,.22);
  color: #3d7a1a;
  font-size: .71rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .7px;
  margin-bottom: 12px;
}

.rp__title {
  font-size: clamp(1.15rem,3vw,1.55rem);
  font-weight: 900;
  color: #111a0e;
  letter-spacing: -.4px;
  margin: 0 0 8px;
  line-height: 1.2;
}
.rp__sub {
  font-size: .82rem;
  color: rgba(17,26,14,.48);
  line-height: 1.6;
  margin: 0;
}

/* ── Step indicators ── */
.rp__steps {
  display: flex;
  align-items: center;
  margin-bottom: 28px;
  gap: 0;
}

.rp__step {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  cursor: default;
}
.rp__step--done { cursor: pointer; }

.rp__step-circle {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid rgba(0,0,0,.12);
  background: #fff;
  color: rgba(0,0,0,.3);
  font-size: .8rem;
  font-weight: 800;
  flex-shrink: 0;
  transition: all .25s ease;
}

.rp__step--active .rp__step-circle {
  border-color: #8bc34a;
  background: #3d7a1a;
  color: #fff;
  box-shadow: 0 4px 12px rgba(61,122,26,.3);
}

.rp__step--done .rp__step-circle {
  border-color: #8bc34a;
  background: rgba(139,195,74,.12);
  color: #3d7a1a;
}

.rp__step-n { line-height: 1; }

.rp__step-lbl {
  font-size: .78rem;
  font-weight: 700;
  color: rgba(0,0,0,.35);
  white-space: nowrap;
  transition: color .25s;
}
.rp__step--active .rp__step-lbl { color: #3d7a1a; }
.rp__step--done  .rp__step-lbl  { color: rgba(0,0,0,.5); }

.rp__step-line {
  flex: 1;
  height: 2px;
  background: rgba(0,0,0,.1);
  margin: 0 10px;
  min-width: 24px;
  border-radius: 1px;
  transition: background .25s;
}
.rp__step-line--done { background: #8bc34a; }

/* ── Form block ── */
.rp__form-block { animation: fadeUp .3s ease both; }

.rp__fg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.rp__fw--half { grid-column: span 1; }
.rp__fw--full { grid-column: span 2; }

.rp__lbl {
  display: block;
  font-size: .7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .7px;
  color: rgba(17,26,14,.4);
  margin-bottom: 5px;
}
.rp__req { color: #dc2626; }

.rp__input-box {
  display: flex;
  align-items: center;
  background: #f7f9f5;
  border: 1.5px solid rgba(0,0,0,.1);
  border-radius: 11px;
  padding: 0 12px;
  transition: border-color .17s, box-shadow .17s, background .17s;
  overflow: hidden;
}
.rp__input-box--area { align-items: flex-start; padding-top: 10px; }
.rp__input-box:focus-within {
  border-color: #8bc34a;
  box-shadow: 0 0 0 3px rgba(139,195,74,.13);
  background: #fff;
}

.rp__fld-ico { flex-shrink: 0; margin-right: 8px; }
.rp__input-box--area .rp__fld-ico { margin-top: 3px; }

.rp__vf { flex: 1; }
.rp__vf :deep(.v-field__input)   { padding: 10px 0 !important; font-size: .875rem !important; font-weight: 600 !important; }
.rp__vf :deep(.v-field__outline) { display: none !important; }

.rp__eye {
  flex-shrink: 0;
  width: 26px; height: 26px;
  border-radius: 6px;
  background: none; border: none;
  cursor: pointer; color: rgba(0,0,0,.3);
  display: flex; align-items: center; justify-content: center;
  transition: color .15s, background .15s;
}
.rp__eye:hover { color: rgba(0,0,0,.6); background: rgba(0,0,0,.06); }

/* ── Notice ── */
.rp__notice {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(61,122,26,.06);
  border: 1px solid rgba(61,122,26,.14);
  color: #3d7a1a;
  font-size: .82rem;
  line-height: 1.55;
  margin-bottom: 18px;
}
.rp__notice-ico {
  flex-shrink: 0;
  width: 28px; height: 28px;
  border-radius: 8px;
  background: rgba(61,122,26,.1);
  display: flex; align-items: center; justify-content: center;
  margin-top: 1px;
}
.rp__notice strong { display: block; font-weight: 800; margin-bottom: 3px; font-size: .84rem; }
.rp__notice p { margin: 0; color: rgba(61,122,26,.7); }

/* ── Navigation ── */
.rp__nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 26px;
  flex-wrap: wrap;
}
.rp__nav-spacer { flex: 1; }

/* ════════════════════════════════════
   BUTTONS
════════════════════════════════════ */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 11px 22px;
  border-radius: 11px;
  font-size: .875rem;
  font-weight: 800;
  border: none;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s, background .15s, opacity .15s;
  white-space: nowrap;
}
.btn:hover:not(:disabled) { transform: translateY(-1px); }
.btn:disabled             { opacity: .55; cursor: not-allowed; }

.btn--primary {
  background: #3d7a1a; color: #fff;
  box-shadow: 0 4px 14px rgba(61,122,26,.28);
}
.btn--primary:hover:not(:disabled) { background: #2e6313; box-shadow: 0 7px 20px rgba(61,122,26,.38); }

.btn--outline {
  background: transparent; color: #3d7a1a;
  border: 1.5px solid rgba(61,122,26,.25);
}
.btn--outline:hover:not(:disabled) { background: rgba(61,122,26,.06); }

.btn--submit {
  background: linear-gradient(135deg, #3d7a1a, #5a9e28); color: #fff;
  padding: 12px 26px;
  box-shadow: 0 6px 20px rgba(61,122,26,.35);
}
.btn--submit:hover:not(:disabled) { box-shadow: 0 10px 28px rgba(61,122,26,.45); }

.btn__inner { display: flex; align-items: center; gap: 7px; }

/* ════════════════════════════════════
   VERIFY DIALOG
════════════════════════════════════ */
.vdlg {
  background: #fff;
  border-radius: 20px;
  padding: 26px 24px 24px;
  box-shadow: 0 20px 56px rgba(0,0,0,.22);
  font-family: 'DM Sans','Segoe UI',sans-serif;
}

.vdlg__head {
  display: flex; align-items: flex-start; gap: 12px;
  margin-bottom: 14px;
}
.vdlg__ico {
  width: 42px; height: 42px; border-radius: 11px;
  background: #e8f5e2;
  border: 1px solid rgba(61,122,26,.15);
  display: flex; align-items: center; justify-content: center;
  color: #3d7a1a; flex-shrink: 0;
}
.vdlg__title { font-size: .98rem; font-weight: 900; color: #111a0e; margin: 0 0 3px; }
.vdlg__sub   { font-size: .78rem; color: rgba(17,26,14,.45); margin: 0; }
.vdlg__close {
  margin-left: auto; flex-shrink: 0;
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(0,0,0,.06); border: none;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: rgba(0,0,0,.4); transition: background .15s;
}
.vdlg__close:hover { background: rgba(0,0,0,.12); }
.vdlg__hint { font-size: .81rem; color: rgba(17,26,14,.45); margin: 0 0 16px; line-height: 1.55; }

.vdlg__code-wrap { margin-bottom: 18px; }

.vdlg__actions { display: flex; flex-direction: column; gap: 8px; }

.btn--verify {
  background: #3d7a1a; color: #fff;
  width: 100%; justify-content: center;
  padding: 12px 20px;
  box-shadow: 0 4px 14px rgba(61,122,26,.28);
}
.btn--verify:hover:not(:disabled) { background: #2e6313; }

.btn--resend {
  background: transparent; color: rgba(17,26,14,.5);
  border: 1.5px solid rgba(0,0,0,.12);
  width: 100%; justify-content: center;
  padding: 11px 20px;
}
.btn--resend:hover:not(:disabled) { background: rgba(0,0,0,.04); color: rgba(17,26,14,.8); }

.btn--cancel-sm {
  background: transparent; border: none;
  color: rgba(17,26,14,.35); font-size: .8rem; font-weight: 700;
  width: 100%; text-align: center;
  padding: 9px;
  cursor: pointer; border-radius: 9px;
  transition: background .15s, color .15s;
}
.btn--cancel-sm:hover { background: rgba(220,38,38,.06); color: #dc2626; }

/* ════════════════════════════════════
   SUCCESS DIALOG
════════════════════════════════════ */
.sdlg {
  background: #fff;
  border-radius: 20px;
  padding: 32px 28px;
  text-align: center;
  box-shadow: 0 20px 56px rgba(0,0,0,.22);
  font-family: 'DM Sans','Segoe UI',sans-serif;
}
.sdlg__ico {
  width: 60px; height: 60px; border-radius: 50%;
  background: linear-gradient(135deg, #3d7a1a, #8bc34a);
  color: #fff; display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 22px rgba(61,122,26,.35);
}
.sdlg__title { font-size: 1.15rem; font-weight: 900; color: #111a0e; margin: 0 0 10px; }
.sdlg__text  { font-size: .85rem; color: rgba(17,26,14,.5); line-height: 1.6; margin: 0 0 22px; }

/* ════════════════════════════════════
   FOOTER + ANIMATIONS
════════════════════════════════════ */
.rp__footer {
  font-size: .7rem; color: rgba(255,255,255,.22);
  font-weight: 600; letter-spacing: .5px;
  text-align: center; margin: 0;
  animation: fadeUp .45s .15s ease both;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes shimmerStrip {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.spin { animation: spinA .85s linear infinite; display: block; }
@keyframes spinA { to { transform: rotate(360deg); } }

/* ════════════════════════════════════
   RESPONSIVE
════════════════════════════════════ */
@media (max-width: 580px) {
  .rp__fg { grid-template-columns: 1fr; }
  .rp__fw--half, .rp__fw--full { grid-column: span 1; }
  .rp__steps { gap: 0; }
  .rp__step-lbl { display: none; }
  .rp__step-line { min-width: 16px; margin: 0 6px; }
}

@media (max-width: 400px) {
  .rp__card-inner { padding: 18px 16px 22px; }
}
</style>