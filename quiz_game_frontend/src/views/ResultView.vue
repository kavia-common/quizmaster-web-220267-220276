<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'

const router = useRouter()
const quiz = useQuizStore()

const summary = computed(() => {
  const total = quiz.total
  const score = quiz.score
  const pct = total ? Math.round((score / total) * 100) : 0
  return { total, score, pct }
})

function restart() {
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
