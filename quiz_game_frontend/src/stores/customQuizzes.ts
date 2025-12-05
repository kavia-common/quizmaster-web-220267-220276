import { defineStore } from 'pinia'

export type CustomQuizVisibility = 'private' | 'link'

export type CustomQuizQuestion = {
  id: string
  text: string
  options: string[] // 2-6
  correctIndex: number
  explanation?: string
  hint?: string
  referenceUrl?: string
}

export type CustomQuizAuthor = { name?: string }

export type CustomQuiz = {
  id: string
  title: string
  description?: string
  category?: string
  visibility: CustomQuizVisibility
  createdAt: number
  updatedAt: number
  questions: CustomQuizQuestion[]
  author?: CustomQuizAuthor
}

type PersistShape = {
  version: number
  quizzes: CustomQuiz[]
}

const STORAGE_KEY = 'customQuizzes.v1'
const STORAGE_VERSION = 1

function now(): number {
  return Date.now()
}

function uuid(): string {
  try {
    // Prefer crypto UUID if available
    if (typeof globalThis !== 'undefined') {
      const anyCrypto = (globalThis as unknown as { crypto?: { randomUUID?: () => string; getRandomValues?: (arr: Uint8Array) => Uint8Array } }).crypto
      if (anyCrypto && typeof anyCrypto.randomUUID === 'function') {
        return anyCrypto.randomUUID()
      }
      if (anyCrypto && typeof anyCrypto.getRandomValues === 'function') {
        // Fallback using getRandomValues
        const buf = new Uint8Array(16)
        anyCrypto.getRandomValues(buf)
        buf[6] = (buf[6] & 0x0f) | 0x40
        buf[8] = (buf[8] & 0x3f) | 0x80
        const hex = Array.from(buf).map((b) => b.toString(16).padStart(2, '0'))
        return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
      }
    }
    // Fallback
    const buf = new Uint8Array(16)
    buf[6] = (buf[6] & 0x0f) | 0x40
    buf[8] = (buf[8] & 0x3f) | 0x80
    const hex = Array.from(buf).map((b) => b.toString(16).padStart(2, '0'))
    return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
  } catch {
    return 'qz-' + Math.random().toString(36).slice(2, 10)
  }
}

function readStorage(): PersistShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: STORAGE_VERSION, quizzes: [] }
    const obj = JSON.parse(raw) as Partial<PersistShape>
    if (!obj || typeof obj !== 'object') return { version: STORAGE_VERSION, quizzes: [] }
    if (typeof obj.version !== 'number' || !Array.isArray(obj.quizzes)) {
      return { version: STORAGE_VERSION, quizzes: [] }
    }
    // sanitize minimal schema
    const cleaned: CustomQuiz[] = obj.quizzes
      .filter((q) => !!q && typeof q === 'object')
      .map((q) => sanitizeQuiz(q as CustomQuiz))
      .filter((q): q is CustomQuiz => !!q)
    return { version: STORAGE_VERSION, quizzes: cleaned }
  } catch {
    return { version: STORAGE_VERSION, quizzes: [] }
  }
}

function writeStorage(data: PersistShape): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore quota
  }
}

function isUrlSafeBase64(s: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(s)
}

function toUrlSafeBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  // btoa expects binary string
  const base64 = btoa(bin)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
function fromUrlSafeBase64(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : ''
  const bin = atob(b64 + pad)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

function utf8Encode(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}
function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

/**
 * Validate and sanitize a candidate CustomQuiz object.
 */
function sanitizeQuiz(q: Partial<CustomQuiz>): CustomQuiz | null {
  if (!q || typeof q !== 'object') return null
  const id = typeof q.id === 'string' && q.id ? q.id : uuid()
  const title = typeof q.title === 'string' ? q.title.trim() : ''
  if (!title) return null
  const visibility: CustomQuizVisibility = q.visibility === 'link' ? 'link' : 'private'
  const createdAt = typeof q.createdAt === 'number' ? q.createdAt : now()
  const updatedAt = typeof q.updatedAt === 'number' ? q.updatedAt : createdAt
  const description = typeof q.description === 'string' ? q.description : undefined
  const category = typeof q.category === 'string' ? q.category : undefined
  const author: CustomQuizAuthor | undefined =
    q.author && typeof q.author === 'object'
      ? { name: typeof q.author.name === 'string' ? q.author.name : undefined }
      : undefined

  const questions = Array.isArray(q.questions) ? q.questions : []
  const cleanedQuestions: CustomQuizQuestion[] = questions
    .filter((qq) => !!qq && typeof qq === 'object')
    .map((qq) => {
      const id = typeof (qq as CustomQuizQuestion).id === 'string' && (qq as CustomQuizQuestion).id
        ? (qq as CustomQuizQuestion).id
        : uuid()
      const text = typeof (qq as CustomQuizQuestion).text === 'string' ? (qq as CustomQuizQuestion).text.trim() : ''
      const optionsIn = Array.isArray((qq as CustomQuizQuestion).options) ? (qq as CustomQuizQuestion).options : []
      const options = optionsIn.map((o) => String(o)).filter((o) => o.length > 0).slice(0, 6)
      const correctIndexNum = Number((qq as CustomQuizQuestion).correctIndex)
      const correctIndex = Number.isFinite(correctIndexNum) ? correctIndexNum : -1
      const explanation =
        typeof (qq as CustomQuizQuestion).explanation === 'string' ? (qq as CustomQuizQuestion).explanation : undefined
      const hint =
        typeof (qq as CustomQuizQuestion).hint === 'string' ? (qq as CustomQuizQuestion).hint : undefined
      const referenceUrl =
        typeof (qq as CustomQuizQuestion).referenceUrl === 'string'
          ? (qq as CustomQuizQuestion).referenceUrl
          : undefined
      return { id, text, options, correctIndex, explanation, hint, referenceUrl }
    })
    .filter((qq) => qq.text && qq.options.length >= 2 && qq.correctIndex >= 0 && qq.correctIndex < qq.options.length)
    .slice(0, 200)

  if (!cleanedQuestions.length) return null

  return {
    id,
    title,
    description,
    category,
    visibility,
    createdAt,
    updatedAt,
    questions: cleanedQuestions,
    author,
  }
}

// PUBLIC_INTERFACE
export const useCustomQuizzesStore = defineStore('customQuizzes', {
  state: () => ({
    version: STORAGE_VERSION as number,
    quizzes: [] as CustomQuiz[],
    loaded: false as boolean,
  }),
  actions: {
    /** PUBLIC_INTERFACE
     * Load quizzes from localStorage into store.
     */
    load(): void {
      const data = readStorage()
      this.version = data.version
      this.quizzes = data.quizzes
      this.loaded = true
    },
    /** PUBLIC_INTERFACE
     * Persist current store to localStorage.
     */
    save(): void {
      writeStorage({ version: this.version, quizzes: this.quizzes })
    },
    /** PUBLIC_INTERFACE
     * Return all quizzes sorted by updatedAt desc.
     */
    list(): CustomQuiz[] {
      if (!this.loaded) this.load()
      return [...this.quizzes].sort((a, b) => b.updatedAt - a.updatedAt)
    },
    /** PUBLIC_INTERFACE
     * Get quiz by id or null.
     */
    get(id: string): CustomQuiz | null {
      if (!this.loaded) this.load()
      const q = this.quizzes.find((x) => x.id === id)
      return q ? { ...q, questions: q.questions.map((qq) => ({ ...qq })) } : null
    },
    /** PUBLIC_INTERFACE
     * Create a new quiz. Returns created quiz.
     */
    create(payload: Omit<CustomQuiz, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): CustomQuiz {
      const draft: Partial<CustomQuiz> = {
        ...payload,
        id: payload.id || uuid(),
        createdAt: now(),
        updatedAt: now(),
      }
      const quiz = sanitizeQuiz(draft)
      if (!quiz) throw new Error('Invalid quiz data')
      this.quizzes.unshift(quiz)
      this.save()
      return quiz
    },
    /** PUBLIC_INTERFACE
     * Update existing quiz by id. Returns updated quiz or null if not found/invalid.
     */
    update(id: string, changes: Partial<CustomQuiz>): CustomQuiz | null {
      if (!this.loaded) this.load()
      const idx = this.quizzes.findIndex((q) => q.id === id)
      if (idx === -1) return null
      const merged: Partial<CustomQuiz> = { ...this.quizzes[idx], ...changes, id, updatedAt: now() }
      const sanitized = sanitizeQuiz(merged)
      if (!sanitized) return null
      this.quizzes[idx] = sanitized
      this.save()
      return sanitized
    },
    /** PUBLIC_INTERFACE
     * Remove quiz by id. Returns true if removed.
     */
    remove(id: string): boolean {
      if (!this.loaded) this.load()
      const before = this.quizzes.length
      this.quizzes = this.quizzes.filter((q) => q.id !== id)
      const changed = this.quizzes.length !== before
      if (changed) this.save()
      return changed
    },
    /** PUBLIC_INTERFACE
     * Export a quiz as JSON string for portability.
     */
    exportQuizJson(id: string): { ok: boolean; json?: string; error?: string } {
      const q = this.get(id)
      if (!q) return { ok: false, error: 'Quiz not found' }
      try {
        const json = JSON.stringify(q, null, 2)
        return { ok: true, json }
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : 'Export failed'
        return { ok: false, error: msg }
      }
    },
    /** PUBLIC_INTERFACE
     * Import a quiz from JSON string. Assigns a new id and timestamps.
     */
    importQuizJson(json: string): { ok: boolean; quiz?: CustomQuiz; error?: string } {
      try {
        const obj = JSON.parse(json) as Partial<CustomQuiz>
        // Assign new identifiers and timestamps to avoid collisions
        delete (obj as { id?: string }).id
        const sanitized = sanitizeQuiz({
          ...obj,
          id: uuid(),
          createdAt: now(),
          updatedAt: now(),
        })
        if (!sanitized) return { ok: false, error: 'Invalid quiz JSON' }
        this.quizzes.unshift(sanitized)
        this.save()
        return { ok: true, quiz: sanitized }
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : 'Invalid JSON'
        return { ok: false, error: msg }
      }
    },
    /** PUBLIC_INTERFACE
     * Encode a quiz to a short, URL-safe token for sharing via link.
     */
    encodeQuizToToken(id: string): { ok: boolean; token?: string; error?: string } {
      const q = this.get(id)
      if (!q) return { ok: false, error: 'Quiz not found' }
      try {
        // Only include public fields; omit createdAt/updatedAt/ids inside to allow recipients to assign new ids
        const payload = {
          t: q.title,
          d: q.description ?? null,
          c: q.category ?? null,
          v: q.visibility,
          a: q.author?.name ?? null,
          q: q.questions.map((x) => ({
            t: x.text,
            o: x.options,
            c: x.correctIndex,
            e: x.explanation ?? null,
            h: x.hint ?? null,
            r: x.referenceUrl ?? null,
          })),
        }
        const json = JSON.stringify(payload)
        const token = toUrlSafeBase64(utf8Encode(json))
        return { ok: true, token }
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : 'Encode failed'
        return { ok: false, error: msg }
      }
    },
    /** PUBLIC_INTERFACE
     * Decode a token back to a quiz object (not persisted). Validates schema.
     */
    decodeTokenToQuiz(token: string): { ok: boolean; quiz?: Omit<CustomQuiz, 'id' | 'createdAt' | 'updatedAt'>; error?: string } {
      try {
        if (!isUrlSafeBase64(token)) return { ok: false, error: 'Invalid token' }
        const bytes = fromUrlSafeBase64(token)
        const json = utf8Decode(bytes)
        const obj = JSON.parse(json) as unknown
        if (!obj || typeof obj !== 'object') return { ok: false, error: 'Invalid token data' }
        const rec = obj as Record<string, unknown>
        const title = typeof rec.t === 'string' ? rec.t : ''
        const description = typeof rec.d === 'string' ? rec.d : undefined
        const category = typeof rec.c === 'string' ? rec.c : undefined
        const visibility: CustomQuizVisibility = rec.v === 'link' ? 'link' : 'private'
        const authorName = typeof rec.a === 'string' ? rec.a : undefined
        const questionsIn = Array.isArray(rec.q) ? (rec.q as Array<Record<string, unknown>>) : []
        const questions: CustomQuizQuestion[] = questionsIn
          .map((r) => {
            const text = typeof r.t === 'string' ? r.t.trim() : ''
            const options = Array.isArray(r.o) ? (r.o as unknown[]).map(String).filter((s) => s.length > 0).slice(0, 6) : []
            const correctIndex = Number(r.c)
            const explanation = typeof r.e === 'string' ? r.e : undefined
            const hint = typeof r.h === 'string' ? r.h : undefined
            const referenceUrl = typeof r.r === 'string' ? r.r : undefined
            return { id: uuid(), text, options, correctIndex, explanation, hint, referenceUrl }
          })
          .filter((qq) => qq.text && qq.options.length >= 2 && qq.correctIndex >= 0 && qq.correctIndex < qq.options.length)
        const draft: Partial<CustomQuiz> = {
          id: uuid(),
          title,
          description,
          category,
          visibility,
          createdAt: now(),
          updatedAt: now(),
          questions,
          author: authorName ? { name: authorName } : undefined,
        }
        const sanitized = sanitizeQuiz(draft)
        if (!sanitized) return { ok: false, error: 'Invalid quiz content' }
        // strip runtime fields for return type
        const out: Omit<CustomQuiz, 'id' | 'createdAt' | 'updatedAt'> = {
          title: sanitized.title,
          description: sanitized.description,
          category: sanitized.category,
          visibility: sanitized.visibility,
          questions: sanitized.questions,
          author: sanitized.author,
        }
        return { ok: true, quiz: out }
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : 'Decode failed'
        return { ok: false, error: msg }
      }
    },
  },
})
