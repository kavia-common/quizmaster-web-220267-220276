<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import QuizHeader from '@/components/QuizHeader.vue'
import QuestionCard from '@/components/QuestionCard.vue'

const router = useRouter()
const quiz = useQuizStore()

async function ensureHydrated() {
  // Try resume/hydrate if saved session exists and questions are empty
  if (!quiz.questions.length && quiz.hasSavedSession()) {
    await quiz.resumeIfAvailable()
  }
  if (!quiz.questions.length && !quiz.loading) {
    await quiz.loadQuestions()
  }
}

function handleSubmitOrNext() {
  if (quiz.hasSubmitted) {
    if (!quiz.nextQuestion()) {
      router.push({ name: 'results' })
    }
    return
  }
  quiz.submitAnswer()
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    // Prevent submission if nothing selected
    if (quiz.selectedIndex === null && !quiz.hasSubmitted) return
    handleSubmitOrNext()
  }

  // Arrow key navigation across options
  if (!quiz.current || quiz.hasSubmitted) return
  const opts = quiz.current.options.length
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    const next = quiz.selectedIndex === null ? 0 : Math.min((quiz.selectedIndex + 1), opts - 1)
    quiz.selectOption(next)
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    const prev = quiz.selectedIndex === null ? 0 : Math.max((quiz.selectedIndex - 1), 0)
    quiz.selectOption(prev)
  }
}

function exitQuiz() {
  if (quiz.hasSavedSession()) {
    const ok = window.confirm('You have a saved session. Exit and return to start?')
    if (!ok) return
  }
  // keep session so user can resume later
  router.push({ name: 'start' })
}

onMounted(() => {
  ensureHydrated()
  window.addEventListener('keydown', handleKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKey)
})
</script>

<template>
  <div class="stack-xl">
    <QuizHeader
      :current="quiz.currentIndex"
      :total="quiz.total"
      :score="quiz.score"
      :category-label="{
        gk: 'General Knowledge',
        sports: 'Sports',
        movies: 'Movies',
        science: 'Science',
        history: 'History',
        geography: 'Geography'
      }[quiz.selectedCategory]"
    />

    <div class="save-indicator" role="status" aria-live="polite">
      <span class="dot" aria-hidden="true"></span>
      Progress auto-saved
    </div>

    <div v-if="quiz.loading" class="card loading">
      <p>Loading questions…</p>
    </div>
    <div v-else-if="quiz.error && !quiz.questions.length" class="card loading">
      <p>Error loading questions. Using fallback…</p>
    </div>

    <QuestionCard
      v-if="quiz.current"
      :question="quiz.current"
      :selected-index="quiz.selectedIndex"
      :has-submitted="quiz.hasSubmitted"
      @select="quiz.selectOption"
    />

    <div class="actions">
      <button
        class="btn btn-secondary"
        type="button"
        @click="exitQuiz"
      >
        Exit
      </button>

      <div class="spacer"></div>

      <button
        v-if="!quiz.hasSubmitted"
        class="btn btn-primary"
        :disabled="quiz.selectedIndex === null"
        @click="quiz.submitAnswer"
      >
        Submit
      </button>

      <button
        v-else
        class="btn btn-primary"
        @click="quiz.isLast ? $router.push({ name: 'results' }) : quiz.nextQuestion()"
      >
        {{ quiz.isLast ? 'See Results' : 'Continue' }}
      </button>
    </div>

    <p v-if="quiz.hasSubmitted" class="read-hint" aria-live="polite">
      Review the explanation above, then press Continue to proceed.
    </p>
  </div>
</template>

<style scoped>
.loading {
  padding: 1rem;
}
.actions {
  display: flex;
  align-items: center;
  gap: .75rem;
}
.spacer {
  flex: 1;
}
.save-indicator {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  font-size: .84rem;
  color: var(--muted);
  margin-top: -.25rem;
  margin-left: .25rem;
}
.dot {
  width: .5rem; height: .5rem; border-radius: 50%;
  background: var(--secondary);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, .18);
}
.read-hint {
  color: var(--muted);
  font-size: .9rem;
  margin-left: .25rem;
}
</style>
