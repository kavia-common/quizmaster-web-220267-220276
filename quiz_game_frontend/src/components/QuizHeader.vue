<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  current: number
  total: number
  score: number
}>()

const pct = computed(() => {
  if (!props.total) return 0
  return Math.round(((props.current) / props.total) * 100)
})
</script>

<template>
  <div class="card header-card" role="region" aria-label="Quiz Progress">
    <div class="header-row">
      <div class="stack">
        <h2 class="title">Question {{ current + 1 }} of {{ total }}</h2>
        <div class="progress" aria-label="Progress">
          <div class="bar" :style="{ width: pct + '%' }" />
        </div>
      </div>
      <div class="score">
        <span class="score-label">Score</span>
        <span class="score-value" aria-live="polite">{{ score }}</span>
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
.score-label {
  color: var(--muted);
  font-size: .75rem;
}
.score-value {
  font-weight: 800;
  color: var(--primary);
  font-size: 1.25rem;
}
</style>
