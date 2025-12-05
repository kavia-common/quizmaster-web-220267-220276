<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useQuizStore, type CategoryKey } from '@/stores/quiz'
import { computed, ref } from 'vue'

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

const hasSession = computed(() => quiz.hasSavedSession())
const sessionProgress = computed(() => quiz.progress)
const sessionCategoryLabel = computed(() => ({
  gk: 'General Knowledge', sports: 'Sports', movies: 'Movies',
  science: 'Science', history: 'History', geography: 'Geography'
}[quiz.selectedCategory] || quiz.selectedCategory))

async function start() {
  if (hasSession.value) {
    const ok = window.confirm('Starting a new quiz will discard your saved progress. Continue?')
    if (!ok) return
    quiz.resetSession()
  }
  busy.value = true
  loadError.value = null
  quiz.resetRuntime()
  quiz.setCategory(picked.value)
  await quiz.loadQuestions()
  busy.value = false
  if (quiz.questions.length) {
    router.push({ name: 'quiz' })
  } else {
    loadError.value = 'No questions available.'
  }
}

async function resume() {
  const ok = await quiz.resumeIfAvailable()
  if (ok) {
    router.push({ name: 'quiz' })
  } else {
    // fallback: if resume failed, try normal start with current category
    await start()
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
        <button v-if="hasSession" class="btn btn-primary" @click="resume" :disabled="busy">
          Resume Quiz
          <span class="badge"> {{ sessionCategoryLabel }} • {{ sessionProgress }}% </span>
        </button>
        <button class="btn" :class="hasSession ? 'btn-secondary' : 'btn-primary'" @click="start" :disabled="busy">
          {{ busy ? 'Preparing…' : (hasSession ? 'Start New Quiz' : 'Start Quiz') }}
        </button>
        <button
          class="btn btn-secondary"
          @click="router.push({ name: 'scoreboard' })"
          :disabled="busy"
          title="View saved scores"
        >
          View Scoreboard
        </button>
        <button
          class="btn btn-secondary"
          @click="router.push({ name: 'mp-lobby' })"
          :disabled="busy"
          title="Play with friends (optional)"
          aria-label="Multiplayer lobby"
        >
          Multiplayer
        </button>
      </div>
      <p v-if="loadError" class="error">{{ loadError }}</p>

      <p class="hint-save" aria-live="polite">
        <span class="dot" aria-hidden="true"></span>
        Progress auto-saved
      </p>
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
  flex-wrap: wrap;
}
.error {
  color: var(--error);
}
.badge {
  margin-left: .5rem;
  padding: .1rem .5rem;
  font-size: .75rem;
  font-weight: 700;
  color: var(--primary);
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
}
.hint-save {
  margin-top: .25rem;
  font-size: .85rem;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .4rem;
}
.dot {
  width: .5rem; height: .5rem; border-radius: 50%;
  background: var(--secondary);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, .18);
}
</style>
