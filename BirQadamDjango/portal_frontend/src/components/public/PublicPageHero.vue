<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  searchPlaceholder?: string;
  searchModel?: string;
  showSearch?: boolean;
}>();

const emit = defineEmits<{
  search: [];
  'update:searchModel': [value: string];
}>();

function onInput(e: Event) {
  emit('update:searchModel', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="hero">
    <div class="hero__inner">
      <h1 class="hero__title">{{ title }}</h1>
      <p class="hero__desc">{{ description }}</p>

      <div v-if="showSearch !== false" class="hero__search">
        <svg class="hero__search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          :value="searchModel"
          @input="onInput"
          @keyup.enter="emit('search')"
          :placeholder="searchPlaceholder || 'Поиск...'"
          class="hero__search-input"
        />
        <button type="button" @click="emit('search')" class="hero__search-btn">Найти</button>
      </div>

      <slot />
    </div>
  </div>
</template>

<style scoped>
.hero {
  background: #3d7a2f;
  color: #fff;
  padding: 120px 24px 60px;
  text-align: center;
  border-radius: 0 0 32px 32px;
  margin-bottom: -40px;
}

.hero__inner {
  max-width: 800px;
  margin: 0 auto;
}

.hero__title {
  font-family: 'Lora', serif;
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  font-weight: 700;
  font-style: italic;
  margin: 0 0 16px;
}

.hero__desc {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.1rem;
  opacity: 0.85;
  margin: 0 0 32px;
}

.hero__search {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 100px;
  padding: 6px 6px 6px 20px;
  max-width: 500px;
  margin: 0 auto;
  box-shadow: 0 12px 24px rgba(26, 60, 18, 0.15);
}

.hero__search-icon {
  color: rgba(0, 0, 0, 0.3);
  margin-right: 12px;
  flex-shrink: 0;
}

.hero__search-input {
  flex: 1;
  border: none;
  outline: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  color: #1a2018;
  background: transparent;
  min-width: 0;
}

.hero__search-input::placeholder {
  color: rgba(0, 0, 0, 0.3);
}

.hero__search-btn {
  background: #3d7a2f;
  color: #fff;
  border: none;
  border-radius: 100px;
  padding: 12px 24px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.hero__search-btn:hover {
  background: #2e6323;
}
</style>
