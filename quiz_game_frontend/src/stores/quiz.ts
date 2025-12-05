import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type QuizQuestion = {
  id: string | number
  question: string
  options: string[]
  answerIndex: number
  /**
   * Optional explanation text shown after answering, to provide additional context.
   */
  explanation?: string
  /**
   * Optional short source label displayed next to explanation (e.g., "Wikipedia").
   */
  source?: string
  /**
   * Optional reference URL for "Learn more" link.
   */
  referenceUrl?: string
  /**
   * Optional hint/clue that can be revealed via lifeline.
   * Maps from backend fields 'hint' or 'clue' when available.
   */
  hint?: string
}

export type CategoryKey = 'gk' | 'sports' | 'movies' | 'science' | 'history' | 'geography'

type ScoreEntry = {
  player: string
  score: number
  total: number
  category: CategoryKey
  categoryLabel?: string
  date: number
}

type LifelineUsage = {
  fiftyFiftyUsed: boolean
  skipUsed: boolean
  extraTimeUsed: boolean
  askHintUsed: boolean
}

type TimerState = {
  // seconds remaining for the current question; if null, timer inactive
  remaining: number | null
  // true when extra time lifeline was used on current question
  extraGranted: boolean
}

type SessionSchema = {
  version: number
  selectedCategory: CategoryKey
  questions: QuizQuestion[]
  currentIndex: number
  selectedAnswers: Record<string | number, number | 'SKIPPED'> // question.id -> selected index or 'SKIPPED'
  score: number
  startedAt: number
  updatedAt: number
  lifelines: LifelineUsage
  // map of question.id -> indices hidden by fiftyFifty
  fiftyFiftyHidden: Record<string | number, number[]>
  // per-question hint shown flag
  hintShown: Record<string | number, boolean>
  // simple per-question timer remaining; optional; stored to resume gently
  timers: Record<string | number, number | null>
}

// Simple sample fallback pools per category to keep UX coherent when no backend is configured
const fallbackPools: Record<CategoryKey, QuizQuestion[]> = {
  gk: [
    {
      id: 'gk-1',
      question: 'What is the capital of France?',
      options: ['Madrid', 'Paris', 'Berlin', 'Rome'],
      answerIndex: 1,
      explanation: 'Paris is the capital and most populous city of France.',
      source: 'Wikipedia',
      referenceUrl: 'https://en.wikipedia.org/wiki/Paris',
      hint: 'It is nicknamed the City of Light.'
    },
    {
      id: 'gk-2',
      question: 'What is 9 + 10?',
      options: ['18', '19', '20'],
      answerIndex: 1,
      explanation: 'Basic arithmetic: 9 + 10 equals 19.',
      hint: 'Think one more than 18.'
    },
    {
      id: 'gk-3',
      question: 'Which language runs in a web browser?',
      options: ['Java', 'C', 'Python', 'JavaScript'],
      answerIndex: 3,
      explanation: 'JavaScript is the standard language for client-side web development.',
      hint: 'It’s the language of the DOM.'
    },
  ],
  sports: [
    {
      id: 'sp-1',
      question: 'How many players in a football (soccer) team on the field?',
      options: ['9', '10', '11', '12'],
      answerIndex: 2,
      explanation: 'A standard soccer team fields 11 players, including the goalkeeper.',
      hint: 'It’s a number between 10 and 12.'
    },
    {
      id: 'sp-2',
      question: 'In tennis, what is 0 points called?',
      options: ['Null', 'Love', 'Zero', 'Nil'],
      answerIndex: 1,
      explanation: 'In tennis scoring, “love” means zero.',
      hint: 'A four-letter word that sounds romantic.'
    },
    {
      id: 'sp-3',
      question: 'Which country hosts the Tour de France?',
      options: ['Italy', 'France', 'Spain', 'Belgium'],
      answerIndex: 1,
      explanation: 'The Tour de France is an annual men’s multiple stage bicycle race primarily held in France.',
      hint: 'It’s in the event name.'
    },
  ],
  movies: [
    {
      id: 'mv-1',
      question: 'Who directed Inception?',
      options: ['Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Ridley Scott'],
      answerIndex: 1,
      explanation: 'Christopher Nolan wrote and directed Inception (2010).',
      hint: 'He also directed The Dark Knight.'
    },
    {
      id: 'mv-2',
      question: 'The Hobbit is set in which world?',
      options: ['Narnia', 'Earthsea', 'Middle-earth', 'Westeros'],
      answerIndex: 2,
      explanation: 'Middle-earth is the fictional setting of Tolkien’s legendarium.',
      hint: 'Think Tolkien.'
    },
    {
      id: 'mv-3',
      question: 'Which film features a DeLorean time machine?',
      options: ['Back to the Future', 'Terminator', 'Looper', 'Primer'],
      answerIndex: 0,
      explanation: 'Back to the Future popularized the DeLorean as a time machine.',
      hint: 'Great Scott!'
    },
  ],
  science: [
    {
      id: 'sc-1',
      question: 'Which planet is known as the Red Planet?',
      options: ['Venus', 'Saturn', 'Mars', 'Jupiter'],
      answerIndex: 2,
      explanation: 'Mars appears reddish due to iron oxide (rust) on its surface.',
      hint: 'Named after the Roman god of war.'
    },
    {
      id: 'sc-2',
      question: 'H2O is the chemical formula for?',
      options: ['Hydrogen', 'Oxygen', 'Water', 'Helium'],
      answerIndex: 2,
      explanation: 'Two hydrogen atoms bonded to one oxygen atom makes water.',
      hint: 'It’s essential for life and covers most of Earth.'
    },
    {
      id: 'sc-3',
      question: 'Speed of light is approximately?',
      options: ['3x10^8 m/s', '3x10^6 m/s', '30000 km/s', '3x10^10 m/s'],
      answerIndex: 0,
      explanation: 'In vacuum, light speed is around 3 × 10^8 meters per second.',
      hint: 'Roughly 300,000 km/s.'
    },
  ],
  history: [
    {
      id: 'hs-1',
      question: 'Who painted the Mona Lisa?',
      options: ['Picasso', 'Da Vinci', 'Van Gogh'],
      answerIndex: 1,
      explanation: 'Leonardo da Vinci painted the Mona Lisa in the early 16th century.',
      hint: 'His first name is Leonardo.'
    },
    {
      id: 'hs-2',
      question: 'The pyramids are located in which country?',
      options: ['Peru', 'Egypt', 'Mexico', 'China'],
      answerIndex: 1,
      explanation: 'The most famous pyramids, including those at Giza, are in Egypt.',
      hint: 'Home to the Nile delta.'
    },
    {
      id: 'hs-3',
      question: 'World War II ended in which year?',
      options: ['1943', '1944', '1945', '1946'],
      answerIndex: 2,
      explanation: 'WWII ended in 1945 with the formal surrender of Axis powers.',
      hint: 'Mid-1940s.'
    },
  ],
  geography: [
    {
      id: 'ge-1',
      question: 'Which is the largest ocean?',
      options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'],
      answerIndex: 2,
      explanation: 'The Pacific Ocean is the largest and deepest of Earth’s oceanic divisions.',
      hint: 'Its name suggests calmness.'
    },
    {
      id: 'ge-2',
      question: 'Mount Everest is in which mountain range?',
      options: ['Andes', 'Himalayas', 'Alps', 'Rockies'],
      answerIndex: 1,
      explanation: 'Everest is part of the Himalayas on the border of Nepal and China (Tibet).',
      hint: 'Range spans Nepal and Tibet.'
    },
    {
      id: 'ge-3',
      question: 'The Nile river flows into which sea?',
      options: ['Black Sea', 'Red Sea', 'Mediterranean Sea', 'Arabian Sea'],
      answerIndex: 2,
      explanation: 'The Nile empties into the Mediterranean Sea near Alexandria, Egypt.',
      hint: 'The sea north of Africa.'
    },
  ],
}

// Map UI categories to backend parameter values
const categoryParamMap: Record<CategoryKey, string> = {
  gk: 'general',
  sports: 'sports',
  movies: 'movies',
  science: 'science',
  history: 'history',
  geography: 'geography',
}

const SCOREBOARD_KEY = 'quizmaster:scores'
const SESSION_KEY = 'quizmaster:session'
const SESSION_VERSION = 3

// Storage helpers to isolate localStorage usage and handle parse errors gracefully
function readScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCOREBOARD_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeScores(scores: ScoreEntry[]): void {
  try {
    localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(scores))
  } catch {
    // ignore storage quota errors
  }
}

function safeReadSession(): SessionSchema | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<SessionSchema> | unknown
    if (!data || typeof data !== 'object') return null
    const obj = data as Partial<SessionSchema>
    // accept version 1, 2, or 3 for forward/backward compatibility
    if (obj.version !== 1 && obj.version !== 2 && obj.version !== SESSION_VERSION) return null
    if (
      !obj.questions ||
      !Array.isArray(obj.questions) ||
      typeof obj.currentIndex !== 'number' ||
      typeof obj.score !== 'number' ||
      !obj.selectedCategory ||
      typeof obj.selectedCategory !== 'string' ||
      typeof obj.startedAt !== 'number' ||
      typeof obj.updatedAt !== 'number' ||
      !obj.selectedAnswers ||
      typeof obj.selectedAnswers !== 'object'
    ) {
      return null
    }
    // minimal validation of question schema, include explanation and hint fields if present
    const qs: QuizQuestion[] = (obj.questions as unknown[])
      .filter((q: unknown) => {
        if (!q || typeof q !== 'object') return false
        const r = q as Record<string, unknown>
        return typeof r.question === 'string' && Array.isArray(r.options) && typeof r.answerIndex === 'number'
      })
      .map((q: unknown, i: number) => {
        const r = q as Record<string, unknown>
        // support alias 'detail' for explanation if older data used that key
        const explanation =
          (typeof r.explanation === 'string' ? (r.explanation as string) : undefined) ??
          (typeof (r as Record<string, unknown>).detail === 'string' ? String((r as Record<string, unknown>).detail) : undefined)
        const referenceUrl = typeof r.referenceUrl === 'string' ? (r.referenceUrl as string) : undefined
        const source = typeof r.source === 'string' ? (r.source as string) : undefined
        const hint =
          (typeof (r as Record<string, unknown>).hint === 'string'
            ? String((r as Record<string, unknown>).hint)
            : undefined) ??
          (typeof (r as Record<string, unknown>).clue === 'string'
            ? String((r as Record<string, unknown>).clue)
            : undefined)
        return {
          id: (r.id as string | number | undefined) ?? i + 1,
          question: String(r.question),
          options: (r.options as unknown[]).map(String),
          answerIndex: Number(r.answerIndex),
          explanation,
          referenceUrl,
          source,
          hint,
        } as QuizQuestion
      })
    if (!qs.length) return null
    return {
      version: SESSION_VERSION,
      selectedCategory: obj.selectedCategory as CategoryKey,
      questions: qs,
      currentIndex: Math.max(0, Math.min(obj.currentIndex!, qs.length - 1)),
      selectedAnswers: obj.selectedAnswers as Record<string | number, number | 'SKIPPED'>,
      score: Math.max(0, Number(obj.score)),
      startedAt: obj.startedAt!,
      updatedAt: obj.updatedAt!,
      lifelines: (obj as Partial<SessionSchema>).lifelines ?? {
        fiftyFiftyUsed: false,
        skipUsed: false,
        extraTimeUsed: false,
        askHintUsed: false,
      },
      fiftyFiftyHidden: (obj as Partial<SessionSchema>).fiftyFiftyHidden ?? {},
      hintShown: (obj as Partial<SessionSchema>).hintShown ?? {},
      timers: (obj as Partial<SessionSchema>).timers ?? {},
    }
  } catch {
    return null
  }
}

function safeWriteSession(payload: SessionSchema | null): void {
  try {
    if (!payload) {
      localStorage.removeItem(SESSION_KEY)
      return
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota errors
  }
}

// PUBLIC_INTERFACE
export const useQuizStore = defineStore('quiz', () => {
  /**
   * Questions array and quiz progress/score state.
   */
  const questions = ref<QuizQuestion[]>([])
  const currentIndex = ref(0)
  const score = ref(0)
  const selectedIndex = ref<number | null>(null)
  const hasSubmitted = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Category state
  const selectedCategory = ref<CategoryKey>('gk')

  // session meta
  const startedAt = ref<number | null>(null)
  const updatedAt = ref<number | null>(null)
  // map of selected answers per question id
  const selectedAnswers = ref<Record<string | number, number | 'SKIPPED'>>({})

  // Lifelines state (per session, one-time each)
  const lifelines = ref<LifelineUsage>({
    fiftyFiftyUsed: false,
    skipUsed: false,
    extraTimeUsed: false,
    askHintUsed: false,
  })

  // Per-question hidden options from fifty-fifty
  const fiftyFiftyHidden = ref<Record<string | number, number[]>>({})

  // Per-question hint visibility
  const hintShown = ref<Record<string | number, boolean>>({})

  // Lightweight timer per-question
  const timers = ref<Record<string | number, number | null>>({})
  const timerState = ref<TimerState>({ remaining: null, extraGranted: false })

  const total = computed(() => questions.value.length)
  const current = computed(() => questions.value[currentIndex.value] || null)
  const progress = computed(() =>
    total.value ? Math.round((currentIndex.value / total.value) * 100) : 0
  )
  const isLast = computed(() => currentIndex.value >= total.value - 1)
  const isCurrentCorrect = computed(() =>
    hasSubmitted.value && current.value ? selectedIndex.value === current.value.answerIndex : null
  )

  function resetRuntime() {
    currentIndex.value = 0
    score.value = 0
    selectedIndex.value = null
    hasSubmitted.value = false
    error.value = null
    selectedAnswers.value = {}
    startedAt.value = null
    updatedAt.value = null
    lifelines.value = {
      fiftyFiftyUsed: false,
      skipUsed: false,
      extraTimeUsed: false,
      askHintUsed: false,
    }
    fiftyFiftyHidden.value = {}
    hintShown.value = {}
    timers.value = {}
    timerState.value = { remaining: null, extraGranted: false }
  }

  // PUBLIC_INTERFACE
  function resetAll() {
    questions.value = []
    resetRuntime()
    // also clear any in-progress session
    clearSession()
  }

  // PUBLIC_INTERFACE
  function setCategory(cat: CategoryKey) {
    selectedCategory.value = cat
  }

  function buildQuestionsUrl(): string {
    const apiBase =
      (import.meta.env.VITE_API_BASE as string) ||
      (import.meta.env.VITE_BACKEND_URL as string) ||
      ''
    if (!apiBase) return ''
    const base = apiBase.replace(/\/*$/, '')
    const param = categoryParamMap[selectedCategory.value] ?? selectedCategory.value
    // Add category as query param if supported by backend
    const url = new URL(`${base}/api/questions`)
    url.searchParams.set('category', param)
    return url.toString()
  }

  // PUBLIC_INTERFACE
  async function loadQuestions(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const url = buildQuestionsUrl()
      if (!url) {
        // No backend configured; use fallback by category
        questions.value = fallbackPools[selectedCategory.value] ?? fallbackPools.gk
        // initialize session metadata on first load
        if (!startedAt.value) startedAt.value = Date.now()
        updatedAt.value = Date.now()
        persistSession()
        return
      }

      // fetch with timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)

      if (!res.ok) throw new Error(`Failed to load questions: ${res.status}`)
      const data: unknown = await res.json()

      // Expect format: [{id, question, options, answerIndex}]
      if (!Array.isArray(data) || !data.length) {
        questions.value = fallbackPools[selectedCategory.value] ?? fallbackPools.gk
      } else {
        // Simple validation/coercion
        questions.value = (data as unknown[])
          .filter((q: unknown) => {
            if (!q || typeof q !== 'object') return false
            const obj = q as Record<string, unknown>
            return typeof obj.question === 'string' &&
                   Array.isArray(obj.options) &&
                   typeof obj.answerIndex === 'number'
          })
          .map((q: unknown, i: number): QuizQuestion => {
            const obj = q as Record<string, unknown>
            const explanation =
              (typeof obj.explanation === 'string' ? (obj.explanation as string) : undefined) ??
              (typeof (obj as Record<string, unknown>).detail === 'string' ? String((obj as Record<string, unknown>).detail) : undefined)
            const referenceUrl = typeof obj.referenceUrl === 'string' ? (obj.referenceUrl as string) : undefined
            const source = typeof obj.source === 'string' ? (obj.source as string) : undefined
            const hint =
              (typeof (obj as Record<string, unknown>).hint === 'string'
                ? String((obj as Record<string, unknown>).hint)
                : undefined) ??
              (typeof (obj as Record<string, unknown>).clue === 'string'
                ? String((obj as Record<string, unknown>).clue)
                : undefined)
            return {
              id: (obj.id as string | number | undefined) ?? i + 1,
              question: String(obj.question),
              options: (obj.options as unknown[]).map(String),
              answerIndex: Number(obj.answerIndex),
              explanation,
              referenceUrl,
              source,
              hint,
            }
          })

        if (!questions.value.length) {
          questions.value = fallbackPools[selectedCategory.value] ?? fallbackPools.gk
        }
      }

      // initialize session metadata on first load
      if (!startedAt.value) startedAt.value = Date.now()
      updatedAt.value = Date.now()
      persistSession()
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Failed to load questions'
      error.value = msg
      questions.value = fallbackPools[selectedCategory.value] ?? fallbackPools.gk
      if (!startedAt.value) startedAt.value = Date.now()
      updatedAt.value = Date.now()
      persistSession()
    } finally {
      loading.value = false
    }
  }

  // PUBLIC_INTERFACE
  function selectOption(index: number) {
    if (hasSubmitted.value) return
    selectedIndex.value = index
    // do not mark selectedAnswers until submission; but persist the transient index too
    touchAndPersist()
  }

  // PUBLIC_INTERFACE
  function submitAnswer(): { correct: boolean } {
    if (selectedIndex.value === null || !current.value) {
      return { correct: false }
    }
    hasSubmitted.value = true
    const correct = selectedIndex.value === current.value.answerIndex
    if (correct) score.value += 1
    // track per-question selected answer
    const qid = current.value.id
    selectedAnswers.value[qid] = selectedIndex.value
    touchAndPersist()
    return { correct }
  }

  // PUBLIC_INTERFACE
  function nextQuestion(): boolean {
    if (!hasSubmitted.value) return false
    if (currentIndex.value < total.value - 1) {
      currentIndex.value += 1
      selectedIndex.value = null
      hasSubmitted.value = false
      // reset timer state for new question (will be started only when extraTime is used)
      const qid = questions.value[currentIndex.value]?.id
      timerState.value = { remaining: (qid != null ? timers.value[qid] ?? null : null), extraGranted: false }
      touchAndPersist()
      return true
    }
    return false
  }

  // Save & Resume

  function buildSession(): SessionSchema | null {
    if (!questions.value.length) return null
    // persist timer remaining for current question if any
    const curId = questions.value[currentIndex.value]?.id
    if (curId != null && timerState.value.remaining != null) {
      timers.value[curId] = timerState.value.remaining
    }
    return {
      version: SESSION_VERSION,
      selectedCategory: selectedCategory.value,
      questions: questions.value,
      currentIndex: currentIndex.value,
      selectedAnswers: selectedAnswers.value,
      score: score.value,
      startedAt: startedAt.value ?? Date.now(),
      updatedAt: updatedAt.value ?? Date.now(),
      lifelines: lifelines.value,
      fiftyFiftyHidden: fiftyFiftyHidden.value,
      hintShown: hintShown.value,
      timers: timers.value,
    }
  }

  function persistSession() {
    const s = buildSession()
    safeWriteSession(s)
  }

  function touchAndPersist() {
    updatedAt.value = Date.now()
    persistSession()
  }

  // PUBLIC_INTERFACE
  function hasSavedSession(): boolean {
    return safeReadSession() !== null
  }

  // PUBLIC_INTERFACE
  function resetSession() {
    // clears saved session but also runtime
    safeWriteSession(null)
    resetAll()
  }

  // PUBLIC_INTERFACE
  async function resumeIfAvailable(): Promise<boolean> {
    const saved = safeReadSession()
    if (!saved) return false
    // hydrate state
    selectedCategory.value = saved.selectedCategory
    questions.value = saved.questions
    currentIndex.value = saved.currentIndex
    score.value = saved.score
    selectedAnswers.value = saved.selectedAnswers || {}
    startedAt.value = saved.startedAt
    updatedAt.value = saved.updatedAt
    lifelines.value = saved.lifelines ?? lifelines.value
    fiftyFiftyHidden.value = saved.fiftyFiftyHidden ?? {}
    hintShown.value = saved.hintShown ?? {}
    timers.value = saved.timers ?? {}
    // set selectedIndex for current if previously answered; otherwise null; ignore 'SKIPPED'
    const curId = questions.value[currentIndex.value]?.id
    const prev = curId != null ? saved.selectedAnswers[curId] : null
    selectedIndex.value = typeof prev === 'number' ? prev : null
    // init timer for current question if saved
    timerState.value = {
      remaining: (curId != null ? timers.value[curId] ?? null : null) as number | null,
      extraGranted: false,
    }
    hasSubmitted.value = false
    error.value = null
    loading.value = false
    return true
  }

  // Results & Scoreboard

  // PUBLIC_INTERFACE
  function addScore(entry: { player?: string | null; score: number; total: number; category: CategoryKey; categoryLabel?: string }): void {
    /**
     * Add a score to persistent storage (localStorage). Stores latest at the top.
     * Omits player name if not provided.
     */
    const existing = readScores()
    const normalized: ScoreEntry = {
      player: (entry.player ?? '').toString().trim().slice(0, 16) || 'Anonymous',
      score: Number(entry.score) || 0,
      total: Number(entry.total) || 0,
      category: entry.category,
      categoryLabel: entry.categoryLabel,
      date: Date.now(),
    }
    const next = [normalized, ...existing].slice(0, 100) // cap to 100 entries
    writeScores(next)
  }

  // PUBLIC_INTERFACE
  function listScores(): ScoreEntry[] {
    /**
     * Returns saved scores sorted by most recent first.
     */
    return readScores()
  }

  // PUBLIC_INTERFACE
  function clearScores(): void {
    /**
     * Clears all saved scores from localStorage.
     */
    writeScores([])
  }

  // PUBLIC_INTERFACE
  function clearSession(): void {
    /**
     * Clears in-progress quiz session from localStorage.
     */
    safeWriteSession(null)
  }

  // Lifelines

  // PUBLIC_INTERFACE
  function useFiftyFifty(): { ok: boolean; hidden: number[] } {
    /**
     * Removes two incorrect options for the current question.
     * Picks two wrong indices that are not the correct one and not currently selected (if any).
     * Persists hidden indices per-question.
     */
    const cur = current.value
    if (!cur || lifelines.value.fiftyFiftyUsed) return { ok: false, hidden: [] }
    const qid = cur.id
    const already = fiftyFiftyHidden.value[qid]
    if (already && already.length) {
      return { ok: true, hidden: already }
    }
    const wrongs = cur.options.map((_, i) => i).filter((i) => i !== cur.answerIndex)
    // Exclude currently selected to avoid removing user's picked option
    const notSelected = wrongs.filter((i) => i !== selectedIndex.value)
    const pool = notSelected.length >= 2 ? notSelected : wrongs
    // pick two at random or first two
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const hidden = shuffled.slice(0, Math.min(2, pool.length))
    fiftyFiftyHidden.value[qid] = hidden
    lifelines.value.fiftyFiftyUsed = true
    touchAndPersist()
    return { ok: true, hidden }
  }

  // PUBLIC_INTERFACE
  function useSkipQuestion(): { ok: boolean } {
    /**
     * Skips current question without affecting score.
     * Marks selectedAnswers for this question as 'SKIPPED' for analytics.
     */
    const cur = current.value
    if (!cur || lifelines.value.skipUsed) return { ok: false }
    // mark skipped
    selectedAnswers.value[cur.id] = 'SKIPPED'
    lifelines.value.skipUsed = true
    hasSubmitted.value = true // treat as reviewed for flow
    touchAndPersist()
    return { ok: true }
  }

  // PUBLIC_INTERFACE
  function useExtraTime(): { ok: boolean; remaining: number | null } {
    /**
     * If a timer exists, extend by +15s. If no timer, create a gentle timer for this question.
     * Timer does not auto-fail; it's informational only.
     */
    const cur = current.value
    if (!cur || lifelines.value.extraTimeUsed) return { ok: false, remaining: timerState.value.remaining }
    const qid = cur.id
    const BASE = 20 // base seconds for gentle per-question timer when created
    const EXT = 15
    // Initialize if absent
    let remaining = timerState.value.remaining
    if (remaining == null) {
      // try saved value
      const saved = timers.value[qid]
      remaining = typeof saved === 'number' ? saved : BASE
    }
    remaining += EXT
    timerState.value = { remaining, extraGranted: true }
    timers.value[qid] = remaining
    lifelines.value.extraTimeUsed = true
    touchAndPersist()
    return { ok: true, remaining }
  }

  // PUBLIC_INTERFACE
  function tickTimer(delta = 1): number | null {
    /**
     * Decrements current timer if active; persists.
     * Returns remaining or null if inactive.
     */
    const cur = current.value
    if (!cur) return null
    if (timerState.value.remaining == null) return null
    timerState.value.remaining = Math.max(0, (timerState.value.remaining ?? 0) - delta)
    timers.value[cur.id] = timerState.value.remaining
    // do not auto-fail; purely informational
    touchAndPersist()
    return timerState.value.remaining
  }

  // PUBLIC_INTERFACE
  function useAskHint(): { ok: boolean; hint?: string } {
    /**
     * Reveals hint for the current question (if available).
     */
    const cur = current.value
    if (!cur || lifelines.value.askHintUsed) return { ok: false }
    hintShown.value[cur.id] = true
    lifelines.value.askHintUsed = true
    touchAndPersist()
    return { ok: true, hint: cur.hint }
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
    selectedCategory,
    startedAt,
    updatedAt,
    selectedAnswers,
    lifelines,
    fiftyFiftyHidden,
    hintShown,
    timers,
    timerState,
    // derived
    total,
    current,
    progress,
    isLast,
    isCurrentCorrect,
    // actions
    resetAll,
    loadQuestions,
    selectOption,
    submitAnswer,
    nextQuestion,
    resetRuntime,
    setCategory,

    // lifelines
    useFiftyFifty,
    useSkipQuestion,
    useExtraTime,
    useAskHint,
    tickTimer,

    // scoreboard actions
    addScore,
    listScores,
    clearScores,

    // session actions
    hasSavedSession,
    resumeIfAvailable,
    resetSession,
    clearSession,
  }
})
