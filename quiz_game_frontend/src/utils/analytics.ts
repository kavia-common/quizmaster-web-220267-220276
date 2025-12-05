export type ModeKey = 'normal' | 'daily' | 'multiplayer'

export type AnalyticsMeta = {
  totalQuestions: number
  correctCount: number
  wrongCount: number
  skippedCount: number
  durations: number[] // milliseconds per answered question index-aligned where possible
  category: string
  mode: ModeKey
  startedAt: number
  completedAt: number
  // optional streak/strike per quiz
  longestCorrectStreak?: number
}

export type ScoreEntryLite = {
  score: number
  total: number
  category: string
  date: number
  meta?: unknown
}

export type CategoryStats = {
  category: string
  attempts: number // answered (correct + wrong)
  correct: number
  wrong: number
  skipped: number
  accuracy: number // 0..100
  avgTimeMs: number | null // null when no durations
}

export type WeakCategory = {
  category: string
  accuracy: number
  attempts: number
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

// PUBLIC_INTERFACE
export function accuracyPercentage(correct: number, wrong: number, includeSkipped = false, skipped = 0): number {
  /** Compute accuracy percentage. If includeSkipped is true, includes skipped in denominator. */
  const denom = includeSkipped ? correct + wrong + skipped : correct + wrong
  if (denom <= 0) return 0
  return clampPct((correct / denom) * 100)
}

// PUBLIC_INTERFACE
export function averageTimeMs(durations: number[] | null | undefined): number | null {
  /** Average time in ms for provided durations; guards empty arrays. */
  if (!durations || !durations.length) return null
  const sum = durations.reduce((a, b) => a + (isFinite(b) ? b : 0), 0)
  const count = durations.filter((d) => isFinite(d)).length
  if (count <= 0) return null
  return Math.max(0, Math.round(sum / count))
}

// PUBLIC_INTERFACE
export function longestStrike(correctFlags: boolean[]): number {
  /** Longest streak of consecutive true values in the given list. */
  let best = 0
  let run = 0
  for (const ok of correctFlags) {
    if (ok) {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return best
}

// PUBLIC_INTERFACE
export function mostPlayedCategory(entries: Array<Pick<AnalyticsMeta, 'category'>>): string | null {
  /** Most frequent category; tie-break alphabetically. */
  if (!entries.length) return null
  const freq = new Map<string, number>()
  for (const e of entries) {
    const c = String(e.category || '')
    freq.set(c, (freq.get(c) || 0) + 1)
  }
  const list = [...freq.entries()]
  list.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })
  return list.length ? list[0][0] : null
}

// PUBLIC_INTERFACE
export function computeCategoryBreakdown(history: AnalyticsMeta[]): CategoryStats[] {
  /** Aggregates per-category stats: attempts, accuracy, avg time. */
  const map = new Map<string, { attempts: number; correct: number; wrong: number; skipped: number; durations: number[] }>()
  for (const h of history) {
    const k = h.category
    const cur = map.get(k) || { attempts: 0, correct: 0, wrong: 0, skipped: 0, durations: [] }
    cur.correct += h.correctCount
    cur.wrong += h.wrongCount
    cur.skipped += h.skippedCount
    cur.attempts += h.correctCount + h.wrongCount
    // add only durations for answered questions; we assume durations[] already excludes skipped
    if (Array.isArray(h.durations)) {
      for (const d of h.durations) {
        if (isFinite(d) && d >= 0) cur.durations.push(d)
      }
    }
    map.set(k, cur)
  }
  const out: CategoryStats[] = []
  for (const [category, agg] of map.entries()) {
    const acc = accuracyPercentage(agg.correct, agg.wrong)
    const avg = averageTimeMs(agg.durations)
    out.push({
      category,
      attempts: agg.attempts,
      correct: agg.correct,
      wrong: agg.wrong,
      skipped: agg.skipped,
      accuracy: Math.round(acc),
      avgTimeMs: avg,
    })
  }
  out.sort((a, b) => a.category.localeCompare(b.category))
  return out
}

// PUBLIC_INTERFACE
export function detectWeakCategories(
  breakdown: CategoryStats[],
  opts?: { thresholdPct?: number; minAttempts?: number }
): WeakCategory[] {
  /** Return categories with accuracy below threshold and at least minAttempts attempts. */
  const threshold = Math.max(0, Math.min(100, opts?.thresholdPct ?? 60))
  const min = Math.max(0, opts?.minAttempts ?? 5)
  const weak = breakdown
    .filter((c) => c.attempts >= min && c.accuracy < threshold)
    .map((c) => ({ category: c.category, accuracy: c.accuracy, attempts: c.attempts }))
  weak.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy
    return b.attempts - a.attempts
  })
  return weak
}

// PUBLIC_INTERFACE
export function lifetimeStrikeBest(history: AnalyticsMeta[]): number {
  /** Computes the best per-quiz longestCorrectStreak across history. */
  let best = 0
  for (const h of history) {
    const s = h.longestCorrectStreak ?? 0
    if (s > best) best = s
  }
  return best
}

// PUBLIC_INTERFACE
export function aggregateRecentPerformance(history: AnalyticsMeta[], limit = 10): Array<{ when: number; accuracy: number; avgTimeMs: number | null }> {
  /** Returns last N quizzes with accuracy and average time per answered question. */
  const sorted = [...history].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
  const slice = sorted.slice(0, Math.max(0, limit))
  return slice.map((h) => ({
    when: h.completedAt,
    accuracy: Math.round(accuracyPercentage(h.correctCount, h.wrongCount)),
    avgTimeMs: averageTimeMs(h.durations),
  }))
}

// PUBLIC_INTERFACE
export function strikeForAnswers(answers: Array<number | 'SKIPPED'>, questions: Array<{ answerIndex: number }>): number {
  /** Compute longest strike given selected answers array and questions answerIndex. */
  const flags: boolean[] = []
  for (let i = 0; i < questions.length; i++) {
    const sel = answers[i]
    if (sel === 'SKIPPED' || typeof sel !== 'number') {
      flags.push(false)
      continue
    }
    flags.push(sel === questions[i].answerIndex)
  }
  return longestStrike(flags)
}

// PUBLIC_INTERFACE
export function backfillAnalyticsFromScore(entry: ScoreEntryLite): AnalyticsMeta {
  /** Build a minimal analytics record from an older scoreboard entry lacking durations. */
  const wrong = Math.max(0, entry.total - entry.score)
  return {
    totalQuestions: entry.total,
    correctCount: Math.max(0, entry.score),
    wrongCount: wrong,
    skippedCount: 0,
    durations: [],
    category: entry.category,
    mode: 'normal',
    startedAt: entry.date,
    completedAt: entry.date,
    longestCorrectStreak: 0,
  }
}
