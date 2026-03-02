<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { fetchVolunteerStats, type VolunteerAchievement } from '@/services/stats';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const loading   = ref(false);
const error     = ref<string | null>(null);
const stats     = ref<Awaited<ReturnType<typeof fetchVolunteerStats>> | null>(null);
const achievements = ref<VolunteerAchievement[]>([]);

const showConfetti         = ref(false);
const confettiAchievement  = ref<VolunteerAchievement | null>(null);

type FilterType      = 'all' | 'unlocked' | 'locked';
type AchievementTier = 'bronze' | 'silver' | 'gold' | 'epic';

const filter = ref<FilterType>('all');

// ─── Load ──────────────────────────────────────────────────────────
const loadAchievements = async () => {
  loading.value = true;
  error.value   = null;
  try {
    const response = await fetchVolunteerStats();
    if (response) {
      stats.value = response;
      if (Array.isArray(response.achievements)) {
        const prevUnlocked = achievements.value.filter(a => a.unlocked).map(a => a.id);
        achievements.value  = response.achievements;
        const newlyUnlocked = achievements.value.filter(a => a.unlocked && !prevUnlocked.includes(a.id));
        if (newlyUnlocked.length > 0 && prevUnlocked.length > 0) {
          confettiAchievement.value = newlyUnlocked[0];
          showConfetti.value        = true;
          setTimeout(() => { showConfetti.value = false; confettiAchievement.value = null; }, 3500);
        }
      } else {
        achievements.value = [];
      }
    }
  } catch (err: any) {
    error.value        = err?.response?.data?.detail || err?.message || 'Не удалось загрузить достижения.';
    achievements.value = [];
    stats.value        = null;
  } finally {
    loading.value = false;
  }
};

// ─── Tier helpers ──────────────────────────────────────────────────
const TIER_CFG = {
  bronze: { label: 'Bronze', color: '#c97c3a', glow: 'rgba(201,124,58,0.35)',  gradient: 'linear-gradient(135deg,#c97c3a,#a05c20)', icon: 'mdi-medal',         bg: 'rgba(201,124,58,0.08)' },
  silver: { label: 'Silver', color: '#8fa3b1', glow: 'rgba(143,163,177,0.35)', gradient: 'linear-gradient(135deg,#8fa3b1,#6b8696)', icon: 'mdi-medal-outline', bg: 'rgba(143,163,177,0.08)' },
  gold:   { label: 'Gold',   color: '#e8b84b', glow: 'rgba(232,184,75,0.45)',  gradient: 'linear-gradient(135deg,#e8b84b,#c49020)', icon: 'mdi-trophy',        bg: 'rgba(232,184,75,0.08)' },
  epic:   { label: 'Epic',   color: '#8bc34a', glow: 'rgba(139,195,74,0.5)',   gradient: 'linear-gradient(135deg,#8bc34a,#4a8c1c)', icon: 'mdi-crown',         bg: 'rgba(139,195,74,0.1)'  },
} as const;

function getTier(a: VolunteerAchievement): AchievementTier {
  const r = a.required_rating || 0;
  if (r >= 500) return 'epic';
  if (r >= 250) return 'gold';
  if (r >= 100) return 'silver';
  return 'bronze';
}

function tierCfg(a: VolunteerAchievement) { return TIER_CFG[getTier(a)]; }

function getIcon(a: VolunteerAchievement) { return a.icon || TIER_CFG[getTier(a)].icon; }

function getProgress(a: VolunteerAchievement): number {
  if (a.unlocked) return 100;
  const cur = stats.value?.rating || 0;
  const req = a.required_rating || 0;
  return req ? Math.min(100, Math.round((cur / req) * 100)) : 0;
}

// ─── Computed ──────────────────────────────────────────────────────
const filteredAchievements = computed(() => {
  if (filter.value === 'unlocked') return achievements.value.filter(a => a.unlocked);
  if (filter.value === 'locked')   return achievements.value.filter(a => !a.unlocked);
  return achievements.value;
});

const sortedAchievements = computed(() =>
  [...filteredAchievements.value].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return (a.required_rating || 0) - (b.required_rating || 0);
  }),
);

const completionPct = computed(() => {
  if (!stats.value?.total_achievements) return 0;
  return Math.round((stats.value.unlocked_achievements / stats.value.total_achievements) * 100);
});

const levelProgress = computed(() => {
  if (!stats.value) return { pct: 0, remaining: 0 };
  const pct = Math.round((stats.value.progress || 0) * 100);
  const remaining = Math.max(0, (stats.value.next_level_rating || 0) - (stats.value.rating || 0));
  return { pct, remaining };
});

const nextAchievement = computed(() =>
  [...achievements.value]
    .filter(a => !a.unlocked)
    .sort((a, b) => (a.required_rating || 0) - (b.required_rating || 0))[0] ?? null,
);

const nextAchievementProgress = computed(() => {
  if (!nextAchievement.value || !stats.value) return { pct: 0, remaining: 0 };
  const cur = stats.value.rating || 0;
  const req = nextAchievement.value.required_rating || 0;
  return { pct: Math.min(100, Math.round((cur / req) * 100)), remaining: Math.max(0, req - cur) };
});

const profileBadges = computed(() =>
  [...achievements.value]
    .filter(a => a.unlocked)
    .sort((a, b) => (b.required_rating || 0) - (a.required_rating || 0))
    .slice(0, 3),
);

const recentAchievements = computed(() =>
  [...achievements.value]
    .filter(a => a.unlocked && a.unlocked_at)
    .sort((a, b) => new Date(b.unlocked_at!).getTime() - new Date(a.unlocked_at!).getTime())
    .slice(0, 3),
);

// Confetti
function confettiStyle(i: number) {
  const palette = ['#e8b84b','#8bc34a','#c97c3a','#4a8c1c','#ffd700','#a5d06a'];
  const angle   = (360 / 50) * i;
  const dist    = 160 + Math.random() * 120;
  return {
    left: '50%', top: '50%',
    backgroundColor: palette[i % palette.length],
    transform: `translate(${Math.cos((angle * Math.PI) / 180) * dist}px, ${Math.sin((angle * Math.PI) / 180) * dist}px) rotate(${angle}deg)`,
    animationDelay:    `${Math.random() * 0.4}s`,
    animationDuration: `${1.8 + Math.random() * 0.8}s`,
  };
}

const dateShort = (v: string) =>
  new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });

const dateLong = (v: string) =>
  new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

onMounted(loadAchievements);
</script>

<template>
  <div class="av">

    <!-- ─── Confetti ─── -->
    <div v-if="showConfetti && confettiAchievement" class="confetti-wrap">
      <div v-for="i in 50" :key="i" class="confetti-dot" :style="confettiStyle(i)" />
      <div class="confetti-toast">
        <div class="confetti-toast__crown">🏆</div>
        <h3 class="confetti-toast__title">Достижение получено!</h3>
        <p class="confetti-toast__name">{{ confettiAchievement.name }}</p>
      </div>
    </div>

    <!-- ─── Error ─── -->
    <div v-if="error" class="err-bar">
      <v-icon icon="mdi-alert-circle-outline" size="18" />
      {{ error }}
      <button class="err-bar__retry" @click="loadAchievements">Повторить</button>
      <button class="err-bar__close" @click="error = null">✕</button>
    </div>

    <!-- ════════════════════════
         HERO BANNER
    ════════════════════════ -->
    <div class="hero-banner">
      <div class="hero-banner__bg">
        <div class="hero-banner__orb hero-banner__orb--a" />
        <div class="hero-banner__orb hero-banner__orb--b" />
        <div class="hero-banner__grid" />
      </div>

      <div class="hero-banner__left">
        <div class="hero-banner__eyebrow">
          <v-icon icon="mdi-trophy-outline" size="14" />
          Достижения
        </div>
        <h1 class="hero-banner__h1">
          <template v-if="stats">{{ stats.unlocked_achievements }} из {{ stats.total_achievements }}</template>
          <template v-else>Ваши награды</template>
        </h1>
        <p class="hero-banner__sub">
          <template v-if="stats">
            Уровень <strong>{{ stats.level }}</strong> · Рейтинг <strong>{{ stats.rating }}</strong> очков
          </template>
          <template v-else>Загрузка данных…</template>
        </p>

        <!-- Level progress bar -->
        <div v-if="stats" class="hero-banner__level">
          <div class="hero-banner__level-row">
            <span>Ур. {{ stats.level }}</span>
            <span class="hero-banner__level-pct">{{ levelProgress.pct }}%</span>
            <span>Ур. {{ stats.level + 1 }}</span>
          </div>
          <div class="prog-track">
            <div class="prog-fill prog-fill--lime" :style="{ width: levelProgress.pct + '%' }" />
          </div>
          <span class="hero-banner__level-hint">ещё {{ levelProgress.remaining }} очков до следующего уровня</span>
        </div>
      </div>

      <div class="hero-banner__right">
        <!-- Circular ring -->
        <div class="ring-wrap">
          <svg class="ring-svg" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" />
            <circle
              cx="60" cy="60" r="50"
              fill="none"
              stroke="url(#ring-grad)"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="314"
              :stroke-dashoffset="314 - 314 * completionPct / 100"
              transform="rotate(-90 60 60)"
              style="transition: stroke-dashoffset 1.2s ease"
            />
            <defs>
              <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#c6ea5a" />
                <stop offset="100%" stop-color="#8bc34a" />
              </linearGradient>
            </defs>
          </svg>
          <div class="ring-text">
            <span class="ring-pct">{{ completionPct }}<span class="ring-sym">%</span></span>
            <span class="ring-lbl">завершено</span>
          </div>
        </div>

        <!-- Mini badges row -->
        <div v-if="profileBadges.length" class="hero-banner__badges">
          <div
            v-for="b in profileBadges"
            :key="b.id"
            class="mini-badge"
            :title="b.name"
            :style="{ background: tierCfg(b).gradient, boxShadow: `0 4px 14px ${tierCfg(b).glow}` }"
          >
            <v-icon :icon="getIcon(b)" color="white" size="18" />
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════════════════
         SIDEBAR + MAIN
    ════════════════════════ -->
    <div class="body-layout">

      <!-- ── Sidebar ── -->
      <aside class="sidebar">

        <!-- Next achievement -->
        <div v-if="nextAchievement" class="scard">
          <div class="scard__head">
            <v-icon icon="mdi-target" size="15" />
            Следующая цель
          </div>
          <div class="next-ach">
            <div
              class="next-ach__ico"
              :style="{ background: tierCfg(nextAchievement).gradient, boxShadow: `0 6px 18px ${tierCfg(nextAchievement).glow}` }"
            >
              <v-icon :icon="getIcon(nextAchievement)" color="white" size="22" />
            </div>
            <div>
              <div class="next-ach__name">{{ nextAchievement.name }}</div>
              <div class="next-ach__req">{{ nextAchievement.required_rating }} очков</div>
            </div>
          </div>
          <div class="prog-track">
            <div class="prog-fill" :style="{ width: nextAchievementProgress.pct + '%', background: tierCfg(nextAchievement).gradient }" />
          </div>
          <div class="next-ach__row">
            <span>{{ stats?.rating || 0 }} / {{ nextAchievement.required_rating }}</span>
            <span class="next-ach__rem">−{{ nextAchievementProgress.remaining }}</span>
          </div>
        </div>

        <!-- Recent unlocks -->
        <div v-if="recentAchievements.length" class="scard">
          <div class="scard__head">
            <v-icon icon="mdi-clock-outline" size="15" />
            Последние
          </div>
          <div class="recent-list">
            <div v-for="a in recentAchievements" :key="a.id" class="recent-item">
              <div
                class="recent-item__ico"
                :style="{ background: tierCfg(a).gradient }"
              >
                <v-icon :icon="getIcon(a)" color="white" size="14" />
              </div>
              <div class="recent-item__info">
                <div class="recent-item__name">{{ a.name }}</div>
                <div class="recent-item__date">{{ dateShort(a.unlocked_at!) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Profile badges -->
        <div v-if="profileBadges.length" class="scard">
          <div class="scard__head">
            <v-icon icon="mdi-account-star-outline" size="15" />
            Бейджи профиля
          </div>
          <div class="badge-list">
            <div
              v-for="b in profileBadges"
              :key="b.id"
              class="badge-item"
              :style="{ borderColor: tierCfg(b).color, background: tierCfg(b).bg }"
            >
              <v-icon :icon="getIcon(b)" :color="tierCfg(b).color" size="20" />
              <span class="badge-item__name">{{ b.name }}</span>
              <span class="badge-item__tier" :style="{ color: tierCfg(b).color }">{{ tierCfg(b).label }}</span>
            </div>
          </div>
        </div>

      </aside>

      <!-- ── Main panel ── -->
      <main class="main-panel">

        <!-- Filter bar -->
        <div class="filter-bar">
          <button
            v-for="f in (['all','unlocked','locked'] as FilterType[])"
            :key="f"
            class="filter-btn"
            :class="{ 'filter-btn--active': filter === f }"
            @click="filter = f"
          >
            {{ f === 'all' ? 'Все' : f === 'unlocked' ? 'Получено' : 'В процессе' }}
            <span class="filter-btn__count">
              {{
                f === 'all'      ? achievements.length :
                f === 'unlocked' ? achievements.filter(a => a.unlocked).length :
                achievements.filter(a => !a.unlocked).length
              }}
            </span>
          </button>
          <button class="filter-btn filter-btn--refresh" :class="{ 'filter-btn--spinning': loading }" @click="loadAchievements">
            <v-icon icon="mdi-refresh" size="16" />
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="ach-grid">
          <div v-for="i in 6" :key="i" class="ach-skeleton">
            <v-skeleton-loader type="card" />
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="!sortedAchievements.length" class="empty-state">
          <div class="empty-state__ico">
            {{ filter === 'locked' ? '🏆' : '🎯' }}
          </div>
          <h3 class="empty-state__title">
            {{ filter === 'unlocked' ? 'Начните свой путь!' : filter === 'locked' ? 'Всё получено! 🎉' : 'Достижений нет' }}
          </h3>
          <p class="empty-state__text">
            <template v-if="filter === 'unlocked'">Выполняйте задачи и загружайте фотоотчёты — каждое действие приближает вас к наградам.</template>
            <template v-else-if="filter === 'locked'">Вы разблокировали все достижения. Вы настоящий мастер волонтёрства!</template>
            <template v-else>Не удалось загрузить достижения. Проверьте подключение.</template>
          </p>
          <button v-if="filter !== 'all'" class="empty-state__btn" @click="filter = 'all'">Показать все</button>
        </div>

        <!-- Achievement cards -->
        <div v-else class="ach-grid">
          <div
            v-for="(a, i) in sortedAchievements"
            :key="a.id"
            class="ach-card"
            :class="{
              'ach-card--unlocked': a.unlocked,
              'ach-card--epic':     getTier(a) === 'epic' && a.unlocked,
              'ach-card--gold':     getTier(a) === 'gold' && a.unlocked,
            }"
            :style="{
              '--tier-color':    tierCfg(a).color,
              '--tier-glow':     tierCfg(a).glow,
              '--tier-gradient': tierCfg(a).gradient,
              animationDelay:    `${i * 0.04}s`,
            }"
          >
            <!-- Locked overlay shimmer -->
            <div v-if="!a.unlocked" class="ach-card__locked-shimmer" />

            <!-- Tier ribbon -->
            <div class="ach-card__ribbon" :style="{ background: tierCfg(a).gradient }">
              <v-icon :icon="TIER_CFG[getTier(a)].icon" color="white" size="11" />
              {{ tierCfg(a).label }}
            </div>

            <!-- Top: icon + status -->
            <div class="ach-card__top">
              <div
                class="ach-card__ico"
                :class="{ 'ach-card__ico--locked': !a.unlocked }"
                :style="a.unlocked ? { background: tierCfg(a).gradient, boxShadow: `0 8px 24px ${tierCfg(a).glow}` } : {}"
              >
                <v-icon :icon="getIcon(a)" :color="a.unlocked ? 'white' : undefined" size="28" />
              </div>
              <div class="ach-card__status" :class="a.unlocked ? 'ach-card__status--got' : 'ach-card__status--progress'">
                {{ a.unlocked ? '✓ Получено' : '· В процессе' }}
              </div>
            </div>

            <!-- Name + desc -->
            <h3 class="ach-card__name">{{ a.name }}</h3>
            <p class="ach-card__desc">{{ a.description }}</p>

            <!-- Progress -->
            <div class="ach-card__prog">
              <div class="ach-card__prog-row">
                <span>
                  <template v-if="a.unlocked">Выполнено</template>
                  <template v-else>{{ stats?.rating || 0 }} / {{ a.required_rating }}</template>
                </span>
                <span class="ach-card__xp" :style="{ color: tierCfg(a).color }">+{{ a.xp }} XP</span>
              </div>
              <div class="prog-track">
                <div
                  class="prog-fill"
                  :style="{
                    width: getProgress(a) + '%',
                    background: a.unlocked ? tierCfg(a).gradient : 'rgba(0,0,0,0.15)',
                  }"
                />
              </div>
              <div class="ach-card__pct">{{ getProgress(a) }}%</div>
            </div>

            <!-- Unlock date -->
            <div v-if="a.unlocked && a.unlocked_at" class="ach-card__date">
              <v-icon icon="mdi-calendar-check-outline" size="12" />
              {{ dateLong(a.unlocked_at) }}
            </div>

            <!-- Remaining hint -->
            <div v-else-if="!a.unlocked" class="ach-card__remain">
              ещё {{ Math.max(0, (a.required_rating || 0) - (stats?.rating || 0)) }} очков
            </div>
          </div>
        </div>

      </main>
    </div>

  </div>
</template>

<style scoped>
/* ══════════════════════════════════
   TOKENS
══════════════════════════════════ */
.av {
  --green:  #8bc34a;
  --lime:   #c6ea5a;
  --ink:    #12180f;
  --ink-2:  rgba(18,24,15,0.52);
  --card:   #ffffff;
  --surf:   #f4f6f0;
  --r:      16px;
  font-family: 'DM Sans', 'Outfit', sans-serif;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Progress tracks ── */
.prog-track {
  height: 6px;
  background: rgba(0,0,0,0.07);
  border-radius: 100px;
  overflow: hidden;
  margin: 4px 0;
}

.prog-fill {
  height: 100%;
  border-radius: 100px;
  transition: width 1s ease;
}

.prog-fill--lime { background: linear-gradient(90deg, #c6ea5a, #8bc34a); }

/* ══════════════════════════════════
   CONFETTI
══════════════════════════════════ */
.confetti-wrap {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confetti-dot {
  position: absolute;
  width: 9px; height: 9px;
  border-radius: 3px;
  animation: cfFly linear forwards;
}
@keyframes cfFly { 0%{opacity:1;} 100%{opacity:0;} }

.confetti-toast {
  position: relative;
  z-index: 10001;
  background: #fff;
  border-radius: 20px;
  padding: 28px 36px;
  text-align: center;
  box-shadow: 0 24px 64px rgba(0,0,0,0.22);
  border: 1px solid rgba(139,195,74,0.2);
  animation: toastPop 0.4s cubic-bezier(.175,.885,.32,1.275) both;
}
@keyframes toastPop { from{opacity:0;transform:scale(0.6);} to{opacity:1;transform:scale(1);} }

.confetti-toast__crown { font-size: 3rem; line-height: 1; margin-bottom: 10px; display: block; }
.confetti-toast__title { font-size: 1.3rem; font-weight: 800; color: var(--ink); margin: 0 0 6px; }
.confetti-toast__name  { font-size: 0.95rem; color: var(--ink-2); margin: 0; }

/* ── Error bar ── */
.err-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(198,40,40,0.07);
  border: 1px solid rgba(198,40,40,0.2);
  border-radius: 12px;
  font-size: 0.875rem;
  color: #c62828;
  font-weight: 600;
}
.err-bar__retry {
  margin-left: auto;
  padding: 4px 12px;
  border-radius: 8px;
  background: rgba(198,40,40,0.1);
  color: #c62828;
  font-weight: 800;
  font-size: 0.8rem;
  border: none;
  cursor: pointer;
}
.err-bar__close { border: none; background: none; color: rgba(198,40,40,0.5); cursor: pointer; font-size: 1rem; }

/* ══════════════════════════════════
   HERO BANNER
══════════════════════════════════ */
.hero-banner {
  position: relative;
  background: #0e180a;
  border-radius: 22px;
  padding: 32px 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  overflow: hidden;
}

.hero-banner__bg { position: absolute; inset: 0; pointer-events: none; }

.hero-banner__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.4;
}
.hero-banner__orb--a { width: 400px; height: 400px; background: radial-gradient(circle, rgba(139,195,74,0.5), transparent); top: -150px; left: -80px; }
.hero-banner__orb--b { width: 300px; height: 300px; background: radial-gradient(circle, rgba(198,234,90,0.3), transparent); bottom: -100px; right: -60px; }

.hero-banner__grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(139,195,74,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,195,74,0.04) 1px, transparent 1px);
  background-size: 40px 40px;
}

.hero-banner__left  { position: relative; z-index: 2; flex: 1; color: #fff; }
.hero-banner__right { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 16px; }

.hero-banner__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: rgba(198,234,90,0.65);
  margin-bottom: 10px;
}

.hero-banner__h1 {
  font-size: clamp(1.8rem, 3.5vw, 2.8rem);
  font-weight: 900;
  color: #fff;
  margin: 0 0 6px;
  letter-spacing: -1px;
  line-height: 1.1;
}

.hero-banner__sub {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.5);
  margin: 0 0 20px;
}
.hero-banner__sub strong { color: rgba(255,255,255,0.85); }

.hero-banner__level-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(255,255,255,0.4);
  margin-bottom: 5px;
}

.hero-banner__level-pct { color: var(--lime); }
.hero-banner__level-hint { font-size: 0.7rem; color: rgba(255,255,255,0.3); margin-top: 4px; display: block; }

.hero-banner__level .prog-track { background: rgba(255,255,255,0.1); height: 7px; }

/* Ring */
.ring-wrap {
  position: relative;
  width: 120px; height: 120px;
}
.ring-svg { width: 100%; height: 100%; }
.ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ring-pct  { font-size: 1.6rem; font-weight: 900; color: #fff; letter-spacing: -1px; line-height: 1; }
.ring-sym  { font-size: 1rem; }
.ring-lbl  { font-size: 0.62rem; font-weight: 700; color: rgba(255,255,255,0.38); text-transform: uppercase; letter-spacing: 0.8px; }

.hero-banner__badges { display: flex; gap: 10px; }

.mini-badge {
  width: 40px; height: 40px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s;
}
.mini-badge:hover { transform: scale(1.1) rotate(-4deg); }

/* ══════════════════════════════════
   BODY LAYOUT
══════════════════════════════════ */
.body-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
  align-items: start;
}

/* ══════════════════════════════════
   SIDEBAR
══════════════════════════════════ */
.sidebar { display: flex; flex-direction: column; gap: 12px; }

.scard {
  background: var(--card);
  border-radius: var(--r);
  border: 1px solid rgba(0,0,0,0.07);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scard__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--ink-2);
}

/* Next achievement */
.next-ach { display: flex; align-items: center; gap: 12px; }
.next-ach__ico { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.next-ach__name { font-size: 0.875rem; font-weight: 800; color: var(--ink); line-height: 1.3; }
.next-ach__req  { font-size: 0.75rem; color: var(--ink-2); margin-top: 2px; }
.next-ach__row  { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--ink-2); }
.next-ach__rem  { font-weight: 800; color: var(--green); }

/* Recent list */
.recent-list { display: flex; flex-direction: column; gap: 8px; }

.recent-item { display: flex; align-items: center; gap: 10px; }
.recent-item__ico { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.recent-item__name { font-size: 0.8rem; font-weight: 700; color: var(--ink); line-height: 1.3; }
.recent-item__date { font-size: 0.7rem; color: var(--ink-2); }
.recent-item__info { flex: 1; min-width: 0; }

/* Badge list */
.badge-list { display: flex; flex-direction: column; gap: 8px; }

.badge-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1.5px solid;
  transition: transform 0.2s;
}
.badge-item:hover { transform: translateX(3px); }
.badge-item__name { font-size: 0.8rem; font-weight: 700; color: var(--ink); flex: 1; }
.badge-item__tier { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }

/* ══════════════════════════════════
   MAIN PANEL
══════════════════════════════════ */
.main-panel { display: flex; flex-direction: column; gap: 14px; }

/* Filter bar */
.filter-bar {
  display: flex;
  gap: 6px;
  background: var(--card);
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.07);
  padding: 5px;
}

.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ink-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.filter-btn:hover { background: rgba(139,195,74,0.06); color: #3a7422; }
.filter-btn--active { background: rgba(139,195,74,0.13); color: #3a7422; }

.filter-btn__count {
  min-width: 22px;
  text-align: center;
  padding: 1px 6px;
  border-radius: 100px;
  font-size: 0.7rem;
  font-weight: 900;
  background: rgba(0,0,0,0.06);
  color: var(--ink-2);
}
.filter-btn--active .filter-btn__count { background: rgba(139,195,74,0.2); color: #3a7422; }

.filter-btn--refresh { flex: none; width: 36px; padding: 8px; }
.filter-btn--spinning { animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Achievement grid ── */
.ach-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.ach-skeleton { border-radius: var(--r); overflow: hidden; min-height: 260px; }

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 56px 24px;
  background: var(--card);
  border-radius: var(--r);
  border: 1px dashed rgba(0,0,0,0.12);
}
.empty-state__ico   { font-size: 3rem; margin-bottom: 14px; animation: float 3s ease-in-out infinite; }
@keyframes float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-10px);} }
.empty-state__title { font-size: 1.05rem; font-weight: 800; color: var(--ink); margin: 0 0 8px; }
.empty-state__text  { font-size: 0.875rem; color: var(--ink-2); line-height: 1.6; margin: 0 0 20px; max-width: 360px; }
.empty-state__btn {
  padding: 10px 22px;
  border-radius: 100px;
  background: rgba(139,195,74,0.1);
  border: 1.5px solid rgba(139,195,74,0.2);
  color: #3a7422;
  font-size: 0.875rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s;
}
.empty-state__btn:hover { background: rgba(139,195,74,0.2); }

/* ══════════════════════════════════
   ACHIEVEMENT CARD
══════════════════════════════════ */
.ach-card {
  background: var(--card);
  border-radius: 18px;
  border: 1.5px solid rgba(0,0,0,0.07);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  overflow: hidden;
  animation: cardIn 0.4s ease both;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}
@keyframes cardIn { from{opacity:0;transform:translateY(14px);} to{opacity:1;transform:translateY(0);} }

.ach-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 32px rgba(0,0,0,0.08);
}

/* Unlocked state */
.ach-card--unlocked {
  border-color: var(--tier-color, rgba(0,0,0,0.07));
  box-shadow: 0 0 0 0 transparent;
}
.ach-card--unlocked:hover {
  box-shadow: 0 14px 32px var(--tier-glow, rgba(0,0,0,0.08));
}

/* Gold shimmer */
.ach-card--gold::before {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(232,184,75,0.08), transparent);
  animation: shimmer 3s ease infinite 0.5s;
}
@keyframes shimmer { 0%{left:-100%;} 100%{left:200%;} }

/* Epic pulse */
.ach-card--epic {
  animation: cardIn 0.4s ease both, epicPulse 3s ease-in-out infinite 1s;
}
@keyframes epicPulse {
  0%,100%{ box-shadow: 0 0 0 0 var(--tier-glow,transparent); }
  50%    { box-shadow: 0 0 0 6px transparent; }
}

/* Locked overlay */
.ach-card__locked-shimmer {
  position: absolute; inset: 0;
  background: rgba(244,246,240,0.5);
  z-index: 1;
  pointer-events: none;
}

/* Ribbon */
.ach-card__ribbon {
  position: absolute;
  top: 14px; right: -1px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px 3px 8px;
  border-radius: 8px 0 0 8px;
  font-size: 0.62rem;
  font-weight: 900;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  z-index: 2;
}

/* Card top */
.ach-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 2;
}

.ach-card__ico {
  width: 52px; height: 52px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s;
}
.ach-card:hover .ach-card__ico { transform: scale(1.08) rotate(-3deg); }
.ach-card__ico--locked {
  background: rgba(0,0,0,0.06);
  color: rgba(0,0,0,0.25);
}
.ach-card__ico--locked :deep(.v-icon) { opacity: 0.4; }

.ach-card__status {
  padding: 3px 9px;
  border-radius: 100px;
  font-size: 0.7rem;
  font-weight: 800;
}
.ach-card__status--got      { background: rgba(139,195,74,0.12); color: #3a7422; }
.ach-card__status--progress { background: rgba(0,0,0,0.05);       color: var(--ink-2); }

/* Name / desc */
.ach-card__name {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--ink);
  margin: 0;
  line-height: 1.3;
  position: relative;
  z-index: 2;
}

.ach-card__desc {
  font-size: 0.8rem;
  color: var(--ink-2);
  line-height: 1.55;
  margin: 0;
  position: relative;
  z-index: 2;
}

/* Progress */
.ach-card__prog { position: relative; z-index: 2; }
.ach-card__prog-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--ink-2);
  margin-bottom: 3px;
}
.ach-card__xp  { font-weight: 800; }
.ach-card__pct { font-size: 0.68rem; color: var(--ink-2); text-align: right; margin-top: 2px; }

/* Dates */
.ach-card__date, .ach-card__remain {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: var(--ink-2);
  padding-top: 8px;
  border-top: 1px solid rgba(0,0,0,0.06);
  position: relative;
  z-index: 2;
}
.ach-card__remain { color: var(--green); font-weight: 700; }

/* ══════════════════════════════════
   RESPONSIVE
══════════════════════════════════ */
@media (max-width: 900px) {
  .body-layout { grid-template-columns: 1fr; }
  .sidebar { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
}

@media (max-width: 640px) {
  .hero-banner { flex-direction: column; padding: 22px 18px; text-align: center; border-radius: 18px; }
  .hero-banner__right { flex-direction: row; justify-content: center; }
  .hero-banner__badges { display: none; }

  .filter-bar { flex-wrap: wrap; }
  .filter-btn { flex: 1 0 calc(50% - 6px); }
  .filter-btn--refresh { flex: none; }

  .ach-grid { grid-template-columns: 1fr; }
  .sidebar  { grid-template-columns: 1fr; }
}
</style>