<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMultiplayerStore } from '@/stores/multiplayer'

const router = useRouter()
const mp = useMultiplayerStore()

const nameInput = ref('')
const roomInput = ref('')
const createdRoom = computed(() => mp.state.roomCode)
const isHost = computed(() => mp.state.isHost)
const players = computed(() => mp.state.players)
const hasBackend = computed(() => mp.hasBackend)
const connected = computed(() => mp.state.connected)

const category = ref<'gk' | 'sports' | 'movies' | 'science' | 'history' | 'geography'>('gk')
const copied = ref(false)

function createRoom() {
  if (!nameInput.value.trim()) {
    nameInput.value = 'Host'
  }
  const code = mp.createRoom(nameInput.value.trim())
  roomInput.value = code
}

function joinRoom() {
  if (!roomInput.value.trim()) return
  if (!nameInput.value.trim()) {
    nameInput.value = 'Player'
  }
  mp.joinRoom(roomInput.value.trim(), nameInput.value.trim())
}

function copyCode() {
  if (!createdRoom.value) return
  navigator.clipboard.writeText(createdRoom.value).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  })
}

function toggleReady(e: Event) {
  const target = e.target as HTMLInputElement
  mp.readyUp(!!target?.checked)
}

function startGame() {
  if (!isHost.value) return
  mp.hostStart(category.value)
  router.push({ name: 'mp-game' })
}

onMounted(() => {
  // attempt to restore identity and reconnect if applicable
  if (!mp.state.playerId) {
    mp.tryResumeFromLocal()
  }
})
</script>

<template>
  <section class="card lobby" role="region" aria-label="Multiplayer Lobby">
    <div class="header">
      <h2 class="title">Multiplayer</h2>
      <p class="sub">Create a room or join with a room code.</p>
    </div>

    <div v-if="!hasBackend" class="notice" role="note" aria-live="polite">
      <span class="n-emoji" aria-hidden="true">ℹ️</span>
      <div class="n-text">
        <strong>Real-time play requires a backend WebSocket (VITE_WS_URL)</strong>.<br />
        You can still try a Local Demo that simulates two players in one tab.
      </div>
    </div>

    <div class="grid">
      <div class="panel">
        <h3 class="panel-title">Create Room</h3>
        <label class="field">
          <span class="label">Your Name</span>
          <input class="input" v-model="nameInput" placeholder="Enter your name" />
        </label>
        <button class="btn btn-primary" @click="createRoom">Create</button>

        <div v-if="createdRoom" class="roomcode" aria-live="polite">
          <div class="code" aria-label="Room code">{{ createdRoom }}</div>
          <button class="btn btn-secondary" @click="copyCode">
            {{ copied ? 'Copied!' : 'Copy Code' }}
          </button>
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">Join Room</h3>
        <label class="field">
          <span class="label">Your Name</span>
          <input class="input" v-model="nameInput" placeholder="Enter your name" />
        </label>
        <label class="field">
          <span class="label">Room Code</span>
          <input class="input" v-model="roomInput" placeholder="ABC123" />
        </label>
        <button class="btn btn-primary" @click="joinRoom">Join</button>
      </div>
    </div>

    <div v-if="createdRoom" class="room card">
      <div class="room-head">
        <div class="left">
          <span class="pill">Room</span>
          <span class="code">{{ createdRoom }}</span>
          <span class="conn" :class="{ ok: connected, bad: !connected }" role="status" aria-live="polite">
            {{ connected ? 'Connected' : 'Reconnecting…' }}
          </span>
        </div>
        <div class="right" v-if="isHost">
          <label class="field inline">
            <span class="label">Category</span>
            <select class="input" v-model="category" aria-label="Select category">
              <option value="gk">General Knowledge</option>
              <option value="sports">Sports</option>
              <option value="movies">Movies</option>
              <option value="science">Science</option>
              <option value="history">History</option>
              <option value="geography">Geography</option>
            </select>
          </label>
          <button class="btn btn-primary" @click="startGame" :disabled="players.every(p => !p.ready)">
            Start Round
          </button>
        </div>
      </div>

      <div class="players">
        <div class="plist" role="list" aria-label="Players in room">
          <div v-for="p in players" :key="p.id" class="pitem" role="listitem">
            <span class="avatar" aria-hidden="true">{{ (p.name || '??').slice(0,2).toUpperCase() }}</span>
            <span class="pname">{{ p.name }}</span>
            <span class="pscore">Score: {{ p.score }}</span>
            <span class="ready" :class="{ on: p.ready }">{{ p.ready ? 'Ready' : 'Not Ready' }}</span>
          </div>
        </div>
        <div class="me-actions">
          <label class="ready-check">
            <input type="checkbox" @change="toggleReady" />
            <span>I'm ready</span>
          </label>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lobby { padding: 1.25rem; }
.header { display: grid; gap: .25rem; margin-bottom: .5rem; }
.title { font-size: 1.25rem; font-weight: 800; color: var(--text); }
.sub { color: var(--muted); }
.notice {
  display: flex; gap: .5rem; margin: .5rem 0 1rem;
  padding: .6rem .8rem; border: 1px dashed #93c5fd; background: #eff6ff; border-radius: .75rem; color: #1e3a8a;
}
.n-emoji { font-size: 1.1rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: .75rem; }
.panel {
  background: var(--surface); border: 1px solid #e5e7eb; border-radius: .75rem; padding: .75rem; display: grid; gap: .5rem;
}
.panel-title { font-weight: 700; }
.field { display: grid; gap: .25rem; }
.field.inline { grid-auto-flow: column; align-items: center; gap: .5rem; }
.label { color: var(--muted); font-size: .9rem; }
.input {
  padding: .55rem .6rem; border: 1px solid #e5e7eb; border-radius: .6rem; background: #fff;
}
.roomcode { display: flex; align-items: center; gap: .5rem; margin-top: .25rem; }
.code { font-weight: 800; color: var(--primary); letter-spacing: 1px; }
.room { padding: .75rem; margin-top: .75rem; }
.room-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-bottom: .5rem; }
.left { display: flex; align-items: center; gap: .5rem; }
.pill {
  display: inline-flex; align-items: center; padding: .1rem .5rem; border-radius: 999px;
  border: 1px solid #e5e7eb; background: #f8fafc; color: var(--primary); font-weight: 700; font-size: .75rem;
}
.conn { font-size: .85rem; color: var(--muted); }
.conn.ok { color: #0e9f6e; }
.conn.bad { color: var(--error); }
.players { display: grid; gap: .5rem; }
.plist { display: grid; gap: .4rem; }
.pitem {
  display: grid; grid-template-columns: auto 1fr auto auto; gap: .5rem; align-items: center;
  background: #fff; border: 1px solid #e5e7eb; border-radius: .6rem; padding: .5rem;
}
.avatar { width: 1.8rem; height: 1.8rem; border-radius: .5rem; display: inline-flex; align-items: center; justify-content: center;
  background: #eef2ff; color: var(--primary); font-weight: 800; box-shadow: inset 0 0 0 1px rgba(37, 99, 235, .15);
}
.pname { font-weight: 700; }
.pscore { color: var(--muted); font-size: .9rem; }
.ready { font-weight: 700; color: var(--muted); }
.ready.on { color: #0e9f6e; }
.me-actions { display: flex; justify-content: flex-end; }
.ready-check { display: inline-flex; align-items: center; gap: .35rem; }
</style>
