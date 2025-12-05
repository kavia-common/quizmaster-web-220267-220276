<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'
import { useQuizStore } from '@/stores/quiz'

const router = useRouter()
const route = useRoute()
const t = useTournamentStore()
const quiz = useQuizStore()

const roundNumber = computed(() => t.currentRound + 1)
const difficulty = computed(() => t.difficultyCurve[Math.min(t.currentRound, t.difficultyCurve.length - 1)])

const miniSummaryVisible = ref(false)
const ariaLiveMsg = ref('')

async function startRound() {
  // If resuming mid-tournament, don't show countdown unless explicitly asked
  const showCountdown = route.query.startWithCountdown === '1'
  const set = await t.startNextRound()
  // hydrate quiz store runtime with questions for this round
  quiz.resetRuntime()
  quiz.questions.splice(0, quiz.questions.length, ...set.questions)
  // mark start timestamp for first question will be set by quiz.resetRuntime()
  if (showCountdown) {
    // navigate to same route to keep within wrapper; just use state for countdown overlays if any exist internally
  }
  ariaLiveMsg.value = `Round ${roundNumber.value} started. Difficulty ${difficulty.value}.`
}

function aggregateRound() {
  const totalQ = quiz.questions.length
  let correct = 0
  let wrong = 0
  let skipped = 0
  const durations: number[] = []
  for (let i = 0; i < totalQ; i++) {
    const q = quiz.questions[i]
    const sel = quiz.selectedAnswers[q.id]
    if (sel === 'SKIPPED') skipped += 1
    else if (typeof sel === 'number') {
      if (sel === q.answerIndex) correct += 1
      else wrong += 1
    }
    const st = quiz.qStartTs[q.id]
    const en = quiz.qEndTs[q.id]
    if (typeof st === 'number' && typeof en === 'number' && en >= st) {
      durations.push(en - st)
    }
  }
  return { correct, wrong, skipped, durations }
}

function handleNext() {
  // mirror QuizView auto flow: when last question is submitted, show mini summary
  if (quiz.isLast) {
    miniSummaryVisible.value = true
  } else {
    quiz.nextQuestion()
  }
}

function continueToNext() {
  // record stats
  const meta = aggregateRound()
  t.recordRoundResult(meta)
  ariaLiveMsg.value = `Round ${roundNumber.value} complete.`
  miniSummaryVisible.value = false
  // advance to next round or results
  if (t.currentRound >= t.roundsTotal - 1) {
    t.completeTournament()
    router.push({ name: 'tournament-results' })
  } else {
    // start next round
    startRound()
  }
}

onMounted(async () => {
  if (!t.loadIfAvailable()) {
    // no persisted; ensure state exists
    // stay here but redirect to lobby
    router.replace({ name: 'tournament-lobby' })
    return
  }
  if (!t.isActive) {
    router.replace({ name: 'tournament-lobby' })
    return
  }
  await startRound()
})

// Auto-next integration: when hasSubmitted flips true at last question, we can schedule show of summary
watch(() => quiz.hasSubmitted, (v) => {
  if (v && quiz.isLast) {
    // mimic auto-next in 2s to summary
    setTimeout(() => {
      miniSummaryVisible.value = true
    }, 2000)
  }
})
</script>

<template>
  <section class="play card">
    <div class="hdr">
      <h2 class="title">Tournament Round {{ roundNumber }} / {{ t.roundsTotal }}</h2>
      <div class="badges">
        <span class="chip" :class="difficulty">{{ difficulty.charAt(0).toUpperCase() + difficulty.slice(1) }}</span>
      </div>
    </div>

    <span class="sr-only" aria-live="polite">{{ ariaLiveMsg }}</span>

    <!-- Reuse QuestionCard-like UX via existing quiz store and components in QuizView.
         We render inline minimal controls around existing global components used in QuizView. -->
    <QuizHeader
      :current="quiz.currentIndex + 1"
      :total="quiz.total"
      :score="quiz.score"
      :categoryLabel="`${t.category === 'mixed' ? 'Mixed' : (t.category.toString().charAt(0).toUpperCase() + t.category.toString().slice(1))} • R${roundNumber}`"
      :remainingSeconds="quiz.timerState.remaining"
    />

    <QuestionCard
      v-if="quiz.current"
      :question="quiz.current"
      :selectedIndex="quiz.selectedIndex"
      :hasSubmitted="quiz.hasSubmitted"
      :fiftyFiftyHidden="quiz.fiftyFiftyHidden[quiz.current.id] || []"
      :hintShown="!!quiz.hintShown[quiz.current.id]"
      @select="quiz.selectOption"
      @submit="quiz.submitAnswer"
      @next="handleNext"
      @use-fifty-fifty="quiz.useFiftyFifty"
      @use-skip="quiz.useSkipQuestion"
      @use-extra-time="quiz.useExtraTime"
      @use-hint="quiz.useAskHint"
    />

    <!-- Mini summary when round finishes -->
    <div v-if="miniSummaryVisible" class="summary card" role="dialog" aria-modal="false" aria-label="Round summary">
      <h3 class="sum-title">Round {{ roundNumber }} Summary</h3>
      <p class="sum-sub">Great job! Continue to the next round.</p>
      <button class="btn btn-primary" @click="continueToNext">Continue</button>
    </div>
  </section>
</template>

<script lang="ts">
/** Register reused components from existing components folder */
import QuizHeader from '@/components/QuizHeader.vue'
import QuestionCard from '@/components/QuestionCard.vue'
export default {
  components: { QuizHeader, QuestionCard }
}
</script>

<style scoped>
.play { padding: 1rem; border: 1px solid #e5e7eb; background: #fff; }
.hdr { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-bottom: .5rem; }
.title { font-size: 1.25rem; font-weight: 800; color: #111827; }
.badges { display: inline-flex; gap: .35rem; }
.chip { padding: .1rem .5rem; border-radius: .5rem; border: 1px solid #e5e7eb; font-size: .75rem; }
.chip.easy { background: #ecfeff; color: #0369a1; border-color: #bae6fd; }
.chip.medium { background: #fff7ed; color: #b45309; border-color: #fde68a; }
.chip.hard { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.summary { margin-top: .75rem; padding: .75rem; border: 1px solid #e5e7eb; background: linear-gradient(90deg, rgba(37,99,235,.06), #fff); }
.sum-title { font-weight: 800; color: #111827; }
.sum-sub { color: #6b7280; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
