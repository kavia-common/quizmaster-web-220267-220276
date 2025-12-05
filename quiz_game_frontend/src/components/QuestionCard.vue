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

      <!-- Explanation / feedback -->
      <div
        v-if="hasSubmitted"
        class="explain card"
        role="region"
        aria-label="Answer feedback"
      >
        <div
          class="feedback"
          :class="selectedIndex === question.answerIndex ? 'ok' : 'bad'"
          aria-live="polite"
        >
          <span class="fb-emoji" aria-hidden="true">{{ selectedIndex === question.answerIndex ? '✅' : '❌' }}</span>
          <span class="fb-text">
            {{ selectedIndex === question.answerIndex ? 'Correct' : 'Incorrect' }}.
            The right answer is
            <strong>{{ String.fromCharCode(65 + question.answerIndex) }}. {{ question.options[question.answerIndex] }}</strong>.
          </span>
        </div>

        <p v-if="question.explanation" class="exp">
          {{ question.explanation }}
          <template v-if="question.source">
            <span class="src">— {{ question.source }}</span>
          </template>
        </p>

        <a
          v-if="question.referenceUrl"
          class="learn"
          :href="question.referenceUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more
        </a>
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
  gap: 0.75rem;
}
.opt-index {
  font-weight: 700;
  color: var(--muted);
  margin-right: .5rem;
}
.opt-text {
  font-weight: 500;
}

/* Explanation panel styled with Ocean Professional theme */
.explain {
  padding: .9rem;
  border-radius: .9rem;
  border: 1px solid #e5e7eb;
  background: linear-gradient(135deg, rgba(59,130,246,0.06), rgba(255,255,255,1));
  box-shadow: 0 4px 10px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.03);
  display: grid;
  gap: .5rem;
}
.feedback {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-weight: 700;
}
.feedback.ok { color: #0e9f6e; }
.feedback.bad { color: var(--error); }
.fb-emoji { font-size: 1rem; }
.exp {
  color: var(--text);
}
.src {
  color: var(--muted);
  margin-left: .25rem;
}
.learn {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  color: var(--primary);
  font-weight: 700;
  text-decoration: none;
}
.learn:hover { text-decoration: underline; }
</style>
