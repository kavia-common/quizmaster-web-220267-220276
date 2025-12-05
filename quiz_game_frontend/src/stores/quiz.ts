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
  }

  // PUBLIC_INTERFACE
  function resetAll() {
    questions.value = []
    resetRuntime()
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
        return
      }
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
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Failed to load questions'
      error.value = msg
      questions.value = fallbackPools[selectedCategory.value] ?? fallbackPools.gk
    } finally {
      loading.value = false
    }
  }

  // PUBLIC_INTERFACE
  function selectOption(index: number) {
    if (hasSubmitted.value) return
    selectedIndex.value = index
  }

  // PUBLIC_INTERFACE
  function submitAnswer(): { correct: boolean } {
    if (selectedIndex.value === null || !current.value) {
      return { correct: false }
    }
    hasSubmitted.value = true
    const correct = selectedIndex.value === current.value.answerIndex
    if (correct) score.value += 1
    return { correct }
  }

  // PUBLIC_INTERFACE
  function nextQuestion(): boolean {
    if (!hasSubmitted.value) return false
    if (currentIndex.value < total.value - 1) {
      currentIndex.value += 1
      selectedIndex.value = null
      hasSubmitted.value = false
      return true
    }
    return false
  }

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
  }
})
