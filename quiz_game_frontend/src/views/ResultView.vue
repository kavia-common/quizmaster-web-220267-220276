<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { useCategoryUnlockStore } from '@/stores/categoryUnlocks'

type DailyMetaRecord = {
  mode: 'daily'
  dateKey: string
  streakAtCompletion: number
  rewards: string[]
} | null

const router = useRouter()
const quiz = useQuizStore()
const unlocks = useCategoryUnlockStore()

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

const quickAvgTime = computed(() => {
  // approximate average time per answered from current session analytics (if present in store)
  const ids = quiz.questions.map((q: { id: string | number }) => q.id)
  const durations: number[] = []
  for (const id of ids) {
    const st = quiz.qStartTs[id]
    const en = quiz.qEndTs[id]
    if (typeof st === 'number' && typeof en === 'number' && en >= st) {
      durations.push(en - st)
    }
  }
  if (!durations.length) return null
  const avg = durations.reduce((a,b)=>a+b,0) / durations.length
  return Math.round(avg)
})

const lastRecord = computed(() => {
  const list = quiz.listScores()
  return list.length ? list[0] : null
})
const dailyMeta = computed<DailyMetaRecord>(() => {
  const meta = lastRecord.value?.meta as unknown
  if (meta && typeof meta === 'object' && (meta as { mode?: string }).mode === 'daily') {
    const m = meta as { mode: 'daily'; dateKey: string; streakAtCompletion: number; rewards: string[] }
    return {
      mode: 'daily',
      dateKey: String(m.dateKey),
      streakAtCompletion: Number(m.streakAtCompletion || 0),
      rewards: Array.isArray(m.rewards) ? m.rewards.map(String) : [],
    }
  }
  return null
})
const isDaily = computed(() => dailyMeta.value !== null)

// New UI state for unlock celebration and motivation
import type { CategoryKey } from '@/stores/quiz'
const newlyUnlocked = ref<Array<CategoryKey>>([])
const showCongrats = ref(false)
const encouragement = computed(() => {
  // If user scored below 80 and there is a next locked path, show motivational message
  const pct = summary.value.pct
  if (pct >= 80) return null
  // Find a next target based on prerequisites: pick first category whose prereqs include current category and is still locked
  const nextTargets = (Object.entries(unlocks.state.prerequisites) as Array<[CategoryKey, CategoryKey[]]>)
    .filter(([cat, deps]) => deps.includes(quiz.selectedCategory) && !unlocks.isUnlocked(cat))
    .map(([cat]) => cat)
  if (!nextTargets.length) return null
  const next = nextTargets[0]
  const prereqLabel = categoryLabels[quiz.selectedCategory] || String(quiz.selectedCategory)
  return `You're close! Score 80% in ${prereqLabel} to unlock ${categoryLabels[next]}. Try lifelines and explanations to improve!`
})

onMounted(() => {
  unlocks.loadUnlocks()
  // Save score once when arriving on results screen
  // Ask for a quick name/initials prompt; fallback to Anonymous
  try {
    const storedOnce = (sessionStorage.getItem('results:saved') || '0') === '1'
    if (!storedOnce && summary.value.total > 0 && !isDaily.value) {
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

  // Evaluate unlocks using this session accuracy
  try {
    const mode: 'normal' | 'daily' | 'multiplayer' = isDaily.value ? 'daily' : 'normal'
    const list = unlocks.evaluateUnlocksFromScore({
      category: quiz.selectedCategory,
      accuracyPercent: summary.value.pct,
      mode,
    }) as Array<CategoryKey>
    newlyUnlocked.value = list
    showCongrats.value = list.length > 0
  } catch {
    // ignore unlock evaluation errors
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

function tryNow(cat: CategoryKey) {
  // Start a new quiz immediately in the newly unlocked category
  quiz.resetAll()
  quiz.setCategory(cat)
  router.push({ name: 'quiz' })
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

      <!-- Celebration banner for new unlocks -->
      <transition name="fade">
        <div
          v-if="showCongrats && newlyUnlocked.length"
          class="unlock-banner"
          role="status"
          aria-live="assertive"
        >
          🎉 New category unlocked: <strong>{{ categoryLabels[newlyUnlocked[0]] }}</strong>! Keep going!
          <button class="btn btn-primary btn-xs" @click="tryNow(newlyUnlocked[0])" aria-label="Try the newly unlocked category now">
            Try now
          </button>
        </div>
      </transition>

      <!-- Motivation message when under threshold -->
      <div v-if="encouragement" class="motivate card" role="note" aria-live="polite">
        <span class="m-emoji" aria-hidden="true">💡</span>
        <div class="m-text">
          {{ encouragement }}
          <div class="m-ctas">
            <button class="btn btn-secondary btn-xs" @click="$router.push({ name: 'quiz' })">Review Explanations</button>
            <button class="btn btn-secondary btn-xs" @click="restart">Retry</button>
          </div>
        </div>
      </div>

      <div
        v-if="isDaily && dailyMeta"
        class="daily-results card"
        role="status"
        aria-live="polite"
      >
        <h3 class="daily-title">Daily Results</h3>
        <p class="daily-sub">
          Completed <strong>{{ dailyMeta.dateKey }}</strong> • Streak:
          <span class="streak-pill">🔥 {{ dailyMeta.streakAtCompletion }}</span>
        </p>
        <div v-if="(dailyMeta.rewards || []).length" class="rewards">
          <span class="reward" v-for="(r, i) in dailyMeta.rewards" :key="i" :aria-label="`Unlocked badge ${r}`" title="Unlocked badge">
            🏅 {{ r }}
          </span>
        </div>
      </div>

      <div class="quick row" role="status" aria-live="polite">
        <span class="pill">Accuracy {{ summary.pct }}%</span>
        <span class="pill" v-if="quickAvgTime != null">Avg {{ (quickAvgTime/1000).toFixed(1) }}s</span>
      </div>

      <div class="buttons">
        <button class="btn btn-primary" @click="restart">Restart</button>
        <button class="btn btn-secondary" @click="$router.push({ name: 'quiz' })">Review</button>
        <button class="btn btn-secondary" @click="$router.push({ name: 'scoreboard' })">View Scoreboard</button>
        <button class="btn btn-secondary" @click="$router.push({ name: 'analytics' })">View Analytics</button>
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
.unlock-banner {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  padding: .4rem .6rem;
  border-radius: .75rem;
  border: 1px solid #93c5fd;
  background: linear-gradient(90deg, rgba(37,99,235,.08), rgba(255,255,255,1));
  color: #1e3a8a;
  font-weight: 800;
  justify-content: center;
  box-shadow: 0 10px 30px rgba(37,99,235,.08);
}
.motivate {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: .5rem;
  align-items: center;
  padding: .6rem .75rem;
  border: 1px solid #fde68a;
  border-radius: .75rem;
  background: linear-gradient(90deg, rgba(245,158,11,.12), rgba(255,255,255,1));
  color: #92400e;
}
.m-emoji { font-size: 1.25rem; }
.m-text { text-align: left; }
.m-ctas { display: flex; gap: .5rem; margin-top: .35rem; flex-wrap: wrap; }

.buttons {
  display: flex;
  gap: .75rem;
  justify-content: center;
  margin-top: .5rem;
}
.quick.row {
  display: flex;
  gap: .5rem;
  justify-content: center;
  margin-top: .4rem;
}
.pill {
  display: inline-flex;
  align-items: center;
  padding: .15rem .5rem;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  color: var(--primary);
  font-weight: 700;
  font-size: .75rem;
}

.daily-results {
  padding: 1rem;
  margin-top: .5rem;
  border: 1px solid #e5e7eb;
  border-radius: .75rem;
  background: linear-gradient(135deg, rgba(245,158,11,.08), rgba(249,250,251,1));
  text-align: center;
}
.daily-title { font-weight: 800; color: var(--text); }
.daily-sub { color: var(--muted); }
.streak-pill {
  display: inline-flex;
  align-items: center;
  padding: .1rem .5rem;
  border-radius: 999px;
  border: 1px solid #fde68a;
  background: linear-gradient(90deg, rgba(245,158,11,.12), rgba(255,255,255,1));
  color: var(--secondary);
  font-weight: 700;
  font-size: .8rem;
}
.rewards {
  display: flex;
  gap: .5rem;
  justify-content: center;
  margin-top: .5rem;
  flex-wrap: wrap;
}
.reward {
  display: inline-flex;
  align-items: center;
  padding: .15rem .5rem;
  border-radius: .6rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  color: var(--text);
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 1px 1px rgba(0,0,0,.04);
}
.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
