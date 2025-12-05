<script setup lang="ts">
import type { QuizQuestion } from '@/stores/quiz'

// define props without assigning to an unused variable to satisfy eslint
defineProps<{
  question: QuizQuestion
  selectedIndex: number | null
  hasSubmitted: boolean
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()

function onKeydownOption(e: KeyboardEvent, idx: number) {
  const keys = ['Enter', ' ']
  if (keys.includes(e.key)) {
    e.preventDefault()
    emit('select', idx)
  }
}
</script>

<template>
  <div class="card q-card">
    <div class="q-body">
      <h3 class="q-title">
        {{ question.question }}
      </h3>
      <div class="stack-lg" role="listbox" aria-label="Answer options">
        <button
          v-for="(opt, idx) in question.options"
          :key="idx"
          class="option"
          :class="{
            selected: selectedIndex === idx && !hasSubmitted,
            correct: hasSubmitted && idx === question.answerIndex,
            incorrect: hasSubmitted && selectedIndex === idx && idx !== question.answerIndex
          }"
          role="option"
          :aria-selected="selectedIndex === idx"
          @click="emit('select', idx)"
          @keydown="onKeydownOption($event, idx)"
        >
          <span class="opt-index">{{ String.fromCharCode(65 + idx) }}.</span>
          <span class="opt-text">{{ opt }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.q-card {
  padding: 1rem 1rem;
}
.q-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: .75rem;
  color: var(--text);
}
.q-body {
  display: grid;
  gap: 0.5rem;
}
.opt-index {
  font-weight: 700;
  color: var(--muted);
  margin-right: .5rem;
}
.opt-text {
  font-weight: 500;
}
</style>
