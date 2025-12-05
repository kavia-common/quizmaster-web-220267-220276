import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CategoryKey, QuizQuestion } from './quiz'
import { useCoinsStore, ensureCoinsLoaded } from './coins'

import { getTournamentQuestionSet } from '@/utils/pools'
import { useQuizStore } from './quiz'

export type DifficultyKey = 'easy' | 'medium' | 'hard'

export type RoundStat = {
  round: number
  correct: number
  wrong: number
  skipped: number
  durations: number[]
  accuracyPct: number
}

export type TournamentPlayer = { id: string; name: string; score: number }

export type TournamentState = {
  isActive: boolean
  roundsTotal: number
  currentRound: number
  difficultyCurve: DifficultyKey[]
  category: CategoryKey | 'mixed'
  seed: string
  startedAt: number | null
  roundStats: RoundStat[]
  players?: TournamentPlayer[]
  completed: boolean
  medalsEarned: string[]
  sessionId: string
}

const STORAGE_KEY = 'tournament.v1'
const STORAGE_VERSION = 1

function seededId(): string {
  try {
    const a = new Uint8Array(8)
    crypto.getRandomValues(a)
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return Math.random().toString(36).slice(2, 12)
  }
}

function now(): number { return Date.now() }

function loadPersisted(): TournamentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw) as { version?: number; state?: TournamentState } | TournamentState
    if (obj && 'version' in obj) {
      const v = (obj as { version?: number; state?: TournamentState }).version
      if (v !== STORAGE_VERSION) return null
      return (obj as { state: TournamentState }).state
    }
    // accept raw state for forward compat
    return obj as TournamentState
  } catch {
    return null
  }
}

function savePersisted(state: TournamentState | null): void {
  try {
    if (!state) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state }))
  } catch {
    // ignore
  }
}

function defaultCurve(): DifficultyKey[] {
  // 10 steps: 2 easy, 3 medium, 5 hard
  return ['easy','easy','medium','medium','medium','hard','hard','hard','hard','hard']
}

// PUBLIC_INTERFACE
export const useTournamentStore = defineStore('tournament', () => {
  const isActive = ref(false)
  const roundsTotal = ref(10)
  const currentRound = ref(0) // 0-based; round number for UI = currentRound+1
  const difficultyCurve = ref<DifficultyKey[]>(defaultCurve())
  const category = ref<CategoryKey | 'mixed'>('gk')
  const seed = ref<string>(seededId())
  const startedAt = ref<number | null>(null)
  const roundStats = ref<RoundStat[]>([])
  const players = ref<TournamentPlayer[] | undefined>(undefined)
  const completed = ref(false)
  const medalsEarned = ref<string[]>([])
  const sessionId = ref<string>(seededId())

  const hasInProgress = computed(() => isActive.value && !completed.value)

  function toState(): TournamentState {
    return {
      isActive: isActive.value,
      roundsTotal: roundsTotal.value,
      currentRound: currentRound.value,
      difficultyCurve: difficultyCurve.value,
      category: category.value,
      seed: seed.value,
      startedAt: startedAt.value ?? 0,
      roundStats: roundStats.value,
      players: players.value,
      completed: completed.value,
      medalsEarned: medalsEarned.value,
      sessionId: sessionId.value,
    }
  }
  function fromState(s: TournamentState) {
    isActive.value = !!s.isActive
    roundsTotal.value = s.roundsTotal ?? 10
    currentRound.value = s.currentRound ?? 0
    difficultyCurve.value = Array.isArray(s.difficultyCurve) && s.difficultyCurve.length === 10 ? s.difficultyCurve : defaultCurve()
    category.value = s.category ?? 'gk'
    seed.value = s.seed || seededId()
    startedAt.value = s.startedAt ?? now()
    roundStats.value = Array.isArray(s.roundStats) ? s.roundStats : []
    players.value = s.players
    completed.value = !!s.completed
    medalsEarned.value = Array.isArray(s.medalsEarned) ? s.medalsEarned : []
    sessionId.value = s.sessionId || seededId()
  }

  function persist() { savePersisted(toState()) }

  // PUBLIC_INTERFACE
  function resetTournament() {
    isActive.value = false
    roundsTotal.value = 10
    currentRound.value = 0
    difficultyCurve.value = defaultCurve()
    // keep last category as convenience
    seed.value = seededId()
    startedAt.value = null
    roundStats.value = []
    players.value = undefined
    completed.value = false
    medalsEarned.value = []
    sessionId.value = seededId()
    persist()
  }

  // PUBLIC_INTERFACE
  function loadIfAvailable(): boolean {
    const s = loadPersisted()
    if (!s) return false
    fromState(s)
    return true
  }

  // PUBLIC_INTERFACE
  function startTournament(opts: { category: CategoryKey | 'mixed'; seed?: string }) {
    category.value = opts.category
    seed.value = opts.seed || seededId()
    isActive.value = true
    roundsTotal.value = 10
    currentRound.value = 0
    difficultyCurve.value = defaultCurve()
    startedAt.value = now()
    roundStats.value = []
    players.value = [{ id: 'p1', name: 'You', score: 0 }]
    completed.value = false
    medalsEarned.value = []
    sessionId.value = seededId()
    persist()
  }

  // Get questions for current round using deterministic seed
  async function prepareRoundQuestions(countPerRound = 10): Promise<QuizQuestion[]> {
    const diff = difficultyCurve.value[Math.min(currentRound.value, difficultyCurve.value.length - 1)]
    const poolCat = category.value
    const roundSeed = `${seed.value}:${currentRound.value + 1}`

    // Attempt to reuse offline cache preference from quiz store
    const quiz = useQuizStore()
    const catForPool = poolCat === 'mixed' ? null : poolCat
    const questions = getTournamentQuestionSet(roundSeed, catForPool ?? undefined, diff, countPerRound)
    if (questions.length) return questions

    // fallback to quiz store's load (category only, without difficulty)
    if (catForPool) {
      quiz.setCategory(catForPool)
    }
    await quiz.loadQuestions()
    return quiz.questions.slice(0, countPerRound)
  }

  // PUBLIC_INTERFACE
  async function startNextRound(): Promise<{ questions: QuizQuestion[]; roundNumber: number; difficulty: DifficultyKey }> {
    if (!isActive.value) throw new Error('Tournament not active')
    if (completed.value) throw new Error('Tournament already completed')
    const nextIndex = currentRound.value
    const questions = await prepareRoundQuestions(10)
    // When playing a round, the view will use QuizView-like flow with these questions.
    persist()
    const difficulty = difficultyCurve.value[Math.min(nextIndex, difficultyCurve.value.length - 1)]
    return { questions, roundNumber: nextIndex + 1, difficulty }
  }

  // PUBLIC_INTERFACE
  function recordRoundResult(meta: {
    correct: number
    wrong: number
    skipped: number
    durations: number[]
  }) {
    const totalAnswered = meta.correct + meta.wrong
    const accuracyPct = totalAnswered > 0 ? Math.round((meta.correct / totalAnswered) * 100) : 0
    const rs: RoundStat = {
      round: currentRound.value + 1,
      correct: meta.correct,
      wrong: meta.wrong,
      skipped: meta.skipped,
      durations: meta.durations,
      accuracyPct,
    }
    // push or replace for idempotency if repeated
    const idx = roundStats.value.findIndex(r => r.round === rs.round)
    if (idx >= 0) roundStats.value[idx] = rs
    else roundStats.value.push(rs)

    // accumulate score
    const player = (players.value || [])[0]
    if (player) {
      player.score = (roundStats.value.reduce((s, r) => s + r.correct, 0))
    }

    // per-round participation coins (+3)
    try {
      ensureCoinsLoaded()
      const coins = useCoinsStore()
      const id = `${sessionId.value}:round:${currentRound.value + 1}`
      coins.add(3, 'bonus', id, { sessionId: sessionId.value, round: currentRound.value + 1 })
    } catch (e) {
      console.warn('tournament: coin participation failed', e)
    }

    // advance round pointer
    if (currentRound.value < roundsTotal.value - 1) {
      currentRound.value += 1
    }
    persist()
  }

  // PUBLIC_INTERFACE
  function completeTournament() {
    completed.value = true
    // compute medals from aggregate
    const totalCorrect = roundStats.value.reduce((s, r) => s + r.correct, 0)
    const totalWrong = roundStats.value.reduce((s, r) => s + r.wrong, 0)
    const totalSkipped = roundStats.value.reduce((s, r) => s + r.skipped, 0)
    const durations = roundStats.value.flatMap(r => r.durations)

    // dynamic import to avoid circulars
    import('@/utils/awards').then(mod => {
      const medals = mod.computeMedals({
        totalCorrect,
        totalWrong,
        totalSkipped,
        durations,
        roundsPlayed: roundStats.value.length,
        roundsTotal: roundsTotal.value,
      })
      medalsEarned.value = medals
      persist()
    }).catch(() => {
      medalsEarned.value = []
      persist()
    })

    // completion coins (+20)
    try {
      ensureCoinsLoaded()
      const coins = useCoinsStore()
      const id = `${sessionId.value}:tournament-complete`
      coins.add(20, 'bonus', id, { sessionId: sessionId.value })
    } catch (e) {
      console.warn('tournament: completion coins failed', e)
    }

    persist()
  }

  return {
    // state
    isActive,
    roundsTotal,
    currentRound,
    difficultyCurve,
    category,
    seed,
    startedAt,
    roundStats,
    players,
    completed,
    medalsEarned,
    sessionId,
    hasInProgress,

    // actions
    startTournament,
    startNextRound,
    recordRoundResult,
    completeTournament,
    resetTournament,
    loadIfAvailable,
  }
})
