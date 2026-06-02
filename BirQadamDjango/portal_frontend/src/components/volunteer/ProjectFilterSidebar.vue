<template>
  <v-card class="filter-sidebar rounded-xl pa-4" elevation="1">
    <h3 class="text-h6 font-weight-bold mb-4">Фильтры</h3>

    <!-- Поиск -->
    <v-text-field
      :model-value="searchQuery"
      @update:model-value="$emit('update:searchQuery', $event)"
      label="Поиск по названию или описанию"
      variant="outlined"
      prepend-inner-icon="mdi-magnify"
      clearable
      hide-details
      class="mb-4"
      density="comfortable"
    />

    <!-- Тип волонтерства -->
    <v-select
      :model-value="selectedType"
      @update:model-value="$emit('update:selectedType', $event)"
      :items="volunteerTypes"
      label="Тип волонтерства"
      variant="outlined"
      clearable
      hide-details
      class="mb-4"
      density="comfortable"
    />

    <!-- Город -->
    <v-autocomplete
      :model-value="selectedCity"
      @update:model-value="$emit('update:selectedCity', $event)"
      :items="cities"
      label="Город / Регион"
      variant="outlined"
      clearable
      hide-details
      class="mb-4"
      density="comfortable"
      prepend-inner-icon="mdi-map-marker"
    />

    <!-- Теги -->
    <v-autocomplete
      :model-value="selectedTags"
      @update:model-value="$emit('update:selectedTags', $event)"
      :items="availableTags"
      label="Теги"
      variant="outlined"
      multiple
      chips
      closable-chips
      clearable
      hide-details
      class="mb-4"
      density="comfortable"
    />

    <!-- Наличие задач -->
    <v-checkbox
      :model-value="hasTasksOnly"
      @update:model-value="$emit('update:hasTasksOnly', $event)"
      label="Есть открытые задания"
      color="primary"
      hide-details
      class="mb-2"
    />
  </v-card>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

const props = defineProps({
  searchQuery: { type: String, default: '' },
  selectedType: { type: String, default: null },
  selectedCity: { type: String, default: null },
  selectedTags: { type: Array as PropType<string[]>, default: () => [] },
  hasTasksOnly: { type: Boolean, default: false },
  volunteerTypes: { type: Array as PropType<any[]>, default: () => [] },
  cities: { type: Array as PropType<string[]>, default: () => [] },
  availableTags: { type: Array as PropType<string[]>, default: () => [] },
});

defineEmits([
  'update:searchQuery',
  'update:selectedType',
  'update:selectedCity',
  'update:selectedTags',
  'update:hasTasksOnly'
]);
</script>

<style scoped>
.filter-sidebar {
  position: sticky;
  top: 24px;
}
</style>
