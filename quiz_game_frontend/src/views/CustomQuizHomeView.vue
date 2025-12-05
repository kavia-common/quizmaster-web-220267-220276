<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCustomQuizzesStore, type CustomQuiz } from '@/stores/customQuizzes'

const router = useRouter()
const store = useCustomQuizzesStore()
const ariaMsg = ref('')

onMounted(() => {
  if (!store.loaded) store.load()
})

const quizzes = computed<CustomQuiz[]>(() => store.list())

function onCreate() {
  router.push({ name: 'custom-new' })
}
function onImportJson() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const res = store.importQuizJson(text)
    if (res.ok && res.quiz) {
      ariaMsg.value = `Quiz ${res.quiz.title} imported`
    } else {
      alert(res.error || 'Import failed')
    }
  }
  input.click()
}
function onImportLink() {
  const tok = window.prompt('Paste share token or full import URL:', '')
  if (!tok) return
  // Allow full URL or token
  try {
    const u = new URL(tok)
    const token = u.pathname.split('/').pop() || u.searchParams.get('token') || ''
    if (token) {
      router.push({ name: 'custom-import', params: { token } })
      return
    }
  } catch {
    // not a URL, treat as token
    router.push({ name: 'custom-import', params: { token: tok } })
    return
  }
}

function play(q: CustomQuiz) {
  router.push({ name: 'custom-play', params: { id: q.id } })
}
function edit(q: CustomQuiz) {
  router.push({ name: 'custom-edit', params: { id: q.id } })
}
function remove(q: CustomQuiz) {
  const ok = window.confirm(`Delete quiz "${q.title}"?`)
  if (!ok) return
  store.remove(q.id)
  ariaMsg.value = `Quiz ${q.title} deleted`
}
</script>

<template>
  <section class="card home">
    <div class="inner">
      <h2 class="title">Custom Quizzes</h2>
      <p class="sub">Create, import, and play custom quizzes. Share via link or JSON.</p>

      <div class="actions">
        <button class="btn btn-primary" @click="onCreate" aria-label="Create new custom quiz">Create New</button>
        <button class="btn btn-secondary" @click="onImportLink" aria-label="Import from link">Import Link</button>
        <button class="btn btn-secondary" @click="onImportJson" aria-label="Import from JSON file">Import JSON</button>
      </div>

      <div class="list">
        <div v-if="!quizzes.length" class="empty">
          <p>No custom quizzes yet.</p>
          <p class="muted">Click “Create New” or “Import” to get started. Shareable links look like /custom/import/&lt;token&gt;.</p>
        </div>

        <div v-for="q in quizzes" :key="q.id" class="row card">
          <div class="meta">
            <div class="head">
              <span class="q-title">{{ q.title }}</span>
              <span class="badge" :class="q.visibility === 'link' ? 'ok' : ''">{{ q.visibility }}</span>
            </div>
            <div class="desc">
              {{ q.description || 'No description' }}
            </div>
            <div class="info">
              <span>{{ q.questions.length }} questions</span>
              <span v-if="q.category">• {{ q.category }}</span>
              <span class="muted">• Updated {{ new Date(q.updatedAt).toLocaleString() }}</span>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn btn-primary btn-sm" @click="play(q)">Play</button>
            <button class="btn btn-secondary btn-sm" @click="edit(q)">Edit</button>
            <button class="btn btn-secondary btn-sm" @click="remove(q)">Delete</button>
          </div>
        </div>
      </div>

      <span class="sr-only" aria-live="polite">{{ ariaMsg }}</span>
    </div>
  </section>
</template>

<style scoped>
.home { padding: 1rem 1rem; }
.inner { max-width: 900px; margin: 0 auto; display: grid; gap: .75rem; }
.title { font-size: 1.5rem; font-weight: 800; }
.sub { color: var(--muted); }
.actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.list { display: grid; gap: .5rem; margin-top: .5rem; }
.empty { text-align: center; color: var(--muted); padding: .75rem; }
.row { display: grid; grid-template-columns: 1fr auto; gap: .75rem; align-items: center; padding: .75rem; }
.head { display: flex; gap: .5rem; align-items: center; }
.q-title { font-weight: 800; color: var(--text); }
.badge { border: 1px solid #e5e7eb; background: #fff; border-radius: 999px; padding: .1rem .5rem; font-size: .75rem; font-weight: 700; }
.badge.ok { color: var(--primary); border-color: #bfdbfe; background: #eff6ff; }
.desc { color: var(--text); margin-top:.125rem; }
.info { color: var(--muted); font-size: .9rem; margin-top: .125rem; display: flex; gap: .35rem; flex-wrap: wrap; }
.row-actions { display: flex; gap: .5rem; }
.muted { color: var(--muted); }
.sr-only { position: absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
</style>
