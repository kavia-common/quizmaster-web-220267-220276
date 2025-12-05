import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CategoryKey } from './quiz'

/**
 * Category unlock persistent schema and logic.
 * Persists to localStorage with versioned key and exposes actions to check/unlock categories
 * and to evaluate unlock progression based on quiz accuracy.
 */

export type CategoryUnlockSchema = {
  version: 1
  unlocked: Record<CategoryKey, boolean>
  prerequisites: Record<CategoryKey, CategoryKey[]>
  thresholds: { scorePercent: number }
  lastUpdated: number
  // config flags
  dailyCountsForUnlocks: boolean
}

const STORAGE_KEY = 'quizmaster:categoryUnlocks.v1'

const DEFAULT_THRESH = 80

// Default prerequisite graph:
// - GK (gk) is unlocked by default.
// - Science unlocks after GK>=80
// - History unlocks after Science>=80
// - Sports unlocks after GK>=80
// - Movies unlocks after GK>=80
// - Geography unlocks after History>=80
const defaultPrereqs: Record<CategoryKey, CategoryKey[]> = {
  gk: [],
  sports: ['gk'],
  movies: ['gk'],
  science: ['gk'],
  history: ['science'],
  geography: ['history'],
}

function defaultUnlocked(): Record<CategoryKey, boolean> {
  return {
    gk: true,
    sports: false,
    movies: false,
    science: false,
    history: false,
    geography: false,
  }
}

function readState(): CategoryUnlockSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) throw new Error('no state')
    const obj = JSON.parse(raw) as Partial<CategoryUnlockSchema>
    if (!obj || typeof obj !== 'object') throw new Error('bad state')
    // simple validation and migration
    const unlockedObj = (obj.unlocked ?? {}) as Partial<Record<CategoryKey, unknown>>
    const unlocked: Record<CategoryKey, boolean> = {
      gk: !!unlockedObj.gk,
      sports: !!unlockedObj.sports,
      movies: !!unlockedObj.movies,
      science: !!unlockedObj.science,
      history: !!unlockedObj.history,
      geography: !!unlockedObj.geography,
    }
    const thresholdsRaw = (obj.thresholds ?? {}) as Partial<{ scorePercent: unknown }>
    const rawPct = typeof thresholdsRaw.scorePercent === 'number' ? thresholdsRaw.scorePercent : DEFAULT_THRESH
    const thresholds = { scorePercent: Math.max(0, Math.min(100, rawPct)) }
    const lastUpdated = typeof obj.lastUpdated === 'number' ? obj.lastUpdated : Date.now()
    const prereqRaw = (obj.prerequisites ?? defaultPrereqs) as Partial<Record<CategoryKey, CategoryKey[]>>
    const prerequisites: Record<CategoryKey, CategoryKey[]> = {
      gk: prereqRaw.gk ?? defaultPrereqs.gk,
      sports: prereqRaw.sports ?? defaultPrereqs.sports,
      movies: prereqRaw.movies ?? defaultPrereqs.movies,
      science: prereqRaw.science ?? defaultPrereqs.science,
      history: prereqRaw.history ?? defaultPrereqs.history,
      geography: prereqRaw.geography ?? defaultPrereqs.geography,
    }
    const dailyCountsForUnlocks = !!obj.dailyCountsForUnlocks
    return {
      version: 1,
      unlocked,
      prerequisites,
      thresholds,
      lastUpdated,
      dailyCountsForUnlocks,
    }
  } catch {
    return {
      version: 1,
      unlocked: defaultUnlocked(),
      prerequisites: defaultPrereqs,
      thresholds: { scorePercent: DEFAULT_THRESH },
      lastUpdated: Date.now(),
      dailyCountsForUnlocks: false, // default: daily does not count towards unlocks
    }
  }
}

function writeState(s: CategoryUnlockSchema) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore
  }
}

function allPrereqsMet(unlocked: Record<CategoryKey, boolean>, prereqs: CategoryKey[]): boolean {
  return prereqs.every((p) => unlocked[p])
}

// PUBLIC_INTERFACE
export const useCategoryUnlockStore = defineStore('categoryUnlocks', () => {
  /** Persistent state for category unlocks. */
  const state = ref<CategoryUnlockSchema>(readState())

  function persist() {
    state.value.lastUpdated = Date.now()
    writeState(state.value)
  }

  // PUBLIC_INTERFACE
  function loadUnlocks(): CategoryUnlockSchema {
    state.value = readState()
    return state.value
  }

  // PUBLIC_INTERFACE
  function resetUnlocks(): void {
    state.value = {
      version: 1,
      unlocked: defaultUnlocked(),
      prerequisites: defaultPrereqs,
      thresholds: { scorePercent: DEFAULT_THRESH },
      lastUpdated: Date.now(),
      dailyCountsForUnlocks: false,
    }
    persist()
  }

  // PUBLIC_INTERFACE
  function isUnlocked(category: CategoryKey): boolean {
    return !!state.value.unlocked[category]
  }

  // PUBLIC_INTERFACE
  function unlock(category: CategoryKey): void {
    state.value.unlocked[category] = true
    persist()
  }

  // PUBLIC_INTERFACE
  function getLockedReason(category: CategoryKey): string | null {
    if (isUnlocked(category)) return null
    const prereqs = state.value.prerequisites[category] || []
    if (!prereqs.length) return 'Locked by configuration.'
    if (prereqs.length === 1) {
      return `Score ${state.value.thresholds.scorePercent}% in ${labelFor(prereqs[0])} to unlock`
    }
    const chain = prereqs.map((c) => labelFor(c)).join(' → ')
    return `Score ${state.value.thresholds.scorePercent}% in ${chain} to unlock`
  }

  function labelFor(cat: CategoryKey): string {
    const map: Record<CategoryKey, string> = {
      gk: 'General Knowledge',
      sports: 'Sports',
      movies: 'Movies',
      science: 'Science',
      history: 'History',
      geography: 'Geography',
    }
    return map[cat] || String(cat)
  }

  /**
   * Evaluate unlocks after a quiz result.
   * Returns list of newly unlocked categories for UI notifications.
   * If the mode is 'daily' and dailyCountsForUnlocks=false, no changes are made.
   */
  // PUBLIC_INTERFACE
  function evaluateUnlocksFromScore(payload: { category: CategoryKey; accuracyPercent: number; mode?: 'normal' | 'daily' | 'multiplayer' }): CategoryKey[] {
    const { category, accuracyPercent, mode = 'normal' } = payload
    // If daily completions shouldn't count, skip
    if (mode === 'daily' && !state.value.dailyCountsForUnlocks) {
      return []
    }
    const newly: CategoryKey[] = []
    const threshold = state.value.thresholds.scorePercent

    // Mark the played category as unlocked if prerequisites already allowed playing and threshold achieved.
    // (GK is typically unlocked already; this also allows future configs where a locked category could be played via special modes)
    if (accuracyPercent >= threshold) {
      state.value.unlocked[category] = true
    }

    // Now attempt to unlock other categories whose prerequisites are all met.
    const keys: CategoryKey[] = ['gk', 'sports', 'movies', 'science', 'history', 'geography']
    for (const k of keys) {
      if (state.value.unlocked[k]) continue
      const prereqCats = state.value.prerequisites[k] || []
      // prerequisite requirement is that each prereq is unlocked (which implies threshold met previously)
      if (allPrereqsMet(state.value.unlocked, prereqCats)) {
        state.value.unlocked[k] = true
        newly.push(k)
      }
    }

    if (newly.length || accuracyPercent >= threshold) persist()
    return newly
  }

  return {
    state,
    loadUnlocks,
    resetUnlocks,
    isUnlocked,
    unlock,
    evaluateUnlocksFromScore,
    getLockedReason,
  }
})
