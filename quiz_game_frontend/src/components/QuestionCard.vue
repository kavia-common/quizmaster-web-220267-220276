<script setup lang="ts">
import { computed } from 'vue'
import type { QuizQuestion } from '@/stores/quiz'
import { useQuizStore } from '@/stores/quiz'

const props = defineProps<{
  question: QuizQuestion
  selectedIndex: number | null
  hasSubmitted: boolean
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()

const quiz = useQuizStore()

// compute hidden indices for current question if fifty-fifty used
const hidden = computed(() => {
  const qid = props.question.id
  const arr = quiz.fiftyFiftyHidden[qid] ?? []
  return new Set(arr)
})

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

      <!-- Hint panel -->
      <div v-if="quiz.hintShown[question.id] && question.hint" class="hint card" role="note" aria-live="polite">
        <span class="hint-emoji" aria-hidden="true">💡</span>
        <span class="hint-text">{{ question.hint }}</span>
      </div>

      <div class="stack-lg" role="listbox" aria-label="Answer options">
        <button
          v-for="(opt, idx) in question.options"
          :key="idx"
          class="option"
          :class="{
            selected: selectedIndex === idx && !hasSubmitted,
            correct: hasSubmitted && idx === question.answerIndex,
            incorrect: hasSubmitted && selectedIndex === idx && idx !== question.answerIndex,
            hiddenOpt: hidden.has(idx)
          }"
          role="option"
          :aria-selected="selectedIndex === idx"
          :aria-disabled="hidden.has(idx)"
          :disabled="hidden.has(idx)"
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

/* Options */
.option {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: var(--text);
  border-radius: .875rem;
  padding: .875rem 1rem;
  text-align: left;
  width: 100%;
  transition: all .2s ease;
}
.option:hover { background: #f9fafb; }
.option.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--ring);
}
.option.correct {
  border-color: #10b981;
  background: #ecfdf5;
}
.option.incorrect {
  border-color: var(--error);
  background: #fef2f2;
}
.option.hiddenOpt {
  opacity: .25;
  pointer-events: none;
  filter: grayscale(0.3);
}

/* Hint panel */
.hint {
  margin-top: .25rem;
  padding: .7rem .8rem;
  border-radius: .8rem;
  border: 1px dashed #93c5fd;
  background: #eff6ff;
  color: #1e3a8a;
  display: flex;
  align-items: center;
  gap: .5rem;
}
.hint-emoji { font-size: 1.1rem; }
.hint-text { font-weight: 600; }

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
