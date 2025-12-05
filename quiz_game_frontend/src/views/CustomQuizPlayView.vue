<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCustomQuizzesStore } from '@/stores/customQuizzes'
import { useQuizStore, type QuizQuestion } from '@/stores/quiz'
import QuizHeader from '@/components/QuizHeader.vue'
import QuestionCard from '@/components/QuestionCard.vue'

const route = useRoute()
const router = useRouter()
const qid = computed(() => String(route.params.id || ''))
const library = useCustomQuizzesStore()
const quiz = useQuizStore()

function mapToQuizQuestions(token: ReturnType<typeof library.get>): QuizQuestion[] {
  const q = token
  const list: QuizQuestion[] = (q?.questions || []).map((it, i) => ({
    id: it.id || i + 1,
    question: it.text,
    options: it.options,
    answerIndex: it.correctIndex,
    explanation: it.explanation,
    referenceUrl: it.referenceUrl,
    hint: it.hint,
  }))
  return list
}

onMounted(async () => {
  if (!library.loaded) library.load()
  const q = library.get(qid.value)
  if (!q) {
    alert('Quiz not found')
    router.replace({ name: 'custom-home' })
    return
  }
  // Start a fresh runtime for custom play: directly set questions
  quiz.resetAll()
  quiz.selectedCategory = 'gk' // do not affect unlocks; use placeholder category
  quiz.startedAt = Date.now()
  quiz.updatedAt = Date.now()
  quiz.questions = mapToQuizQuestions(q)
  // ensure analytics start for first
  const firstId = quiz.questions[0]?.id
  if (firstId != null && quiz.qStartTs[firstId] == null) {
    quiz.qStartTs[firstId] = Date.now()
  }
})

function submitOrNext() {
  if (quiz.hasSubmitted) {
    if (!quiz.nextQuestion()) {
      router.push({ name: 'results', query: { mode: 'custom', title: currentQuizTitle.value } })
    }
    return
  }
  quiz.submitAnswer()
}
const currentQuizTitle = computed(() => library.get(qid.value)?.title || 'Custom')
</script>

<template>
  <div class="stack-xl" v-if="quiz.questions.length">
    <QuizHeader
      :current="quiz.currentIndex"
      :total="quiz.total"
      :score="quiz.score"
      :category-label="currentQuizTitle"
      :remaining-seconds="quiz.timerState.remaining ?? null"
    />
    <QuestionCard
      v-if="quiz.current"
      :question="quiz.current"
      :selected-index="quiz.selectedIndex"
      :has-submitted="quiz.hasSubmitted"
      @select="quiz.selectOption"
    />
    <div class="actions">
      <button class="btn btn-secondary" @click="$router.push({ name: 'custom-home' })">Exit</button>
      <div class="spacer"></div>
      <button v-if="!quiz.hasSubmitted" class="btn btn-primary" :disabled="quiz.selectedIndex===null" @click="submitOrNext">Submit</button>
      <button v-else class="btn btn-primary" @click="submitOrNext">{{ quiz.isLast ? 'See Results' : 'Continue' }}</button>
    </div>
  </div>
  <div v-else class="card loading"><p>Loading…</p></div>
</template>

<style scoped>
.actions { display: flex; align-items: center; gap: .75rem; }
.spacer { flex: 1; }
.loading { padding: 1rem; }
</style>
