<script setup lang="ts">
import { ref } from 'vue';
import type { PublicVolunteerReview } from '@/services/webPortal';
import { formatPublicDateLong } from '@/utils/publicVolunteer';

defineProps<{
  review: PublicVolunteerReview;
}>();

const imageError = ref(false);
</script>

<template>
  <article class="review-card">
    <header class="review-card__head">
      <div class="review-card__org">
        <div class="review-card__logo">
          <img
            v-if="review.organizer_avatar_url && !imageError"
            :src="review.organizer_avatar_url"
            :alt="review.organization_name"
            @error="imageError = true"
          />
          <span v-else>{{ review.organization_name.charAt(0).toUpperCase() }}</span>
        </div>
        <div>
          <h3 class="review-card__org-name">{{ review.organization_name }}</h3>
          <p class="review-card__project">{{ review.project_title }}</p>
        </div>
      </div>
      <time class="review-card__date">{{ formatPublicDateLong(review.created_at) }}</time>
    </header>

    <div class="review-card__rating" aria-label="Оценка">
      <svg
        v-for="i in 5"
        :key="i"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        :fill="i <= review.rating ? '#f5a623' : 'none'"
        :stroke="i <= review.rating ? '#f5a623' : 'rgba(26,32,24,0.2)'"
        stroke-width="2"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    </div>

    <p class="review-card__text">{{ review.text }}</p>
  </article>
</template>

<style scoped>
.review-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(61, 122, 47, 0.08);
  box-shadow: 0 4px 20px rgba(26, 60, 18, 0.05);
}

.review-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}

.review-card__org {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.review-card__logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(61, 122, 47, 0.1);
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'DM Sans', sans-serif;
  font-weight: 800;
  color: #3d7a2f;
  font-size: 1.1rem;
}

.review-card__logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.review-card__org-name {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1a2018;
  margin: 0 0 2px;
  line-height: 1.3;
}

.review-card__project {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  color: rgba(26, 32, 24, 0.5);
  margin: 0;
}

.review-card__date {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  color: rgba(26, 32, 24, 0.45);
  white-space: nowrap;
  flex-shrink: 0;
}

.review-card__rating {
  display: flex;
  gap: 2px;
  margin-bottom: 12px;
}

.review-card__text {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  line-height: 1.65;
  color: rgba(26, 32, 24, 0.8);
  margin: 0;
  white-space: pre-wrap;
}
</style>
