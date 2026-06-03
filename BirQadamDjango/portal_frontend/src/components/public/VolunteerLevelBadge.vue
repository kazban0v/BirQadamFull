<script setup lang="ts">
import { computed } from 'vue';
import { getLevelColors } from '@/utils/publicVolunteer';

const props = defineProps<{
  level: number;
  size?: 'sm' | 'md';
}>();

const colors = computed(() => getLevelColors(props.level));
const sizePx = computed(() => (props.size === 'sm' ? 36 : 48));
</script>

<template>
  <svg
    :width="sizePx"
    :height="sizePx"
    viewBox="0 0 48 48"
    class="lvl"
    :aria-label="`Уровень ${level}`"
  >
    <polygon
      points="24,2 44,14 44,34 24,46 4,34 4,14"
      :fill="colors.fill"
      :stroke="colors.stroke"
      stroke-width="2"
    />
    <text
      x="24"
      y="28"
      text-anchor="middle"
      fill="#fff"
      font-family="DM Sans, sans-serif"
      font-weight="800"
      :font-size="size === 'sm' ? 14 : 18"
    >{{ level }}</text>
  </svg>
</template>
