<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'
import type { CategoryKey } from '@/stores/quiz'

const router = useRouter()
const t = useTournamentStore()

const categories: Array<{ key: CategoryKey | 'mixed'; label: string; emoji: string; hint: string }> = [
  { key: 'mixed', label: 'Mixed', emoji: '🎯', hint: 'A curated blend across all' },
  { key: 'gk', label: 'General Knowledge', emoji: '🧠', hint: 'A bit of everything' },
  { key: 'sports', label: 'Sports', emoji: '🏅', hint: 'Games and records' },
  { key: 'movies', label: 'Movies', emoji: '🎬', hint: 'Cinema & film trivia' },
  { key: 'science', label: 'Science', emoji: '🔬', hint: 'Facts & discoveries' },
  { key: 'history', label: 'History', emoji: '🏛️', hint: 'Past events & figures' },
  { key: 'geography', label: 'Geography', emoji: '🗺️', hint: 'World & places' },
]
const picked = ref<CategoryKey | 'mixed'>(t.category ?? 'mixed')
const curve = computed(() => t.difficultyCurve.length ? t.difficultyCurve : ['easy','easy','medium','medium','medium','hard','hard','hard','hard','hard'])

function start() {
  t.startTournament({ category: picked.value })
  router.push({ name: 'tournament-play' , query: { startWithCountdown: '1' }})
}

onMounted(() => {
  // load persisted tournament if present; don't auto-resume here, just enable resume from play route
  t.loadIfAvailable()
})
</script>

<template>
  <section class="lobby card">
    <div class="inner">
      <h2 class="title">Tournament</h2>
      <p class="sub">10 rounds • Increasing difficulty • Earn medals & bonus coins</p>

      <div class="badge-row" aria-label="Tournament structure">
        <span class="round-badge">Rounds: 10</span>
        <span class="curve">
          <span v-for="(d,i) in curve" :key="i" class="chip" :class="d">{{ d.charAt(0).toUpperCase() + d.slice(1) }}</span>
        </span>
      </div>

      <div class="grid">
        <button
          v-for="c in categories"
          :key="c.key"
          class="category"
          :class="{ active: picked === c.key }"
          @click="picked = c.key"
          :aria-pressed="picked === c.key"
          :aria-label="`Select ${c.label} category`"
        >
          <div class="cat-emoji" aria-hidden="true">{{ c.emoji }}</div>
          <div class="cat-info">
            <div class="cat-label">{{ c.label }}</div>
            <div class="cat-hint">{{ c.hint }}</div>
          </div>
        </button>
      </div>

      <aside class="rules card" aria-label="Rules">
        <h3 class="rules-title">Rules</h3>
        <ul class="rules-list">
          <li>Play 10 rounds, each with 10 questions.</li>
          <li>Difficulty increases as you progress.</li>
          <li>Scores sum across rounds; medals awarded at the end.</li>
          <li>Auto-save enabled — resume anytime.</li>
        </ul>
      </aside>

      <div class="actions">
        <button class="btn btn-primary" @click="start">Start Tournament</button>
        <button class="btn btn-secondary" @click="$router.push({ name: 'start' })">Home</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lobby { padding: 1.25rem; border: 1px solid #e5e7eb; background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), #fff); }
.inner { max-width: 880px; margin: 0 auto; display: grid; gap: .75rem; }
.title { font-size: 1.75rem; font-weight: 800; color: #111827; }
.sub { color: #6b7280; }
.badge-row { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
.round-badge { padding: .15rem .6rem; border-radius: 999px; border: 1px solid #dbeafe; background: #eff6ff; color: #1d4ed8; font-weight: 700; }
.curve { display: inline-flex; gap: .25rem; flex-wrap: wrap; }
.chip { padding: .1rem .4rem; border-radius: .5rem; border: 1px solid #e5e7eb; font-size: .75rem; }
.chip.easy { background: #ecfeff; color: #0369a1; border-color: #bae6fd; }
.chip.medium { background: #fff7ed; color: #b45309; border-color: #fde68a; }
.chip.hard { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .75rem; margin-top: .25rem; }
.category { display: flex; gap: .6rem; align-items: center; padding: .6rem .75rem; border: 1px solid #e5e7eb; border-radius: 1rem; background: #fff; text-align: left; }
.category.active { border-color: #2563EB; box-shadow: 0 0 0 4px rgba(37, 99, 235, .12); }
.cat-emoji { font-size: 1.35rem; width: 2.25rem; height: 2.25rem; display: inline-flex; align-items: center; justify-content: center; border-radius: .75rem; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.cat-info { display: grid; gap: .1rem; }
.cat-label { font-weight: 800; color: #111827; }
.cat-hint { font-size: .85rem; color: #6b7280; }
.rules { padding: .75rem; border: 1px solid #e5e7eb; }
.rules-title { font-weight: 800; color: #111827; margin-bottom: .35rem; }
.rules-list { margin: 0; padding-left: 1rem; color: #374151; }
.actions { display: flex; gap: .5rem; flex-wrap: wrap; }
</style>
