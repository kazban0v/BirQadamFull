<template>
  <v-card 
    :data-project-id="project.id"
    elevation="1" 
    rounded="xl"
    class="project-card h-100 d-flex flex-column"
  >
    <!-- Cover Image -->
    <div class="project-card-image-wrapper d-flex align-center justify-center pa-4 bg-white" style="height: 180px;">
      <v-img
        v-if="project.cover_image_url"
        :src="getFullImageUrl(project.cover_image_url) || ''"
        height="100%"
        width="100%"
        class="project-cover-img"
        contain
      >
        <template #error>
          <div class="d-flex align-center justify-center fill-height bg-grey-lighten-4 w-100">
            <v-icon icon="mdi-image-off" size="48" color="grey-lighten-1" />
          </div>
        </template>
        <template #placeholder>
          <div class="d-flex align-center justify-center fill-height bg-grey-lighten-4 w-100">
            <v-icon icon="mdi-image-off" size="48" color="grey-lighten-1" />
          </div>
        </template>
      </v-img>
      <div v-else class="d-flex align-center justify-center bg-grey-lighten-4 w-100 h-100" style="height: 180px;">
        <v-icon icon="mdi-image-off" size="48" color="grey-lighten-1" />
      </div>
    </div>

    <!-- Content -->
    <div class="pa-6 d-flex flex-column flex-grow-1">
      <div class="d-flex justify-space-between align-start mb-4">
        <div class="pe-4">
          <h2 class="text-h6 font-weight-bold mb-2">{{ project.title }}</h2>
          <div class="text-body-2 text-medium-emphasis">
            {{ volunteerTypeMap[project.volunteer_type] || project.volunteer_type }} •
            {{ project.city || 'Город не указан' }}
          </div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            С {{ formatDate(project.start_date) }} по {{ formatDate(project.end_date) }}
          </div>
        </div>
      </div>

      <!-- Description (Clamped to 3 lines) -->
      <p class="text-body-2 mb-4 project-desc text-medium-emphasis">
        {{ project.description }}
      </p>

      <v-spacer />

      <!-- Action Buttons -->
      <div class="d-flex flex-column flex-sm-row ga-2 mt-auto">
        <v-btn
          v-if="!project.joined"
          color="primary"
          variant="flat"
          class="text-none font-weight-bold flex-grow-1"
          :disabled="loading"
          @click="$emit('join', project.id)"
        >
          Присоединиться
        </v-btn>
        <v-btn
          v-else
          color="error"
          variant="outlined"
          class="text-none font-weight-bold flex-grow-1"
          :disabled="loading"
          @click="$emit('leave', project.id)"
        >
          Выйти
        </v-btn>

        <v-btn
          variant="text"
          color="primary"
          class="text-none font-weight-bold flex-grow-1"
          @click="$emit('details', project.id)"
        >
          Подробнее
        </v-btn>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import { formatDate, getFullImageUrl } from '@/utils/formatters';

const props = defineProps({
  project: {
    type: Object as PropType<any>,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  volunteerTypeMap: {
    type: Object as PropType<Record<string, string>>,
    default: () => ({}),
  }
});

defineEmits(['join', 'leave', 'details']);
</script>

<style scoped>
.project-card {
  transition: all 0.3s ease;
  border: 1px solid rgba(0,0,0,0.05);
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important;
}

.project-desc {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
