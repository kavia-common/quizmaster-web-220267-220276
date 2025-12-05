<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ensureCoinsLoaded, useCoinsStore } from '@/stores/coins'

const props = defineProps<{
  current: number
  total: number
  score: number
  categoryLabel?: string
  // Optional minimal timer display (seconds remaining). When null, hidden.
  remainingSeconds?: number | null
}>()

const pct = computed(() => {
  if (!props.total) return 0
  return Math.round(((props.current) / props.total) * 100)
})

// coins badge
const coins = useCoinsStore()
const balance = computed(() => coins.getBalance)
const recentDelta = ref(0)
onMounted(() => {
  ensureCoinsLoaded()
})
watch(
  () => coins.getHistory(1),
  (items) => {
    if (items && items.length > 0) {
      const latest = items[0]
      recentDelta.value = latest.delta
      window.setTimeout(() => (recentDelta.value = 0), 1200)
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="card header-card" role="region" aria-label="Quiz Progress">
    <div class="header-row">
      <div class="stack">
        <div class="head-top">
          <span v-if="categoryLabel" class="pill" aria-label="Selected category">{{ categoryLabel }}</span>
        </div>
        <h2 class="title">Question {{ current + 1 }} of {{ total }}</h2>
        <div class="progress" aria-label="Progress">
          <div class="bar" :style="{ width: pct + '%' }" />
        </div>
      </div>
      <div class="score">
        <span class="score-label">Score</span>
        <span class="score-value" aria-live="polite">{{ score }}</span>
        <div v-if="props.remainingSeconds != null" class="timer" role="timer" :aria-label="`Time remaining ${props.remainingSeconds} seconds`">
          ⏱️ <span class="timer-val">{{ props.remainingSeconds }}s</span>
        </div>
      </div>
      <div
        class="coin-badge"
        :aria-label="`Coin balance: ${balance}`"
        role="status"
      >
        <svg class="coin-icon" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id="coinGrad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stop-color="#F59E0B" />
              <stop offset="100%" stop-color="#D97706" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill="url(#coinGrad)" />
          <text x="12" y="16" text-anchor="middle" font-size="12" fill="#fff" font-weight="700">$</text>
        </svg>
        <span class="coin-balance">{{ balance }}</span>
        <transition name="pulse" appear>
          <span v-if="recentDelta !== 0" class="delta" :class="{ up: recentDelta>0, down: recentDelta<0 }">
            {{ recentDelta>0 ? `+${recentDelta}` : `${recentDelta}` }}
          </span>
        </transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-card {
  padding: 1rem;
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.head-top {
  min-height: 1.25rem;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  padding: .15rem .5rem;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  color: var(--primary);
  font-weight: 700;
  font-size: .75rem;
}
.title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}
.score {
  display: grid;
  gap: .25rem;
  justify-items: end;
  min-width: 90px;
}
.timer {
  margin-top: .1rem;
  font-size: .85rem;
  color: var(--muted);
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: .5rem;
  padding: .1rem .35rem;
}
.timer-val { font-weight: 700; color: var(--primary); }
.score-label {
  color: var(--muted);
  font-size: .75rem;
}
.score-value {
  font-weight: 800;
  color: var(--primary);
  font-size: 1.25rem;
}
.coin-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(180deg, #F9FAFB, #EFF6FF);
  border: 1px solid rgba(37,99,235,0.15);
  padding: 6px 10px;
  border-radius: 999px;
  color: #111827;
  box-shadow: 0 2px 8px rgba(37,99,235,0.08);
}
.coin-icon { width: 20px; height: 20px; display: block; }
.coin-balance { font-weight: 700; color: #2563EB; }
.delta {
  margin-left: 2px;
  font-weight: 700;
  color: #F59E0B;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,0.08));
}
.delta.down { color: #EF4444; }
@media (prefers-reduced-motion: no-preference) {
  .pulse-enter-active,
  .pulse-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .pulse-enter-from,
  .pulse-leave-to {
    opacity: 0;
    transform: translateY(-6px);
  }
}
</style>
