<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMultiplayerStore } from '@/stores/multiplayer'
import QuestionCard from '@/components/QuestionCard.vue'
import QuizHeader from '@/components/QuizHeader.vue'
import CountdownOverlay from '@/components/CountdownOverlay.vue'
import { COIN_RULES } from '@/stores/coins'

const router = useRouter()
const mp = useMultiplayerStore()

const showCountdown = ref(false)

const roomCode = computed(() => mp.state.roomCode)
const isHost = computed(() => mp.state.isHost)
const players = computed(() => mp.leaderboard)
const winAward = COIN_RULES.MULTIPLAYER_WIN
const participationAward = COIN_RULES.PARTICIPATION
const winnerIds = computed<Set<string>>(() => {
  const board = players.value
  if (!board || board.length === 0) return new Set<string>()
  const top = Math.max(...board.map(b => b.score))
  return new Set(board.filter(b => b.score === top).map(b => b.id))
})
const currentIndex = computed(() => mp.state.currentQuestionIndex)
const currentQ = computed(() => mp.state.questions[currentIndex.value] || null)
const total = computed(() => mp.state.questions.length)
const myScore = computed(() => {
  const player = mp.state.players.find(p => p.id === mp.state.playerId)
  return player ? player.score : 0
})
const winnerName = computed(() => mp.fastestWinnerNameForQuestion(currentIndex.value))

function selectOption(idx: number) {
  // prevent multiple submissions: if already submitted, ignore. In this simple client we allow one per question locally
  const already = mp.state.submissions.find(s => s.playerId === mp.state.playerId && s.questionIndex === currentIndex.value)
  if (already) return
  mp.submitAnswer(idx)
}

function continueOrFinish() {
  // In multiplayer, do not auto-advance via local preference; host controls flow.
  if (!mp.nextQuestion()) {
    // done
    router.push({ name: 'mp-lobby' })
  }
}

function exitToLobby() {
  router.push({ name: 'mp-lobby' })
}
function hostStartFlow() {
  // Host triggers a pre-start countdown locally (and ideally informs others via WS START after)
  if (!isHost.value) return
  // Only show countdown if game not yet started
  if (!mp.state.questions.length) {
    showCountdown.value = true
  }
}

</script>

<template>
  <section class="stack-xl">
    <div class="topbar card">
      <div class="left">
        <span class="pill">Room</span>
        <span class="code">{{ roomCode }}</span>
      </div>
      <div class="right">
        <button class="btn btn-secondary" @click="exitToLobby">Back to Lobby</button>
      </div>
    </div>

    <QuizHeader
      :current="currentIndex"
      :total="total"
      :score="myScore"
      :categoryLabel="mp.state.category ? ({
        gk: 'General Knowledge',
        sports: 'Sports',
        movies: 'Movies',
        science: 'Science',
        history: 'History',
        geography: 'Geography'
      }[mp.state.category] || mp.state.category) : undefined"
      :remaining-seconds="null"
    />

    <div v-if="!currentQ" class="card pad">
      <p>Waiting for the host to start the round…</p>
    </div>

    <QuestionCard
      v-else
      :question="currentQ"
      :selected-index="null"
      :has-submitted="!!mp.state.submissions.find(s => s.playerId === mp.state.playerId && s.questionIndex === currentIndex)"
      @select="selectOption"
    />

    <div v-if="winnerName" class="winner card" role="status" aria-live="polite">
      <span class="w-emoji" aria-hidden="true">🏆</span>
      <span><strong>{{ winnerName }}</strong> answered fastest!</span>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" @click="exitToLobby">Exit</button>
      <div class="spacer"></div>

      <!-- Host controls -->
      <template v-if="isHost">
        <button
          v-if="!currentQ"
          class="btn btn-primary"
          @click="hostStartFlow"
          :disabled="!!currentQ"
          title="Start the game"
        >
          Start
        </button>
        <button
          v-else
          class="btn btn-primary"
          :disabled="currentIndex + 1 >= total"
          @click="continueOrFinish"
        >
          Next
        </button>
      </template>

      <!-- Non-hosts wait -->
      <button class="btn btn-primary" v-else disabled title="Host controls the flow">
        Waiting for Host…
      </button>
    </div>

    <!-- Countdown overlay for host pre-start; on complete, broadcast start (or local demo) -->
    <CountdownOverlay
      v-if="showCountdown && isHost && !currentQ"
      @complete="
        () => {
          showCountdown = false
          // If backend exists, store logic already sends START in hostStart();
          // here, for both modes, we call hostStart to initialize questions and START.
          // Using a dedicated method on the store:
          if (mp.hasBackend) {
            // reuse existing hostStart method which sets seed and START message
            mp.hostStart(mp.state.category || 'gk')
          } else {
            mp.hostStart(mp.state.category || 'gk')
          }
        }
      "
    />

    <aside class="leader card" aria-label="Leaderboard">
      <h3 class="leader-title">Leaderboard</h3>
      <ul class="leader-list">
        <li v-for="p in players" :key="p.id" :class="{ me: p.id === mp.state.playerId }">
          <span class="avatar" aria-hidden="true">{{ (p.name || '??').slice(0,2).toUpperCase() }}</span>
          <span class="name">{{ p.name }}</span>
          <span class="score">{{ p.score }}</span>
          <span v-if="winnerIds.has(p.id)" class="award">+{{ winAward }} coins</span>
          <span v-else-if="participationAward>0" class="award secondary">+{{ participationAward }} coins</span>
        </li>
      </ul>
      <p v-if="!mp.hasBackend" class="demo-note">
        Demo mode: real-time is simulated locally. For true multi-device play, set VITE_WS_URL.
      </p>
    </aside>
  </section>
</template>

<style scoped>
.topbar { padding: .6rem .75rem; display: flex; align-items: center; justify-content: space-between; }
.left { display: flex; align-items: center; gap: .5rem; }
.pill {
  display: inline-flex; align-items: center; padding: .1rem .5rem; border-radius: 999px;
  border: 1px solid #e5e7eb; background: #f8fafc; color: var(--primary); font-weight: 700; font-size: .75rem;
}
.code { font-weight: 800; color: var(--primary); }
.pad { padding: 1rem; }
.winner { padding: .6rem .75rem; display: inline-flex; align-items: center; gap: .5rem; border: 1px solid #e5e7eb; background: #f0fdf4; color: #065f46; border-radius: .75rem; }
.w-emoji { font-size: 1.1rem; }
.actions { display: flex; align-items: center; gap: .75rem; }
.spacer { flex: 1; }
.leader { padding: .75rem; }
.leader-title { font-weight: 800; margin-bottom: .5rem; }
.leader-list { list-style: none; display: grid; gap: .4rem; padding: 0; margin: 0; }
.leader-list li {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .5rem;
  background: #fff; border: 1px solid #e5e7eb; border-radius: .6rem; padding: .4rem .5rem;
}
.leader-list li.me { outline: 3px solid rgba(37,99,235,.15); }
.avatar { width: 1.6rem; height: 1.6rem; border-radius: .45rem; display: inline-flex; align-items: center; justify-content: center;
  background: #eef2ff; color: var(--primary); font-weight: 800; box-shadow: inset 0 0 0 1px rgba(37, 99, 235, .15);
}
.name { font-weight: 700; }
.score { font-weight: 800; color: var(--primary); }
.award { margin-left: .5rem; color: #F59E0B; font-weight: 700; }
.award.secondary { color: #2563EB; }
.demo-note { color: var(--muted); font-size: .85rem; margin-top: .5rem; }
</style>
