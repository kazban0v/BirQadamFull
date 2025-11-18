<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';

import { registerVolunteer, verifyEmail, resendVerificationCode } from '@/services/webPortal';
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
    const digits = value.replace(/[^0-9+]/g, '');
    return digits.length >= 11 || 'Введите корректный номер телефона.';
  },
  password: (value: string) => {
    if (!value) return true;
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
      password: formState.password || undefined,
    });
    
    // Проверяем, требуется ли подтверждение email
    if (response?.requires_email_verification && response?.user?.email) {
      verificationEmail.value = response.user.email;
      showVerificationDialog.value = true;
      showSnackbar('Код подтверждения отправлен на ваш email. Проверьте почту.', 'info');
    } else {
      // Старая логика для обратной совместимости
      await authStore.loadUser();
      showSnackbar('Регистрация успешно завершена. Добро пожаловать!', 'success');
      resetForm();
      const dashboardUrl = response?.dashboard_url || '/volunteer/dashboard';
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
    
    // Перенаправляем на дашборд
    const dashboardUrl = response?.dashboard_url || '/volunteer/dashboard';
    setTimeout(() => {
      router.push(dashboardUrl);
    }, 1000);
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Неверный код подтверждения.';
    showSnackbar(detail, 'error');
  } finally {
    verificationLoading.value = false;
  }
};

const handleResendCode = async () => {
  resendLoading.value = true;
  try {
    await resendVerificationCode(verificationEmail.value);
    showSnackbar('Код подтверждения отправлен повторно на ваш email.', 'success');
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось отправить код.';
    showSnackbar(detail, 'error');
  } finally {
    resendLoading.value = false;
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
                    label="Пароль (опционально)"
                    variant="outlined"
                    prepend-inner-icon="mdi-lock-outline"
                    :rules="[rules.password]"
                    type="password"
                    hint="Если оставить поле пустым, система сгенерирует пароль автоматически."
                    persistent-hint
                    autocomplete="new-password"
                  />
                </v-col>
              </v-row>

              <div class="d-flex flex-column flex-sm-row ga-4">
                <v-btn
                  color="warning"
                  class="text-none font-weight-bold"
                  size="large"
                  type="submit"
                  :loading="loading"
                >
                  Зарегистрироваться
                </v-btn>
                <v-btn
                  to="https://t.me/cleanupalmaty_bot"
                  color="primary"
                  variant="outlined"
                  class="text-none font-weight-bold"
                  size="large"
                  target="_blank"
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
    <v-dialog v-model="showVerificationDialog" max-width="500" persistent>
      <v-card class="pa-6">
        <v-card-title class="d-flex align-center mb-4">
          <v-icon icon="mdi-email-check" color="primary" size="32" class="mr-3" />
          <h2 class="text-h5 font-weight-bold">Подтверждение email</h2>
        </v-card-title>

        <v-card-text>
          <p class="text-body-1 mb-4">
            Мы отправили код подтверждения на <strong>{{ verificationEmail }}</strong>
          </p>
          <p class="text-body-2 text-medium-emphasis mb-6">
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
          />
        </v-card-text>

        <v-card-actions class="pa-6 pt-0">
          <v-btn
            variant="text"
            @click="handleResendCode"
            :loading="resendLoading"
            class="text-none"
          >
            Отправить код повторно
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            variant="flat"
            @click="handleVerifyEmail"
            :loading="verificationLoading"
            :disabled="!verificationCode || verificationCode.length !== 6"
            class="text-none font-weight-bold"
          >
            Подтвердить
          </v-btn>
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

