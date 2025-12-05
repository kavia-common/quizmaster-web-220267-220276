<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useQuizStore, type CategoryKey } from '@/stores/quiz'
import { ref } from 'vue'

const router = useRouter()
const quiz = useQuizStore()
const busy = ref(false)
const loadError = ref<string | null>(null)
const categories: { key: CategoryKey; label: string; emoji: string; hint: string }[] = [
  { key: 'gk', label: 'General Knowledge', emoji: '🧠', hint: 'A bit of everything' },
  { key: 'sports', label: 'Sports', emoji: '🏅', hint: 'Games and records' },
  { key: 'movies', label: 'Movies', emoji: '🎬', hint: 'Cinema & film trivia' },
  { key: 'science', label: 'Science', emoji: '🔬', hint: 'Facts & discoveries' },
  { key: 'history', label: 'History', emoji: '🏛️', hint: 'Past events & figures' },
  { key: 'geography', label: 'Geography', emoji: '🗺️', hint: 'World & places' },
]
const picked = ref<CategoryKey>(quiz.selectedCategory ?? 'gk')

async function start() {
  busy.value = true
  loadError.value = null
  quiz.resetAll()
  quiz.setCategory(picked.value)
  await quiz.loadQuestions()
  busy.value = false
  if (quiz.questions.length) {
    router.push({ name: 'quiz' })
  } else {
    loadError.value = 'No questions available.'
  }
}
</script>

<template>
  <section class="hero card">
    <div class="hero-inner">
      <h2 class="hero-title">Welcome to QuizMaster</h2>
      <p class="hero-sub">Choose a category to begin your journey.</p>

      <div class="grid">
        <button
          v-for="c in categories"
          :key="c.key"
          class="category"
          :class="{ active: picked === c.key }"
          @click="picked = c.key"
          :aria-pressed="picked === c.key"
        >
          <div class="cat-emoji" aria-hidden="true">{{ c.emoji }}</div>
          <div class="cat-info">
            <div class="cat-label">{{ c.label }}</div>
            <div class="cat-hint">{{ c.hint }}</div>
          </div>
        </button>
      </div>

      <div class="hero-actions">
        <button class="btn btn-primary" @click="start" :disabled="busy">
          {{ busy ? 'Preparing…' : 'Start Quiz' }}
        </button>
        <button
          class="btn btn-secondary"
          @click="router.push({ name: 'quiz' })"
          :disabled="busy"
          title="Quick start (uses previous questions if loaded)"
        >
          Quick Start
        </button>
      </div>
      <p v-if="loadError" class="error">{{ loadError }}</p>
    </div>
  </section>
</template>

<style scoped>
.hero {
  padding: 2rem 1.5rem;
  background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(249,250,251,1));
  border: 1px solid #e5e7eb;
}
.hero-inner {
  display: grid;
  gap: 1rem;
  text-align: center;
  max-width: 880px;
  margin: 0 auto;
}
.hero-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text);
}
.hero-sub {
  color: var(--muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: .75rem;
  margin: .5rem 0 0.25rem;
}
.category {
  display: flex;
  align-items: center;
  gap: .75rem;
  background: var(--surface);
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: .75rem .9rem;
  text-align: left;
  cursor: pointer;
  transition: all .2s ease;
}
.category:hover { background: #f9fafb; }
.category.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--ring);
}
.cat-emoji {
  font-size: 1.4rem;
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center; 
  justify-content: center;
  background: #fff;
  border-radius: .75rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 1px 1px rgba(0,0,0,0.04);
}
.cat-info {
  display: grid;
  gap: .125rem;
}
.cat-label {
  font-weight: 700;
  color: var(--text);
}
.cat-hint {
  color: var(--muted);
  font-size: .85rem;
}

.hero-actions {
  display: flex;
  gap: .75rem;
  justify-content: center;
}
.error {
  color: var(--error);
}
</style>
