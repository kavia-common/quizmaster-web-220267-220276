<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCustomQuizzesStore, type CustomQuiz } from '@/stores/customQuizzes'

const route = useRoute()
const router = useRouter()
const store = useCustomQuizzesStore()

const token = computed(() => String(route.params.token || ''))
const status = ref<string>('Decoding…')
const preview = ref<Omit<CustomQuiz, 'id' | 'createdAt' | 'updatedAt'> | null>(null)
const error = ref<string | null>(null)

onMounted(() => {
  if (!store.loaded) store.load()
  const res = store.decodeTokenToQuiz(token.value)
  if (res.ok && res.quiz) {
    preview.value = res.quiz
    status.value = 'Ready to import'
  } else {
    error.value = res.error || 'Invalid token'
    status.value = 'Failed to decode'
  }
})

function save() {
  if (!preview.value) return
  try {
    const created = store.create({ ...preview.value })
    router.replace({ name: 'custom-edit', params: { id: created.id } })
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : 'Save failed'
    error.value = msg
  }
}
</script>

<template>
  <section class="card import">
    <div class="inner">
      <h2 class="title">Import Custom Quiz</h2>
      <p class="muted">{{ status }}</p>

      <div v-if="error" class="error card" role="alert">
        {{ error }}
      </div>

      <div v-if="preview" class="preview card">
        <div class="row">
          <span class="label">Title</span>
          <span class="value">{{ preview.title }}</span>
        </div>
        <div class="row">
          <span class="label">Category</span>
          <span class="value">{{ preview.category || '—' }}</span>
        </div>
        <div class="row">
          <span class="label">Visibility</span>
          <span class="value">{{ preview.visibility }}</span>
        </div>
        <div class="row">
          <span class="label">Questions</span>
          <span class="value">{{ preview.questions.length }}</span>
        </div>
        <div class="row">
          <span class="label">Author</span>
          <span class="value">{{ preview.author?.name || '—' }}</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" @click="$router.push({ name: 'custom-home' })">Cancel</button>
        <button class="btn btn-primary" :disabled="!preview" @click="save">Save to Library</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.import { padding: 1rem; }
.inner { max-width: 720px; margin: 0 auto; display: grid; gap: .75rem; }
.title { font-size: 1.5rem; font-weight: 800; }
.muted { color: var(--muted); }
.error { padding: .75rem; border: 1px solid var(--error); color: var(--error); }
.preview { padding: .75rem; display: grid; gap: .35rem; }
.row { display: grid; grid-template-columns: 140px 1fr; gap: .5rem; }
.label { color: var(--muted); }
.value { color: var(--text); font-weight: 700; }
.actions { display: flex; gap: .5rem; }
</style>
