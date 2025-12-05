<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'

const router = useRouter()
const quiz = useQuizStore()

// reactive fetch of scores
const scores = computed(() => quiz.listScores())

const confirmingClear = ref(false)

function confirmClear() {
  if (!confirmingClear.value) {
    confirmingClear.value = true
    return
  }
  quiz.clearScores()
  confirmingClear.value = false
}

function cancelClear() {
  confirmingClear.value = false
}

function goHome() {
  router.push({ name: 'start' })
}
</script>

<template>
  <section class="card scoreboard">
    <div class="head">
      <div class="left">
        <h2 class="title">Scoreboard</h2>
        <p class="sub">Your saved scores sorted by most recent.</p>
      </div>
      <div class="right">
        <button class="btn btn-secondary" @click="goHome">Back</button>
        <button
          class="btn"
          :class="confirmingClear ? 'btn-danger' : 'btn-secondary'"
          @click="confirmClear"
          :disabled="!scores.length"
        >
          {{ confirmingClear ? 'Confirm Clear' : 'Clear All' }}
        </button>
        <button
          v-if="confirmingClear"
          class="btn btn-secondary"
          @click="cancelClear"
        >
          Cancel
        </button>
      </div>
    </div>

    <div v-if="!scores.length" class="empty">
      <div class="empty-emoji" aria-hidden="true">📄</div>
      <h3>No scores yet</h3>
      <p>Play a quiz to see your results here.</p>
      <div class="actions">
        <button class="btn btn-primary" @click="$router.push({ name: 'start' })">
          Start a Quiz
        </button>
      </div>
    </div>

    <div v-else class="table-wrap">
      <table class="table" aria-label="Saved scores">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Score</th>
            <th scope="col">Category</th>
            <th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, idx) in scores" :key="idx">
            <td data-label="Player">
              <span class="avatar" aria-hidden="true">{{ (s.player || '??').slice(0, 2).toUpperCase() }}</span>
              <span class="player">{{ s.player || 'Anonymous' }}</span>
            </td>
            <td data-label="Score">
              <span class="score">{{ s.score }}</span>
              <span class="of">/ {{ s.total }}</span>
              <span class="pct">({{ s.total ? Math.round((s.score / s.total) * 100) : 0 }}%)</span>
            </td>
            <td data-label="Category">
              <span class="pill">{{ s.categoryLabel || s.category }}</span>
            </td>
            <td data-label="Date">
              <time :datetime="new Date(s.date).toISOString()">
                {{ new Date(s.date).toLocaleString() }}
              </time>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.scoreboard {
  padding: 1.25rem 1rem;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  margin-bottom: .75rem;
}

.left {
  display: grid;
  gap: .15rem;
}
.title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text);
}
.sub {
  color: var(--muted);
  font-size: .9rem;
}

.right {
  display: flex;
  gap: .5rem;
}

.btn-danger {
  background: var(--error);
  color: #fff;
  border-color: transparent;
}
.btn-danger:hover {
  filter: brightness(0.95);
}

.empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--muted);
  display: grid;
  gap: .5rem;
  justify-items: center;
}
.empty-emoji {
  font-size: 2rem;
  width: 3rem;
  height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: .8rem;
  box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 1px 1px rgba(0,0,0,.04);
}
.empty h3 {
  color: var(--text);
  font-weight: 700;
}
.actions { margin-top: .25rem; }

.table-wrap {
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border-radius: .75rem;
}
.table thead th {
  text-align: left;
  font-weight: 700;
  color: var(--muted);
  font-size: .85rem;
  padding: .75rem .75rem;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(180deg, rgba(59,130,246,0.06), rgba(255,255,255,1));
}
.table tbody td {
  padding: .875rem .75rem;
  border-bottom: 1px solid #eef2f7;
  vertical-align: middle;
}
.table tbody tr:last-child td {
  border-bottom: none;
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: .6rem;
  background: #eef2ff;
  color: var(--primary);
  font-weight: 800;
  margin-right: .5rem;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, .15);
}
.player {
  font-weight: 600;
  color: var(--text);
}
.score {
  font-weight: 800;
  color: var(--primary);
}
.of {
  color: var(--muted);
  margin-left: .25rem;
}
.pct {
  color: var(--muted);
  margin-left: .25rem;
  font-size: .9rem;
}
.pill {
  display: inline-flex;
  align-items: center;
  padding: .15rem .5rem;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  color: var(--primary);
  font-weight: 700;
  font-size: .75rem;
}

/* Responsive labels for mobile */
@media (max-width: 640px) {
  .table thead { display: none; }
  .table tbody tr { display: grid; gap: .25rem; border-bottom: 1px solid #eef2f7; padding: .75rem; }
  .table tbody td { border: none; padding: 0; }
  .table tbody td::before {
    content: attr(data-label) ": ";
    font-weight: 700;
    color: var(--muted);
    margin-right: .25rem;
  }
}
</style>
