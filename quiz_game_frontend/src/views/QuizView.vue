<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import QuizHeader from '@/components/QuizHeader.vue'
import QuestionCard from '@/components/QuestionCard.vue'
import CountdownOverlay from '@/components/CountdownOverlay.vue'

const router = useRouter()
const quiz = useQuizStore()

// Show countdown if navigated from a fresh start (query flag) and not resuming
const showCountdown = ref<boolean>(false)
const isFreshSession = computed(() => {
  const q = router.currentRoute.value.query
  const raw = q?.startWithCountdown
  // normalize value to string for safe comparisons (handle array case)
  const v = Array.isArray(raw) ? raw[0] : raw
  const s = typeof v === 'string' ? v : String(v ?? '')
  // Accept '1' or 'true' (case-insensitive)
  return s === '1' || s.toLowerCase() === 'true'
})

// Typed category label map to satisfy strict TS indexing
const categoryMap: Record<'gk'|'sports'|'movies'|'science'|'history'|'geography', string> = {
  gk: 'General Knowledge',
  sports: 'Sports',
  movies: 'Movies',
  science: 'Science',
  history: 'History',
  geography: 'Geography'
}

let timerInterval: number | undefined

async function ensureHydrated() {
  // Try resume/hydrate if saved session exists and questions are empty
  if (!quiz.questions.length && quiz.hasSavedSession()) {
    await quiz.resumeIfAvailable()
  }
  if (!quiz.questions.length && !quiz.loading) {
    await quiz.loadQuestions()
  }

  // If this is a fresh start with countdown, delay ticking and qStartTs until overlay completes
  const shouldCountdown = isFreshSession.value && !quiz.hasSavedSession()
  showCountdown.value = !!shouldCountdown
  if (!shouldCountdown) {
    startTicking()
    const curId = quiz.current?.id
    if (curId != null && quiz.qStartTs[curId] == null) {
      quiz.qStartTs[curId] = Date.now()
    }
  }
}

function startTicking() {
  // Lightweight ticking each second only if timer is active
  stopTicking()
  timerInterval = window.setInterval(() => {
    if (quiz.timerState.remaining != null) {
      quiz.tickTimer(1)
    }
  }, 1000)
}
function stopTicking() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = undefined
  }
}

/**
 * Handle countdown completion: stamp start time, start ticking, hide overlay, and strip query flag.
 */
function onCountdownComplete() {
  const curId = quiz.current?.id
  if (curId != null && quiz.qStartTs[curId] == null) {
    quiz.qStartTs[curId] = Date.now()
  }
  startTicking()
  showCountdown.value = false
  const q = { ...router.currentRoute.value.query }
  delete (q as Record<string, unknown>).startWithCountdown
  router.replace({ query: q })
}

function handleSubmitOrNext() {
  if (quiz.hasSubmitted) {
    if (!quiz.nextQuestion()) {
      stopTicking()
      router.push({ name: 'results' })
    } else {
      // continue ticking for next question
      startTicking()
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

function lifelineFifty() {
  quiz.useFiftyFifty()
}
function lifelineSkip() {
  const { ok } = quiz.useSkipQuestion()
  if (ok) {
    // immediately go to next or results
    if (quiz.isLast) {
      // persist end and go to results
      stopTicking()
      router.push({ name: 'results' })
    } else {
      quiz.nextQuestion()
      startTicking()
    }
  }
}
function lifelineExtra() {
  quiz.useExtraTime()
  startTicking()
}
function lifelineHint() {
  quiz.useAskHint()
}

onMounted(() => {
  ensureHydrated()
  window.addEventListener('keydown', handleKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKey)
  stopTicking()
})
</script>

<template>
  <div class="stack-xl">
    <QuizHeader
      :current="quiz.currentIndex"
      :total="quiz.total"
      :score="quiz.score"
      :category-label="categoryMap[quiz.selectedCategory as 'gk'|'sports'|'movies'|'science'|'history'|'geography']"
      :remaining-seconds="quiz.timerState.remaining ?? null"
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

    <CountdownOverlay
      v-if="showCountdown"
      @complete="onCountdownComplete"
    />

    <!-- Lifelines -->
    <div class="lifelines card" role="group" aria-label="Lifelines">
      <div class="lifelines-row">
        <button
          class="btn btn-secondary"
          :class="{ 'btn-disabled': quiz.lifelines.fiftyFiftyUsed }"
          :disabled="quiz.lifelines.fiftyFiftyUsed"
          @click="lifelineFifty"
          aria-label="Use 50-50 to remove two incorrect options"
          title="50-50: remove two wrong options"
        >
          50-50
        </button>

        <button
          class="btn btn-secondary"
          :class="{ 'btn-disabled': quiz.lifelines.skipUsed }"
          :disabled="quiz.lifelines.skipUsed"
          @click="lifelineSkip"
          aria-label="Skip this question"
          title="Skip question (no penalty)"
        >
          Skip
        </button>

        <button
          class="btn btn-secondary"
          :class="{ 'btn-disabled': quiz.lifelines.extraTimeUsed }"
          :disabled="quiz.lifelines.extraTimeUsed"
          @click="lifelineExtra"
          aria-label="Add extra time for this question"
          title="Extra time (+15s)"
        >
          +15s
        </button>

        <button
          class="btn btn-secondary"
          :class="{ 'btn-disabled': quiz.lifelines.askHintUsed }"
          :disabled="quiz.lifelines.askHintUsed"
          @click="lifelineHint"
          aria-label="Reveal a hint"
          title="Ask for a hint"
        >
          Hint
        </button>
      </div>
      <p class="lifeline-hint">Each lifeline can be used once per quiz.</p>
    </div>

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
        @click="handleSubmitOrNext"
      >
        Submit
      </button>

      <button
        v-else
        class="btn btn-primary"
        @click="handleSubmitOrNext"
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

/* Lifelines styling matching Ocean Professional theme */
.lifelines {
  padding: .75rem;
}
.lifelines-row {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
}
.lifeline-hint {
  margin-top: .35rem;
  font-size: .85rem;
  color: var(--muted);
}
</style>
