<script setup lang="ts">
import { onMounted, ref, computed, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

// Types
interface FAQ {
  q: string;
  a: string;
}

const authStore = useAuthStore();

// Loading state
const isLoading = ref(false);

// FAQ
const openFaq = ref<number | null>(null);
const faqs: FAQ[] = [
  { q: 'Как связать аккаунт из Telegram с веб-порталом?', a: 'После регистрации на сайте откройте бот BirQadam в Telegram и введите команду /link. Следуйте инструкциям — займёт меньше минуты.' },
  { q: 'Нужно ли проходить повторную модерацию?', a: 'Если вы уже подтверждены в системе, повторная модерация не требуется. Новые организаторы проходят проверку один раз.' },
  { q: 'Можно ли управлять проектами с телефона?', a: 'Да. Все действия в Telegram-боте автоматически отображаются в веб-кабинете и наоборот.' },
  { q: 'Куда поступают фотоотчёты?', a: 'Фото сохраняются в общей базе данных. При одобрении организатором волонтёры получают уведомления в Telegram.' },
];

// Computed
const isAuthenticated = computed(() => authStore.isAuthenticated);
const user = computed(() => authStore.user);
const isOrganizer = computed(() => {
  const u = user.value;
  return !!u && 
    (u.role === 'organizer' || u.is_organizer) && 
    u.organizer_status === 'approved';
});
const isVolunteer = computed(() => {
  return isAuthenticated.value && !isOrganizer.value;
});
const userName = computed(() => {
  return user.value?.full_name || user.value?.username || '';
});

const dashboardRoute = computed(() => {
  return isOrganizer.value
    ? { name: 'organizer-dashboard' }
    : { name: 'volunteer-dashboard' };
});

// Conditions for conditional rendering
const showRegistrationCTA = computed(() => !isAuthenticated.value);
const showDashboardLink = computed(() => isAuthenticated.value);
const showPersonalizedGreeting = computed(() => isAuthenticated.value && !!userName.value);

// Initialize auth and check if user should be redirected
onMounted(async () => {
  isLoading.value = true;
  try {
    if (!authStore.initialized) {
      await authStore.initialize();
    }
    
    // Optional: Redirect authenticated users to dashboard
    // Раскомментируйте, если нужен автоматический редирект:
    // if (authStore.isAuthenticated) {
    //   router.push(dashboardRoute.value);
    //   return;
    // }
    
    // Set page title and meta
    document.title = 'BirQadam — Один шаг навстречу возможностям';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Платформа для волонтёров и организаторов. Находите проекты, берите задачи, меняйте мир рядом с вами — прямо из браузера.');
    }
    
    // Setup scroll animations after DOM is ready
    await nextTick();
    setupScrollAnimations();
  } catch (error) {
    console.error('Failed to initialize:', error);
  } finally {
    isLoading.value = false;
  }
});

// Scroll animations with Intersection Observer
function setupScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in-visible');
      }
    });
  }, observerOptions);

  // Observe sections
  const sections = document.querySelectorAll('.how, .split, .faq-s, .quote-band');
  sections.forEach(section => {
    section.classList.add('fade-in');
    observer.observe(section);
  });
}

// FAQ toggle handler with keyboard support
function toggleFaq(index: number, event?: KeyboardEvent) {
  if (event && event.key !== 'Enter' && event.key !== ' ') {
    return;
  }
  if (event) {
    event.preventDefault();
  }
  openFaq.value = openFaq.value === index ? null : index;
}
</script>

<template>
  <div class="hv">

    <!-- ════════════════════════════════
         HERO
    ════════════════════════════════ -->
    <section class="hero">
      <!-- Photo collage background -->
      <div class="hero__bg">
        <div class="hero__photo hero__photo--1" />
        <div class="hero__photo hero__photo--2" />
        <div class="hero__photo hero__photo--3" />
        <div class="hero__photo hero__photo--4" />
        <div class="hero__overlay" />
      </div>

      <div class="hero__inner">

        <!-- Eyebrow -->
        <div class="hero__eyebrow" style="display: none;">
          <svg class="hero__leaf" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          BirQadam · Казахстан
        </div>

        <!-- Headline -->
        <h1 class="hero__h1">
          <template v-if="showPersonalizedGreeting">
            Добро пожаловать, {{ userName }}!<br />
            <em class="hero__em">продолжайте менять мир</em>
          </template>
          <template v-else>
            Один шаг —<br />
            <em class="hero__em">навстречу возможностям</em>
          </template>
        </h1>

        <p class="hero__p">
          <template v-if="isAuthenticated">
            <template v-if="isOrganizer">
              Управляйте проектами, модереруйте фотоотчёты и общайтесь с командой волонтёров.
            </template>
            <template v-else>
              Находите проекты, берите задачи и загружайте фотоотчёты прямо из браузера.
            </template>
          </template>
          <template v-else>
            Платформа для волонтёров и организаторов. Находите проекты, берите задачи,
            меняйте мир рядом с вами — прямо из браузера.
          </template>
        </p>

        <!-- CTA row -->
        <div class="hero__cta">
          <!-- Для неавторизованных пользователей -->
          <template v-if="showRegistrationCTA">
            <RouterLink to="/register/volunteer" class="cta-btn cta-btn--primary" aria-label="Зарегистрироваться как волонтёр">
              Стать волонтёром
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </RouterLink>
            <RouterLink to="/register/organizer" class="cta-btn cta-btn--ghost" aria-label="Зарегистрироваться как организатор">
              Я организатор
            </RouterLink>
          </template>
          
          <!-- Для авторизованных пользователей -->
          <template v-if="showDashboardLink">
            <RouterLink :to="dashboardRoute" class="cta-btn cta-btn--primary" aria-label="Перейти в кабинет">
              <template v-if="isOrganizer">Мой кабинет организатора</template>
              <template v-else>Мой кабинет волонтёра</template>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </RouterLink>
            <RouterLink to="/login" class="cta-btn cta-btn--ghost" aria-label="Выйти из аккаунта" v-if="false">
              Выйти
            </RouterLink>
          </template>
        </div>

        <!-- Trust row -->
        <div class="hero__trust" style="display: none;">
          <div class="trust-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2"/></svg>
            Проверенные проекты
          </div>
          <span class="trust-dot">·</span>
          <div class="trust-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20.6 4.1L2.8 10.8c-1.2.5-1.2 1.2-.2 1.5l4.5 1.4 1.7 5.2c.2.6.5.8 1 .8.4 0 .6-.2.9-.5l2.2-2.1 4.5 3.3c.8.5 1.4.2 1.6-.8l2.9-13.7c.3-1.2-.5-1.8-1.3-1.8z" fill="currentColor"/></svg>
            Синхронизация с Telegram
          </div>
          <span class="trust-dot">·</span>
          <div class="trust-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Задачи в реальном времени
          </div>
        </div>

      </div>
    </section>

    <!-- ════════════════════════════════
         HOW IT WORKS
    ════════════════════════════════ -->
    <section class="how" style="display: none;">
      <div class="how__inner">

        <div class="section-eyebrow">Как это работает</div>
        <h2 class="section-h2">Три шага —<br />и вы меняете мир</h2>

        <div class="how__grid">

          <div class="how-card how-card--1">
            <div class="how-card__num">01</div>
            <div class="how-card__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <path d="M20 8v6M23 11h-6"/>
              </svg>
            </div>
            <h3 class="how-card__title">Зарегистрируйтесь</h3>
            <p class="how-card__desc">Создайте аккаунт за одну минуту — как волонтёр или организатор. Никаких лишних форм.</p>
          </div>

          <div class="how-card how-card--2">
            <div class="how-card__num">02</div>
            <div class="how-card__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.6 4.1L2.8 10.8c-1.2.5-1.2 1.2-.2 1.5l4.5 1.4 1.7 5.2c.2.6.5.8 1 .8.4 0 .6-.2.9-.5l2.2-2.1 4.5 3.3c.8.5 1.4.2 1.6-.8l2.9-13.7c.3-1.2-.5-1.8-1.3-1.8z"/>
              </svg>
            </div>
            <h3 class="how-card__title">Свяжите Telegram</h3>
            <p class="how-card__desc">Введите <code>/link</code> в боте BirQadam. Теперь данные синхронизируются автоматически везде.</p>
          </div>

          <div class="how-card how-card--3">
            <div class="how-card__num">03</div>
            <div class="how-card__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3 class="how-card__title">Помогайте</h3>
            <p class="how-card__desc">Берите задачи, загружайте фотоотчёты, общайтесь с командой и видьте результат своего труда.</p>
          </div>

        </div>
      </div>
    </section>

    <!-- ════════════════════════════════
         FEATURES SPLIT
    ════════════════════════════════ -->
    <section class="split">
      <div class="split__inner">

        <!-- For volunteers -->
        <div class="split__half split__half--light">
          <div class="split__tag split__tag--green">Для волонтёров</div>
          <h3 class="split__h3">Ваш вклад — на виду</h3>
          <p class="split__p">Личный дашборд с рейтингом, история выполненных задач, фотоотчёты и уведомления о новых проектах рядом с вами.</p>
          <ul class="split__list">
            <li>
              <div class="split__check">✓</div>
              <span>Просмотр и фильтрация открытых задач</span>
            </li>
            <li>
              <div class="split__check">✓</div>
              <span>Принятие задач в один клик</span>
            </li>
            <li>
              <div class="split__check">✓</div>
              <span>Загрузка фотоотчётов прямо из браузера</span>
            </li>
            <li>
              <div class="split__check">✓</div>
              <span>Личный рейтинг и достижения</span>
            </li>
          </ul>
          <RouterLink 
            v-if="showRegistrationCTA"
            to="/register/volunteer" 
            class="cta-btn cta-btn--green" 
            aria-label="Стать волонтёром"
          >
            Стать волонтёром →
          </RouterLink>
          <RouterLink 
            v-else-if="isVolunteer"
            :to="dashboardRoute" 
            class="cta-btn cta-btn--green" 
            aria-label="Перейти в кабинет волонтёра"
          >
            Открыть мой кабинет →
          </RouterLink>
        </div>

        <!-- Divider leaf -->
        <div class="split__divider">
          <div class="split__divider-line" />
          <div class="split__divider-leaf">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
          </div>
          <div class="split__divider-line" />
        </div>

        <!-- For organizers -->
        <div class="split__half split__half--dark">
          <div class="split__tag split__tag--lime">Для организаторов</div>
          <h3 class="split__h3 split__h3--light">Управляйте командой легко</h3>
          <p class="split__p split__p--dim">Полный контроль над проектами: создание задач, модерация фотоотчётов, чат с командой и детальная аналитика.</p>
          <ul class="split__list split__list--light">
            <li>
              <div class="split__check split__check--lime">✓</div>
              <span>Создание проектов и назначение задач</span>
            </li>
            <li>
              <div class="split__check split__check--lime">✓</div>
              <span>Модерация фотоотчётов волонтёров</span>
            </li>
            <li>
              <div class="split__check split__check--lime">✓</div>
              <span>Встроенный чат с командой</span>
            </li>
            <li>
              <div class="split__check split__check--lime">✓</div>
              <span>Аналитика и статистика проектов</span>
            </li>
          </ul>
          <RouterLink 
            v-if="showRegistrationCTA"
            to="/register/organizer" 
            class="cta-btn cta-btn--lime" 
            aria-label="Организовывать проект"
          >
            Организовывать проект →
          </RouterLink>
          <RouterLink 
            v-else-if="isOrganizer"
            :to="dashboardRoute" 
            class="cta-btn cta-btn--lime" 
            aria-label="Перейти в кабинет организатора"
          >
            Открыть мой кабинет →
          </RouterLink>
        </div>

      </div>
    </section>

    <!-- ════════════════════════════════
         QUOTE BAND
    ════════════════════════════════ -->
    <section class="quote-band">
      <div class="quote-band__inner">
        <div class="quote-band__leaf">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          </svg>
        </div>
        <blockquote class="quote-band__q">
          «Один человек не может изменить мир, но может изменить мир для одного человека.»
        </blockquote>
        <div class="quote-band__author">BirQadam — шаг навстречу</div>
      </div>
    </section>

    <!-- ════════════════════════════════
         FAQ
    ════════════════════════════════ -->
    <section class="faq-s">
      <div class="faq-s__inner">
        <div class="section-eyebrow">Вопросы и ответы</div>
        <h2 class="section-h2">Всё, что нужно знать</h2>

        <div class="faq-list" role="list">
          <div
            v-for="(item, i) in faqs"
            :key="i"
            class="faq-item"
            :class="{ 'faq-item--open': openFaq === i }"
            role="listitem"
            :aria-expanded="openFaq === i"
            tabindex="0"
            @click="toggleFaq(i)"
            @keydown="toggleFaq(i, $event)"
          >
            <div class="faq-item__row">
              <div class="faq-item__num">{{ String(i + 1).padStart(2, '0') }}</div>
              <span class="faq-item__q">{{ item.q }}</span>
              <div class="faq-item__ico" :class="{ 'faq-item__ico--open': openFaq === i }" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              </div>
            </div>
            <div class="faq-item__a" :class="{ 'faq-item__a--show': openFaq === i }" role="region">
              {{ item.a }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ════════════════════════════════
         FINAL CTA
    ════════════════════════════════ -->
    <section class="final-cta">
      <div class="final-cta__bg">
        <!-- Illustrated hills SVG -->
        <svg class="final-cta__hills" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 220 Q180 120 360 200 Q540 280 720 180 Q900 80 1080 160 Q1260 240 1440 140 L1440 320 L0 320Z" fill="rgba(255,255,255,0.04)"/>
          <path d="M0 280 Q200 200 400 250 Q600 300 800 240 Q1000 180 1200 230 Q1350 265 1440 220 L1440 320 L0 320Z" fill="rgba(255,255,255,0.06)"/>
        </svg>
      </div>
      <div class="final-cta__inner">
        <h2 class="final-cta__h2">Готовы сделать<br /><span class="final-cta__accent">первый шаг?</span></h2>
        <p class="final-cta__sub">Присоединяйтесь к волонтёрам и организаторам</p>
        <div class="final-cta__btns">
          <template v-if="showRegistrationCTA">
            <RouterLink to="/register/volunteer" class="cta-btn cta-btn--white" aria-label="Стать волонтёром">
              Стать волонтёром
            </RouterLink>
            <RouterLink to="/register/organizer" class="cta-btn cta-btn--outline-w" aria-label="Организовать проект">
              Организовать проект
            </RouterLink>
          </template>
          <template v-else>
            <RouterLink :to="dashboardRoute" class="cta-btn cta-btn--white" aria-label="Перейти в кабинет">
              <template v-if="isOrganizer">Открыть кабинет организатора</template>
              <template v-else>Открыть кабинет волонтёра</template>
            </RouterLink>
            <RouterLink to="/" class="cta-btn cta-btn--outline-w" aria-label="Остаться на главной">
              Остаться на главной
            </RouterLink>
          </template>
        </div>
        <p class="final-cta__note">Бесплатно · Без скрытых условий · Синхронизировано с Telegram</p>
      </div>
    </section>

  </div>
</template>

<style scoped>
/* ════════════════════════════════════
   TOKENS
════════════════════════════════════ */
.hv {
  --green:      #3d7a2f;
  --green-mid:  #5a9e47;
  --green-lt:   #8bc34a;
  --green-pale: #e8f5e2;
  --lime:       #b8e04a;
  --earth:      #6b4c2a;
  --cream:      #faf8f3;
  --ink:        #1a2018;
  --ink-2:      rgba(26,32,24,0.55);
  --white:      #ffffff;
  --r:          20px;
  font-family: 'Lora', 'Georgia', serif;   /* warm editorial serif for headings */
  background: var(--cream);
  overflow-x: hidden;
}

/* Utility */
.section-eyebrow {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--green-mid);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-eyebrow::before { content: ''; width: 18px; height: 2px; background: var(--green-lt); border-radius: 2px; flex-shrink: 0; }

.section-h2 {
  font-size: clamp(1.9rem, 3.5vw, 2.8rem);
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 48px;
  line-height: 1.15;
  font-style: italic;
}

/* CTA buttons */
.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 26px;
  border-radius: 100px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  font-weight: 800;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
  cursor: pointer;
  border: none;
  letter-spacing: 0.01em;
  outline: none;
}
.cta-btn:hover { transform: translateY(-2px); }
.cta-btn:focus-visible { 
  outline: 2px solid var(--green);
  outline-offset: 2px;
}

.cta-btn--primary {
  background: var(--green);
  color: #fff;
  box-shadow: 0 8px 24px rgba(61,122,47,0.35);
}
.cta-btn--primary:hover { background: #2e6323; box-shadow: 0 12px 32px rgba(61,122,47,0.45); }

.cta-btn--ghost {
  background: rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.9);
  border: 1.5px solid rgba(255,255,255,0.3);
}
.cta-btn--ghost:hover { background: rgba(255,255,255,0.25); }

.cta-btn--green {
  background: var(--green-pale);
  color: var(--green);
  border: 1.5px solid rgba(61,122,47,0.2);
}
.cta-btn--green:hover { background: #d6eecb; }

.cta-btn--lime {
  background: var(--lime);
  color: var(--ink);
  box-shadow: 0 6px 20px rgba(184,224,74,0.35);
}
.cta-btn--lime:hover { background: #c8f052; }

.cta-btn--white {
  background: #fff;
  color: var(--green);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}
.cta-btn--white:hover { background: var(--green-pale); }

.cta-btn--outline-w {
  background: transparent;
  color: rgba(255,255,255,0.88);
  border: 1.5px solid rgba(255,255,255,0.35);
}
.cta-btn--outline-w:hover { background: rgba(255,255,255,0.1); }

/* ════════════════════════════════════
   HERO
════════════════════════════════════ */
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
  background: var(--green);
}

/* Photo collage mosaic */
.hero__bg {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.hero__photo {
  background-size: cover;
  background-position: center;
  opacity: 0.45;
  transition: opacity 0.3s;
}

.hero__photo--1 {
  background-image: url('https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80');
  grid-row: 1; grid-column: 1;
}
.hero__photo--2 {
  background-image: url('https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80');
  grid-row: 1; grid-column: 2;
}
.hero__photo--3 {
  background-image: url('https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80');
  grid-row: 2; grid-column: 1;
}
.hero__photo--4 {
  background-image: url('https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80');
  grid-row: 2; grid-column: 2;
}

.hero__overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 70% at 40% 50%, rgba(26,60,18,0.88) 0%, rgba(26,60,18,0.6) 60%, rgba(26,60,18,0.3) 100%);
}

.hero__inner {
  position: relative;
  z-index: 2;
  max-width: 700px;
  margin: 0 auto;
  padding: 0 28px;
  text-align: center;
  color: #fff;
}

.hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.65);
  margin-bottom: 24px;
  animation: up 0.6s ease both;
}

.hero__leaf { 
  width: 16px; 
  height: 16px; 
  color: rgba(255,255,255,0.65);
  animation: sway 3s ease-in-out infinite; 
}
@keyframes sway { 0%,100%{transform:rotate(-5deg);}50%{transform:rotate(5deg);} }

.hero__h1 {
  font-size: clamp(2.6rem, 6vw, 5rem);
  font-weight: 700;
  font-style: italic;
  line-height: 1.1;
  color: #fff;
  margin: 0 0 20px;
  animation: up 0.6s ease 0.1s both;
}

.hero__em {
  font-style: normal;
  background: linear-gradient(135deg, #b8e04a, #8bc34a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: block;
}

.hero__p {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.05rem;
  line-height: 1.7;
  color: rgba(255,255,255,0.72);
  max-width: 520px;
  margin: 0 auto 34px;
  animation: up 0.6s ease 0.2s both;
}

.hero__cta {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 36px;
  animation: up 0.6s ease 0.3s both;
}

.hero__trust {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  animation: up 0.6s ease 0.4s both;
}

.trust-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(255,255,255,0.5);
}

.trust-dot { color: rgba(255,255,255,0.25); }

@keyframes up { from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);} }

/* ════════════════════════════════════
   SCROLL ANIMATIONS
════════════════════════════════════ */
.fade-in {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.fade-in-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ════════════════════════════════════
   HOW IT WORKS
════════════════════════════════════ */
.how {
  background: var(--cream);
  padding: 96px 0;
}

.how__inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 28px;
}

.how__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.how-card {
  border-radius: var(--r);
  padding: 32px 28px;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s, box-shadow 0.25s;
}
.how-card:hover { transform: translateY(-5px); }

.how-card--1 { background: var(--white); border: 1px solid rgba(0,0,0,0.07); }
.how-card--2 { background: var(--green); color: #fff; margin-top: -16px; }
.how-card--3 { background: var(--green-pale); border: 1px solid rgba(61,122,47,0.15); }

.how-card__num {
  font-family: 'DM Sans', sans-serif;
  font-size: 3.5rem;
  font-weight: 900;
  color: rgba(0,0,0,0.05);
  line-height: 1;
  position: absolute;
  top: 16px; right: 20px;
}
.how-card--2 .how-card__num { color: rgba(255,255,255,0.08); }

.how-card__icon { 
  width: 48px; 
  height: 48px; 
  margin-bottom: 16px; 
  display: flex; 
  align-items: center; 
  justify-content: center;
  color: var(--green);
}
.how-card--2 .how-card__icon { color: rgba(255,255,255,0.9); }
.how-card--3 .how-card__icon { color: var(--green-mid); }

.how-card__title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 10px;
}
.how-card--2 .how-card__title { color: #fff; }

.how-card__desc {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.875rem;
  color: var(--ink-2);
  line-height: 1.65;
  margin: 0;
}
.how-card--2 .how-card__desc { color: rgba(255,255,255,0.65); }
.how-card__desc code {
  font-family: 'Fira Code', monospace;
  background: rgba(139,195,74,0.15);
  color: var(--green-lt);
  padding: 1px 6px;
  border-radius: 5px;
  font-size: 0.9em;
}
.how-card--2 .how-card__desc code { background: rgba(255,255,255,0.12); color: var(--lime); }

/* ════════════════════════════════════
   SPLIT
════════════════════════════════════ */
.split {
  background: var(--white);
  padding: 96px 0;
}

.split__inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 28px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0;
  align-items: center;
}

.split__half {
  padding: 48px 40px;
  border-radius: var(--r);
}

.split__half--light {
  background: var(--cream);
  border: 1px solid rgba(0,0,0,0.07);
}

.split__half--dark {
  background: var(--ink);
}

.split__divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 0 24px;
}

.split__divider-line {
  width: 1px;
  height: 80px;
  background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.12), transparent);
}

.split__divider-leaf { 
  width: 24px; 
  height: 24px; 
  color: var(--green-mid);
  display: flex;
  align-items: center;
  justify-content: center;
}

.split__tag {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  padding: 4px 10px;
  border-radius: 100px;
  margin-bottom: 14px;
  display: inline-block;
}
.split__tag--green { background: var(--green-pale); color: var(--green); }
.split__tag--lime  { background: rgba(184,224,74,0.15); color: var(--lime); border: 1px solid rgba(184,224,74,0.25); }

.split__h3 {
  font-size: 1.5rem;
  font-weight: 700;
  font-style: italic;
  color: var(--ink);
  margin: 0 0 12px;
  line-height: 1.2;
}
.split__h3--light { color: #fff; }

.split__p {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.875rem;
  color: var(--ink-2);
  line-height: 1.65;
  margin: 0 0 24px;
}
.split__p--dim { color: rgba(255,255,255,0.48); }

.split__list {
  list-style: none;
  padding: 0; margin: 0 0 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.split__list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.875rem;
  color: var(--ink-2);
}
.split__list--light li { color: rgba(255,255,255,0.55); }

.split__check {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: rgba(61,122,47,0.12);
  color: var(--green);
  font-size: 0.75rem;
  font-weight: 900;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.split__check--lime { background: rgba(184,224,74,0.12); color: var(--lime); }

/* ════════════════════════════════════
   QUOTE BAND
════════════════════════════════════ */
.quote-band {
  background: var(--green-pale);
  border-top: 1px solid rgba(61,122,47,0.12);
  border-bottom: 1px solid rgba(61,122,47,0.12);
  padding: 56px 0;
}

.quote-band__inner {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 28px;
  text-align: center;
}

.quote-band__leaf { 
  width: 32px; 
  height: 32px; 
  color: var(--green);
  display: block; 
  margin: 0 auto 16px;
}

.quote-band__q {
  font-size: clamp(1.1rem, 2.5vw, 1.5rem);
  font-style: italic;
  font-weight: 600;
  color: var(--green);
  line-height: 1.55;
  margin: 0 0 16px;
}

.quote-band__author {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(61,122,47,0.5);
}

/* ════════════════════════════════════
   FAQ
════════════════════════════════════ */
.faq-s {
  background: var(--cream);
  padding: 96px 0;
}

.faq-s__inner {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 28px;
}

.faq-list { display: flex; flex-direction: column; gap: 8px; }

.faq-item {
  background: var(--white);
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.07);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
}
.faq-item--open { border-color: rgba(61,122,47,0.3); box-shadow: 0 4px 16px rgba(61,122,47,0.08); }
.faq-item:hover { border-color: rgba(61,122,47,0.18); }
.faq-item:focus-visible { 
  outline: 2px solid var(--green);
  outline-offset: 2px;
}

.faq-item__row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
}

.faq-item__num {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.7rem;
  font-weight: 900;
  color: var(--green-lt);
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.faq-item__q {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.925rem;
  font-weight: 700;
  color: var(--ink);
  flex: 1;
  line-height: 1.4;
}

.faq-item__ico {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: rgba(0,0,0,0.05);
  display: flex; align-items: center; justify-content: center;
  color: rgba(0,0,0,0.35);
  flex-shrink: 0;
  transition: transform 0.3s, background 0.2s, color 0.2s;
}
.faq-item__ico--open { transform: rotate(180deg); background: rgba(61,122,47,0.1); color: var(--green); }

.faq-item__a {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease, padding 0.3s;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.875rem;
  color: var(--ink-2);
  line-height: 1.7;
  padding: 0 20px 0 48px;
}
.faq-item__a--show { max-height: 200px; padding: 0 20px 18px 48px; }

/* ════════════════════════════════════
   FINAL CTA
════════════════════════════════════ */
.final-cta {
  position: relative;
  background: linear-gradient(160deg, #1a3a10 0%, #2d5a1b 50%, #1a4012 100%);
  padding: 110px 0;
  overflow: hidden;
  text-align: center;
}

.final-cta__bg { position: absolute; inset: 0; pointer-events: none; }

.final-cta__hills {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  width: 100%;
  height: 200px;
}


.final-cta__inner {
  position: relative;
  z-index: 2;
  max-width: 640px;
  margin: 0 auto;
  padding: 0 28px;
}

.final-cta__h2 {
  font-size: clamp(2.2rem, 5vw, 3.6rem);
  font-weight: 700;
  font-style: italic;
  color: #fff;
  line-height: 1.1;
  margin: 0 0 16px;
}

.final-cta__accent {
  background: linear-gradient(135deg, var(--lime), #8bc34a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-style: normal;
}

.final-cta__sub {
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  color: rgba(255,255,255,0.55);
  margin: 0 0 36px;
  line-height: 1.6;
}

.final-cta__btns {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.final-cta__note {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.3);
  margin: 0;
  letter-spacing: 0.3px;
}

/* ════════════════════════════════════
   RESPONSIVE
════════════════════════════════════ */
@media (max-width: 960px) {
  .how__grid { grid-template-columns: 1fr; }
  .how-card--2 { margin-top: 0; }

  .split__inner {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .split__divider { flex-direction: row; padding: 16px 0; }
  .split__divider-line { width: 80px; height: 1px; background: linear-gradient(to right, transparent, rgba(0,0,0,0.1), transparent); }
  .split__half { padding: 32px 24px; }
}

@media (max-width: 600px) {
  .hero__h1 { font-size: 2.4rem; }
  .hero__trust { gap: 10px; }
  .trust-dot { display: none; }
  .trust-item { font-size: 0.72rem; }

  .section-h2 { font-size: 1.8rem; margin-bottom: 32px; }

  .how { padding: 64px 0; }
  .split { padding: 64px 0; }
  .faq-s { padding: 64px 0; }
  .final-cta { padding: 72px 0; }

  .faq-item__a--show { padding: 0 16px 16px; }
  .faq-item__row { padding: 16px; }
}
</style>