import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CategoryKey, QuizQuestion } from './quiz'

export type OfflinePackMeta = {
  category: CategoryKey
  version: string // could be api version or semantic version/hash
  hash: string // content hash for quick comparison
  lastUpdated: number
  size: number // number of questions
}

export type OfflinePack = {
  meta: OfflinePackMeta
  questions: QuizQuestion[]
}

type OfflineState = {
  enabled: boolean
  packs: Record<CategoryKey, OfflinePack | undefined>
}

const STORAGE_KEY = 'quizmaster:offline:packs'
const OFFLINE_FLAG_KEY = 'quizmaster:offline:enabled'

function stableHash(str: string): string {
  // Simple djb2-like hash to produce stable short hex
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(16)
}

type RawQuestion = {
  id?: string | number
  question?: unknown
  options?: unknown
  answerIndex?: unknown
  explanation?: unknown
  detail?: unknown
  source?: unknown
  referenceUrl?: unknown
  hint?: unknown
  clue?: unknown
}
function isRecord(val: unknown): val is Record<string, unknown> {
  return !!val && typeof val === 'object'
}
function isRawQuestion(val: unknown): val is RawQuestion {
  if (!isRecord(val)) return false
  return 'question' in val && 'options' in val && 'answerIndex' in val
}
function toPack(category: CategoryKey, data: unknown, version = 'v1'): OfflinePack | null {
  if (!Array.isArray(data)) return null
  const sanitized: QuizQuestion[] = (data as unknown[])
    .filter((q: unknown) => isRawQuestion(q) && typeof (q as RawQuestion).question === 'string' && Array.isArray((q as RawQuestion).options) && typeof (q as RawQuestion).answerIndex === 'number')
    .map((q: unknown, i: number) => {
      const rq = q as RawQuestion
      const explanation =
        (typeof rq.explanation === 'string' ? rq.explanation : undefined) ??
        (typeof rq.detail === 'string' ? rq.detail : undefined)
      const source = typeof rq.source === 'string' ? rq.source : undefined
      const referenceUrl = typeof rq.referenceUrl === 'string' ? rq.referenceUrl : undefined
      const hint =
        (typeof rq.hint === 'string' ? rq.hint : undefined) ??
        (typeof rq.clue === 'string' ? rq.clue : undefined)
      return {
        id: rq.id ?? `${category}-${i + 1}`,
        question: String(rq.question),
        options: ((rq.options as unknown[]) || []).map(String),
        answerIndex: Number(rq.answerIndex),
        explanation,
        source,
        referenceUrl,
        hint,
      } as QuizQuestion
    })
  if (!sanitized.length) return null
  const payloadStr = JSON.stringify(sanitized)
  const pack: OfflinePack = {
    meta: {
      category,
      version,
      hash: stableHash(payloadStr),
      lastUpdated: Date.now(),
      size: sanitized.length,
    },
    questions: sanitized,
  }
  return pack
}

function readStorage(): OfflineState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const flag = localStorage.getItem(OFFLINE_FLAG_KEY)
    const enabled = flag ? flag === '1' : false
    if (!raw) return { enabled, packs: { gk: undefined, sports: undefined, movies: undefined, science: undefined, history: undefined, geography: undefined } }
    const obj = JSON.parse(raw) as Partial<OfflineState>
    const packs: OfflineState['packs'] = { gk: undefined, sports: undefined, movies: undefined, science: undefined, history: undefined, geography: undefined }
    if (obj && obj.packs && typeof obj.packs === 'object') {
      const src: Record<string, unknown> = obj.packs as Record<string, unknown>
      for (const k of Object.keys(packs) as CategoryKey[]) {
        const p = src[k]
        if (p && typeof p === 'object' && 'meta' in (p as Record<string, unknown>) && Array.isArray((p as { questions?: unknown }).questions)) {
          packs[k] = p as OfflinePack
        }
      }
    }
    return { enabled, packs }
  } catch {
    return { enabled: false, packs: { gk: undefined, sports: undefined, movies: undefined, science: undefined, history: undefined, geography: undefined } }
  }
}

function writeStorage(state: OfflineState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ packs: state.packs }))
    localStorage.setItem(OFFLINE_FLAG_KEY, state.enabled ? '1' : '0')
  } catch {
    // ignore storage quota errors
  }
}

// PUBLIC_INTERFACE
export const useOfflineStore = defineStore('offline', () => {
  const persisted = readStorage()
  const enabled = ref<boolean>(persisted.enabled)
  const packs = ref<OfflineState['packs']>(persisted.packs)

  const categories: CategoryKey[] = ['gk', 'sports', 'movies', 'science', 'history', 'geography']

  const totalSize = computed(() => categories.reduce((acc, k) => acc + (packs.value[k]?.meta.size ?? 0), 0))

  function persist() {
    writeStorage({ enabled: enabled.value, packs: packs.value })
  }

  // PUBLIC_INTERFACE
  function setEnabled(v: boolean) {
    enabled.value = v
    persist()
  }

  // PUBLIC_INTERFACE
  function getStatus(category: CategoryKey): 'Available' | 'Outdated' | 'Not downloaded' {
    const p = packs.value[category]
    if (!p) return 'Not downloaded'
    // We don't have remote version info here; caller can compute "Outdated" based on server meta.
    return 'Available'
  }

  // PUBLIC_INTERFACE
  function getPack(category: CategoryKey): OfflinePack | undefined {
    return packs.value[category]
  }

  // PUBLIC_INTERFACE
  function savePack(category: CategoryKey, data: unknown, version = 'v1'): OfflinePack | null {
    const pack = toPack(category, data, version)
    if (!pack) return null
    packs.value[category] = pack
    persist()
    return pack
  }

  // PUBLIC_INTERFACE
  function deletePack(category: CategoryKey) {
    packs.value[category] = undefined
    persist()
  }

  // PUBLIC_INTERFACE
  function clearAll() {
    for (const k of categories) packs.value[k] = undefined
    persist()
  }

  // PUBLIC_INTERFACE
  function exportPack(category: CategoryKey): string | null {
    const p = packs.value[category]
    if (!p) return null
    const payload = {
      meta: p.meta,
      questions: p.questions,
    }
    return JSON.stringify(payload, null, 2)
  }

  // PUBLIC_INTERFACE
  function importPack(category: CategoryKey, json: string): { ok: boolean; error?: string } {
    try {
      const obj = JSON.parse(json)
      const questions = Array.isArray(obj?.questions) ? obj.questions : obj
      const version = typeof obj?.meta?.version === 'string' ? obj.meta.version : 'v1'
      const pack = toPack(category, questions, version)
      if (!pack) return { ok: false, error: 'Invalid pack content' }
      packs.value[category] = pack
      persist()
      return { ok: true }
    } catch (e: unknown) {
      const msg = (e && typeof e === 'object' && 'message' in e) ? String((e as { message?: string }).message) : 'Invalid JSON'
      return { ok: false, error: msg }
    }
  }

  // PUBLIC_INTERFACE
  async function fetchAndStore(category: CategoryKey): Promise<{ ok: boolean; status: string; pack?: OfflinePack }> {
    const base = (import.meta.env.VITE_API_BASE as string) || (import.meta.env.VITE_BACKEND_URL as string) || ''
    if (!base) {
      return { ok: false, status: 'No backend configured' }
    }
    const url = new URL(`${base.replace(/\/+$/, '')}/api/questions`)
    url.searchParams.set('category', category)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url.toString(), { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const saved = savePack(category, data, 'v1')
      if (!saved) return { ok: false, status: 'Invalid payload' }
      return { ok: true, status: `Downloaded ${saved.meta.size} questions`, pack: saved }
    } catch (e: unknown) {
      const msg = (e && typeof e === 'object' && 'message' in e) ? String((e as { message?: string }).message) : 'Download failed'
      return { ok: false, status: msg }
    }
  }

  // PUBLIC_INTERFACE
  function getStorageUsageSummary(): { totalQuestions: number; categories: Array<{ category: CategoryKey; size: number; lastUpdated: number | null }> } {
    const list = categories.map((c) => ({
      category: c,
      size: packs.value[c]?.meta.size ?? 0,
      lastUpdated: packs.value[c]?.meta.lastUpdated ?? null,
    }))
    return { totalQuestions: totalSize.value, categories: list }
  }

  return {
    enabled,
    categories,
    packs,
    totalSize,
    setEnabled,
    getStatus,
    getPack,
    savePack,
    deletePack,
    clearAll,
    exportPack,
    importPack,
    fetchAndStore,
    getStorageUsageSummary,
  }
})
