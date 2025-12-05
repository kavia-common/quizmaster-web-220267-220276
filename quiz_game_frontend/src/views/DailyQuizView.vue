<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDailyQuizStore } from '@/stores/dailyQuiz'
import { useQuizStore } from '@/stores/quiz'
import QuestionCard from '@/components/QuestionCard.vue'
import QuizHeader from '@/components/QuizHeader.vue'
import CountdownOverlay from '@/components/CountdownOverlay.vue'
import { useUiPreferencesStore } from '@/stores/uiPreferences'

const router = useRouter()
const daily = useDailyQuizStore()
const quiz = useQuizStore() // for addScore function reuse
const ui = useUiPreferencesStore()
const autoAria = ref<string>('') // aria-live polite message
let autoNextTimer: number | null = null
const autoCountdown = ref<number | null>(null)

function clearAutoNext() {
  if (autoNextTimer != null) {
    clearTimeout(autoNextTimer)
    autoNextTimer = null
  }
  autoCountdown.value = null
}
function cancelAutoNext() {
  clearAutoNext()
}
function scheduleAutoNext() {
  if (!ui.autoNextEnabled || !daily.hasSubmitted || showCountdown.value) return
  if (autoNextTimer != null) return
  autoCountdown.value = 2
  autoAria.value = daily.isLast ? 'Auto advancing to results in 2 seconds' : 'Auto advancing to next question in 2 seconds'
  const t0 = Date.now()
  const interval = window.setInterval(() => {
    if (autoCountdown.value == null) { clearInterval(interval); return }
    const elapsed = Math.floor((Date.now() - t0) / 1000)
    const remaining = Math.max(0, 2 - elapsed)
    autoCountdown.value = remaining
    if (remaining <= 0) clearInterval(interval)
  }, 250)
  autoNextTimer = window.setTimeout(() => {
    autoNextTimer = null
    autoCountdown.value = null
    if (daily.hasSubmitted) {
      if (!daily.nextQuestion()) {
        // complete and go results (same as manual path)
        daily.completeAndRecordScore(quiz.addScore)
        router.push({ name: 'results' })
      }
    }
  }, 2000)
}

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
  scheduleAutoNext()
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
  cancelAutoNext()
})

/**
 * Handle countdown complete in Daily mode: simply hide the overlay.
 */
function onCountdownComplete() {
  showCountdown.value = false
}

// Auto-next watchers
watch(
  () => daily.hasSubmitted,
  (submitted) => {
    if (submitted && !showCountdown.value) {
      nextTick(() => scheduleAutoNext())
    } else {
      cancelAutoNext()
    }
  }
)
watch(
  () => showCountdown.value,
  (shown) => {
    if (shown) cancelAutoNext()
  }
)
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
        @focus="cancelAutoNext"
        :aria-describedby="ui.autoNextEnabled && autoCountdown !== null ? 'daily-auto-next' : undefined"
      >
        {{ daily.isLast ? 'See Daily Results' : 'Continue' }}
      </button>
      <span
        v-if="ui.autoNextEnabled && autoCountdown !== null"
        id="daily-auto-next"
        class="auto-indicator"
        aria-live="polite"
      >
        Next in {{ autoCountdown }}…
      </span>
    </div>

    <span class="sr-only" aria-live="polite">{{ autoAria }}</span>

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
.auto-indicator { margin-left: .5rem; color: var(--muted); font-size: .9rem; }
.sr-only { position: absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip: rect(0,0,0,0); white-space:nowrap; border:0; }
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
