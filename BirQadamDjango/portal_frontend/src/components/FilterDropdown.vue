<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

/**
 * Пропсы компонента FilterDropdown
 * @param filters - конфигурация полей фильтрации (доступные значения)
 * @param modelValue - текущие выбранные фильтры
 */
interface FilterConfig {
  availableTags: string[];      // Доступные теги
  availableCities: string[];    // Доступные города
  availableTypes: string[];     // Типы проектов
  availableStatuses: string[];  // Статусы проектов
}

interface SelectedFilters {
  tags: string[];
  cities: string[];
  types: string[];
  statuses: string[];
  dateFrom: string | null;
  dateTo: string | null;
}

interface Props {
  filters: FilterConfig;
  modelValue: SelectedFilters;
  viewMode?: 'grid' | 'list';
  onApply?: (filters: SelectedFilters) => void;
  onReset?: () => void;
}

const props = defineProps<Props>();

/**
 * События компонента:
 * @event update:modelValue - при изменении фильтров
 * @event update:viewMode - при изменении вида
 * @event apply - при нажатии кнопки "Применить"
 * @event reset - при нажатии кнопки "Сбросить"
 */
const emit = defineEmits<{
  'update:modelValue': [value: SelectedFilters];
  'update:viewMode': [value: 'grid' | 'list'];
  'apply': [filters: SelectedFilters];
  'reset': [];
}>();

// Локальное состояние выбранных фильтров
const localFilters = ref<SelectedFilters>({ ...props.modelValue });

// Синхронизация с внешним состоянием
watch(() => props.modelValue, (newValue) => {
  localFilters.value = { ...newValue };
}, { deep: true });

// Состояние открытия панели
const isOpen = ref(false);

/**
 * Переключение состояния панели
 */
function togglePanel() {
  isOpen.value = !isOpen.value;
}

/**
 * Переключение тега в списке выбранных
 */
function toggleTag(tag: string) {
  const index = localFilters.value.tags.indexOf(tag);
  if (index === -1) {
    localFilters.value.tags.push(tag);
  } else {
    localFilters.value.tags.splice(index, 1);
  }
  emit('update:modelValue', localFilters.value);
}

/**
 * Переключение города в списке выбранных
 */
function toggleCity(city: string) {
  const index = localFilters.value.cities.indexOf(city);
  if (index === -1) {
    localFilters.value.cities.push(city);
  } else {
    localFilters.value.cities.splice(index, 1);
  }
  emit('update:modelValue', localFilters.value);
}

/**
 * Переключение типа проекта
 */
function toggleType(type: string) {
  const index = localFilters.value.types.indexOf(type);
  if (index === -1) {
    localFilters.value.types.push(type);
  } else {
    localFilters.value.types.splice(index, 1);
  }
  emit('update:modelValue', localFilters.value);
}

/**
 * Переключение статуса проекта
 */
function toggleStatus(status: string) {
  const index = localFilters.value.statuses.indexOf(status);
  if (index === -1) {
    localFilters.value.statuses.push(status);
  } else {
    localFilters.value.statuses.splice(index, 1);
  }
  emit('update:modelValue', localFilters.value);
}

/**
 * Применение фильтров
 * Закрывает панель и отправляет событие apply
 */
function applyFilters() {
  isOpen.value = false;
  emit('apply', localFilters.value);
  props.onApply?.(localFilters.value);
}

/**
 * Сброс всех фильтров
 * Очищает все выбранные значения и отправляет событие reset
 */
function resetFilters() {
  localFilters.value = {
    tags: [],
    cities: [],
    types: [],
    statuses: [],
    dateFrom: null,
    dateTo: null,
  };
  emit('update:modelValue', localFilters.value);
  emit('reset');
  props.onReset?.();
}

/**
 * Вычисление количества активных фильтров
 * Используется для отображения счётчика на кнопке
 */
const activeFiltersCount = computed(() => {
  let count = 0;
  count += localFilters.value.tags.length;
  count += localFilters.value.cities.length;
  count += localFilters.value.types.length;
  if (localFilters.value.dateFrom) count++;
  if (localFilters.value.dateTo) count++;
  return count;
});

/**
 * Текстовые отображения для статусов
 */
const statusLabels: Record<string, string> = {
  approved: 'Активен',
  pending: 'На модерации',
  rejected: 'Отклонён',
};

/**
 * Текстовые отображения для типов проектов
 */
const typeLabels: Record<string, string> = {
  social: 'Социальный',
  environmental: 'Экологический',
  cultural: 'Культурный',
};
</script>

<template>
  <div class="filter-dropdown">
    <v-menu
      v-model="isOpen"
      :close-on-content-click="false"
      location="bottom start"
      :content-class="$vuetify.display.mobile ? 'mobile-filter-menu' : ''"
      transition="scale-transition"
      :max-width="!$vuetify.display.mobile ? 800 : undefined"
      :min-width="!$vuetify.display.mobile ? 700 : undefined"
    >
      <template v-slot:activator="{ props }">
        <!-- Кнопка открытия фильтра -->
        <v-btn
          v-bind="props"
          :color="activeFiltersCount > 0 ? 'primary' : 'default'"
          variant="outlined"
          class="text-none font-weight-bold bg-white"
          :prepend-icon="isOpen ? 'mdi-filter-variant-remove' : 'mdi-filter-variant'"
        >
          {{ activeFiltersCount > 0 ? `Фильтр (${activeFiltersCount})` : 'Фильтр' }}
        </v-btn>
      </template>

      <!-- Выпадающая панель с фильтрами -->
      <v-card
        class="filter-panel mt-2"
        elevation="4"
        rounded="xl"
        style="border: 1px solid rgba(0, 0, 0, 0.08);"
      >
        <v-card-title class="d-flex justify-space-between align-center pa-4 pb-0">
          <span class="text-h6 font-weight-bold px-2">Фильтр</span>
          <v-btn icon="mdi-close" variant="text" size="small" @click="isOpen = false"></v-btn>
        </v-card-title>
        <v-card-text class="pa-5 pt-4">
          <v-row class="ga-4">
            <!-- Фильтр по дате -->
            <v-col cols="12" md="4" lg="4">
              <div class="text-body-2 font-weight-medium mb-3 d-flex align-center text-primary">
                <v-icon icon="mdi-calendar-range" size="20" class="me-2" />
                Период
              </div>
              <v-row class="ga-2">
                <v-col cols="12">
                  <v-text-field
                    v-model="localFilters.dateFrom"
                    label="С даты"
                    type="date"
                    variant="outlined"
                    density="compact"
                    hide-details
                    bg-color="white"
                    rounded="lg"
                    clearable
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="localFilters.dateTo"
                    label="По дату"
                    type="date"
                    variant="outlined"
                    density="compact"
                    hide-details
                    bg-color="white"
                    rounded="lg"
                    clearable
                  />
                </v-col>
              </v-row>
            </v-col>



            <!-- Фильтр по городам -->
            <v-col cols="12" md="4" lg="4">
              <div class="text-body-2 font-weight-medium mb-3 d-flex align-center text-primary">
                <v-icon icon="mdi-map-marker" size="20" class="me-2" />
                Город
              </div>
              <div class="d-flex flex-wrap ga-2" v-if="filters.availableCities.length">
                <v-chip
                  v-for="city in filters.availableCities"
                  :key="city"
                  filter
                  :variant="localFilters.cities.includes(city) ? 'flat' : 'outlined'"
                  :color="localFilters.cities.includes(city) ? 'primary' : 'default'"
                  size="small"
                  class="cursor-pointer"
                  rounded="lg"
                  @click="toggleCity(city)"
                >
                  <v-icon v-if="localFilters.cities.includes(city)" icon="mdi-check-circle" start size="14" />
                  {{ city }}
                </v-chip>
              </div>
              <div v-else class="text-body-2 text-medium-emphasis">
                Города не указаны
              </div>
            </v-col>

            <!-- Фильтр по категориям -->
            <v-col cols="12" md="4" lg="4">
              <div class="text-body-2 font-weight-medium mb-3 d-flex align-center text-primary">
                <v-icon icon="mdi-tag-multiple" size="20" class="me-2" />
                Категория
              </div>
              <div class="d-flex flex-wrap ga-2" v-if="filters.availableTypes.length">
                <v-chip
                  v-for="type in filters.availableTypes"
                  :key="type"
                  filter
                  :variant="localFilters.types.includes(type) ? 'flat' : 'outlined'"
                  :color="localFilters.types.includes(type) ? 'primary' : 'default'"
                  size="small"
                  class="cursor-pointer"
                  rounded="lg"
                  @click="toggleType(type)"
                >
                  <v-icon v-if="localFilters.types.includes(type)" icon="mdi-check-circle" start size="14" />
                  {{ typeLabels[type] || type }}
                </v-chip>
              </div>
            </v-col>

            <!-- Фильтр по тегам (на всю ширину на мобильных) -->
            <v-col cols="12" v-if="filters.availableTags.length">
              <div class="text-body-2 font-weight-medium mb-3 d-flex align-center text-primary">
                <v-icon icon="mdi-label" size="20" class="me-2" />
                Теги
                <v-chip
                  v-if="localFilters.tags.length"
                  size="x-small"
                  variant="tonal"
                  color="primary"
                  class="ms-2"
                >
                  {{ localFilters.tags.length }}
                </v-chip>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip
                  v-for="tag in filters.availableTags"
                  :key="tag"
                  filter
                  :variant="localFilters.tags.includes(tag) ? 'flat' : 'outlined'"
                  :color="localFilters.tags.includes(tag) ? 'primary' : 'default'"
                  size="small"
                  class="cursor-pointer"
                  rounded="lg"
                  @click="toggleTag(tag)"
                >
                  <v-icon v-if="localFilters.tags.includes(tag)" icon="mdi-check-circle" start size="14" />
                  {{ tag }}
                </v-chip>
              </div>
            </v-col>
          </v-row>

          <!-- Переключатель вида (только для Desktop) -->
          <v-row class="ga-4 mt-1" v-if="!$vuetify.display.mobile && props.viewMode">
            <v-col cols="12">
              <div class="d-flex align-center justify-space-between bg-grey-lighten-4 rounded-lg pa-3">
                <div class="text-body-2 font-weight-medium d-flex align-center text-primary">
                  <v-icon icon="mdi-monitor-dashboard" size="20" class="me-2" />
                  Вид отображения списка
                </div>
                <v-btn-toggle
                  :model-value="props.viewMode"
                  @update:model-value="val => emit('update:viewMode', val)"
                  mandatory
                  color="primary"
                  variant="elevated"
                  elevation="1"
                  density="compact"
                  class="bg-white"
                >
                  <v-btn value="grid" class="px-4" title="Сетка">
                    <v-icon icon="mdi-view-grid" />
                    <span class="ms-2 text-none d-none d-sm-inline">Сетка</span>
                  </v-btn>
                  <v-btn value="list" class="px-4" title="Список">
                    <v-icon icon="mdi-view-list" />
                    <span class="ms-2 text-none d-none d-sm-inline">Список</span>
                  </v-btn>
                </v-btn-toggle>
              </div>
            </v-col>
          </v-row>

          <!-- Кнопки действий -->
          <v-divider class="my-4" />
          <div class="d-flex justify-end ga-3">
            <v-btn
              color="default"
              variant="outlined"
              class="text-none"
              prepend-icon="mdi-refresh"
              @click="resetFilters"
              :disabled="activeFiltersCount === 0"
            >
              Сбросить
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              class="text-none font-weight-bold"
              prepend-icon="mdi-check"
              @click="applyFilters"
            >
              Применить
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-menu>
  </div>
</template>

<style>
/* Глобальные стили для телепортированного v-menu на мобильных */
.mobile-filter-menu {
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  top: auto !important;
  max-width: 100% !important;
  width: 100% !important;
  margin: 0 !important;
  border-radius: 20px 20px 0 0 !important;
  height: auto !important;
  transform-origin: bottom center !important;
}

.mobile-filter-menu .filter-panel {
  border-radius: 20px 20px 0 0 !important;
  max-height: 85vh;
  overflow-y: auto;
  margin-top: 0 !important;
  min-width: 100% !important;
}

.mobile-filter-menu .filter-panel .v-card-text {
  padding: 24px 20px !important;
}
</style>

<style scoped>
.filter-dropdown {
  display: inline-block;
}

.filter-panel {
  min-width: 320px;
  background-color: white;
}

.cursor-pointer {
  cursor: pointer;
}

/* Убираем стандартные стили чекбоксов Vuetify для компактности */
:deep(.v-checkbox) {
  margin-bottom: 0 !important;
}

:deep(.v-checkbox .v-label) {
  font-size: 0.875rem;
}
</style>
