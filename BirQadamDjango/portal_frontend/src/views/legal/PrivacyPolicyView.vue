<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { privacyPolicyMeta, privacyPolicySections } from '@/content/privacyPolicyRu';
</script>

<template>
  <div class="legal">
    <div class="legal__inner">
      <nav class="legal__nav">
        <RouterLink to="/" class="legal__back">← На главную</RouterLink>
        <RouterLink to="/terms" class="legal__other">Пользовательское соглашение →</RouterLink>
      </nav>

      <h1 class="legal__title">{{ privacyPolicyMeta.title }}</h1>
      <p class="legal__meta">{{ privacyPolicyMeta.updated }}</p>

      <section v-for="(sec, i) in privacyPolicySections" :key="i" class="legal__section">
        <h2 class="legal__h2">{{ sec.title }}</h2>
        <p v-for="(p, j) in sec.paragraphs || []" :key="'p' + j" class="legal__p">{{ p }}</p>
        <ul v-if="sec.bullets?.length" class="legal__ul">
          <li v-for="(b, k) in sec.bullets" :key="'b' + k">{{ b }}</li>
        </ul>
      </section>

      <div class="legal__footer-block">
        <p class="legal__muted">Мы в соцсетях и на сайте</p>
        <a class="legal__link" href="https://birqadam.almau.edu.kz/portal/" target="_blank" rel="noopener noreferrer">
          Веб-портал BirQadam
        </a>
        <p class="legal__version">{{ privacyPolicyMeta.version }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.legal {
  min-height: 100vh;
  background: linear-gradient(180deg, #f7f9f5 0%, #fff 40%);
  padding: clamp(1.25rem, 4vw, 2.5rem) 1rem 3rem;
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
}
.legal__inner {
  max-width: 42rem;
  margin: 0 auto;
}
.legal__nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  font-weight: 700;
}
.legal__back,
.legal__other {
  color: #3d7a1a;
  text-decoration: none;
}
.legal__back:hover,
.legal__other:hover {
  text-decoration: underline;
}
.legal__title {
  margin: 0 0 0.35rem;
  font-size: clamp(1.35rem, 3vw, 1.75rem);
  font-weight: 900;
  color: #111a0e;
  letter-spacing: -0.02em;
}
.legal__meta {
  margin: 0 0 1.75rem;
  font-size: 0.875rem;
  color: rgba(17, 26, 14, 0.5);
}
.legal__section {
  margin-bottom: 1.5rem;
}
.legal__h2 {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
  font-weight: 800;
  color: #1a2e12;
}
.legal__p {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  line-height: 1.65;
  color: rgba(17, 26, 14, 0.78);
}
.legal__ul {
  margin: 0;
  padding-left: 1.15rem;
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(17, 26, 14, 0.78);
}
.legal__ul li {
  margin-bottom: 0.35rem;
}
.legal__footer-block {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(61, 122, 26, 0.15);
  text-align: center;
}
.legal__muted {
  margin: 0 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(17, 26, 14, 0.45);
}
.legal__link {
  display: inline-block;
  font-weight: 700;
  color: #3d7a1a;
  text-decoration: none;
}
.legal__link:hover {
  text-decoration: underline;
}
.legal__version {
  margin: 1rem 0 0;
  font-size: 0.8rem;
  color: rgba(17, 26, 14, 0.4);
}
</style>
