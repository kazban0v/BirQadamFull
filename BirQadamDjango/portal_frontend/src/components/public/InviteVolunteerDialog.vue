<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { fetchOrganizerProjects, type OrganizerProject } from '@/services/organizer';
import { inviteVolunteerToProject } from '@/services/webPortal';
import { getVolunteerDisplayName } from '@/utils/publicVolunteer';
import type { PublicVolunteer } from '@/services/webPortal';

const props = defineProps<{
  open: boolean;
  volunteer: PublicVolunteer;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  invited: [message: string];
}>();

const projects = ref<OrganizerProject[]>([]);
const loadingProjects = ref(false);
const selectedProjectId = ref<number | null>(null);
const submitting = ref(false);
const error = ref('');

const activeProjects = computed(() =>
  projects.value.filter((p) => {
    if (p.status !== 'approved') return false;
    if (!p.end_date) return true;
    const end = new Date(p.end_date);
    end.setHours(23, 59, 59, 999);
    return end >= new Date();
  }),
);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    error.value = '';
    selectedProjectId.value = null;
    loadingProjects.value = true;
    try {
      projects.value = await fetchOrganizerProjects();
      if (activeProjects.value.length === 1) {
        selectedProjectId.value = activeProjects.value[0].id;
      }
    } catch {
      error.value = 'Не удалось загрузить список проектов.';
    } finally {
      loadingProjects.value = false;
    }
  },
);

function close() {
  emit('update:open', false);
}

async function submit() {
  if (!selectedProjectId.value) {
    error.value = 'Выберите проект.';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    const result = await inviteVolunteerToProject(props.volunteer.id, selectedProjectId.value);
    emit('invited', result.message);
    close();
  } catch (err: any) {
    error.value = err?.response?.data?.detail || err?.message || 'Не удалось отправить приглашение.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="close">
      <div class="modal" role="dialog" aria-labelledby="invite-title">
        <button type="button" class="modal__close" aria-label="Закрыть" @click="close">×</button>
        <h2 id="invite-title" class="modal__title">Пригласить в проект</h2>
        <p class="modal__desc">
          Выберите проект, в который хотите пригласить
          <strong>{{ getVolunteerDisplayName(volunteer) }}</strong>.
        </p>

        <div v-if="loadingProjects" class="modal__loading">Загрузка проектов…</div>

        <div v-else-if="!activeProjects.length" class="modal__empty">
          Нет активных одобренных проектов. Создайте проект в личном кабинете организатора.
        </div>

        <div v-else class="modal__projects">
          <label
            v-for="project in activeProjects"
            :key="project.id"
            class="project-option"
            :class="{ 'project-option--selected': selectedProjectId === project.id }"
          >
            <input
              type="radio"
              name="invite-project"
              :value="project.id"
              v-model="selectedProjectId"
            />
            <span class="project-option__title">{{ project.title }}</span>
            <span class="project-option__meta">{{ project.city }}</span>
          </label>
        </div>

        <p v-if="error" class="modal__error">{{ error }}</p>

        <div class="modal__actions">
          <button type="button" class="modal__btn modal__btn--ghost" @click="close">Отмена</button>
          <button
            type="button"
            class="modal__btn modal__btn--primary"
            :disabled="submitting || !activeProjects.length"
            @click="submit"
          >
            {{ submitting ? 'Отправка…' : 'Пригласить' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 32, 24, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
}

.modal {
  background: #fff;
  border-radius: 24px;
  padding: 32px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 24px 64px rgba(26, 60, 18, 0.2);
  position: relative;
}

.modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: rgba(26, 32, 24, 0.4);
}

.modal__title {
  font-family: 'Lora', serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a2018;
  margin: 0 0 8px;
}

.modal__desc {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  color: rgba(26, 32, 24, 0.65);
  margin: 0 0 24px;
  line-height: 1.5;
}

.modal__loading, .modal__empty {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  color: rgba(26, 32, 24, 0.55);
  padding: 16px 0;
}

.modal__projects {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.project-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 16px;
  border: 1px solid rgba(61, 122, 47, 0.15);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.project-option input {
  display: none;
}

.project-option--selected {
  border-color: #3d7a2f;
  background: rgba(61, 122, 47, 0.06);
}

.project-option__title {
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  color: #1a2018;
}

.project-option__meta {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  color: rgba(26, 32, 24, 0.5);
}

.modal__error {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem;
  color: #c62828;
  margin: 0 0 12px;
}

.modal__actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal__btn {
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 12px 20px;
  border-radius: 100px;
  cursor: pointer;
  border: none;
}

.modal__btn--ghost {
  background: transparent;
  color: rgba(26, 32, 24, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.modal__btn--primary {
  background: #3d7a2f;
  color: #fff;
}

.modal__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
