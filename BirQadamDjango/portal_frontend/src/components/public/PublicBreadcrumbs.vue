<script setup lang="ts">
import { RouterLink } from 'vue-router';

defineProps<{
  items: { label: string; to?: { name: string; path?: string; params?: Record<string, string | number> } }[];
}>();
</script>

<template>
  <nav class="bc" aria-label="Хлебные крошки">
    <template v-for="(item, i) in items" :key="i">
      <span v-if="i > 0" class="bc__sep">/</span>
      <RouterLink v-if="item.to" :to="item.to" class="bc__link">{{ item.label }}</RouterLink>
      <span v-else class="bc__current">{{ item.label }}</span>
    </template>
  </nav>
</template>

<style scoped>
.bc {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.875rem;
  margin-bottom: 24px;
}

.bc__sep {
  color: rgba(26, 32, 24, 0.3);
}

.bc__link {
  color: rgba(26, 32, 24, 0.55);
  text-decoration: none;
  transition: color 0.2s;
}

.bc__link:hover {
  color: #3d7a2f;
}

.bc__current {
  color: #1a2018;
  font-weight: 600;
}
</style>
