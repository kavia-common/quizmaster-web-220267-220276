<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCustomQuizzesStore, type CustomQuiz, type CustomQuizQuestion } from '@/stores/customQuizzes'

/* using $router in template; no local router variable needed */
const route = useRoute()
const store = useCustomQuizzesStore()
const editingId = computed(() => (route.params.id ? String(route.params.id) : null))

const ariaMsg = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)

type Draft = {
  id?: string
  title: string
  description?: string
  category?: string
  visibility: 'private' | 'link'
  questions: CustomQuizQuestion[]
  author?: { name?: string }
}
const draft = reactive<Draft>({
  title: '',
  description: '',
  category: '',
  visibility: 'private',
  questions: [],
  author: { name: '' },
})

function newQuestion(): CustomQuizQuestion {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    text: '',
    options: ['', ''],
    correctIndex: 0,
    explanation: '',
    hint: '',
    referenceUrl: '',
  }
}

function loadOrInit() {
  if (!store.loaded) store.load()
  if (editingId.value) {
    const q = store.get(editingId.value)
    if (q) {
      draft.id = q.id
      draft.title = q.title
      draft.description = q.description
      draft.category = q.category
      draft.visibility = q.visibility
      draft.questions = q.questions.map((x) => ({ ...x }))
      draft.author = q.author ? { ...q.author } : { name: '' }
      return
    }
  }
  // init new
  draft.id = undefined
  draft.title = ''
  draft.description = ''
  draft.category = ''
  draft.visibility = 'private'
  draft.questions = [newQuestion()]
  draft.author = { name: '' }
}

onMounted(loadOrInit)

function addQuestionAt(index?: number) {
  const q = newQuestion()
  if (typeof index === 'number' && index >= 0 && index < draft.questions.length) {
    draft.questions.splice(index + 1, 0, q)
  } else {
    draft.questions.push(q)
  }
  announce('Question added')
}
function removeQuestion(i: number) {
  draft.questions.splice(i, 1)
  announce('Question removed')
}
function moveQuestion(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= draft.questions.length) return
  const [q] = draft.questions.splice(i, 1)
  draft.questions.splice(j, 0, q)
  announce('Question reordered')
}

function ensureOptionsBounds(q: CustomQuizQuestion) {
  if (q.options.length < 2) {
    while (q.options.length < 2) q.options.push('')
  }
  if (q.options.length > 6) q.options = q.options.slice(0, 6)
  if (q.correctIndex >= q.options.length) q.correctIndex = Math.max(0, q.options.length - 1)
}
function addOption(q: CustomQuizQuestion) {
  if (q.options.length >= 6) return
  q.options.push('')
}
function removeOption(q: CustomQuizQuestion, idx: number) {
  if (q.options.length <= 2) return
  q.options.splice(idx, 1)
  if (q.correctIndex === idx) q.correctIndex = 0
  if (q.correctIndex > idx) q.correctIndex -= 1
}

const validation = computed(() => {
  const errors: string[] = []
  if (!draft.title.trim()) errors.push('Title is required')
  if (!draft.questions.length) errors.push('At least one question is required')
  draft.questions.forEach((q, i) => {
    if (!q.text.trim()) errors.push(`Question ${i + 1}: text is required`)
    const opts = q.options.map((o) => o.trim()).filter((o) => o)
    if (opts.length < 2) errors.push(`Question ${i + 1}: at least 2 options`)
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) errors.push(`Question ${i + 1}: select a correct option`)
  })
  return { ok: errors.length === 0, errors }
})

let saveTimer: number | undefined
function debounceSave() {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => save(true), 700)
}

function save(isAutosave = false) {
  if (!validation.value.ok) {
    if (!isAutosave) saveError.value = validation.value.errors[0] || 'Invalid fields'
    return
  }
  saving.value = true
  saveError.value = null
  try {
    const payload: Omit<CustomQuiz, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } = {
      id: draft.id,
      title: draft.title.trim(),
      description: draft.description?.trim() || undefined,
      category: draft.category?.trim() || undefined,
      visibility: draft.visibility,
      author: draft.author?.name ? { name: draft.author.name } : undefined,
      questions: draft.questions.map((q) => ({
        id: q.id,
        text: q.text.trim(),
        options: q.options.map((o) => o.toString()),
        correctIndex: q.correctIndex,
        explanation: q.explanation?.trim() || undefined,
        hint: q.hint?.trim() || undefined,
        referenceUrl: q.referenceUrl?.trim() || undefined,
      })),
    }
    const res = draft.id ? store.update(draft.id, payload) : store.create(payload)
    if (!res) {
      saveError.value = 'Failed to save'
    } else {
      draft.id = res.id
      if (!isAutosave) announce('Quiz saved')
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : 'Failed to save'
    saveError.value = msg
  } finally {
    saving.value = false
  }
}

function share() {
  if (!draft.id) {
    const ok = window.confirm('Save quiz before generating a share link?')
    if (!ok) return
    save(false)
  }
  if (!draft.id) return
  const res = store.encodeQuizToToken(draft.id)
  if (!res.ok || !res.token) {
    alert(res.error || 'Failed to create token')
    return
  }
  const link = `${location.origin}${import.meta.env.BASE_URL || '/'}custom/import/${res.token}`
  navigator.clipboard?.writeText(link).then(
    () => announce('Share link copied to clipboard'),
    () => alert(link)
  )
}

function exportJson() {
  if (!draft.id) {
    const ok = window.confirm('Save quiz before exporting?')
    if (!ok) return
    save(false)
  }
  if (!draft.id) return
  const res = store.exportQuizJson(draft.id)
  if (!res.ok || !res.json) {
    alert(res.error || 'Export failed')
    return
  }
  const blob = new Blob([res.json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${draft.title.replace(/\s+/g, '_') || 'custom_quiz'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function announce(msg: string) {
  ariaMsg.value = msg
}

watch(
  () => draft,
  () => debounceSave(),
  { deep: true }
)
</script>

<template>
  <section class="card builder">
    <div class="inner">
      <h2 class="title">{{ editingId ? 'Edit Custom Quiz' : 'New Custom Quiz' }}</h2>
      <div class="form">
        <div class="row">
          <label class="label" for="title">Title</label>
          <input id="title" v-model="draft.title" class="input" type="text" placeholder="e.g., JavaScript Basics" aria-required="true" />
        </div>
        <div class="row">
          <label class="label" for="desc">Description</label>
          <textarea id="desc" v-model="draft.description" class="input" rows="2" placeholder="Brief summary (optional)"></textarea>
        </div>
        <div class="row grid2">
          <div>
            <label class="label" for="cat">Category</label>
            <input id="cat" v-model="draft.category" class="input" type="text" placeholder="e.g., programming" />
          </div>
          <div>
            <label class="label" for="vis">Visibility</label>
            <select id="vis" v-model="draft.visibility" class="input">
              <option value="private">Private</option>
              <option value="link">Link (anyone with link)</option>
            </select>
          </div>
        </div>
        <div class="row">
          <label class="label" for="author">Author (optional)</label>
          <input id="author" v-model="draft.author!.name" class="input" type="text" placeholder="Your name" />
        </div>
      </div>

      <div class="q-list">
        <h3 class="q-title">Questions</h3>
        <div v-for="(q, i) in draft.questions" :key="q.id" class="q card">
          <div class="q-head">
            <div class="q-index">Q{{ i + 1 }}</div>
            <div class="q-actions">
              <button class="btn btn-secondary btn-xs" @click="moveQuestion(i, -1)" :disabled="i===0" aria-label="Move up">↑</button>
              <button class="btn btn-secondary btn-xs" @click="moveQuestion(i, 1)" :disabled="i===draft.questions.length-1" aria-label="Move down">↓</button>
              <button class="btn btn-secondary btn-xs" @click="addQuestionAt(i)" aria-label="Add after">+ Add</button>
              <button class="btn btn-secondary btn-xs" @click="removeQuestion(i)" :disabled="draft.questions.length<=1" aria-label="Remove">Remove</button>
            </div>
          </div>

          <div class="row">
            <label class="label">Question Text</label>
            <textarea v-model="q.text" class="input" rows="2" placeholder="Type the question stem"></textarea>
          </div>

          <div class="opts">
            <div class="opt-row" v-for="(opt, idx) in q.options" :key="idx">
              <div class="opt-left">
                <input
                  :id="`correct-${q.id}-${idx}`"
                  type="radio"
                  :name="`correct-${q.id}`"
                  :checked="q.correctIndex === idx"
                  @change="q.correctIndex = idx"
                  :aria-label="`Mark option ${idx+1} as correct`"
                />
              </div>
              <div class="opt-mid">
                <input
                  class="input"
                  type="text"
                  v-model="q.options[idx]"
                  :placeholder="`Option ${idx+1}`"
                  @input="ensureOptionsBounds(q)"
                />
              </div>
              <div class="opt-right">
                <button class="btn btn-secondary btn-xs" @click="removeOption(q, idx)" :disabled="q.options.length<=2">Remove</button>
              </div>
            </div>
            <div class="opt-actions">
              <button class="btn btn-secondary btn-sm" @click="addOption(q)" :disabled="q.options.length>=6">Add option</button>
              <span class="muted">Pick the correct option using the radio button.</span>
            </div>
          </div>

          <div class="row grid2">
            <div>
              <label class="label">Hint (optional)</label>
              <input class="input" type="text" v-model="q.hint" placeholder="Helpful clue" />
            </div>
            <div>
              <label class="label">Reference URL (optional)</label>
              <input class="input" type="url" v-model="q.referenceUrl" placeholder="https://..." />
            </div>
          </div>
          <div class="row">
            <label class="label">Explanation (optional)</label>
            <textarea class="input" rows="2" v-model="q.explanation" placeholder="Why is this correct?"></textarea>
          </div>
        </div>

        <div class="add-last">
          <button class="btn btn-secondary" @click="addQuestionAt()">+ Add Question</button>
        </div>
      </div>

      <div class="footer">
        <div class="left">
          <button class="btn btn-primary" @click="save(false)" :disabled="!validation.ok || saving">Save</button>
          <button class="btn btn-secondary" @click="share" :disabled="!draft.id">Share</button>
          <button class="btn btn-secondary" @click="exportJson" :disabled="!draft.id">Export JSON</button>
          <span class="muted" v-if="saveError">{{ saveError }}</span>
          <ul v-else-if="!validation.ok" class="val">
            <li v-for="(e,i) in validation.errors" :key="i">{{ e }}</li>
          </ul>
        </div>
        <div class="right">
          <button class="btn btn-secondary" @click="$router.push({ name: 'custom-home' })">Back</button>
          <button class="btn btn-secondary" v-if="draft.id" @click="$router.push({ name: 'custom-play', params: { id: draft.id } })">Play</button>
        </div>
      </div>

      <span class="sr-only" aria-live="polite">{{ ariaMsg }}</span>
    </div>
  </section>
</template>

<style scoped>
.builder { padding: 1rem; }
.inner { max-width: 980px; margin: 0 auto; display: grid; gap: .75rem; }
.title { font-size: 1.5rem; font-weight: 800; }
.form { display: grid; gap: .5rem; }
.row { display: grid; gap: .25rem; }
.grid2 { grid-template-columns: 1fr 1fr; }
.label { font-weight: 700; color: var(--text); }
.input { border: 1px solid #e5e7eb; border-radius: .75rem; padding: .5rem .6rem; background: #fff; color: var(--text); }
.q-list { display: grid; gap: .5rem; margin-top: .5rem; }
.q-title { font-weight: 800; color: var(--text); }
.q { padding: .75rem; }
.q-head { display: flex; justify-content: space-between; align-items: center; }
.q-index { font-weight: 800; color: var(--primary); }
.q-actions { display: flex; gap: .5rem; }
.opts { display: grid; gap: .35rem; }
.opt-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .4rem; }
.opt-left { display: flex; justify-content: center; }
.opt-mid { }
.opt-right { }
.opt-actions { display: flex; gap: .5rem; align-items: center; }
.muted { color: var(--muted); font-size: .9rem; }
.add-last { margin-top: .25rem; }
.footer { display: flex; justify-content: space-between; align-items: center; gap: .5rem; flex-wrap: wrap; margin-top: .5rem; }
.val { margin: 0; padding-left: 1rem; color: var(--error); }
.sr-only { position: absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
</style>
