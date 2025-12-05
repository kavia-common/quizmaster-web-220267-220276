<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { onMounted, ref } from 'vue'

const router = useRouter()
const quiz = useQuizStore()
const busy = ref(false)
const loadError = ref<string | null>(null)

async function start() {
  busy.value = true
  loadError.value = null
  quiz.resetAll()
  await quiz.loadQuestions()
  busy.value = false
  if (quiz.questions.length) {
    router.push({ name: 'quiz' })
  } else {
    loadError.value = 'No questions available.'
  }
}

onMounted(() => {
  // Pre-warm question loading for faster start, but we still reset on explicit start
})
</script>

<template>
  <section class="hero card">
    <div class="hero-inner">
      <h2 class="hero-title">Welcome to QuizMaster</h2>
      <p class="hero-sub">Sharpen your mind and challenge yourself with quick questions.</p>
      <div class="hero-actions">
        <button class="btn btn-primary" @click="start" :disabled="busy">
          {{ busy ? 'Preparing…' : 'Start Quiz' }}
        </button>
        <button class="btn btn-secondary" @click="router.push({ name: 'quiz' })" :disabled="busy" title="Quick start (uses previous questions if loaded)">
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
  max-width: 720px;
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
.hero-actions {
  display: flex;
  gap: .75rem;
  justify-content: center;
}
.error {
  color: var(--error);
}
</style>
