import { defineStore } from 'pinia'
import { ensureCoinsLoaded, useCoinsStore, COIN_RULES, CoinIds } from './coins'
import { computed, ref, watch } from 'vue'
import type { CategoryKey, QuizQuestion } from './quiz'

/**
 * Multiplayer client store with WebSocket hookup (if configured) and local demo fallback.
 * Tracks room state, players, synchronized question set via shared seed, answer submissions,
 * fastest-correct scoring and reconnection.
 */

export type Player = {
  id: string
  name: string
  score: number
  ready: boolean
}

export type AnswerSubmission = {
  playerId: string
  questionIndex: number
  answerIndex: number
  correct: boolean
  ts: number // client-side timestamp ms since epoch
}

export type RoomState = {
  roomCode: string
  isHost: boolean
  playerId: string
  playerName: string
  players: Player[]
  // game state
  category: CategoryKey | null
  seed: string | null // seed/hash that derives question order
  currentQuestionIndex: number
  questionStartTs: number | null
  questions: QuizQuestion[]
  // per-question submissions
  submissions: AnswerSubmission[]
  // networking
  connected: boolean
  reconnecting: boolean
  lastSocketError: string | null
}

type Persisted = {
  roomCode: string
  isHost: boolean
  playerId: string
  playerName: string
}

const MP_STORE_KEY = 'quizmaster:mp:session'
const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) || ''

// Configurable scoring constants
export const FULL_POINTS = 10
export const REDUCED_POINTS = 5

// Deterministic pseudo-random util (xorshift32-like) for seeding
import poolsDefault from '../utils/pools'

function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  let seed = 0
  // derive numeric seed from string
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) | 0
  seed = seed || 123456789
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    // xorshift32
    seed ^= seed << 13
    seed ^= seed >> 17
    seed ^= seed << 5
    const r = Math.abs(seed) / 0x7fffffff
    const j = Math.floor(r * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // avoid ambiguous chars
  let code = ''
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(MP_STORE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return null
    if (
      typeof p.roomCode === 'string' &&
      typeof p.playerId === 'string' &&
      typeof p.playerName === 'string' &&
      typeof p.isHost === 'boolean'
    ) {
      return p
    }
    return null
  } catch {
    return null
  }
}
function savePersisted(p: Persisted | null) {
  try {
    if (!p) {
      localStorage.removeItem(MP_STORE_KEY)
      return
    }
    localStorage.setItem(MP_STORE_KEY, JSON.stringify(p))
  } catch {}
}

type WsMessage =
  | { type: 'HELLO'; roomCode: string; playerId: string; name: string }
  | { type: 'ROOM_CREATED'; roomCode: string }
  | { type: 'ROOM_JOINED'; roomCode: string; players: Player[]; category?: CategoryKey; seed?: string; currentQuestionIndex?: number }
  | { type: 'PLAYER_LIST'; players: Player[] }
  | { type: 'READY'; playerId: string; ready: boolean }
  | { type: 'START'; category: CategoryKey; seed: string; questionStartTs: number }
  | { type: 'QUESTION_INDEX'; index: number; questionStartTs: number }
  | { type: 'SUBMISSION'; submission: AnswerSubmission }
  | { type: 'SCORES'; players: Player[] }
  | { type: 'PING' }
  | { type: 'REJOIN'; roomCode: string; playerId: string }
  | { type: 'ERROR'; message: string }

let socket: WebSocket | null = null
let pingTimer: number | null = null

export const useMultiplayerStore = defineStore('multiplayer', () => {
  const state = ref<RoomState>({
    roomCode: '',
    isHost: false,
    playerId: '',
    playerName: '',
    players: [],
    category: null,
    seed: null,
    currentQuestionIndex: 0,
    questionStartTs: null,
    questions: [],
    submissions: [],
    connected: false,
    reconnecting: false,
    lastSocketError: null,
  })

  const isInRoom = computed(() => !!state.value.roomCode && !!state.value.playerId)
  const me = computed(() => state.value.players.find(p => p.id === state.value.playerId) || null)
  const leaderboard = computed(() => [...state.value.players].sort((a, b) => b.score - a.score))
  const hasBackend = computed(() => !!WS_URL)

  // PUBLIC_INTERFACE
  function createRoom(playerName: string): string {
    /** Create a room (host). If a WS backend is configured, send create; else local demo room is created. */
    const roomCode = randomRoomCode()
    const playerId = cryptoRandomId()
    state.value.roomCode = roomCode
    state.value.isHost = true
    state.value.playerId = playerId
    state.value.playerName = playerName.trim().slice(0, 16) || 'Host'
    state.value.players = [
      { id: playerId, name: state.value.playerName, score: 0, ready: false },
    ]
    persistIdentity()
    if (WS_URL) {
      openSocketAndHello()
    } else {
      // local demo mode: keep only in-memory state. Users can simulate a second player later.
      state.value.connected = true
    }
    return roomCode
  }

  // PUBLIC_INTERFACE
  function joinRoom(roomCode: string, playerName: string): boolean {
    /** Join an existing room. In demo mode, we simulate a local second player inside same tab. */
    const code = roomCode.toUpperCase().trim()
    if (!code) return false
    const playerId = cryptoRandomId()
    state.value.roomCode = code
    state.value.isHost = false
    state.value.playerId = playerId
    state.value.playerName = playerName.trim().slice(0, 16) || 'Player'
    // In demo mode, if there is no WS, we simulate the host also in this tab if not present
    if (!WS_URL) {
      if (!state.value.players.length) {
        // create a pseudo-host bot first to simulate an existing room
        const hostId = cryptoRandomId()
        state.value.players = [
          { id: hostId, name: 'Host (Demo)', score: 0, ready: false },
        ]
      }
      // add this player
      state.value.players.push({ id: playerId, name: state.value.playerName, score: 0, ready: false })
      state.value.connected = true
      persistIdentity()
      return true
    }
    // Real backend flow:
    persistIdentity()
    openSocketAndHello()
    return true
  }

  // PUBLIC_INTERFACE
  function readyUp(ready: boolean) {
    /** Toggle ready state for this player. In WS mode, notify server; in demo mode, update locally. */
    const mine = me.value
    if (!mine) return
    mine.ready = ready
    state.value.players = [...state.value.players]
    if (WS_URL && socket && socket.readyState === WebSocket.OPEN) {
      const msg: WsMessage = { type: 'READY', playerId: state.value.playerId, ready }
      socket.send(JSON.stringify(msg))
    }
  }

  // PUBLIC_INTERFACE
  function hostStart(category: CategoryKey) {
    /** Host picks category and starts the game. Generates a seed and synchronizes question order. */
    if (!state.value.isHost) return
    const seed = `${state.value.roomCode}:${category}:${Date.now()}`
    state.value.category = category
    state.value.seed = seed
    state.value.currentQuestionIndex = 0
    state.value.submissions = []
    // Question pool is derived client-side using the existing quiz fallback pools.
    const pool = getPoolSync(category)
    state.value.questions = seededShuffle(pool, seed)
    state.value.questionStartTs = Date.now()
    if (WS_URL && socket && socket.readyState === WebSocket.OPEN) {
      const msg: WsMessage = { type: 'START', category, seed, questionStartTs: state.value.questionStartTs! }
      socket.send(JSON.stringify(msg))
    } else {
      // demo: nothing to send, same-tab users share state
    }
  }

  // PUBLIC_INTERFACE
  function submitAnswer(answerIndex: number) {
    /** Submit an answer for the current question, compute scoring per fastest-correct rule. */
    const qIdx = state.value.currentQuestionIndex
    const ts = Date.now()
    const question = state.value.questions[qIdx]
    if (!question) return
    const correct = answerIndex === question.answerIndex
    const submission: AnswerSubmission = {
      playerId: state.value.playerId,
      questionIndex: qIdx,
      answerIndex,
      correct,
      ts,
    }

    // In WS mode send to server (server will broadcast authoritative scoring)
    if (WS_URL && socket && socket.readyState === WebSocket.OPEN) {
      const msg: WsMessage = { type: 'SUBMISSION', submission }
      socket.send(JSON.stringify(msg))
      // Optimistic local append
      appendSubmissionAndScore(submission)
    } else {
      // demo: local scoring
      appendSubmissionAndScore(submission)
    }
  }

  // PUBLIC_INTERFACE
  function nextQuestion(): boolean {
    /** Host or local flow: advance to next question index and reset per-question start timestamp. */
    // Award coins for current question winners/participants prior to advancing
    try {
      const room = state.value.roomCode || 'LOCAL'
      const round = state.value.currentQuestionIndex
      const subs = state.value.submissions.filter(s => s.questionIndex === round)
      if (subs.length) {
        const correctSubs = subs.filter(s => s.correct)
        if (correctSubs.length) {
          const firstTs = Math.min(...correctSubs.map(s => s.ts))
          const winners = correctSubs.filter(s => s.ts === firstTs).map(s => s.playerId)
          ensureCoinsLoaded()
          const coins = useCoinsStore()
          // winners
          for (const uid of winners) {
            const id = CoinIds.multiplayerWin(room, round, uid)
            coins.add(COIN_RULES.MULTIPLAYER_WIN, 'challenge-win', id, { roomCode: room, round, userId: uid })
          }
          // participants
          if (COIN_RULES.PARTICIPATION > 0) {
            const others = Array.from(new Set(subs.map(s => s.playerId))).filter(uid => !winners.includes(uid))
            for (const uid of others) {
              const id = CoinIds.multiplayerParticipation(room, round, uid)
              coins.add(COIN_RULES.PARTICIPATION, 'bonus', id, { roomCode: room, round, userId: uid })
            }
          }
        } else if (COIN_RULES.PARTICIPATION > 0) {
          // no one answered correctly: optionally grant participation to all who attempted
          ensureCoinsLoaded()
          const coins = useCoinsStore()
          const all = Array.from(new Set(subs.map(s => s.playerId)))
          for (const uid of all) {
            const id = CoinIds.multiplayerParticipation(room, round, uid)
            coins.add(COIN_RULES.PARTICIPATION, 'bonus', id, { roomCode: room, round, userId: uid })
          }
        }
      }
    } catch (e) {
      console.warn('coin award failed (multiplayer nextQuestion):', e)
    }
    const nextIndex = state.value.currentQuestionIndex + 1
    if (nextIndex >= state.value.questions.length) return false
    state.value.currentQuestionIndex = nextIndex
    state.value.questionStartTs = Date.now()
    if (WS_URL && socket && socket.readyState === WebSocket.OPEN && state.value.isHost) {
      const msg: WsMessage = { type: 'QUESTION_INDEX', index: nextIndex, questionStartTs: state.value.questionStartTs! }
      socket.send(JSON.stringify(msg))
    }
    return true
  }

  // PUBLIC_INTERFACE
  function fastestWinnerNameForQuestion(qIdx: number): string | null {
    /** Returns the display name of the first correct submission for a question, or null if none. */
    const subs = state.value.submissions.filter(s => s.questionIndex === qIdx && s.correct)
    if (!subs.length) return null
    const first = subs.sort((a, b) => a.ts - b.ts)[0]
    const p = state.value.players.find(pl => pl.id === first.playerId)
    return p?.name || null
  }

  // PUBLIC_INTERFACE
  function leaveRoom() {
    /** Leave current room and clear local MP state. */
    // do not clear persisted identity to allow reconnect, but reset room fields
    try { if (socket) socket.close() } catch {}
    socket = null
    if (pingTimer != null) { clearInterval(pingTimer); pingTimer = null }
    const id = state.value.playerId
    const name = state.value.playerName
    const isHost = state.value.isHost
    savePersisted({ roomCode: '', playerId: id, playerName: name, isHost }) // keep identity without room
    state.value = {
      roomCode: '',
      isHost,
      playerId: id,
      playerName: name,
      players: [],
      category: null,
      seed: null,
      currentQuestionIndex: 0,
      questionStartTs: null,
      questions: [],
      submissions: [],
      connected: false,
      reconnecting: false,
      lastSocketError: null,
    }
  }

  // PUBLIC_INTERFACE
  function tryResumeFromLocal(): boolean {
    /** Attempt to restore MP identity and rejoin room via WS if configured. */
    const p = loadPersisted()
    if (!p) return false
    state.value.roomCode = p.roomCode || ''
    state.value.isHost = !!p.isHost
    state.value.playerId = p.playerId || cryptoRandomId()
    state.value.playerName = p.playerName || 'Player'
    if (state.value.roomCode && WS_URL) {
      state.value.reconnecting = true
      openSocketAndHello(true)
    }
    return true
  }

  function appendSubmissionAndScore(submission: AnswerSubmission) {
    // prevent duplicate submissions from same player for same question
    const exists = state.value.submissions.find(s => s.playerId === submission.playerId && s.questionIndex === submission.questionIndex)
    if (exists) return
    state.value.submissions.push(submission)

    // scoring for correct answers:
    if (submission.correct) {
      const firstCorrect = state.value.submissions
        .filter(s => s.questionIndex === submission.questionIndex && s.correct)
        .sort((a, b) => a.ts - b.ts)[0]
      const isFirst = firstCorrect && firstCorrect.playerId === submission.playerId
      const points = isFirst ? FULL_POINTS : REDUCED_POINTS
      const p = state.value.players.find(pl => pl.id === submission.playerId)
      if (p) p.score += points
      state.value.players = [...state.value.players]
    }
  }

  // Sync pool accessor using static ESM import (poolsDefault at module scope)
  function getPoolSync(category: CategoryKey): QuizQuestion[] {
    const pools = poolsDefault as Record<CategoryKey, QuizQuestion[]>
    return pools[category] || pools.gk
  }

  function persistIdentity() {
    savePersisted({
      roomCode: state.value.roomCode,
      isHost: state.value.isHost,
      playerId: state.value.playerId,
      playerName: state.value.playerName,
    })
  }

  function openSocketAndHello(isRejoin = false) {
    try { if (socket) socket.close() } catch {}
    socket = null
    if (!WS_URL) return
    const url = WS_URL.replace(/\/+$/, '')
    socket = new WebSocket(`${url}?room=${encodeURIComponent(state.value.roomCode)}&pid=${encodeURIComponent(state.value.playerId)}`)
    socket.onopen = () => {
      state.value.connected = true
      state.value.reconnecting = false
      state.value.lastSocketError = null
      if (isRejoin) {
        const msg: WsMessage = { type: 'REJOIN', roomCode: state.value.roomCode, playerId: state.value.playerId }
        socket?.send(JSON.stringify(msg))
      } else {
        const hello: WsMessage = { type: 'HELLO', roomCode: state.value.roomCode, playerId: state.value.playerId, name: state.value.playerName }
        socket?.send(JSON.stringify(hello))
      }
      if (pingTimer != null) clearInterval(pingTimer)
      pingTimer = window.setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'PING' } satisfies WsMessage))
        }
      }, 15000)
    }
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WsMessage
        handleWsMessage(msg)
      } catch (e) {
        console.warn('WS parse error', e)
      }
    }
    socket.onerror = () => {
      state.value.lastSocketError = 'Socket error'
    }
    socket.onclose = () => {
      state.value.connected = false
      if (pingTimer != null) { clearInterval(pingTimer); pingTimer = null }
      // attempt reconnect when we still have a room code and identity
      if (state.value.roomCode && state.value.playerId) {
        state.value.reconnecting = true
        setTimeout(() => {
          if (state.value.roomCode) openSocketAndHello(true)
        }, 2000)
      }
    }
  }

  function handleWsMessage(msg: WsMessage) {
    switch (msg.type) {
      case 'ROOM_CREATED':
        // already had local state
        break
      case 'ROOM_JOINED':
        state.value.roomCode = msg.roomCode
        state.value.players = msg.players
        if (msg.category) state.value.category = msg.category
        if (msg.seed) state.value.seed = msg.seed
        if (msg.currentQuestionIndex != null) state.value.currentQuestionIndex = msg.currentQuestionIndex
        if (state.value.category && state.value.seed) {
          const pool = getPoolSync(state.value.category)
          state.value.questions = seededShuffle(pool, state.value.seed)
        }
        break
      case 'PLAYER_LIST':
        state.value.players = msg.players
        break
      case 'READY': {
        const p = state.value.players.find(pl => pl.id === msg.playerId)
        if (p) p.ready = msg.ready
        state.value.players = [...state.value.players]
        break
      }
      case 'START':
        state.value.category = msg.category
        state.value.seed = msg.seed
        state.value.submissions = []
        state.value.currentQuestionIndex = 0
        state.value.questionStartTs = msg.questionStartTs
        if (state.value.category && state.value.seed) {
          const pool = getPoolSync(state.value.category)
          state.value.questions = seededShuffle(pool, state.value.seed)
        }
        break
      case 'QUESTION_INDEX':
        state.value.currentQuestionIndex = msg.index
        state.value.questionStartTs = msg.questionStartTs
        break
      case 'SUBMISSION':
        appendSubmissionAndScore(msg.submission)
        break
      case 'SCORES':
        state.value.players = msg.players
        break
      case 'ERROR':
        state.value.lastSocketError = msg.message
        break
      case 'PING':
        break
      case 'HELLO':
      case 'REJOIN':
        // handled by server; no-op here
        break
    }
  }

  function cryptoRandomId(): string {
    try {
      const bytes = new Uint8Array(8)
      crypto.getRandomValues(bytes)
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
      return Math.random().toString(36).slice(2, 10)
    }
  }

  // keep persisted identity updated
  watch(() => [state.value.roomCode, state.value.playerId, state.value.playerName, state.value.isHost], () => {
    persistIdentity()
  })

  return {
    state,
    isInRoom,
    me,
    leaderboard,
    hasBackend,
    createRoom,
    joinRoom,
    readyUp,
    hostStart,
    submitAnswer,
    nextQuestion,
    fastestWinnerNameForQuestion,
    leaveRoom,
    tryResumeFromLocal,
  }
})
