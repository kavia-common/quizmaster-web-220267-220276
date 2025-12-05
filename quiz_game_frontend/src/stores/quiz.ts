import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type QuizQuestion = {
  id: string | number
  question: string
  options: string[]
  answerIndex: number
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

type SessionSchema = {
  version: number
  selectedCategory: CategoryKey
  questions: QuizQuestion[]
  currentIndex: number
  selectedAnswers: Record<string | number, number> // question.id -> selected index
  score: number
  startedAt: number
  updatedAt: number
}

// Simple sample fallback pools per category to keep UX coherent when no backend is configured
const fallbackPools: Record<CategoryKey, QuizQuestion[]> = {
  gk: [
    { id: 'gk-1', question: 'What is the capital of France?', options: ['Madrid', 'Paris', 'Berlin', 'Rome'], answerIndex: 1 },
    { id: 'gk-2', question: 'What is 9 + 10?', options: ['18', '19', '20'], answerIndex: 1 },
    { id: 'gk-3', question: 'Which language runs in a web browser?', options: ['Java', 'C', 'Python', 'JavaScript'], answerIndex: 3 },
  ],
  sports: [
    { id: 'sp-1', question: 'How many players in a football (soccer) team on the field?', options: ['9', '10', '11', '12'], answerIndex: 2 },
    { id: 'sp-2', question: 'In tennis, what is 0 points called?', options: ['Null', 'Love', 'Zero', 'Nil'], answerIndex: 1 },
    { id: 'sp-3', question: 'Which country hosts the Tour de France?', options: ['Italy', 'France', 'Spain', 'Belgium'], answerIndex: 1 },
  ],
  movies: [
    { id: 'mv-1', question: 'Who directed Inception?', options: ['Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Ridley Scott'], answerIndex: 1 },
    { id: 'mv-2', question: 'The Hobbit is set in which world?', options: ['Narnia', 'Earthsea', 'Middle-earth', 'Westeros'], answerIndex: 2 },
    { id: 'mv-3', question: 'Which film features a DeLorean time machine?', options: ['Back to the Future', 'Terminator', 'Looper', 'Primer'], answerIndex: 0 },
  ],
  science: [
    { id: 'sc-1', question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Saturn', 'Mars', 'Jupiter'], answerIndex: 2 },
    { id: 'sc-2', question: 'H2O is the chemical formula for?', options: ['Hydrogen', 'Oxygen', 'Water', 'Helium'], answerIndex: 2 },
    { id: 'sc-3', question: 'Speed of light is approximately?', options: ['3x10^8 m/s', '3x10^6 m/s', '30000 km/s', '3x10^10 m/s'], answerIndex: 0 },
  ],
  history: [
    { id: 'hs-1', question: 'Who painted the Mona Lisa?', options: ['Picasso', 'Da Vinci', 'Van Gogh'], answerIndex: 1 },
    { id: 'hs-2', question: 'The pyramids are located in which country?', options: ['Peru', 'Egypt', 'Mexico', 'China'], answerIndex: 1 },
    { id: 'hs-3', question: 'World War II ended in which year?', options: ['1943', '1944', '1945', '1946'], answerIndex: 2 },
  ],
  geography: [
    { id: 'ge-1', question: 'Which is the largest ocean?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], answerIndex: 2 },
    { id: 'ge-2', question: 'Mount Everest is in which mountain range?', options: ['Andes', 'Himalayas', 'Alps', 'Rockies'], answerIndex: 1 },
    { id: 'ge-3', question: 'The Nile river flows into which sea?', options: ['Black Sea', 'Red Sea', 'Mediterranean Sea', 'Arabian Sea'], answerIndex: 2 },
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
const SESSION_VERSION = 1

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
    if (obj.version !== SESSION_VERSION) return null
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
    // minimal validation of question schema
    const qs: QuizQuestion[] = (obj.questions as unknown[])
      .filter((q: unknown) => {
        if (!q || typeof q !== 'object') return false
        const r = q as Record<string, unknown>
        return typeof r.question === 'string' && Array.isArray(r.options) && typeof r.answerIndex === 'number'
      })
      .map((q: unknown, i: number) => {
        const r = q as Record<string, unknown>
        return {
          id: (r.id as string | number | undefined) ?? i + 1,
          question: String(r.question),
          options: (r.options as unknown[]).map(String),
          answerIndex: Number(r.answerIndex),
        } as QuizQuestion
      })
    if (!qs.length) return null
    return {
      version: SESSION_VERSION,
      selectedCategory: obj.selectedCategory as CategoryKey,
      questions: qs,
      currentIndex: Math.max(0, Math.min(obj.currentIndex!, qs.length - 1)),
      selectedAnswers: obj.selectedAnswers as Record<string | number, number>,
      score: Math.max(0, Number(obj.score)),
      startedAt: obj.startedAt!,
      updatedAt: obj.updatedAt!,
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
  const selectedAnswers = ref<Record<string | number, number>>({})

  const total = computed(() => questions.value.length)
  const current = computed(() => questions.value[currentIndex.value] || null)
  const progress = computed(() => (total.value ? Math.round(((currentIndex.value) / total.value) * 100) : 0))
  const isLast = computed(() => currentIndex.value >= total.value - 1)

  function resetRuntime() {
    currentIndex.value = 0
    score.value = 0
    selectedIndex.value = null
    hasSubmitted.value = false
    error.value = null
    selectedAnswers.value = {}
    startedAt.value = null
    updatedAt.value = null
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
    const base = apiBase.replace(/\/+$/, '')
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
            return {
              id: (obj.id as string | number | undefined) ?? i + 1,
              question: String(obj.question),
              options: (obj.options as unknown[]).map(String),
              answerIndex: Number(obj.answerIndex),
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
      touchAndPersist()
      return true
    }
    return false
  }

  // Save & Resume

  function buildSession(): SessionSchema | null {
    if (!questions.value.length) return null
    return {
      version: SESSION_VERSION,
      selectedCategory: selectedCategory.value,
      questions: questions.value,
      currentIndex: currentIndex.value,
      selectedAnswers: selectedAnswers.value,
      score: score.value,
      startedAt: startedAt.value ?? Date.now(),
      updatedAt: updatedAt.value ?? Date.now(),
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
    // set selectedIndex for current if previously answered; otherwise null
    const curId = questions.value[currentIndex.value]?.id
    selectedIndex.value = curId != null && saved.selectedAnswers && saved.selectedAnswers[curId] != null
      ? saved.selectedAnswers[curId]
      : null
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
    // derived
    total,
    current,
    progress,
    isLast,
    // actions
    resetAll,
    loadQuestions,
    selectOption,
    submitAnswer,
    nextQuestion,
    resetRuntime,
    setCategory,

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
