<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import type { AnalyticsMeta } from '@/utils/analytics'
import {
  accuracyPercentage,
  averageTimeMs,
  mostPlayedCategory,
  computeCategoryBreakdown,
  detectWeakCategories,
  lifetimeStrikeBest,
  aggregateRecentPerformance,
} from '@/utils/analytics'

const router = useRouter()
const quiz = useQuizStore()

const history = computed<AnalyticsMeta[]>(() => quiz.listAnalytics() as unknown as AnalyticsMeta[])

const lifetimeOverview = computed(() => {
  const h = history.value
  if (!h.length) {
    return {
      lifetimeAccuracy: 0,
      lifetimeAvgMs: null as number | null,
      mostPlayed: null as string | null,
      strikeBest: 0,
      attempts: 0,
    }
  }
  let correct = 0
  let wrong = 0
  const durations: number[] = []
  for (const r of h) {
    correct += r.correctCount
    wrong += r.wrongCount
    if (r.durations?.length) durations.push(...r.durations.filter((d) => d >= 0 && isFinite(d)))
  }
  return {
    lifetimeAccuracy: Math.round(accuracyPercentage(correct, wrong)),
    lifetimeAvgMs: averageTimeMs(durations),
    mostPlayed: mostPlayedCategory(h),
    strikeBest: lifetimeStrikeBest(h),
    attempts: correct + wrong,
  }
})

const breakdown = computed(() => computeCategoryBreakdown(history.value))
const weak = computed(() => detectWeakCategories(breakdown.value, { thresholdPct: 60, minAttempts: 5 }))
const recent = computed(() => aggregateRecentPerformance(history.value, 10))

function formatMs(ms: number | null): string {
  if (ms == null) return '-'
  const s = ms / 1000
  return `${(Math.round(s * 10) / 10).toFixed(1)}s`
}
</script>

<template>
  <section class="analytics card">
    <header class="head">
      <div class="left">
        <h2 class="title">Analytics</h2>
        <p class="sub">Insights from your gameplay history.</p>
      </div>
      <div class="right">
        <button class="btn btn-secondary" @click="router.push({ name: 'start' })">Back</button>
      </div>
    </header>

    <div v-if="!history.length" class="empty">
      <div class="empty-emoji" aria-hidden="true">📊</div>
      <h3>No analytics yet</h3>
      <p>Play a few quizzes to see trends and insights here.</p>
      <div class="actions">
        <button class="btn btn-primary" @click="router.push({ name: 'start' })">Start a Quiz</button>
      </div>
    </div>

    <div v-else class="grid">
      <!-- Overview -->
      <section class="card panel" aria-labelledby="ov-title">
        <h3 id="ov-title" class="panel-title">Overview</h3>
        <div class="kpis">
          <div class="kpi">
            <div class="kpi-label">Lifetime Accuracy</div>
            <div class="kpi-value">{{ lifetimeOverview.lifetimeAccuracy }}%</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Avg Time / Q</div>
            <div class="kpi-value">{{ formatMs(lifetimeOverview.lifetimeAvgMs) }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Most Played</div>
            <div class="kpi-value">{{ lifetimeOverview.mostPlayed ?? '-' }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Lifetime Strike Best</div>
            <div class="kpi-value">{{ lifetimeOverview.strikeBest }}</div>
          </div>
        </div>
      </section>

      <!-- Category Breakdown -->
      <section class="card panel" aria-labelledby="cb-title">
        <h3 id="cb-title" class="panel-title">Category Breakdown</h3>
        <div class="table-wrap">
          <table class="table" aria-label="Per-category performance">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Attempts</th>
                <th scope="col">Accuracy</th>
                <th scope="col">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in breakdown" :key="row.category" :class="{ weak: weak.some(w => w.category === row.category) }">
                <td>{{ row.category }}</td>
                <td>{{ row.attempts }}</td>
                <td>
                  {{ row.accuracy }}%
                  <span v-if="weak.some(w => w.category === row.category)" class="weak-pill" title="Below target threshold">Needs Practice</span>
                </td>
                <td>{{ formatMs(row.avgTimeMs) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!breakdown.length" class="muted">No category data yet.</p>
      </section>

      <!-- Recent Performance -->
      <section class="card panel" aria-labelledby="rp-title">
        <h3 id="rp-title" class="panel-title">Recent Performance</h3>
        <ul class="recent" role="list">
          <li v-for="r in recent" :key="r.when" role="listitem">
            <span class="when">
              <time :datetime="new Date(r.when).toISOString()">{{ new Date(r.when).toLocaleString() }}</time>
            </span>
            <span class="acc">Acc: <strong>{{ r.accuracy }}%</strong></span>
            <span class="avg">Avg: <strong>{{ formatMs(r.avgTimeMs) }}</strong></span>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.analytics { padding: 1.25rem; }
.head { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .75rem; }
.title { font-size: 1.25rem; font-weight: 800; color: var(--text); }
.sub { color: var(--muted); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: .75rem; }
.panel { padding: .9rem; }
.panel-title { font-weight: 800; margin-bottom: .5rem; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .5rem; }
.kpi { background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem; padding: .6rem .75rem; }
.kpi-label { font-size: .85rem; color: var(--muted); }
.kpi-value { font-weight: 800; color: var(--primary); font-size: 1.2rem; }
.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; }
.table thead th { text-align: left; font-weight: 700; color: var(--muted); font-size: .85rem; padding: .5rem .5rem; border-bottom: 1px solid #e5e7eb; background: linear-gradient(180deg, rgba(59,130,246,0.06), rgba(255,255,255,1)); }
.table tbody td { padding: .6rem .5rem; border-bottom: 1px solid #eef2f7; }
.recent { list-style: none; padding: 0; margin: 0; display: grid; gap: .4rem; }
.recent li { display: grid; grid-template-columns: 1fr auto auto; gap: .5rem; align-items: center; background: #fff; border: 1px solid #e5e7eb; border-radius: .6rem; padding: .5rem .6rem; }
.when { color: var(--text); font-weight: 600; }
.acc, .avg { color: var(--muted); }
.weak-pill { margin-left: .35rem; display: inline-flex; align-items: center; padding: .05rem .4rem; border-radius: 999px; border: 1px solid #fecaca; color: #b91c1c; background: #fff1f2; font-size: .7rem; font-weight: 700; }
.empty { text-align: center; padding: 2rem 1rem; color: var(--muted); display: grid; gap: .5rem; justify-items: center; }
.empty-emoji { font-size: 2rem; width: 3rem; height: 3rem; display: inline-flex; align-items: center; justify-content: center; background: #fff; border-radius: .8rem; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 1px 1px rgba(0,0,0,.04); }
.muted { color: var(--muted); }
</style>
