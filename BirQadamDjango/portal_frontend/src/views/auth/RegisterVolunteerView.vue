<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';

import { registerVolunteer, verifyEmail, resendVerificationCode, cancelRegistration } from '@/services/webPortal';
import { useAuthStore } from '@/stores/auth';

interface VolunteerFormState {
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
}

const router = useRouter();
const authStore = useAuthStore();

const formRef = ref<VForm | null>(null);
const loading = ref(false);
const snackbar = reactive({
  show: false,
  color: 'success',
  message: '',
});

// Состояние для подтверждения email
const showVerificationDialog = ref(false);
const verificationEmail = ref('');
const verificationCode = ref('');
const verificationLoading = ref(false);
const resendLoading = ref(false);
const resendCooldown = ref(0);
let resendTimer: ReturnType<typeof setInterval> | null = null;

const formState = reactive<VolunteerFormState>({
  fullName: '',
  phoneNumber: '',
  email: '',
  password: '',
});

const rules = {
  required: (value: string) => !!value || 'Поле обязательно для заполнения.',
  email: (value: string) => {
    if (!value) return true;
    const pattern = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return pattern.test(value) || 'Введите корректный email.';
  },
  phone: (value: string) => {
    if (!value) return 'Номер телефона обязателен для заполнения.';
    const digits = value.replace(/[^0-9+]/g, '');
    return digits.length >= 11 || 'Введите корректный номер телефона.';
  },
  password: (value: string) => {
    if (!value) return 'Пароль обязателен для заполнения.';
    return value.length >= 8 || 'Пароль должен содержать не менее 8 символов.';
  },
};

const resetForm = () => {
  formRef.value?.reset();
  formRef.value?.resetValidation();
};

const showSnackbar = (message: string, color: string) => {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
};

const submit = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  loading.value = true;
  try {
    const response = await registerVolunteer({
      full_name: formState.fullName,
      phone_number: formState.phoneNumber,
      email: formState.email || undefined,
      password: formState.password,
    });
    
    // Проверяем, требуется ли подтверждение email
    if (response?.requires_email_verification && response?.user?.email) {
      verificationEmail.value = response.user.email;
      // Устанавливаем таймер на 30 секунд при открытии диалога
      resendCooldown.value = 30;
      if (resendTimer) clearInterval(resendTimer);
      resendTimer = setInterval(() => {
        resendCooldown.value--;
        if (resendCooldown.value <= 0) {
          if (resendTimer) {
            clearInterval(resendTimer);
            resendTimer = null;
          }
        }
      }, 1000);
      showVerificationDialog.value = true;
      showSnackbar('Код подтверждения отправлен на ваш email. Проверьте почту.', 'info');
    } else {
      // Старая логика для обратной совместимости
      await authStore.loadUser();
      showSnackbar('Регистрация успешно завершена. Добро пожаловать!', 'success');
      resetForm();
      // Используем имя роута вместо хардкода пути
      const dashboardUrl = response?.dashboard_url || { name: 'volunteer-dashboard' };
      setTimeout(() => {
        router.push(dashboardUrl);
      }, 1000);
    }
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось завершить регистрацию.';
    console.error('[VolunteerRegistration] submit error', detail, error);
    showSnackbar(detail, 'error');
  } finally {
    loading.value = false;
  }
};

const handleVerifyEmail = async () => {
  if (!verificationCode.value || verificationCode.value.length !== 6) {
    showSnackbar('Введите 6-значный код', 'error');
    return;
  }

  verificationLoading.value = true;
  try {
    const response = await verifyEmail(verificationEmail.value, verificationCode.value);
    
    // Загружаем пользователя в auth store после подтверждения
    await authStore.loadUser();
    
    showSnackbar('Email успешно подтверждён! Добро пожаловать!', 'success');
    showVerificationDialog.value = false;
    resetForm();
    
    // Перенаправляем на главную страницу после подтверждения
    setTimeout(() => {
      router.push({ name: 'home' });
    }, 1000);
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Неверный код подтверждения.';
    showSnackbar(detail, 'error');
  } finally {
    verificationLoading.value = false;
  }
};

const handleResendCode = async () => {
  if (resendCooldown.value > 0) return;
  
  resendLoading.value = true;
  try {
    await resendVerificationCode(verificationEmail.value);
    showSnackbar('Код подтверждения отправлен повторно на ваш email.', 'success');
    
    // Устанавливаем таймер на 30 секунд
    resendCooldown.value = 30;
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      resendCooldown.value--;
      if (resendCooldown.value <= 0) {
        if (resendTimer) {
          clearInterval(resendTimer);
          resendTimer = null;
        }
      }
    }, 1000);
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось отправить код.';
    showSnackbar(detail, 'error');
  } finally {
    resendLoading.value = false;
  }
};

const handleCancelRegistration = async () => {
  try {
    await cancelRegistration(verificationEmail.value);
    showVerificationDialog.value = false;
    // Не очищаем форму - данные остаются для повторной попытки
    verificationCode.value = ''; // Очищаем только код подтверждения
    showSnackbar('Регистрация отменена. Вы можете попробовать снова.', 'info');
  } catch (error: any) {
    // Даже если произошла ошибка, закрываем диалог, но сохраняем данные формы
    showVerificationDialog.value = false;
    verificationCode.value = ''; // Очищаем только код подтверждения
    console.error('Ошибка при отмене регистрации:', error);
  }
};
</script>

<template>
  <section class="form-section py-12 py-md-16">
    <v-container>
      <v-row class="justify-center">
        <v-col cols="12" md="8" lg="6">
          <v-card class="pa-8 pa-md-10 elevation-8">
            <div class="d-flex align-center mb-6 ga-4">
              <v-avatar color="warning" size="52">
                <v-icon icon="mdi-account-heart-outline" size="32" />
              </v-avatar>
              <div>
                <h1 class="text-h5 text-md-h4 font-weight-bold mb-1">Регистрация волонтёра</h1>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  Создайте аккаунт, чтобы участвовать в проектах и отслеживать прогресс.
                </p>
              </div>
            </div>

            <v-form ref="formRef" @submit.prevent="submit">
              <v-row>
                <v-col cols="12">
                  <v-text-field
                    v-model="formState.fullName"
                    label="Полное имя"
                    variant="outlined"
                    prepend-inner-icon="mdi-account"
                    :rules="[rules.required]"
                    autocomplete="name"
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="formState.phoneNumber"
                    label="Номер телефона"
                    variant="outlined"
                    prepend-inner-icon="mdi-phone"
                    :rules="[rules.required, rules.phone]"
                    autocomplete="tel"
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="formState.email"
                    label="Email"
                    variant="outlined"
                    prepend-inner-icon="mdi-email-outline"
                    :rules="[rules.required, rules.email]"
                    autocomplete="email"
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="formState.password"
                    label="Пароль"
                    variant="outlined"
                    prepend-inner-icon="mdi-lock-outline"
                    :rules="[rules.required, rules.password]"
                    type="password"
                    hint="Минимум 8 символов"
                    persistent-hint
                    autocomplete="new-password"
                  />
                </v-col>
              </v-row>

              <div class="d-flex flex-column ga-4">
                <v-btn
                  color="warning"
                  class="text-none font-weight-bold w-100"
                  size="large"
                  type="submit"
                  :loading="loading"
                >
                  Зарегистрироваться
                </v-btn>
                <v-btn
                  href="https://t.me/cleanupalmaty_bot"
                  color="primary"
                  variant="outlined"
                  class="text-none font-weight-bold w-100"
                  size="large"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Продолжить в Telegram
                </v-btn>
              </div>
            </v-form>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>

    <!-- Диалог подтверждения email -->
    <v-dialog v-model="showVerificationDialog" max-width="450" persistent>
      <v-card class="pa-4 pa-md-6">
        <v-card-title class="d-flex align-center justify-space-between mb-4 flex-wrap">
          <div class="d-flex align-center flex-wrap" style="max-width: calc(100% - 50px);">
            <v-icon icon="mdi-email-check" color="primary" size="24" class="mr-2 mr-md-3" style="flex-shrink: 0;" />
            <h2 class="text-h6 text-md-h5 font-weight-bold" style="word-break: break-word; line-height: 1.2;">Подтверждение email</h2>
          </div>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="handleCancelRegistration"
            class="ml-2"
          />
        </v-card-title>

        <v-card-text class="pa-0 pa-md-4">
          <p class="text-body-2 text-md-body-1 mb-3 mb-md-4">
            Мы отправили код подтверждения на <strong>{{ verificationEmail }}</strong>
          </p>
          <p class="text-caption text-md-body-2 text-medium-emphasis mb-4 mb-md-6">
            Введите 6-значный код из письма для завершения регистрации.
          </p>

          <v-text-field
            v-model="verificationCode"
            label="Код подтверждения"
            variant="outlined"
            prepend-inner-icon="mdi-key"
            :rules="[(v) => v.length === 6 || 'Введите 6-значный код']"
            maxlength="6"
            counter
            autofocus
            @keyup.enter="handleVerifyEmail"
            density="comfortable"
            class="mb-2"
          />
        </v-card-text>

        <v-card-actions class="pa-4 pa-md-6 pt-0">
          <div class="d-flex flex-column ga-2 w-100">
            <v-btn
              variant="outlined"
              color="error"
              @click="handleCancelRegistration"
              class="text-none w-100"
              size="large"
            >
              Отмена
            </v-btn>
            <v-btn
              variant="outlined"
              @click="handleResendCode"
              :loading="resendLoading"
              :disabled="resendCooldown > 0"
              class="text-none w-100"
              :class="{ 'text-grey': resendCooldown > 0 }"
              size="large"
            >
              {{ resendCooldown > 0 ? `Отправить код повторно (${resendCooldown}с)` : 'Отправить код повторно' }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              @click="handleVerifyEmail"
              :loading="verificationLoading"
              :disabled="!verificationCode || verificationCode.length !== 6"
              class="text-none font-weight-bold w-100"
              size="large"
            >
              Подтвердить
            </v-btn>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<style scoped>
.form-section {
  background: linear-gradient(135deg, rgba(248, 236, 196, 0.9), rgba(255, 255, 255, 0.95)); /* BirQadam background */
}
</style>

