<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDailyQuizStore } from '@/stores/dailyQuiz'
import { useQuizStore } from '@/stores/quiz'
import QuestionCard from '@/components/QuestionCard.vue'
import QuizHeader from '@/components/QuizHeader.vue'
import CountdownOverlay from '@/components/CountdownOverlay.vue'

const router = useRouter()
const daily = useDailyQuizStore()
const quiz = useQuizStore() // for addScore function reuse

const showCountdown = ref<boolean>(false)
const isFreshSession = computed(() => {
  const q = router.currentRoute.value.query
  return q && q.startWithCountdown === '1'
})

let sparkleTimer: number | undefined
const showConfetti = ref(false)

async function ensureDaily() {
  // Resume first if possible; else prepare
  const resumed = await daily.resumeIfAvailable()
  if (!resumed) {
    await daily.prepareToday(null, 10)
    // show countdown only for fresh daily start (not resume)
    const shouldCountdown = isFreshSession.value
    showCountdown.value = !!shouldCountdown
    // remove the flag immediately from URL to avoid later re-use
    if (shouldCountdown) {
      const q = { ...router.currentRoute.value.query }
      delete (q as Record<string, unknown>).startWithCountdown
      router.replace({ query: q })
    }
  } else {
    showCountdown.value = false
  }
}

function handleSubmitOrNext() {
  if (daily.hasSubmitted) {
    if (!daily.nextQuestion()) {
      // complete: record score and go to Daily Results (reusing results route)
      // Add to scoreboard with 'daily' meta and compute streak/rewards
      daily.completeAndRecordScore(quiz.addScore)
      // quick celebratory effect
      showConfetti.value = true
      sparkleTimer = window.setTimeout(() => {
        showConfetti.value = false
        router.push({ name: 'results' })
      }, 800)
    }
    return
  }
  daily.submitAnswer()
}

function exitDaily() {
  if (daily.hasSavedDaily()) {
    const ok = window.confirm('You have an in-progress daily attempt. Exit? You can resume later today.')
    if (!ok) return
  }
  router.push({ name: 'start' })
}

onMounted(() => {
  ensureDaily()
})

onBeforeUnmount(() => {
  if (sparkleTimer) clearTimeout(sparkleTimer)
})

/**
 * Handle countdown complete in Daily mode: simply hide the overlay.
 */
function onCountdownComplete() {
  showCountdown.value = false
}
</script>

<template>
  <div class="stack-xl">
    <QuizHeader
      :current="daily.currentIndex"
      :total="daily.total"
      :score="daily.score"
      :category-label="'Daily'"
      :remaining-seconds="null"
    />

    <div class="save-indicator" role="status" aria-live="polite">
      <span class="dot" aria-hidden="true"></span>
      Daily progress auto-saved
    </div>

    <div v-if="daily.loading" class="card loading">
      <p>Loading daily questions…</p>
    </div>
    <div v-else-if="daily.error && !daily.questions.length" class="card loading">
      <p>Error loading daily. Please try again.</p>
    </div>

    <QuestionCard
      v-if="daily.current"
      :question="daily.current"
      :selected-index="daily.selectedIndex"
      :has-submitted="daily.hasSubmitted"
      @select="daily.selectOption"
    />

    <CountdownOverlay
      v-if="showCountdown"
      @complete="onCountdownComplete"
    />

    <div class="lifelines card" role="group" aria-label="Daily Lifelines">
      <div class="lifelines-row">
        <button
          class="btn btn-secondary"
          :class="{ 'btn-disabled': daily.lifelines.fiftyFiftyUsed }"
          :disabled="daily.lifelines.fiftyFiftyUsed"
          @click="daily.useFiftyFifty"
          aria-label="Use 50-50 to remove two incorrect options"
          title="50-50: remove two wrong options"
        >
          50-50
        </button>

        <button
          class="btn btn-secondary"
          :class="{ 'btn-disabled': daily.lifelines.skipUsed }"
          :disabled="daily.lifelines.skipUsed"
          @click="() => { if (daily.useSkipQuestion().ok) { daily.hasSubmitted = true; handleSubmitOrNext() } }"
          aria-label="Skip this question"
          title="Skip question (no penalty)"
        >
          Skip
        </button>

        <button
          class="btn btn-secondary"
          :class="{ 'btn-disabled': daily.lifelines.askHintUsed }"
          :disabled="daily.lifelines.askHintUsed"
          @click="daily.useAskHint"
          aria-label="Reveal a hint"
          title="Ask for a hint"
        >
          Hint
        </button>
      </div>
      <p class="lifeline-hint">Lifelines are available once per daily attempt.</p>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" type="button" @click="exitDaily">Exit</button>
      <div class="spacer"></div>
      <button
        v-if="!daily.hasSubmitted"
        class="btn btn-primary"
        :disabled="daily.selectedIndex === null"
        @click="handleSubmitOrNext"
      >
        Submit
      </button>
      <button
        v-else
        class="btn btn-primary"
        @click="handleSubmitOrNext"
      >
        {{ daily.isLast ? 'See Daily Results' : 'Continue' }}
      </button>
    </div>

    <transition name="pop">
      <div v-if="showConfetti" class="celebrate" role="status" aria-live="assertive">
        🎉 Streak updated! 🎉
      </div>
    </transition>
  </div>
</template>

<style scoped>
.loading { padding: 1rem; }
.actions { display: flex; align-items: center; gap: .75rem; }
.spacer { flex: 1; }
.save-indicator { display: inline-flex; align-items: center; gap: .4rem; font-size: .84rem; color: var(--muted); margin-top: -.25rem; margin-left: .25rem; }
.dot { width: .5rem; height: .5rem; border-radius: 50%; background: var(--secondary); box-shadow: 0 0 0 3px rgba(245, 158, 11, .18); }
.lifelines { padding: .75rem; }
.lifelines-row { display: flex; flex-wrap: wrap; gap: .5rem; }
.lifeline-hint { margin-top: .35rem; font-size: .85rem; color: var(--muted); }

/* celebration */
.celebrate {
  position: fixed;
  left: 50%;
  top: 12%;
  transform: translateX(-50%);
  background: #fff;
  color: var(--secondary);
  border: 1px solid #fde68a;
  border-radius: .75rem;
  padding: .5rem .75rem;
  box-shadow: 0 10px 30px rgba(37,99,235,.15);
  font-weight: 800;
}
.pop-enter-active, .pop-leave-active { transition: all .3s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translate(-50%, -8px); }
</style>
