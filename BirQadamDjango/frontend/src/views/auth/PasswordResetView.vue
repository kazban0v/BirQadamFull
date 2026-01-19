<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';
import { httpClient } from '@/services/http';

const router = useRouter();

const formRef = ref<VForm | null>(null);
const step = ref<'request' | 'confirm'>('request');
const loading = ref(false);
const snackbar = reactive({
  show: false,
  color: 'success' as 'success' | 'error',
  message: '',
});

const formState = reactive({
  email: '',
  code: '',
  newPassword: '',
  confirmPassword: '',
});

const rules = {
  required: (value: string) => !!value || 'Поле обязательно для заполнения.',
  email: (value: string) => {
    if (!value) return true;
    return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value) || 'Введите корректный email.';
  },
  password: (value: string) => {
    if (!value) return true;
    return value.length >= 8 || 'Пароль должен содержать не менее 8 символов.';
  },
  passwordMatch: (value: string) => {
    if (!value) return true;
    return value === formState.newPassword || 'Пароли не совпадают.';
  },
};

const requestPasswordReset = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  loading.value = true;
  try {
    const response = await httpClient.post('/api/web/password-reset/request/', {
      email: formState.email,
    });
    
    snackbar.message = response.data.message || 'Код для сброса пароля отправлен на ваш email.';
    snackbar.color = 'success';
    snackbar.show = true;
    step.value = 'confirm';
  } catch (error: any) {
    // Логируем полную ошибку в консоль для отладки
    console.error('Ошибка при запросе сброса пароля:', error);
    console.error('Детали ошибки:', {
      message: error?.message,
      response: error?.response,
      responseData: error?.response?.data,
      responseStatus: error?.response?.status,
      code: error?.code,
      request: error?.request,
    });
    
    // Определяем сообщение об ошибке
    let errorMessage = 'Не удалось отправить код. Попробуйте позже.';
    
    if (error?.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    } else if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.message) {
      // Для CORS ошибок и сетевых ошибок
      if (error.message.includes('CORS') || error.message.includes('Network Error') || error.code === 'ERR_NETWORK') {
        errorMessage = 'Ошибка подключения к серверу. Проверьте интернет-соединение или попробуйте позже.';
        console.error('CORS или сетевая ошибка:', error.message);
      } else {
        errorMessage = `Ошибка: ${error.message}`;
      }
    }
    
    snackbar.message = errorMessage;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    loading.value = false;
  }
};

const confirmPasswordReset = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  if (formState.newPassword !== formState.confirmPassword) {
    snackbar.message = 'Пароли не совпадают.';
    snackbar.color = 'error';
    snackbar.show = true;
    return;
  }

  loading.value = true;
  try {
    const response = await httpClient.post('/api/web/password-reset/confirm/', {
      email: formState.email,
      code: formState.code,
      new_password: formState.newPassword,
    });
    
    snackbar.message = response.data.message || 'Пароль успешно изменён. Теперь вы можете войти с новым паролем.';
    snackbar.color = 'success';
    snackbar.show = true;
    
    // Перенаправляем на страницу входа через 2 секунды
    setTimeout(() => {
      router.push('/login');
    }, 2000);
  } catch (error: any) {
    // Логируем полную ошибку в консоль для отладки
    console.error('Ошибка при подтверждении сброса пароля:', error);
    console.error('Детали ошибки:', {
      message: error?.message,
      response: error?.response,
      responseData: error?.response?.data,
      responseStatus: error?.response?.status,
      code: error?.code,
      request: error?.request,
    });
    
    // Определяем сообщение об ошибке
    let errorMessage = 'Не удалось изменить пароль. Попробуйте позже.';
    
    if (error?.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    } else if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.message) {
      // Для CORS ошибок и сетевых ошибок
      if (error.message.includes('CORS') || error.message.includes('Network Error') || error.code === 'ERR_NETWORK') {
        errorMessage = 'Ошибка подключения к серверу. Проверьте интернет-соединение или попробуйте позже.';
        console.error('CORS или сетевая ошибка:', error.message);
      } else {
        errorMessage = `Ошибка: ${error.message}`;
      }
    }
    
    snackbar.message = errorMessage;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    loading.value = false;
  }
};

const backToRequest = () => {
  step.value = 'request';
  formState.code = '';
  formState.newPassword = '';
  formState.confirmPassword = '';
  if (formRef.value) {
    formRef.value.resetValidation();
  }
};
</script>

<template>
  <section class="form-section py-12 py-md-16">
    <v-container>
      <v-row class="justify-center">
        <v-col cols="12" md="6" lg="5">
          <v-card class="pa-8 pa-md-10 elevation-8">
            <div class="d-flex align-center mb-6 ga-4">
              <v-avatar color="primary" size="52">
                <v-icon :icon="step === 'request' ? 'mdi-lock-reset' : 'mdi-key-variant'" size="30" />
              </v-avatar>
              <div>
                <h1 class="text-h5 text-md-h4 font-weight-bold mb-1">
                  {{ step === 'request' ? 'Сброс пароля' : 'Новый пароль' }}
                </h1>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  {{
                    step === 'request'
                      ? 'Введите ваш email, и мы отправим код для сброса пароля.'
                      : 'Введите код из письма и новый пароль.'
                  }}
                </p>
              </div>
            </div>

            <v-form ref="formRef" @submit.prevent="step === 'request' ? requestPasswordReset() : confirmPasswordReset()">
              <v-row>
                <v-col cols="12">
                  <v-text-field
                    v-model="formState.email"
                    label="Email"
                    variant="outlined"
                    prepend-inner-icon="mdi-email-outline"
                    :rules="[rules.required, rules.email]"
                    :disabled="step === 'confirm'"
                    autocomplete="email"
                  />
                </v-col>
                <template v-if="step === 'confirm'">
                  <v-col cols="12">
                    <v-text-field
                      v-model="formState.code"
                      label="Код подтверждения"
                      variant="outlined"
                      prepend-inner-icon="mdi-shield-check-outline"
                      :rules="[rules.required]"
                      autocomplete="one-time-code"
                      hint="Введите 6-значный код из письма"
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      v-model="formState.newPassword"
                      label="Новый пароль"
                      variant="outlined"
                      prepend-inner-icon="mdi-lock-outline"
                      :rules="[rules.required, rules.password]"
                      type="password"
                      autocomplete="new-password"
                      hint="Минимум 8 символов"
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      v-model="formState.confirmPassword"
                      label="Подтвердите пароль"
                      variant="outlined"
                      prepend-inner-icon="mdi-lock-check-outline"
                      :rules="[rules.required, rules.passwordMatch]"
                      type="password"
                      autocomplete="new-password"
                    />
                  </v-col>
                </template>
              </v-row>

              <div class="d-flex flex-column flex-sm-row ga-4 mt-4">
                <v-btn
                  color="primary"
                  class="text-none font-weight-bold"
                  size="large"
                  type="submit"
                  :loading="loading"
                  block
                >
                  {{ step === 'request' ? 'Отправить код' : 'Изменить пароль' }}
                </v-btn>
                <v-btn
                  v-if="step === 'confirm'"
                  variant="text"
                  color="primary"
                  class="text-none font-weight-bold"
                  size="large"
                  @click="backToRequest"
                >
                  Назад
                </v-btn>
              </div>

              <div class="d-flex justify-center mt-4">
                <v-btn
                  variant="text"
                  color="primary"
                  class="text-none"
                  size="small"
                  @click="router.push('/login')"
                >
                  Вернуться к входу
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
  </section>
</template>

<style scoped>
.form-section {
  background: linear-gradient(135deg, rgba(248, 236, 196, 0.9), rgba(255, 255, 255, 0.95)); /* BirQadam background */
}
</style>

