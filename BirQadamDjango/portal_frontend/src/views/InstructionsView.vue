<script setup lang="ts">
import { RouterLink } from 'vue-router';

const steps = [
  {
    n: '01',
    icon: 'mdi-account-outline',
    title: 'Контактные данные',
    color: '#2e7d32',
    items: [
      { field: 'Полное имя', req: true, hint: 'Введите ФИО руководителя или ответственного лица организации. Например: Айгерим Жаксыбекова.' },
      { field: 'Контактное лицо', req: false, hint: 'Заполните, если контактное лицо отличается от ФИО руководителя.' },
      { field: 'Телефон', req: true, hint: 'Введите номер в формате +7 (700) 000-00-00. Это номер для связи с администратором.' },
      { field: 'Email', req: true, hint: 'Укажите рабочий email организации. На него придёт код подтверждения и уведомления о статусе заявки.' },
      { field: 'Пароль', req: true, hint: 'Минимум 8 символов. Рекомендуем использовать буквы, цифры и специальные символы.' },
    ],
  },
  {
    n: '02',
    icon: 'mdi-domain',
    title: 'Информация об организации',
    color: '#1565c0',
    items: [
      { field: 'Название организации', req: true, hint: 'Официальное название вашей НПО. Например: ОО «Даун Синдром» или ОФ «Күн Бала». Укажите полностью.' },
      { field: 'Описание деятельности', req: true, hint: 'Расскажите о миссии, направлениях работы и целевой аудитории вашей организации. Минимум 2–3 предложения.' },
      { field: 'Город', req: true, hint: 'Укажите город, в котором работает ваша организация. Например: Алматы.' },
      { field: 'Сайт или соцсети', req: false, hint: 'Укажите сайт или ссылку на Instagram/Facebook организации. Если сайта нет — поле можно оставить пустым.' },
    ],
  },
  {
    n: '03',
    icon: 'mdi-check-decagram-outline',
    title: 'Планируемые проекты',
    color: '#e65100',
    items: [
      { field: 'Планируемые проекты', req: false, hint: 'Опишите, какие волонтёрские мероприятия или акции вы планируете. Например: организация субботников, помощь детям с ОВЗ, экологические акции. Это поможет администратору быстрее одобрить вашу заявку.' },
    ],
  },
];

const afterSteps = [
  { icon: 'mdi-email-check-outline', title: 'Подтверждение email', desc: 'На указанный email придёт письмо с 6-значным кодом. Введите его в появившееся окно.' },
  { icon: 'mdi-clock-outline', title: 'Проверка модератором', desc: 'Администратор рассмотрит вашу заявку в течение 1–3 рабочих дней и свяжется с вами.' },
  { icon: 'mdi-check-circle-outline', title: 'Доступ к кабинету', desc: 'После одобрения вы получите полный доступ к созданию проектов и управлению волонтёрами.' },
];

const tips = [
  { icon: 'mdi-lightbulb-outline', text: 'Заполните описание как можно подробнее — это ускорит одобрение заявки.' },
  { icon: 'mdi-phone-outline', text: 'Укажите актуальный телефон: администратор может позвонить для уточнения деталей.' },
  { icon: 'mdi-web', text: 'Укажите сайт или соцсети — это повышает доверие к организации.' },
  { icon: 'mdi-translate', text: 'Название организации можно писать на русском или казахском языке.' },
];
</script>

<template>
  <div class="instr-root">

    <!-- Hero -->
    <div class="instr-hero">
      <div class="instr-hero__deco instr-hero__deco--1" />
      <div class="instr-hero__deco instr-hero__deco--2" />
      <div class="instr-hero__inner">
        <div class="instr-hero__badge">
          <v-icon size="14">mdi-book-open-outline</v-icon>
          Инструкция
        </div>
        <h1 class="instr-hero__h1">Как зарегистрироваться<br><em>организатором</em></h1>
        <p class="instr-hero__sub">
          Пошаговое руководство по заполнению формы регистрации НПО на платформе BirQadam.
          Регистрация займёт не более 5 минут.
        </p>
        <RouterLink to="/register/organizer" class="instr-hero__btn">
          <v-icon size="17">mdi-rocket-launch-outline</v-icon>
          Перейти к регистрации
        </RouterLink>
      </div>
    </div>

    <div class="instr-body">

      <!-- Steps -->
      <section class="instr-steps">
        <h2 class="instr-section-title">Три шага заполнения формы</h2>
        <p class="instr-section-sub">Форма разбита на три шага. Ниже — подробное описание каждого поля.</p>

        <div v-for="step in steps" :key="step.n" class="step-card">
          <div class="step-card__header" :style="{ background: step.color }">
            <div class="step-card__num">{{ step.n }}</div>
            <div class="step-card__icon-wrap">
              <v-icon size="22" color="white">{{ step.icon }}</v-icon>
            </div>
            <h3 class="step-card__title">{{ step.title }}</h3>
          </div>
          <div class="step-card__body">
            <div v-for="item in step.items" :key="item.field" class="field-row">
              <div class="field-row__name">
                {{ item.field }}
                <span v-if="item.req" class="field-row__req">*</span>
                <span v-else class="field-row__opt">(необязательно)</span>
              </div>
              <div class="field-row__hint">
                <v-icon size="14" class="field-row__hint-ico">mdi-information-outline</v-icon>
                {{ item.hint }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- After submit -->
      <section class="instr-after">
        <h2 class="instr-section-title">Что происходит после отправки</h2>
        <div class="after-grid">
          <div v-for="(item, i) in afterSteps" :key="i" class="after-card">
            <div class="after-card__num">{{ String(i + 1).padStart(2, '0') }}</div>
            <div class="after-card__icon-wrap">
              <v-icon size="22" color="#2e7d32">{{ item.icon }}</v-icon>
            </div>
            <h4 class="after-card__title">{{ item.title }}</h4>
            <p class="after-card__desc">{{ item.desc }}</p>
          </div>
        </div>
      </section>

      <!-- Tips -->
      <section class="instr-tips">
        <h2 class="instr-section-title">Советы для быстрого одобрения</h2>
        <div class="tips-grid">
          <div v-for="(tip, i) in tips" :key="i" class="tip-card">
            <div class="tip-card__icon">
              <v-icon size="20" color="#2e7d32">{{ tip.icon }}</v-icon>
            </div>
            <p class="tip-card__text">{{ tip.text }}</p>
          </div>
        </div>
      </section>

      <!-- Example data -->
      <section class="instr-example">
        <h2 class="instr-section-title">Пример заполнения для НПО</h2>
        <p class="instr-section-sub">Вы можете использовать этот пример как образец при заполнении формы.</p>

        <div class="example-card">
          <div class="example-card__header">
            <v-icon size="16" color="#2e7d32">mdi-file-document-edit-outline</v-icon>
            Пример — ОО «АРДИ»
          </div>
          <div class="example-grid">
            <div class="example-row">
              <span class="example-row__label">Полное имя</span>
              <span class="example-row__val">Ахатова Асия Акишевна</span>
            </div>
            <div class="example-row">
              <span class="example-row__label">Телефон</span>
              <span class="example-row__val">+7 (727) 292-48-99</span>
            </div>
            <div class="example-row">
              <span class="example-row__label">Email</span>
              <span class="example-row__val">asiya_ardi@mail.ru</span>
            </div>
            <div class="example-row">
              <span class="example-row__label">Название организации</span>
              <span class="example-row__val">ОО «АРДИ»</span>
            </div>
            <div class="example-row example-row--full">
              <span class="example-row__label">Описание деятельности</span>
              <span class="example-row__val">Ассоциация родителей детей-инвалидов «АРДИ» — первая НПО в Казахстане для детей и молодёжи с особенностями развития (ДЦП), основана в 1991 году. Предоставляем реабилитационные, образовательные и психологические услуги детям и их семьям.</span>
            </div>
            <div class="example-row">
              <span class="example-row__label">Город</span>
              <span class="example-row__val">Алматы</span>
            </div>
            <div class="example-row">
              <span class="example-row__label">Сайт</span>
              <span class="example-row__val">ardi.kz</span>
            </div>
            <div class="example-row example-row--full">
              <span class="example-row__label">Планируемые проекты</span>
              <span class="example-row__val">Проведение интенсивных программ физической реабилитации, организация инклюзивных творческих фестивалей и выставок, запуск программ ранней помощи детям с ДЦП.</span>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <div class="instr-cta">
        <h3 class="instr-cta__title">Готовы зарегистрироваться?</h3>
        <p class="instr-cta__sub">Форма занимает 5 минут. После одобрения вы сразу получите доступ к кабинету.</p>
        <div class="instr-cta__btns">
          <RouterLink to="/register/organizer" class="instr-cta__btn instr-cta__btn--primary">
            <v-icon size="18">mdi-domain</v-icon>
            Зарегистрировать организацию
          </RouterLink>
          <RouterLink to="/" class="instr-cta__btn instr-cta__btn--ghost">
            <v-icon size="16">mdi-arrow-left</v-icon>
            На главную
          </RouterLink>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ── Root ── */
.instr-root {
  min-height: 100vh;
  background: #f7f8f5;
  font-family: 'DM Sans', 'Inter', sans-serif;
}

/* ── Hero ── */
.instr-hero {
  background: linear-gradient(145deg, #1a5c1e 0%, #2e7d32 50%, #43a047 100%);
  padding: 72px 24px 80px;
  position: relative;
  overflow: hidden;
  text-align: center;
}
.instr-hero__deco {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.instr-hero__deco--1 {
  width: 400px; height: 400px;
  top: -150px; right: -100px;
  background: rgba(255,255,255,0.05);
}
.instr-hero__deco--2 {
  width: 250px; height: 250px;
  bottom: -80px; left: -60px;
  background: rgba(255,255,255,0.04);
}
.instr-hero__inner {
  position: relative;
  z-index: 2;
  max-width: 680px;
  margin: 0 auto;
}
.instr-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 100px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.88);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 20px;
}
.instr-hero__h1 {
  font-size: clamp(1.9rem, 4vw, 3rem);
  font-weight: 700;
  color: #fff;
  line-height: 1.15;
  margin: 0 0 18px;
}
.instr-hero__h1 em {
  font-style: italic;
  opacity: 0.88;
}
.instr-hero__sub {
  color: rgba(255,255,255,0.72);
  font-size: 1rem;
  line-height: 1.65;
  max-width: 520px;
  margin: 0 auto 32px;
}
.instr-hero__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 28px;
  border-radius: 100px;
  background: #fff;
  color: #2e7d32;
  font-weight: 800;
  font-size: 0.9rem;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 6px 24px rgba(0,0,0,0.2);
}
.instr-hero__btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 32px rgba(0,0,0,0.25);
}

/* ── Body ── */
.instr-body {
  max-width: 820px;
  margin: 0 auto;
  padding: 56px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 64px;
}

/* ── Section titles ── */
.instr-section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px;
}
.instr-section-sub {
  color: #888;
  font-size: 0.9rem;
  margin: 0 0 28px;
  line-height: 1.6;
}

/* ── Step cards ── */
.instr-steps {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.instr-steps .instr-section-title { margin-bottom: 8px; }

.step-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,0.07);
  overflow: hidden;
  box-shadow: 0 2px 16px rgba(0,0,0,0.05);
}
.step-card__header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 24px;
}
.step-card__num {
  font-size: 1.6rem;
  font-weight: 900;
  color: rgba(255,255,255,0.25);
  line-height: 1;
  flex-shrink: 0;
  min-width: 38px;
}
.step-card__icon-wrap {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: rgba(255,255,255,0.18);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.step-card__title {
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0;
}

.step-card__body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.field-row {
  padding: 14px 0;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.field-row:last-child { border-bottom: none; }

.field-row__name {
  font-size: 0.82rem;
  font-weight: 700;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.field-row__req {
  color: #e53935;
  font-weight: 900;
}
.field-row__opt {
  color: #aaa;
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}
.field-row__hint {
  font-size: 0.87rem;
  color: #666;
  line-height: 1.6;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.field-row__hint-ico {
  flex-shrink: 0;
  color: #2e7d32 !important;
  margin-top: 2px;
}

/* ── After steps ── */
.after-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.after-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px 20px;
  border: 1px solid rgba(0,0,0,0.07);
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  position: relative;
}
.after-card__num {
  position: absolute;
  top: 14px; right: 16px;
  font-size: 2rem;
  font-weight: 900;
  color: rgba(0,0,0,0.05);
  line-height: 1;
}
.after-card__icon-wrap {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: #f1f8e9;
  border: 1px solid rgba(46,125,50,0.15);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 14px;
}
.after-card__title {
  font-size: 0.97rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px;
}
.after-card__desc {
  font-size: 0.84rem;
  color: #777;
  line-height: 1.6;
  margin: 0;
}

/* ── Tips ── */
.tips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
}
.tip-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 16px 18px;
  border: 1px solid rgba(0,0,0,0.06);
  border-left: 3px solid #2e7d32;
}
.tip-card__icon {
  flex-shrink: 0;
  margin-top: 1px;
}
.tip-card__text {
  font-size: 0.87rem;
  color: #555;
  line-height: 1.6;
  margin: 0;
}

/* ── Example card ── */
.example-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(46,125,50,0.2);
  overflow: hidden;
  box-shadow: 0 2px 16px rgba(0,0,0,0.05);
}
.example-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 22px;
  background: #f1f8e9;
  font-size: 0.82rem;
  font-weight: 700;
  color: #2e7d32;
  border-bottom: 1px solid rgba(46,125,50,0.15);
}
.example-grid {
  padding: 16px 22px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}
.example-row {
  padding: 12px 0;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.example-row--full {
  grid-column: span 2;
}
.example-row__label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.example-row__val {
  font-size: 0.88rem;
  color: #333;
  font-weight: 500;
}

/* ── CTA ── */
.instr-cta {
  text-align: center;
  background: linear-gradient(135deg, #1a5c1e 0%, #2e7d32 100%);
  border-radius: 24px;
  padding: 48px 32px;
  color: #fff;
}
.instr-cta__title {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 12px;
  color: #fff;
}
.instr-cta__sub {
  color: rgba(255,255,255,0.72);
  margin: 0 0 30px;
  font-size: 0.95rem;
  line-height: 1.6;
}
.instr-cta__btns {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.instr-cta__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 26px;
  border-radius: 100px;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}
.instr-cta__btn:hover { transform: translateY(-2px); }
.instr-cta__btn--primary {
  background: #fff;
  color: #2e7d32;
  box-shadow: 0 6px 20px rgba(0,0,0,0.18);
}
.instr-cta__btn--ghost {
  background: rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.88);
  border: 1.5px solid rgba(255,255,255,0.25);
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .instr-body { padding: 36px 16px 60px; gap: 44px; }
  .example-grid { grid-template-columns: 1fr; }
  .example-row--full { grid-column: span 1; }
  .instr-cta { padding: 36px 20px; }
}
</style>
