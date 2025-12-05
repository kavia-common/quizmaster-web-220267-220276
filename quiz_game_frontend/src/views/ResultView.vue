<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'

const router = useRouter()
const quiz = useQuizStore()

const categoryLabels: Record<string, string> = {
  gk: 'General Knowledge',
  sports: 'Sports',
  movies: 'Movies',
  science: 'Science',
  history: 'History',
  geography: 'Geography',
}

const summary = computed(() => {
  const total = quiz.total
  const score = quiz.score
  const pct = total ? Math.round((score / total) * 100) : 0
  return { total, score, pct }
})

onMounted(() => {
  // Save score once when arriving on results screen
  // Ask for a quick name/initials prompt; fallback to Anonymous
  try {
    const storedOnce = (sessionStorage.getItem('results:saved') || '0') === '1'
    if (!storedOnce && summary.value.total > 0) {
      const input = window.prompt('Enter your name/initials to save your score (optional):', '')
      quiz.addScore({
        player: input ?? '',
        score: summary.value.score,
        total: summary.value.total,
        category: quiz.selectedCategory,
        categoryLabel: categoryLabels[quiz.selectedCategory] || quiz.selectedCategory,
      })
      sessionStorage.setItem('results:saved', '1')
    }
  } catch {
    // ignore if sessionStorage not available
  }
  // clear in-progress session once results are recorded to avoid resuming a completed quiz
  try {
    quiz.clearSession()
  } catch {}
})

function restart() {
  // clear the session flag so next completion saves again
  try { sessionStorage.removeItem('results:saved') } catch {}
  quiz.resetAll()
  router.push({ name: 'start' })
}
</script>

<template>
  <section class="card results">
    <div class="results-inner">
      <h2 class="title">Results</h2>
      <p class="desc">You answered {{ summary.score }} out of {{ summary.total }} correctly.</p>
      <div class="meter">
        <div class="meter-fill" :style="{ width: summary.pct + '%' }"></div>
      </div>
      <div class="pct">{{ summary.pct }}%</div>

      <div class="buttons">
        <button class="btn btn-primary" @click="restart">Restart</button>
        <button class="btn btn-secondary" @click="$router.push({ name: 'quiz' })">Review</button>
        <button class="btn btn-secondary" @click="$router.push({ name: 'scoreboard' })">View Scoreboard</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.results {
  padding: 2rem 1.5rem;
}
.results-inner {
  display: grid;
  gap: .75rem;
  text-align: center;
  max-width: 640px;
  margin: 0 auto;
}
.title {
  font-size: 1.5rem;
  font-weight: 800;
}
.desc {
  color: var(--muted);
}
.meter {
  height: 12px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
  margin-top: .5rem;
}
.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), #60a5fa);
  transition: width .3s ease;
}
.pct {
  font-weight: 800;
  color: var(--primary);
  margin-top: .25rem;
}
.buttons {
  display: flex;
  gap: .75rem;
  justify-content: center;
  margin-top: .5rem;
}
</style>
