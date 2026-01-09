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
const snackbar = reactive({
  show: false,
  color: 'error',
  message: '',
});

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

    const redirect = (route.query.redirect as string) || data.dashboard_url || '/volunteer/dashboard';
    router.push(redirect);
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось выполнить вход.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  }
};

const redirectToRole = (role: 'volunteer' | 'organizer') => {
  registrationDialog.value = false;
  if (role === 'volunteer') {
    router.push('/register/volunteer');
  } else {
    router.push('/register/organizer');
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
                <v-icon icon="mdi-login" size="30" />
              </v-avatar>
              <div>
                <h1 class="text-h5 text-md-h4 font-weight-bold mb-1">Вход в кабинет</h1>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  Используйте номер телефона или email и пароль, чтобы перейти в кабинет волонтёра.
                </p>
              </div>
            </div>

            <v-form ref="formRef" @submit.prevent="submit">
              <v-row>
                <v-col cols="12">
                  <v-text-field
                    v-model="formState.identifier"
                    label="Телефон или email"
                    variant="outlined"
                    prepend-inner-icon="mdi-account"
                    :rules="[rules.required]"
                    autocomplete="username"
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="formState.password"
                    label="Пароль"
                    variant="outlined"
                    prepend-inner-icon="mdi-lock-outline"
                    :rules="[rules.required]"
                    type="password"
                    autocomplete="current-password"
                  />
                </v-col>
              </v-row>

              <div class="d-flex flex-column flex-sm-row ga-4 mt-4">
                <v-btn
                  color="primary"
                  class="text-none font-weight-bold"
                  size="large"
                  type="submit"
                  :loading="authStore.loading"
                >
                  Войти
                </v-btn>
                <v-btn
                  variant="text"
                  color="primary"
                  class="text-none font-weight-bold"
                  size="large"
                  @click="registrationDialog = true"
                >
                  Зарегистрироваться
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

    <v-dialog v-model="registrationDialog" max-width="420">
      <v-card class="role-dialog pa-6">
        <div class="d-flex align-center ga-3 mb-4">
          <v-avatar color="primary" size="48">
            <v-icon icon="mdi-account-group-outline" size="26" />
          </v-avatar>
          <div>
            <h2 class="text-h6 font-weight-bold mb-1">Кого регистрируем?</h2>
            <p class="text-body-2 text-medium-emphasis mb-0">Выберите роль, чтобы продолжить оформление заявки.</p>
          </div>
        </div>
        <div class="d-flex flex-column ga-3">
          <v-btn
            color="primary"
            class="text-none font-weight-bold"
            size="large"
            @click="redirectToRole('volunteer')"
          >
            Я волонтёр
          </v-btn>
          <v-btn
            color="warning"
            class="text-none font-weight-bold"
            size="large"
            @click="redirectToRole('organizer')"
          >
            Я организатор
          </v-btn>
          <v-btn variant="text" color="primary" class="text-none font-weight-semibold" @click="registrationDialog = false">
            Отменить
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </section>
</template>

<style scoped>
.form-section {
  background: linear-gradient(135deg, rgba(248, 236, 196, 0.9), rgba(255, 255, 255, 0.95)); /* BirQadam background */
}

.role-dialog {
  border-radius: 24px;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.98), rgba(255, 250, 246, 0.94)); /* BirQadam background */
  box-shadow: 0 20px 40px rgba(139, 195, 74, 0.15); /* BirQadam primary */
}
</style>

