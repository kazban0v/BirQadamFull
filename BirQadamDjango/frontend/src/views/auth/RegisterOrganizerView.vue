<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';

import { registerOrganizer, verifyEmail, resendVerificationCode } from '@/services/webPortal';
import { useAuthStore } from '@/stores/auth';

interface OrganizerFormState {
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  organizationName: string;
  description: string;
  city: string;
  website: string;
  contactPerson: string;
  projectsPlan: string;
}

const router = useRouter();
const authStore = useAuthStore();

const step = ref(1);
const stepsTotal = 3;

const personalForm = ref<VForm | null>(null);
const organizationForm = ref<VForm | null>(null);
const additionalForm = ref<VForm | null>(null);

const loading = ref(false);
const successDialog = ref(false);
const submittedOrganization = ref<string | null>(null);
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

const formState = reactive<OrganizerFormState>({
  fullName: '',
  phoneNumber: '',
  email: '',
  password: '',
  organizationName: '',
  description: '',
  city: '',
  website: '',
  contactPerson: '',
  projectsPlan: '',
});

const rules = {
  required: (value: string) => !!value || 'Поле обязательно для заполнения.',
  phone: (value: string) => {
    const digits = value.replace(/[^0-9+]/g, '');
    return digits.length >= 11 || 'Введите корректный номер телефона.';
  },
  email: (value: string) => {
    if (!value) return true;
    const pattern = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return pattern.test(value) || 'Введите корректный email.';
  },
  password: (value: string) => {
    if (!value) return true;
    return value.length >= 8 || 'Пароль должен содержать не менее 8 символов.';
  },
  url: (value: string) => {
    if (!value) return true;
    try {
      new URL(value);
      return true;
    } catch (error) {
      return 'Введите корректный URL.';
    }
  },
};

const showSnackbar = (message: string, color: string) => {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
};

const validateCurrentStep = async () => {
  if (step.value === 1) {
    const { valid } = (await personalForm.value?.validate()) ?? { valid: false };
    return valid;
  }
  if (step.value === 2) {
    const { valid } = (await organizationForm.value?.validate()) ?? { valid: false };
    return valid;
  }
  const { valid } = (await additionalForm.value?.validate()) ?? { valid: false };
  return valid;
};

const goNext = async () => {
  const valid = await validateCurrentStep();
  if (!valid) return;
  if (step.value < stepsTotal) {
    step.value += 1;
  }
};

const goPrev = () => {
  if (step.value > 1) {
    step.value -= 1;
  }
};

const resetForms = () => {
  personalForm.value?.reset();
  organizationForm.value?.reset();
  additionalForm.value?.reset();
  personalForm.value?.resetValidation();
  organizationForm.value?.resetValidation();
  additionalForm.value?.resetValidation();
  step.value = 1;
};

const submit = async () => {
  const valid = await validateCurrentStep();
  if (!valid) return;

  loading.value = true;
  try {
    const organizationNameSnapshot = formState.organizationName;
    const response = await registerOrganizer({
      full_name: formState.fullName,
      phone_number: formState.phoneNumber,
      email: formState.email || undefined,
      password: formState.password || undefined,
      organization_name: formState.organizationName,
      description: formState.description,
      city: formState.city,
      website: formState.website || undefined,
      contact_person: formState.contactPerson || formState.fullName,
      notes: formState.projectsPlan,
    });

    // Проверяем, требуется ли подтверждение email
    if (response?.requires_email_verification && response?.user?.email) {
      verificationEmail.value = response.user.email;
      submittedOrganization.value = organizationNameSnapshot;
      showVerificationDialog.value = true;
      showSnackbar('Код подтверждения отправлен на ваш email. Проверьте почту.', 'info');
    } else {
      // Старая логика для обратной совместимости
      await authStore.loadUser();
      showSnackbar('Заявка отправлена. Вы автоматически вошли в систему.', 'success');
      resetForms();
      const dashboardUrl = response?.dashboard_url || '/organizer/dashboard';
      setTimeout(() => {
        router.push(dashboardUrl);
      }, 1000);
    }
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось отправить заявку. Попробуйте позже.';
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
    
    showSnackbar('Email успешно подтверждён! Заявка отправлена.', 'success');
    showVerificationDialog.value = false;
    resetForms();
    
    // Показываем диалог успеха
    successDialog.value = true;
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

// Функция больше не нужна, так как автоматически перенаправляем на дашборд
</script>

<template>
  <section class="form-section py-12 py-md-16">
    <v-container>
      <v-row class="justify-center">
        <v-col cols="12" md="10" lg="8">
          <v-card class="registration-card pa-6 pa-md-10 elevation-8">
            <div class="registration-card__header mb-6">
              <div class="registration-card__badge">
                <v-icon icon="mdi-rocket-launch-outline" size="20" />
                Новый организатор
              </div>
              <h1 class="text-h5 text-md-h4 font-weight-bold mb-2">Регистрация организатора</h1>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Заполните форму, чтобы повторить функции Telegram-бота в веб-портале. После модерации вы попадёте в
                кабинет организатора с кнопками «Создать проект», «Команда», «Задачи» и «Модерация фото».
              </p>
            </div>

            <v-stepper v-model="step" flat alt-labels class="registration-stepper">
              <v-stepper-header>
                <v-stepper-item :value="1" title="Контакты" />
                <v-stepper-item :value="2" title="Организация" />
                <v-stepper-item :value="3" title="Дополнительно" />
              </v-stepper-header>

              <v-stepper-window>
                <v-stepper-window-item :value="1">
                  <v-form ref="personalForm" class="mt-6">
                    <v-row>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="formState.fullName"
                          label="Полное имя"
                          variant="outlined"
                          prepend-inner-icon="mdi-account"
                          :rules="[rules.required]"
                          autocomplete="name"
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="formState.contactPerson"
                          label="Контактное лицо (если отличается)"
                          variant="outlined"
                          prepend-inner-icon="mdi-account-tie"
                          hint="Введите имя ответственного за коммуникацию."
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="formState.phoneNumber"
                          label="Номер телефона"
                          variant="outlined"
                          prepend-inner-icon="mdi-phone"
                          :rules="[rules.required, rules.phone]"
                          autocomplete="tel"
                        />
                      </v-col>
                      <v-col cols="12" md="6">
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
                          hint="Если оставить пустым, система сгенерирует пароль автоматически."
                          persistent-hint
                          autocomplete="new-password"
                        />
                      </v-col>
                    </v-row>
                  </v-form>
                </v-stepper-window-item>

                <v-stepper-window-item :value="2">
                  <v-form ref="organizationForm" class="mt-6">
                    <v-row>
                      <v-col cols="12">
                        <v-text-field
                          v-model="formState.organizationName"
                          label="Название организации"
                          variant="outlined"
                          prepend-inner-icon="mdi-domain"
                          :rules="[rules.required]"
                        />
                      </v-col>
                      <v-col cols="12">
                        <v-textarea
                          v-model="formState.description"
                          label="Описание деятельности"
                          variant="outlined"
                          rows="4"
                          auto-grow
                          prepend-inner-icon="mdi-text"
                          :rules="[rules.required]"
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="formState.city"
                          label="Город"
                          variant="outlined"
                          prepend-inner-icon="mdi-map-marker-outline"
                          :rules="[rules.required]"
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="formState.website"
                          label="Сайт или соцсети"
                          variant="outlined"
                          prepend-inner-icon="mdi-web"
                          :rules="[rules.url]"
                          hint="Например: https://example.kz"
                        />
                      </v-col>
                    </v-row>
                  </v-form>
                </v-stepper-window-item>

                <v-stepper-window-item :value="3">
                  <v-form ref="additionalForm" class="mt-6">
                    <v-alert
                      type="info"
                      variant="tonal"
                      border="start"
                      class="mb-6"
                      title="Что происходит дальше"
                    >
                      После отправки заявки администратор проверит данные и свяжется с вами. Статус будет доступен в
                      личном кабинете.
                    </v-alert>
                    <v-row>
                      <v-col cols="12">
                        <v-textarea
                          v-model="formState.projectsPlan"
                          label="Краткое описание планируемых проектов"
                          variant="outlined"
                          rows="4"
                          auto-grow
                          placeholder="Расскажите, какие мероприятия вы планируете организовывать в ближайшее время."
                        />
                      </v-col>
                    </v-row>
                  </v-form>
                </v-stepper-window-item>
              </v-stepper-window>
            </v-stepper>

            <div class="d-flex flex-column flex-sm-row ga-4 mt-8">
              <v-btn
                v-if="step > 1"
                variant="outlined"
                color="primary"
                class="text-none"
                size="large"
                @click="goPrev"
              >
                Назад
              </v-btn>

              <v-spacer class="d-none d-sm-flex" />

              <v-btn
                v-if="step < stepsTotal"
                color="primary"
                class="text-none"
                size="large"
                @click="goNext"
              >
                Далее
              </v-btn>

              <v-btn
                v-else
                color="warning"
                class="text-none font-weight-bold"
                size="large"
                :loading="loading"
                @click="submit"
              >
                Отправить заявку
              </v-btn>
            </div>
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

    <v-dialog v-model="successDialog" max-width="520">
      <v-card class="success-dialog pa-6">
        <div class="d-flex align-center ga-3 mb-4">
          <v-avatar color="primary" size="48">
            <v-icon icon="mdi-check-decagram" size="28" />
          </v-avatar>
          <div>
            <h2 class="text-h6 font-weight-bold mb-1">Заявка отправлена</h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Мы уведомим вас после проверки. Пока ознакомьтесь с возможностями кабинета организатора.
            </p>
          </div>
        </div>
        <v-alert type="info" variant="tonal" border="start" class="mb-4">
          Статус заявки для
          <strong>{{ submittedOrganization || 'вашей организации' }}</strong>
          можно отслеживать в разделе «Кабинет организатора». Доступ появится после модерации.
        </v-alert>
        <div class="d-flex flex-column ga-3">
          <v-btn color="primary" class="text-none font-weight-bold" size="large" @click="successDialog = false">
            Понятно
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

.registration-card {
  border-radius: 28px;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.98), rgba(255, 250, 246, 0.96)); /* BirQadam background */
  border: 1px solid rgba(139, 195, 74, 0.08); /* BirQadam primary */
  box-shadow: 0 24px 48px rgba(139, 195, 74, 0.08);
}

.registration-card__header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.registration-card__badge {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(139, 195, 74, 0.12); /* BirQadam primary */
  color: #8BC34A;
  font-weight: 600;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.registration-stepper :deep(.v-stepper-header) {
  background: transparent;
}

.registration-stepper :deep(.v-stepper-item) {
  border-radius: 16px;
  margin: 4px 8px;
  padding-inline: 12px;
}

.registration-stepper :deep(.v-stepper-item--selected) {
  background: rgba(139, 195, 74, 0.08); /* BirQadam primary */
  box-shadow: inset 0 0 0 1px rgba(139, 195, 74, 0.2);
}

.success-dialog {
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(255, 250, 246, 0.96)); /* BirQadam background */
}

@media (max-width: 600px) {
  .registration-card {
    padding: 24px !important;
  }
}
</style>

