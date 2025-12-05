import { defineStore } from 'pinia'

/**
 * Ocean Professional colors
 * primary: #2563EB
 * secondary/success (coins): #F59E0B
 */

export type CoinReason =
  | 'correct-answer'
  | 'quiz-complete'
  | 'challenge-win'
  | 'daily-complete'
  | 'bonus'

export interface CoinHistoryItem {
  id: string // idempotency key to prevent duplicates
  ts: number
  delta: number
  reason: CoinReason
  meta?: Record<string, string | number>
}

export interface CoinsState {
  balance: number
  lifetimeEarned: number
  history: CoinHistoryItem[]
  // marker for version migrations if needed
  _version: number
}

const STORAGE_KEY = 'coins.v1'

// Tunable earning rules
export const COIN_RULES = {
  CORRECT_ANSWER: 2,
  QUIZ_COMPLETE: 10,
  DAILY_COMPLETE: 5,
  MULTIPLAYER_WIN: 15,
  // Set to 0 to disable participation awards or to 3 to enable
  PARTICIPATION: 3,
} as const

function nowTs(): number {
  return Date.now()
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * PUBLIC_INTERFACE
 * Coins store to manage in-app coin balance with persistence and idempotent award history.
 */
export const useCoinsStore = defineStore('coins', {
  state: (): CoinsState => ({
    balance: 0,
    lifetimeEarned: 0,
    history: [],
    _version: 1,
  }),
  getters: {
    /**
     * PUBLIC_INTERFACE
     * Returns current coin balance.
     */
    getBalance(state): number {
      return state.balance
    },
    /**
     * PUBLIC_INTERFACE
     * Returns lifetime coins earned (sum of positive deltas ever credited).
     */
    getLifetimeEarned(state): number {
      return state.lifetimeEarned
    },
    /**
     * PUBLIC_INTERFACE
     * Returns latest history items, optionally limited.
     */
    getHistory:
      (state) =>
      (limit?: number): CoinHistoryItem[] => {
        const arr = [...state.history].sort((a, b) => b.ts - a.ts)
        return typeof limit === 'number' ? arr.slice(0, limit) : arr
      },
  },
  actions: {
    /**
     * PUBLIC_INTERFACE
     * Load coins state from localStorage.
     */
    load(): void {
      const parsed = safeParse<CoinsState>(localStorage.getItem(STORAGE_KEY))
      if (parsed && typeof parsed.balance === 'number') {
        // simple versioning hook: if future migration required, handle by _version
        this.balance = parsed.balance
        this.lifetimeEarned = parsed.lifetimeEarned ?? parsed.history
          .filter(h => h.delta > 0)
          .reduce((sum, h) => sum + h.delta, 0)
        this.history = Array.isArray(parsed.history) ? parsed.history : []
        this._version = 1
      } else {
        // initialize empty persisted state
        this.save()
      }
    },
    /**
     * PUBLIC_INTERFACE
     * Persist current state to localStorage.
     */
    save(): void {
      const payload: CoinsState = {
        balance: this.balance,
        lifetimeEarned: this.lifetimeEarned,
        history: this.history,
        _version: this._version,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    },
    /**
     * PUBLIC_INTERFACE
     * Add coins delta with idempotency control.
     * - If an entry with the same id exists, it will not double-award.
     * - Positive delta increases lifetimeEarned.
     */
    add(delta: number, reason: CoinReason, id: string, meta?: Record<string, string | number>): void {
      if (!id) {
        // Safety: require id for idempotency
        console.warn('Coins.add called without idempotency id; ignored')
        return
      }
      // Deduplicate
      if (this.history.find(h => h.id === id)) {
        return
      }
      const item: CoinHistoryItem = {
        id,
        ts: nowTs(),
        delta,
        reason,
        meta,
      }
      this.history.push(item)
      this.balance += delta
      if (delta > 0) this.lifetimeEarned += delta
      this.save()
    },
    /**
     * PUBLIC_INTERFACE
     * Reset coins data (dev/testing). Not wired to UI.
     */
    reset(): void {
      this.balance = 0
      this.lifetimeEarned = 0
      this.history = []
      this._version = 1
      this.save()
    },
    /**
     * Optional: Spend API for future shop.
     * PUBLIC_INTERFACE
     * Attempts to spend amount; returns true if success, false if insufficient.
     */
    spend(amount: number, id: string, meta?: Record<string, string | number>): boolean {
      if (amount <= 0) return true
      if (this.balance < amount) return false
      // idempotent spend guard
      if (id && this.history.find(h => h.id === id)) {
        return true
      }
      this.history.push({
        id,
        ts: nowTs(),
        delta: -amount,
        reason: 'bonus', // spending categorized under 'bonus' for now; can expand enum later if needed
        meta: { ...(meta ?? {}), type: 'spend' },
      })
      this.balance -= amount
      // lifetimeEarned should not decrease on spend
      this.save()
      return true
    },
  },
})

// Helpers for composing idempotency keys consistently across app
export const CoinIds = {
  correctAnswer: (sessionId: string, questionIndex: number) =>
    `sa:${sessionId}:${questionIndex}`,
  quizComplete: (sessionId: string) => `qc:${sessionId}`,
  dailyComplete: (dailyId: string) => `dc:${dailyId}`,
  multiplayerWin: (roomCode: string, round: number, userId: string) =>
    `mw:${roomCode}:${round}:${userId}`,
  multiplayerParticipation: (roomCode: string, round: number, userId: string) =>
    `mp:${roomCode}:${round}:${userId}`,
} as const

// PUBLIC_INTERFACE
export function ensureCoinsLoaded(): void {
  const store = useCoinsStore()
  if (store.history.length === 0 && store.balance === 0 && store.lifetimeEarned === 0) {
    // naive heuristic; still safe if state is legitimately zeroed as we save() after load on first write
    store.load()
  }
}
