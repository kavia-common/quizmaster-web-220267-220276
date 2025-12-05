import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuizQuestion, CategoryKey } from '@/stores/quiz'
import pools from '@/utils/pools'

/**
 * Daily quiz store handles:
 * - daily metadata: date key, deterministic seed, optional category
 * - persistence: lastPlayedDate, lastCompletedDate, streakCount, rewards history
 * - in-progress session for daily (compatible shape with quiz session + daily flag)
 * - deterministic question selection via seeded RNG from date/category
 * - rewards and streak calculation on completion
 */

type DailyMeta = {
  dailyDate: string // YYYY-MM-DD local
  dailySeed: string
  dailyCategory: CategoryKey | null
  rewardsEarned: string[]
  streakCount: number
}

type DailyPersistent = {
  version: number
  lastPlayedDate: string | null
  lastCompletedDate: string | null
  streakCount: number
  rewardsHistory: string[]
  // in-progress session pointer to separate key
}

type DailySessionSchema = {
  version: number
  mode: 'daily'
  dailyDate: string
  dailySeed: string
  dailyCategory: CategoryKey | null
  questions: QuizQuestion[]
  currentIndex: number
  selectedAnswers: Record<string | number, number | 'SKIPPED'>
  score: number
  startedAt: number
  updatedAt: number
  // reuse some lifelines-state interface from quiz store
  lifelines: {
    fiftyFiftyUsed: boolean
    skipUsed: boolean
    extraTimeUsed: boolean
    askHintUsed: boolean
  }
  fiftyFiftyHidden: Record<string | number, number[]>
  hintShown: Record<string | number, boolean>
}

type ScoreboardDailyMeta = {
  mode: 'daily'
  dateKey: string
  streakAtCompletion: number
  rewards: string[]
}

const DAILY_META_KEY = 'quizmaster:daily:meta' // persistent meta (last dates, streak)
const DAILY_SESSION_KEY = 'quizmaster:daily:session' // in-progress daily attempt
const DAILY_PERSIST_VERSION = 2
const DAILY_SESSION_VERSION = 2

function getTodayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function seededHash(str: string): number {
  // simple xorshift-like hash to seed RNG deterministically
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // avoid zero
  return (h >>> 0) || 1
}

function makeRng(seed: number) {
  let s = seed >>> 0
  return function next(): number {
    // xorshift32
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    // convert to [0,1)
    return ((s >>> 0) / 0xffffffff)
  }
}

// Deterministically pick N unique indices from an array
function pickDeterministic<T>(arr: T[], n: number, rng: () => number): T[] {
  const indices = arr.map((_, i) => i)
  // Partial Fisher-Yates using RNG
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const slice = indices.slice(0, Math.min(n, indices.length))
  return slice.map(i => arr[i])
}

// PUBLIC_INTERFACE
export const useDailyQuizStore = defineStore('dailyQuiz', () => {
  // runtime state for UI
  const questions = ref<QuizQuestion[]>([])
  const currentIndex = ref(0)
  const score = ref(0)
  const selectedIndex = ref<number | null>(null)
  const hasSubmitted = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // meta
  const dailyDate = ref<string>(getTodayKey())
  const dailySeed = ref<string>('') // computed from date/category
  const dailyCategory = ref<CategoryKey | null>(null)
  const rewardsEarned = ref<string[]>([])
  const streakCount = ref<number>(0)

  // per-question states
  const selectedAnswers = ref<Record<string | number, number | 'SKIPPED'>>({})
  const lifelines = ref({
    fiftyFiftyUsed: false,
    skipUsed: false,
    extraTimeUsed: false,
    askHintUsed: false,
  })
  const fiftyFiftyHidden = ref<Record<string | number, number[]>>({})
  const hintShown = ref<Record<string | number, boolean>>({})

  const total = computed(() => questions.value.length)
  const current = computed(() => questions.value[currentIndex.value] || null)
  const isLast = computed(() => currentIndex.value >= total.value - 1)

  function readPersist(): DailyPersistent {
    try {
      const raw = localStorage.getItem(DAILY_META_KEY)
      if (!raw) {
        return {
          version: DAILY_PERSIST_VERSION,
          lastPlayedDate: null,
          lastCompletedDate: null,
          streakCount: 0,
          rewardsHistory: [],
        }
      }
      const obj = JSON.parse(raw) as Partial<DailyPersistent>
      if (typeof obj !== 'object' || obj == null) throw new Error('bad meta')
      // migrate older
      const streak = typeof obj.streakCount === 'number' ? obj.streakCount : 0
      const rewardsHistory = Array.isArray(obj.rewardsHistory) ? obj.rewardsHistory.map(String) : []
      const lastPlayedDate = typeof obj.lastPlayedDate === 'string' ? obj.lastPlayedDate : (obj.lastPlayedDate ?? null) as string | null
      const lastCompletedDate = typeof obj.lastCompletedDate === 'string' ? obj.lastCompletedDate : (obj.lastCompletedDate ?? null) as string | null
      return {
        version: DAILY_PERSIST_VERSION,
        lastPlayedDate,
        lastCompletedDate,
        streakCount: streak,
        rewardsHistory,
      }
    } catch {
      return {
        version: DAILY_PERSIST_VERSION,
        lastPlayedDate: null,
        lastCompletedDate: null,
        streakCount: 0,
        rewardsHistory: [],
      }
    }
  }
  function writePersist(p: DailyPersistent) {
    try {
      localStorage.setItem(DAILY_META_KEY, JSON.stringify(p))
    } catch {
      // ignore quota
    }
  }

  function readSession(): DailySessionSchema | null {
    try {
      const raw = localStorage.getItem(DAILY_SESSION_KEY)
      if (!raw) return null
      const obj = JSON.parse(raw) as Partial<DailySessionSchema>
      if (!obj || typeof obj !== 'object') return null
      if (obj.version !== DAILY_SESSION_VERSION || obj.mode !== 'daily') return null
      if (!Array.isArray(obj.questions) || typeof obj.currentIndex !== 'number') return null
      return obj as DailySessionSchema
    } catch {
      return null
    }
  }
  function writeSession(s: DailySessionSchema | null) {
    try {
      if (!s) {
        localStorage.removeItem(DAILY_SESSION_KEY)
        return
      }
      localStorage.setItem(DAILY_SESSION_KEY, JSON.stringify(s))
    } catch {
      // ignore
    }
  }

  function buildSeed(dateKey: string, category: CategoryKey | null): string {
    return `${dateKey}::${category ?? 'any'}`
  }

  // PUBLIC_INTERFACE
  function hasSavedDaily(): boolean {
    const s = readSession()
    if (!s) return false
    // only valid if session's dailyDate equals today's date
    return s.dailyDate === getTodayKey()
  }

  // PUBLIC_INTERFACE
  async function prepareToday(category: CategoryKey | null = null, count = 10) {
    loading.value = true
    error.value = null
    try {
      const today = getTodayKey()
      dailyDate.value = today
      dailyCategory.value = category
      dailySeed.value = buildSeed(today, category)
      // deterministically compute set
      const seedNum = seededHash(dailySeed.value)
      const rng = makeRng(seedNum)

      // Pool aggregation: if category null, mix all categories evenly-ish
      let source: QuizQuestion[] = []
      if (category) {
        source = pools[category] ?? []
      } else {
        // mix from all categories
        const all: QuizQuestion[] = Object.values(pools).flat()
        source = all
      }
      if (!source.length) {
        throw new Error('No questions available')
      }
      const set = pickDeterministic(source, count, rng)
      questions.value = set
      // reset runtime
      currentIndex.value = 0
      score.value = 0
      selectedIndex.value = null
      hasSubmitted.value = false
      selectedAnswers.value = {}
      lifelines.value = { fiftyFiftyUsed: false, skipUsed: false, extraTimeUsed: false, askHintUsed: false }
      hintShown.value = {}
      fiftyFiftyHidden.value = {}

      // touch persistent meta: lastPlayedDate
      const meta = readPersist()
      meta.lastPlayedDate = today
      // keep existing streak/rewards
      writePersist(meta)

      // persist session
      persistSession()
    } catch (e: unknown) {
      let msg = 'Failed to load daily'
      if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
        msg = (e as { message: string }).message
      }
      error.value = msg
    } finally {
      loading.value = false
    }
  }

  function buildSession(): DailySessionSchema | null {
    if (!questions.value.length) return null
    return {
      version: DAILY_SESSION_VERSION,
      mode: 'daily',
      dailyDate: dailyDate.value,
      dailySeed: dailySeed.value,
      dailyCategory: dailyCategory.value,
      questions: questions.value,
      currentIndex: currentIndex.value,
      selectedAnswers: selectedAnswers.value,
      score: score.value,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      lifelines: lifelines.value,
      fiftyFiftyHidden: fiftyFiftyHidden.value,
      hintShown: hintShown.value,
    }
  }
  function persistSession() {
    const s = buildSession()
    writeSession(s)
  }

  // PUBLIC_INTERFACE
  async function resumeIfAvailable(): Promise<boolean> {
    const s = readSession()
    if (!s) return false
    // Only resume same-day
    if (s.dailyDate !== getTodayKey()) {
      writeSession(null)
      return false
    }
    dailyDate.value = s.dailyDate
    dailySeed.value = s.dailySeed
    dailyCategory.value = s.dailyCategory
    questions.value = s.questions
    currentIndex.value = s.currentIndex
    score.value = s.score
    selectedAnswers.value = s.selectedAnswers || {}
    lifelines.value = s.lifelines || lifelines.value
    fiftyFiftyHidden.value = s.fiftyFiftyHidden || {}
    hintShown.value = s.hintShown || {}
    selectedIndex.value = null
    hasSubmitted.value = false
    return true
  }

  // PUBLIC_INTERFACE
  function clearSession(): void {
    writeSession(null)
  }

  // PUBLIC_INTERFACE
  function selectOption(index: number) {
    if (hasSubmitted.value) return
    selectedIndex.value = index
    persistSession()
  }

  // PUBLIC_INTERFACE
  function submitAnswer(): { correct: boolean } {
    if (selectedIndex.value === null || !current.value) {
      return { correct: false }
    }
    hasSubmitted.value = true
    const correct = selectedIndex.value === current.value.answerIndex
    if (correct) score.value += 1
    const qid = current.value.id
    selectedAnswers.value[qid] = selectedIndex.value
    persistSession()
    return { correct }
  }

  // PUBLIC_INTERFACE
  function nextQuestion(): boolean {
    if (!hasSubmitted.value) return false
    if (currentIndex.value < total.value - 1) {
      currentIndex.value += 1
      selectedIndex.value = null
      hasSubmitted.value = false
      persistSession()
      return true
    }
    return false
  }

  // Lifelines (same semantics as normal quiz)
  // PUBLIC_INTERFACE
  function useFiftyFifty(): { ok: boolean; hidden: number[] } {
    const cur = current.value
    if (!cur || lifelines.value.fiftyFiftyUsed) return { ok: false, hidden: [] }
    const qid = cur.id
    const wrongs = cur.options.map((_, i) => i).filter((i) => i !== cur.answerIndex)
    const pool = wrongs
    const rng = makeRng(seededHash(`${dailySeed.value}:${qid}`))
    const shuffled = [...pool].sort(() => rng() - 0.5)
    const hidden = shuffled.slice(0, Math.min(2, pool.length))
    fiftyFiftyHidden.value[qid] = hidden
    lifelines.value.fiftyFiftyUsed = true
    persistSession()
    return { ok: true, hidden }
  }

  // PUBLIC_INTERFACE
  function useSkipQuestion(): { ok: boolean } {
    const cur = current.value
    if (!cur || lifelines.value.skipUsed) return { ok: false }
    selectedAnswers.value[cur.id] = 'SKIPPED'
    lifelines.value.skipUsed = true
    hasSubmitted.value = true
    persistSession()
    return { ok: true }
  }

  // PUBLIC_INTERFACE
  function useAskHint(): { ok: boolean; hint?: string } {
    const cur = current.value
    if (!cur || lifelines.value.askHintUsed) return { ok: false }
    hintShown.value[cur.id] = true
    lifelines.value.askHintUsed = true
    persistSession()
    return { ok: true, hint: cur.hint }
  }

  // Rewards & Streaks
  function calcStreakOnCompletion(dateKey: string, lastCompleted: string | null): number {
    if (!lastCompleted) return 1
    // compute yesterday key
    const d = new Date(dateKey + 'T00:00:00')
    const y = new Date(d)
    y.setDate(d.getDate() - 1)
    const yKey = `${y.getFullYear()}-${`${y.getMonth() + 1}`.padStart(2, '0')}-${`${y.getDate()}`.padStart(2, '0')}`
    if (lastCompleted === dateKey) {
      // same day completion doesn't increment
      return readPersist().streakCount || 1
    }
    if (lastCompleted === yKey) {
      return (readPersist().streakCount || 0) + 1
    }
    return 1
  }

  function rewardsForStreak(streak: number): string[] {
    const r: string[] = []
    if (streak === 1) r.push('Daily Starter')
    if (streak === 3) r.push('3-Day Streak')
    if (streak === 7) r.push('7-Day Streak')
    if (streak === 14) r.push('14-Day Streak')
    if (streak === 30) r.push('30-Day Legend')
    return r
  }

  // PUBLIC_INTERFACE
  function completeAndRecordScore(addScore: (entry: { player?: string | null; score: number; total: number; category: CategoryKey; categoryLabel?: string; meta?: unknown }) => void) {
    // compute streak
    const meta = readPersist()
    const today = dailyDate.value
    const newStreak = calcStreakOnCompletion(today, meta.lastCompletedDate)
    streakCount.value = newStreak
    meta.streakCount = newStreak
    meta.lastCompletedDate = today

    // rewards
    const unlocked = rewardsForStreak(newStreak)
    rewardsEarned.value = unlocked
    if (unlocked.length) {
      meta.rewardsHistory = Array.from(new Set([...(meta.rewardsHistory || []), ...unlocked]))
    }
    writePersist(meta)

    // push into scoreboard with mode: 'daily'
    const catLabelMap: Record<string, string> = {
      gk: 'General Knowledge', sports: 'Sports', movies: 'Movies', science: 'Science', history: 'History', geography: 'Geography'
    }
    const metaRecord: ScoreboardDailyMeta = {
      mode: 'daily',
      dateKey: today,
      streakAtCompletion: newStreak,
      rewards: unlocked,
    }
    addScore({
      player: '', // will be asked by ResultView; allow overwrite
      score: score.value,
      total: total.value,
      category: (dailyCategory.value ?? 'gk') as CategoryKey,
      categoryLabel: catLabelMap[dailyCategory.value ?? 'gk'] ?? (dailyCategory.value ?? 'Daily'),
      meta: metaRecord,
    })

    // clear session for today to prevent duplicate completion increment
    clearSession()
  }

  // PUBLIC_INTERFACE
  function getPersistentOverview(): DailyMeta {
    const p = readPersist()
    return {
      dailyDate: getTodayKey(),
      dailySeed: buildSeed(getTodayKey(), dailyCategory.value),
      dailyCategory: dailyCategory.value,
      rewardsEarned: rewardsEarned.value,
      streakCount: p.streakCount || 0,
    }
  }

  return {
    // state
    questions,
    currentIndex,
    score,
    selectedIndex,
    hasSubmitted,
    loading,
    error,

    dailyDate,
    dailySeed,
    dailyCategory,
    rewardsEarned,
    streakCount,

    selectedAnswers,
    lifelines,
    fiftyFiftyHidden,
    hintShown,

    total,
    current,
    isLast,

    // actions
    hasSavedDaily,
    prepareToday,
    resumeIfAvailable,
    clearSession,

    selectOption,
    submitAnswer,
    nextQuestion,

    useFiftyFifty,
    useSkipQuestion,
    useAskHint,

    completeAndRecordScore,
    getPersistentOverview,
  }
})
