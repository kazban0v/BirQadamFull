<script setup lang="ts">
const steps = [
  {
    icon: 'register',
    label: 'Зарегистрируйтесь',
    desc: 'Создайте аккаунт волонтёра на BirQadam',
  },
  {
    icon: 'project',
    label: 'Присоединитесь к проекту',
    desc: 'Выберите проект в каталоге или получите приглашение от фонда',
  },
  {
    icon: 'task',
    label: 'Примите задачу',
    desc: 'Откройте задание и подтвердите участие в один клик',
  },
  {
    icon: 'photo',
    label: 'Загрузите фотоотчёт',
    desc: 'Выполните работу, отправьте отчёт и получите оценку организатора',
  },
];
</script>

<template>
  <section class="how">
    <h2 class="how__title">Как это работает?</h2>
    <div class="how__grid">
      <div v-for="(step, i) in steps" :key="i" class="how__step">
        <div class="how__icon">
          <svg v-if="step.icon === 'register'" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <path d="M20 8v6M23 11h-6"/>
          </svg>
          <svg v-else-if="step.icon === 'project'" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <svg v-else-if="step.icon === 'task'" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <span class="how__label">{{ step.label }}</span>
        <span class="how__desc">{{ step.desc }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.how {
  padding: 60px 0 20px;
  border-top: 1px solid rgba(61, 122, 47, 0.1);
  margin-top: 48px;
}

.how__title {
  font-family: 'Lora', serif;
  font-size: clamp(1.75rem, 3vw, 2.25rem);
  font-weight: 700;
  color: #1a2018;
  margin: 0 0 40px;
}

.how__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .how__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .how__grid {
    grid-template-columns: 1fr;
  }
}

.how__step {
  text-align: center;
}

.how__icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3d7a2f;
  background: rgba(61, 122, 47, 0.08);
  border-radius: 16px;
}

.how__label {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1a2018;
  line-height: 1.35;
  display: block;
  margin-bottom: 6px;
}

.how__desc {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(26, 32, 24, 0.55);
  line-height: 1.45;
  display: block;
}
</style>
