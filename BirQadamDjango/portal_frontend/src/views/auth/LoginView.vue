<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { VForm } from 'vuetify/components';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const formRef = ref<VForm | null>(null);
const registrationDialog = ref(false);
const showPassword = ref(false);
const snackbar = reactive({ show: false, color: 'error', message: '' });

const formState = reactive({
  identifier: (route.query.identifier as string) || '',
  password: '',
});

const rules = {
  required: (value: string) => !!value || 'Поле обязательно для заполнения.',
};

const submit = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  try {
    const data = await authStore.login({
      identifier: formState.identifier,
      password: formState.password,
    });
    const user = authStore.user;
    const namedPostLogin = () => {
      if (user && (user.role === 'organizer' || user.is_organizer)) {
        if (user.organizer_status === 'rejected') return { name: 'organizer-application-rejected' };
        return { name: 'organizer-dashboard' };
      }
      return { name: 'volunteer-dashboard' };
    };
    const fromQuery = route.query.redirect as string | undefined;
    let target: string | ReturnType<typeof namedPostLogin> =
      fromQuery || (data.dashboard_url as string | undefined) || namedPostLogin();
    if (
      typeof target === 'string' &&
      user &&
      (user.role === 'organizer' || user.is_organizer) &&
      target.includes('/volunteer')
    ) {
      target = namedPostLogin();
    }
    await router.push(target as any);
  } catch (error: any) {
    snackbar.message = error?.response?.data?.detail || 'Не удалось выполнить вход.';
    snackbar.color = 'error';
    snackbar.show = true;
  }
};

const redirectToRole = (role: 'volunteer' | 'organizer') => {
  registrationDialog.value = false;
  router.push(role === 'volunteer' ? '/register/volunteer' : '/register/organizer');
};

</script>

<template>
  <div class="login-root">

    <!-- ──────────── Левая брендинг-панель ──────────── -->
    <div class="brand-panel d-none d-lg-flex">
      <div class="brand-deco brand-deco--1" />
      <div class="brand-deco brand-deco--2" />
      <div class="brand-deco brand-deco--3" />

      <div class="brand-inner">
        <!-- Заголовок (логотип только в v-app-bar) -->
        <div class="brand-headline-wrap">
          <p class="brand-eyebrow">Платформа для волонтёров</p>
          <h2 class="brand-headline">
            Один шаг —<br>
            <em>навстречу</em><br>
            возможностям
          </h2>
          <p class="brand-sub">
            Находите проекты, берите задачи,<br>
            меняйте мир рядом с вами.
          </p>
        </div>
      </div>
    </div>

    <!-- ──────────── Правая панель формы ──────────── -->
    <div class="form-panel">
      <div class="form-card">
        <!-- Шапка формы -->
        <div class="form-header">
          <div class="form-icon-wrap">
            <v-icon size="24" color="white">mdi-login-variant</v-icon>
          </div>
          <div>
            <h1 class="form-title">Вход в кабинет</h1>
            <p class="form-subtitle">Используйте телефон или email</p>
          </div>
        </div>

        <!-- Форма -->
        <v-form ref="formRef" @submit.prevent="submit" class="mt-6">
          <label class="field-label">Телефон или email</label>
          <v-text-field
            v-model="formState.identifier"
            variant="outlined"
            prepend-inner-icon="mdi-account-outline"
            placeholder="+7 (700) 000-00-00 или mail@example.com"
            :rules="[rules.required]"
            autocomplete="username"
            class="field-input mb-3"
            density="comfortable"
            hide-details="auto"
          />

          <label class="field-label mt-2">Пароль</label>
          <v-text-field
            v-model="formState.password"
            variant="outlined"
            prepend-inner-icon="mdi-lock-outline"
            placeholder="Введите пароль"
            :type="showPassword ? 'text' : 'password'"
            :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            :rules="[rules.required]"
            autocomplete="current-password"
            class="field-input"
            density="comfortable"
            hide-details="auto"
            @click:append-inner="showPassword = !showPassword"
          />

          <div class="d-flex justify-end mt-2 mb-5">
            <button
              type="button"
              class="forgot-link"
              @click="router.push('/password-reset')"
            >
              Забыли пароль?
            </button>
          </div>

          <!-- Кнопки -->
          <v-btn
            type="submit"
            block
            size="large"
            class="btn-login text-none"
            :loading="authStore.loading"
            elevation="0"
          >
            Войти
          </v-btn>

          <div class="form-divider my-5">
            <span>или</span>
          </div>

          <v-btn
            block
            size="large"
            variant="outlined"
            class="btn-register text-none"
            elevation="0"
            @click="registrationDialog = true"
          >
            Зарегистрироваться
          </v-btn>
        </v-form>
      </div>
    </div>

    <!-- ──────────── Snackbar ──────────── -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000" location="top">
      {{ snackbar.message }}
    </v-snackbar>

    <!-- ──────────── Диалог выбора роли ──────────── -->
    <v-dialog v-model="registrationDialog" max-width="400" :scrim-opacity="0.4">
      <v-card class="role-card pa-6">
        <div class="d-flex align-center ga-3 mb-5">
          <div class="role-icon-wrap">
            <v-icon size="22" color="white">mdi-account-group-outline</v-icon>
          </div>
          <div>
            <h2 class="role-title">Кого регистрируем?</h2>
            <p class="role-subtitle">Выберите вашу роль на платформе</p>
          </div>
        </div>

        <div class="d-flex flex-column ga-3">
          <button class="role-option role-option--volunteer" @click="redirectToRole('volunteer')">
            <div class="role-option-icon">
              <v-icon size="22" color="white">mdi-hand-heart</v-icon>
            </div>
            <div class="role-option-text">
              <span class="role-option-title">Я волонтёр</span>
              <span class="role-option-desc">Участвую в проектах и акциях</span>
            </div>
            <v-icon size="18" class="ml-auto" style="opacity:.5">mdi-chevron-right</v-icon>
          </button>

          <button class="role-option role-option--organizer" @click="redirectToRole('organizer')">
            <div class="role-option-icon role-option-icon--org">
              <v-icon size="22" color="white">mdi-domain</v-icon>
            </div>
            <div class="role-option-text">
              <span class="role-option-title">Я организатор</span>
              <span class="role-option-desc">Создаю и управляю проектами</span>
            </div>
            <v-icon size="18" class="ml-auto" style="opacity:.5">mdi-chevron-right</v-icon>
          </button>

          <button class="role-cancel" @click="registrationDialog = false">Отменить</button>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
/* ── Корневой контейнер ─────────────────────────────── */
.login-root {
  min-height: 100vh;
  display: flex;
}

/* ── Левая панель ───────────────────────────────────── */
.brand-panel {
  width: 480px;
  flex-shrink: 0;
  background: var(--birqadam-app-bar-gradient);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px 48px;
  position: relative;
  overflow: hidden;
}

/* Декоративные круги */
.brand-deco {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.brand-deco--1 {
  width: 320px; height: 320px;
  top: -80px; right: -100px;
  background: rgba(255,255,255,0.06);
}
.brand-deco--2 {
  width: 220px; height: 220px;
  bottom: 80px; left: -60px;
  background: rgba(255,255,255,0.05);
}
.brand-deco--3 {
  width: 120px; height: 120px;
  top: 45%; right: 30px;
  background: rgba(255,255,255,0.04);
}

.brand-inner {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  z-index: 1;
}

/* Заголовок */
.brand-eyebrow {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin: 0 0 14px;
}
.brand-headline {
  color: #ffffff;
  font-size: 2.6rem;
  font-weight: 700;
  line-height: 1.15;
  margin: 0 0 16px;
}
.brand-headline em {
  font-style: italic;
  color: #ffffff;
  opacity: 0.88;
}
.brand-sub {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0;
}

.brand-stat-label {
  color: rgba(255, 255, 255, 0.6);
}

.brand-footer-note {
  color: rgba(255,255,255,0.45);
  font-size: 0.78rem;
  margin: 0;
  position: relative;
  z-index: 1;
}

/* ── Правая панель ──────────────────────────────────── */
.form-panel {
  flex: 1;
  background: #f7f8f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  min-height: 100vh;
}

/* Карточка формы */
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
}
.form-icon-wrap {
  width: 48px; height: 48px;
  border-radius: 14px;
  background: var(--birqadam-app-bar-gradient);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(27, 94, 32, 0.28);
}
.form-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 2px;
  line-height: 1.2;
}
.form-subtitle {
  font-size: 0.83rem;
  color: #888;
  margin: 0;
}

/* Поля */
.field-label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: #444;
  margin-bottom: 6px;
  margin-top: 12px;
}
.field-input :deep(.v-field) {
  border-radius: 12px !important;
  font-size: 0.9rem;
}
.field-input :deep(.v-field--focused) {
  box-shadow: 0 0 0 3px rgba(46,125,50,0.15);
}

/* Забыли пароль */
.forgot-link {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  color: #2e7d32;
  padding: 0;
  transition: opacity 0.15s;
}
.forgot-link:hover { opacity: 0.7; }

/* Кнопки */
.btn-login {
  background: var(--birqadam-app-bar-gradient) !important;
  color: white !important;
  font-weight: 700 !important;
  font-size: 0.95rem !important;
  letter-spacing: 0.3px;
  border-radius: 12px !important;
  height: 50px !important;
  box-shadow: 0 4px 16px rgba(27, 94, 32, 0.35) !important;
  transition: all 0.22s !important;
}
.btn-login:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 22px rgba(27, 94, 32, 0.45) !important;
}

.btn-register {
  color: #2e7d32 !important;
  border-color: #c8e6c9 !important;
  border-radius: 12px !important;
  height: 50px !important;
  font-weight: 600 !important;
  font-size: 0.95rem !important;
  background: #f1f8e9 !important;
  transition: all 0.2s;
}
.btn-register:hover {
  background: #e8f5e9 !important;
  border-color: #a5d6a7 !important;
}

/* Разделитель */
.form-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #bbb;
  font-size: 0.8rem;
}
.form-divider::before,
.form-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e8e8e8;
}

/* ── Диалог ─────────────────────────────────────────── */
.role-card {
  border-radius: 24px !important;
}
.role-icon-wrap {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: var(--birqadam-app-bar-gradient);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.role-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 2px;
}
.role-subtitle {
  font-size: 0.8rem;
  color: #888;
  margin: 0;
}

/* Опции ролей */
.role-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1.5px solid #e8e8e8;
  background: white;
  cursor: pointer;
  transition: all 0.18s;
  text-align: left;
  width: 100%;
}
.role-option:hover {
  border-color: #a5d6a7;
  background: #f1f8e9;
}
.role-option-icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: var(--birqadam-app-bar-gradient);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.role-option-icon--org {
  background: linear-gradient(135deg, #ffa726, #f57c00);
}
.role-option-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.role-option-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1a1a1a;
}
.role-option-desc {
  font-size: 0.78rem;
  color: #888;
}

.role-cancel {
  background: none;
  border: none;
  cursor: pointer;
  text-align: center;
  color: #aaa;
  font-size: 0.85rem;
  padding: 8px;
  transition: color 0.15s;
  width: 100%;
}
.role-cancel:hover { color: #666; }
</style>