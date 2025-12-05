<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'

const router = useRouter()
const t = useTournamentStore()
const ariaLiveMsg = ref('')

const totals = computed(() => {
  const correct = t.roundStats.reduce((s, r) => s + r.correct, 0)
  const wrong = t.roundStats.reduce((s, r) => s + r.wrong, 0)
  const skipped = t.roundStats.reduce((s, r) => s + r.skipped, 0)
  const answered = correct + wrong
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
  const durations = t.roundStats.flatMap(r => r.durations)
  const avgMs = durations.length ? Math.round(durations.reduce((a,b)=>a+b,0)/durations.length) : null
  return { correct, wrong, skipped, accuracy, avgMs, durations }
})

function playAgain() {
  t.resetTournament()
  router.push({ name: 'tournament-lobby' })
}
function goHome() {
  router.push({ name: 'start' })
}
function share() {
  const text = `I finished a 10-round Tournament with ${totals.value.accuracy}% accuracy and medals: ${t.medalsEarned.join(', ') || 'None'}!`
  if (navigator.share) {
    navigator.share({ title: 'Quiz Tournament', text })
  } else {
    navigator.clipboard.writeText(text)
    alert('Copied results to clipboard!')
  }
}

onMounted(() => {
  if (!t.completed) {
    router.replace({ name: 'tournament-lobby' })
    return
  }
  if (t.medalsEarned.length) {
    ariaLiveMsg.value = `Medals earned: ${t.medalsEarned.join(', ')}`
  }
})
</script>

<template>
  <section class="results card">
    <div class="inner">
      <h2 class="title">Tournament Results</h2>
      <span class="sr-only" aria-live="polite">{{ ariaLiveMsg }}</span>

      <div class="summary">
        <div class="stat">
          <div class="label">Total Correct</div>
          <div class="value">{{ totals.correct }}</div>
        </div>
        <div class="stat">
          <div class="label">Accuracy</div>
          <div class="value">{{ totals.accuracy }}%</div>
        </div>
        <div class="stat">
          <div class="label">Avg Time</div>
          <div class="value">{{ totals.avgMs == null ? '—' : Math.round(totals.avgMs / 1000) + 's' }}</div>
        </div>
        <div class="stat">
          <div class="label">Coins Earned</div>
          <div class="value">+20</div>
        </div>
      </div>

      <div class="medals" role="status" aria-label="Medals earned">
        <span v-for="m in t.medalsEarned" :key="m" class="medal" :class="m.toLowerCase()">{{ m }}</span>
        <span v-if="!t.medalsEarned.length" class="muted">No medals this time. Try again!</span>
      </div>

      <div class="rounds">
        <h3 class="rounds-title">Round-by-round</h3>
        <div class="round-list">
          <div v-for="r in t.roundStats" :key="r.round" class="round-row">
            <div class="r-left">
              <span class="badge">Round {{ r.round }}</span>
              <span class="badge small">{{ t.difficultyCurve[r.round-1] }}</span>
            </div>
            <div class="r-right">
              <span class="cell">✅ {{ r.correct }}</span>
              <span class="cell">❌ {{ r.wrong }}</span>
              <span class="cell">⏭️ {{ r.skipped }}</span>
              <span class="cell">🎯 {{ r.accuracyPct }}%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click="playAgain">Play again</button>
        <button class="btn btn-secondary" @click="goHome">Home</button>
        <button class="btn btn-secondary" @click="share">Share</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.results { padding: 1rem; border: 1px solid #e5e7eb; background: linear-gradient(135deg, rgba(37,99,235,.08), #fff); }
.inner { max-width: 880px; margin: 0 auto; display: grid; gap: .75rem; }
.title { font-size: 1.75rem; font-weight: 800; color: #111827; }
.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .5rem; }
.stat { padding: .6rem; border: 1px solid #e5e7eb; background: #fff; border-radius: .75rem; text-align: center; }
.label { font-size: .8rem; color: #6b7280; }
.value { font-weight: 800; color: #111827; font-size: 1.1rem; }
.medals { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
.medal { padding: .15rem .5rem; border-radius: .5rem; border: 1px solid #e5e7eb; font-weight: 800; }
.medal.bronze { background: #fff7ed; color: #92400e; border-color: #fcd34d; }
.medal.silver { background: #f3f4f6; color: #374151; border-color: #e5e7eb; }
.medal.gold { background: #fffbeb; color: #b45309; border-color: #fde68a; }
.medal.diamond { background: #ecfeff; color: #0ea5e9; border-color: #bae6fd; }
.muted { color: #6b7280; }
.rounds { border: 1px solid #e5e7eb; background: #fff; border-radius: .75rem; padding: .5rem; }
.rounds-title { font-weight: 800; color: #111827; padding: .25rem .25rem .5rem; }
.round-list { display: grid; gap: .35rem; }
.round-row { display: flex; align-items: center; justify-content: space-between; border: 1px solid #e5e7eb; border-radius: .5rem; padding: .35rem .5rem; }
.r-left { display: flex; align-items: center; gap: .35rem; }
.badge { padding: .1rem .5rem; border-radius: 999px; border: 1px solid #dbeafe; background: #eff6ff; color: #1d4ed8; font-weight: 700; }
.badge.small { border-color: #fde68a; background: #fff7ed; color: #b45309; }
.r-right { display: inline-flex; gap: .5rem; }
.cell { font-variant-numeric: tabular-nums; }
.actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
