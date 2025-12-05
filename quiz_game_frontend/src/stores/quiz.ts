import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type QuizQuestion = {
  id: string | number
  question: string
  options: string[]
  answerIndex: number
}

const fallbackQuestions: QuizQuestion[] = [
  { id: 1, question: 'What is the capital of France?', options: ['Madrid', 'Paris', 'Berlin', 'Rome'], answerIndex: 1 },
  { id: 2, question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Saturn', 'Mars', 'Jupiter'], answerIndex: 2 },
  { id: 3, question: 'What is 9 + 10?', options: ['18', '19', '20'], answerIndex: 1 },
  { id: 4, question: 'Which language runs in a web browser?', options: ['Java', 'C', 'Python', 'JavaScript'], answerIndex: 3 },
  { id: 5, question: 'Who painted the Mona Lisa?', options: ['Picasso', 'Da Vinci', 'Van Gogh'], answerIndex: 1 },
  { id: 6, question: 'HTTP stands for?', options: ['HyperText Transfer Protocol', 'High Transfer Text Protocol', 'Hyperlink Transmission Process'], answerIndex: 0 },
]

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
  async function loadQuestions(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const apiBase = (import.meta.env.VITE_API_BASE as string) || (import.meta.env.VITE_BACKEND_URL as string) || ''
      const url = apiBase ? `${apiBase.replace(/\/+$/, '')}/api/questions` : ''
      if (!url) {
        // No backend configured; use fallback
        questions.value = fallbackQuestions
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
        questions.value = fallbackQuestions
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
        questions.value = fallbackQuestions
      }
    } catch (e: unknown) {
      const msg = (e && typeof e === 'object' && 'message' in e) ? String((e as { message?: string }).message) : 'Failed to load questions'
      error.value = msg
      questions.value = fallbackQuestions
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

  return {
    // state
    questions, currentIndex, score, selectedIndex, hasSubmitted, loading, error,
    // derived
    total, current, progress, isLast,
    // actions
    resetAll, loadQuestions, selectOption, submitAnswer, nextQuestion, resetRuntime,
  }
})
