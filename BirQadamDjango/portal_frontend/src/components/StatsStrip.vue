<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchPublicStats, type PlatformStats } from '@/services/webPortal';

// ─── State ────────────────────────────────────────────────────────────────────
const loading  = ref(true);
const error    = ref(false);
const visible  = ref(false);

const displayed = ref<PlatformStats>({ volunteers: 0, funds: 0, tasks_done: 0, days_since: 0 });

// ─── Count-up animation ───────────────────────────────────────────────────────
function animateCount(key: keyof PlatformStats, to: number, delay = 0, duration = 2200) {
  setTimeout(() => {
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      // ease-out expo for elegant timing
      const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      displayed.value[key] = Math.round(to * ease) as never;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, delay);
}

function formatNumber(n: number): string {
  return n >= 1000 ? n.toLocaleString('ru-RU') : String(n);
}

// ─── Intersection Observer — triggering animation on viewport enter ─────────
function setupObserver(el: Element) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        visible.value = true;
        observer.disconnect();
      }
    },
    { threshold: 0.15 }
  );
  observer.observe(el);
}

onMounted(async () => {
  try {
    const data = await fetchPublicStats();
    loading.value = false;

    const section = document.querySelector('.ss-wrapper');
    if (section) {
      setupObserver(section);
      const rect = section.getBoundingClientRect();
      if (rect.top < window.innerHeight) visible.value = true;
    }

    // Watch for visible trigger to run counters
    const unwatch = setInterval(() => {
      if (visible.value) {
        clearInterval(unwatch);
        const keys = Object.keys(data) as (keyof PlatformStats)[];
        keys.forEach((key, i) => animateCount(key, data[key], i * 150));
      }
    }, 50);
  } catch {
    error.value  = true;
    loading.value = false;
  }
});

const cards = [
  {
    key:   'volunteers' as keyof PlatformStats,
    label: ['Зарегистрированных', 'волонтёров'],
    icon:  'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  },
  {
    key:   'funds' as keyof PlatformStats,
    label: ['Фондов', 'зарегистрировано'],
    icon:  'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  },
  {
    key:   'tasks_done' as keyof PlatformStats,
    label: ['Заданий', 'уже выполнено'],
    icon:  'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  },
  {
    key:   'days_since' as keyof PlatformStats,
    label: ['Дней со старта', 'проекта'],
    icon:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
  },
];
</script>

<template>
  <div class="ss-wrapper" aria-label="Статистика платформы">
    <div class="ss-card" :class="{ 'ss-card--visible': visible }">

      <!-- Loading skeleton -->
      <template v-if="loading">
        <div class="ss-grid">
          <div v-for="i in 4" :key="i" class="ss-col ss-col--sk">
            <div class="ss-sk ss-sk--icon" />
            <div class="ss-sk ss-sk--num" />
            <div class="ss-sk ss-sk--lbl" />
          </div>
        </div>
      </template>

      <!-- Error message -->
      <div v-else-if="error" class="ss-error">
        Статистика временно недоступна
      </div>

      <!-- Real stats content -->
      <div v-else class="ss-grid">
        <div
          v-for="(card, i) in cards"
          :key="card.key"
          class="ss-col"
          :style="{ '--delay-idx': i }"
        >
          <!-- Icon -->
          <div class="ss-icon-box" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path :d="card.icon" />
            </svg>
          </div>

          <!-- Counter Number -->
          <div class="ss-num">
            {{ formatNumber(displayed[card.key] as number) }}
          </div>

          <!-- Label -->
          <div class="ss-lbl">
            <span v-for="(line, li) in card.label" :key="li">
              {{ line }}<br v-if="li < card.label.length - 1" />
            </span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════
   STATS STRIP v4 — Premium Modern Tech Aesthetic
   ══════════════════════════════════════════════════════ */

.ss-wrapper {
  max-width: 1140px;
  margin: 40px auto 60px; /* Отступ сверху — карточка опущена ниже */
  padding: 0 24px;
  position: relative;
  z-index: 10;
}

.ss-card {
  background: #ffffff;
  border-radius: 28px;
  border: 1px solid rgba(61, 122, 47, 0.08);
  box-shadow: 
    0 24px 50px rgba(26, 60, 18, 0.04),
    0 4px 16px rgba(26, 60, 18, 0.02);
  padding: 48px 24px;
  
  /* Soft entry transition */
  opacity: 0;
  transform: translateY(30px);
  transition: 
    opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.4s ease;
}

.ss-card:hover {
  box-shadow: 
    0 32px 70px rgba(26, 60, 18, 0.07),
    0 8px 24px rgba(26, 60, 18, 0.03);
}

.ss-card--visible {
  opacity: 1;
  transform: translateY(0);
}

.ss-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
}

/* ─── Column layout ─────────────────────── */
.ss-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 16px 24px;
  position: relative;
  
  /* Staggered entry animation */
  opacity: 0;
  transform: translateY(20px);
}

.ss-card--visible .ss-col {
  animation: slideUpFade 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  animation-delay: calc(var(--delay-idx) * 0.12s + 0.15s);
}

@keyframes slideUpFade {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Elegant vertical separators */
.ss-col:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 15%;
  right: 0;
  width: 1px;
  height: 70%;
  background: linear-gradient(
    to bottom,
    rgba(61, 122, 47, 0) 0%,
    rgba(61, 122, 47, 0.12) 50%,
    rgba(61, 122, 47, 0) 100%
  );
}

/* ─── Icon style ────────────────────────── */
.ss-icon-box {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: #f4f9f1;
  color: #3d7a2f;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22px;
  transition: 
    background 0.4s ease,
    color 0.4s ease,
    box-shadow 0.4s ease,
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy hover */
}

.ss-col:hover .ss-icon-box {
  background: #3d7a2f;
  color: #ffffff;
  transform: translateY(-6px) scale(1.08) rotate(-6deg);
  box-shadow: 0 12px 24px rgba(61, 122, 47, 0.25);
}

/* ─── Number style (Modern Bold Sans) ───── */
.ss-num {
  font-family: 'DM Sans', sans-serif;
  font-size: clamp(2.4rem, 4vw, 3.2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #1a2018; /* Dark ink for crisp premium feel */
  line-height: 1.1;
  margin-bottom: 8px;
  transition: 
    color 0.4s ease,
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ss-col:hover .ss-num {
  color: #4caf50; /* Pops to vibrant green */
  transform: scale(1.06);
}

/* ─── Label style ───────────────────────── */
.ss-lbl {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.45;
  color: rgba(26, 32, 24, 0.5);
  transition: color 0.4s ease;
}

.ss-col:hover .ss-lbl {
  color: #1a2018;
}

/* ─── Skeleton ──────────────────────────── */
.ss-col--sk {
  gap: 14px;
  pointer-events: none;
  opacity: 1;
  transform: none;
  animation: none;
}
.ss-sk {
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    rgba(61, 122, 47, 0.04) 25%,
    rgba(61, 122, 47, 0.09) 50%,
    rgba(61, 122, 47, 0.04) 75%
  );
  background-size: 400% 100%;
  animation: shimmer 1.5s ease infinite;
}
.ss-sk--icon { width: 54px; height: 54px; border-radius: 16px; }
.ss-sk--num  { width: 80px; height: 42px; }
.ss-sk--lbl  { width: 130px; height: 34px; }

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ─── Error ─────────────────────────────── */
.ss-error {
  text-align: center;
  padding: 32px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  color: rgba(26, 32, 24, 0.4);
}

/* ══════════════════════════════════════════════════════
   RESPONSIVE DESIGN
   ══════════════════════════════════════════════════════ */

@media (max-width: 960px) {
  .ss-wrapper {
    margin: -24px auto 40px;
  }
  
  .ss-card {
    border-radius: 24px;
    padding: 36px 16px;
  }

  .ss-grid {
    grid-template-columns: repeat(2, 1fr);
    row-gap: 40px;
  }

  .ss-col:nth-child(2n)::after {
    display: none;
  }
}

@media (max-width: 520px) {
  .ss-wrapper {
    margin: 16px auto 32px;
    padding: 0 16px;
  }

  .ss-card {
    border-radius: 20px;
    padding: 32px 12px;
  }

  .ss-grid {
    grid-template-columns: 1fr;
    row-gap: 28px;
  }

  .ss-col {
    padding: 12px 16px;
  }

  .ss-col::after {
    display: none !important;
  }

  .ss-col:not(:last-child) {
    border-bottom: 1px solid rgba(61, 122, 47, 0.08);
    padding-bottom: 28px;
  }
}
</style>
