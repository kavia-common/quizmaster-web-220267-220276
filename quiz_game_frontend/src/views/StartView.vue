<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useQuizStore, type CategoryKey } from '@/stores/quiz'
import { computed, ref, onMounted } from 'vue'
import { useDailyQuizStore } from '@/stores/dailyQuiz'
import { useOfflineStore } from '@/stores/offline'
import { downloadAllCategories, downloadCategoryPack, exportPackToJson, importPackFromJson } from '@/utils/offlineService'
import { useCategoryUnlockStore } from '@/stores/categoryUnlocks'

const router = useRouter()
const quiz = useQuizStore()
const daily = useDailyQuizStore()
const offline = useOfflineStore()
const unlocks = useCategoryUnlockStore()

const busy = ref(false)
const loadError = ref<string | null>(null)
const arAnnounce = ref('')
const progressMsg = ref('')

const categories: Array<{ key: CategoryKey; label: string; emoji: string; hint: string }> = [
  { key: 'gk', label: 'General Knowledge', emoji: '🧠', hint: 'A bit of everything' },
  { key: 'sports', label: 'Sports', emoji: '🏅', hint: 'Games and records' },
  { key: 'movies', label: 'Movies', emoji: '🎬', hint: 'Cinema & film trivia' },
  { key: 'science', label: 'Science', emoji: '🔬', hint: 'Facts & discoveries' },
  { key: 'history', label: 'History', emoji: '🏛️', hint: 'Past events & figures' },
  { key: 'geography', label: 'Geography', emoji: '🗺️', hint: 'World & places' },
]
const picked = ref<CategoryKey>(quiz.selectedCategory ?? 'gk')

const hasSession = computed(() => quiz.hasSavedSession())
const hasDailySession = computed(() => daily.hasSavedDaily())
const sessionProgress = computed(() => quiz.progress)
const sessionCategoryLabel = computed(() => {
  const map: Record<'gk'|'sports'|'movies'|'science'|'history'|'geography', string> = {
    gk: 'General Knowledge',
    sports: 'Sports',
    movies: 'Movies',
    science: 'Science',
    history: 'History',
    geography: 'Geography'
  }
  return map[quiz.selectedCategory as 'gk'|'sports'|'movies'|'science'|'history'|'geography'] || quiz.selectedCategory
})

const todayKey = computed(() => daily.getPersistentOverview().dailyDate)
const dailyStreak = computed(() => daily.getPersistentOverview().streakCount)

// Offline helpers
const offlineEnabled = computed({
  get: () => offline.enabled,
  set: (v: boolean) => offline.setEnabled(v),
})
function statusLabel(c: CategoryKey): string {
  const p = offline.getPack(c)
  if (!p) return 'Not downloaded'
  return `Available • ${p.meta.size} • ${new Date(p.meta.lastUpdated).toLocaleDateString()}`
}
async function downloadCat(c: CategoryKey) {
  progressMsg.value = `Downloading ${c}…`
  const res = await downloadCategoryPack(c)
  progressMsg.value = res.message
}
async function downloadAll() {
  progressMsg.value = 'Downloading all…'
  const res = await downloadAllCategories((c, i, total, s) => {
    progressMsg.value = `(${i}/${total}) ${c}: ${s}`
  })
  progressMsg.value = res.summary
}
function exportCat(c: CategoryKey) {
  const res = exportPackToJson(c)
  if (!res.ok || !res.json) {
    window.alert(res.message || 'Nothing to export')
    return
  }
  const blob = new Blob([res.json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quiz_pack_${c}.json`
  a.click()
  URL.revokeObjectURL(url)
}
async function importCat(c: CategoryKey) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const res = importPackFromJson(c, text)
    window.alert(res.message)
  }
  input.click()
}

function isLocked(c: CategoryKey): boolean {
  return !unlocks.isUnlocked(c)
}
function lockedReason(c: CategoryKey): string {
  return unlocks.getLockedReason(c) || 'Locked'
}

function clickCategory(c: CategoryKey) {
  // Allow selection but if locked, do not start; show hint instead.
  picked.value = c
}

function keydownCategory(e: KeyboardEvent, c: CategoryKey) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (isLocked(c)) {
      alert(lockedReason(c))
      return
    }
    picked.value = c
  }
}

const learningPath = computed(() => {
  // List of next targets that are still locked with their conditions
  const list = categories
    .filter((c) => isLocked(c.key))
    .map((c) => ({ label: c.label, reason: lockedReason(c.key) }))
  return list.slice(0, 4)
})

async function start() {
  if (isLocked(picked.value)) {
    // focus remains and show hint
    alert(lockedReason(picked.value))
    return
  }
  if (hasSession.value) {
    const ok = window.confirm('Starting a new quiz will discard your saved progress. Continue?')
    if (!ok) return
    quiz.resetSession()
  }
  busy.value = true
  loadError.value = null
  quiz.resetRuntime()
  quiz.setCategory(picked.value)
  await quiz.loadQuestions()
  busy.value = false
  if (quiz.questions.length) {
    router.push({ name: 'quiz', query: { startWithCountdown: '1' } })
  } else {
    loadError.value = 'No questions available.'
  }
}

async function resume() {
  const ok = await quiz.resumeIfAvailable()
  if (ok) {
    router.push({ name: 'quiz' })
  } else {
    await start()
  }
}

async function startDaily() {
  if (hasDailySession.value) {
    const ok = window.confirm('A daily attempt is in progress. Start over and discard it?')
    if (!ok) return
    daily.clearSession()
  }
  busy.value = true
  await daily.prepareToday(null, 10)
  busy.value = false
  if (!daily.error && daily.questions.length) {
    router.push({ name: 'daily', query: { startWithCountdown: '1' } })
  }
}

async function resumeDaily() {
  const ok = await daily.resumeIfAvailable()
  if (ok) {
    router.push({ name: 'daily' })
  } else {
    await startDaily()
  }
}

onMounted(() => {
  unlocks.loadUnlocks()
  arAnnounce.value = `Daily quiz for ${todayKey.value}. Current streak ${dailyStreak.value} days.`
})
</script>

<template>
  <section class="hero card">
    <div class="hero-inner">
      <h2 class="hero-title">Welcome to QuizMaster</h2>
      <p class="hero-sub">Choose a category to begin your journey.</p>

      <span class="sr-only" aria-live="polite">{{ arAnnounce }}</span>

      <!-- Offline mode controls -->
      <div class="offline card">
        <div class="offline-left">
          <div class="offline-badge" aria-hidden="true">Offline</div>
          <div class="offline-info">
            <div class="offline-title">Offline Mode</div>
            <div class="offline-sub">
              Play using downloaded question packs. 
              <span v-if="!offlineEnabled">Toggle on to prefer cached questions.</span>
            </div>
          </div>
        </div>
        <div class="offline-right">
          <label class="switch">
            <input type="checkbox" :checked="offlineEnabled" @change="offlineEnabled = ($event.target as HTMLInputElement).checked" aria-label="Toggle Offline Mode">
            <span class="slider"></span>
          </label>
          <button class="btn btn-secondary" @click="downloadAll" title="Download all categories">Download All</button>
          <button class="btn btn-secondary" @click="router.push({ name: 'offline-manage' })" title="Manage cached packs">Manage</button>
        </div>
      </div>
      <p v-if="progressMsg" class="progress-msg" aria-live="polite">{{ progressMsg }}</p>

      <!-- Category cache status and actions -->
      <div class="offline-grid">
        <div v-for="c in categories" :key="c.key" class="offline-row">
          <div class="off-cat">
            <span class="cat-emoji" aria-hidden="true">{{ c.emoji }}</span>
            <span class="cat-label">{{ c.label }}</span>
          </div>
          <div class="off-status">
            <span class="badge" :class="offline.getPack(c.key) ? 'badge-ok' : 'badge-warn'">
              {{ statusLabel(c.key) }}
            </span>
          </div>
          <div class="off-actions">
            <button class="btn btn-secondary btn-xs" @click="downloadCat(c.key)">Download/Refresh</button>
            <button class="btn btn-secondary btn-xs" @click="exportCat(c.key)">Export</button>
            <button class="btn btn-secondary btn-xs" @click="importCat(c.key)">Import</button>
          </div>
        </div>
      </div>

      <div class="daily card">
        <div class="daily-left">
          <div class="daily-badge" aria-hidden="true">Daily</div>
          <div class="daily-info">
            <div class="daily-title">Daily Quiz</div>
            <div class="daily-sub">Today: <strong>{{ todayKey }}</strong></div>
          </div>
        </div>
        <div class="daily-right">
          <span class="streak" role="status" aria-live="polite" :aria-label="`Current streak ${dailyStreak} days`">
            🔥 {{ dailyStreak }} day{{ dailyStreak === 1 ? '' : 's' }}
          </span>
          <button
            v-if="hasDailySession"
            class="btn btn-primary"
            @click="resumeDaily"
            :disabled="busy"
            aria-label="Resume Daily Quiz"
            title="Resume Daily Quiz"
          >
            Resume Daily
          </button>
          <button
            v-else
            class="btn btn-secondary"
            @click="startDaily"
            :disabled="busy"
            aria-label="Start Daily Quiz"
            title="Start Daily Quiz"
          >
            Start Daily
          </button>
        </div>
      </div>

      <div class="grid">
        <button
          v-for="c in categories"
          :key="c.key"
          class="category"
          :class="[{ active: picked === c.key }, isLocked(c.key) ? 'locked' : '']"
          @click="clickCategory(c.key)"
          @keydown="(e) => keydownCategory(e, c.key)"
          :aria-pressed="picked === c.key"
          :aria-label="isLocked(c.key) ? `${c.label} locked: ${lockedReason(c.key)}` : `Select ${c.label}`"
          tabindex="0"
        >
          <div class="cat-emoji" aria-hidden="true">{{ c.emoji }}</div>
          <div class="cat-info">
            <div class="cat-label">
              {{ c.label }}
              <span v-if="isLocked(c.key)" class="lock" aria-hidden="true">🔒</span>
            </div>
            <div class="cat-hint">
              <template v-if="isLocked(c.key)">
                {{ lockedReason(c.key) }}
              </template>
              <template v-else>
                {{ c.hint }}
              </template>
            </div>
          </div>
        </button>
      </div>

      <aside class="path card" aria-label="Learning Path">
        <h3 class="path-title">Learning Path</h3>
        <ul class="path-list">
          <li v-for="(t, i) in learningPath" :key="i">
            <span class="dot-blue" aria-hidden="true"></span>
            <span class="t-label">{{ t.label }}</span>
            <span class="t-reason">{{ t.reason }}</span>
          </li>
        </ul>
      </aside>

      <div class="hero-actions">
        <button v-if="hasSession" class="btn btn-primary" @click="resume" :disabled="busy">
          Resume Quiz
          <span class="badge"> {{ sessionCategoryLabel }} • {{ sessionProgress }}% </span>
        </button>
        <button class="btn" :class="hasSession ? 'btn-secondary' : 'btn-primary'" @click="start" :disabled="busy">
          {{ busy ? 'Preparing…' : (hasSession ? 'Start New Quiz' : 'Start Quiz') }}
        </button>
        <button
          class="btn btn-secondary"
          @click="router.push({ name: 'scoreboard' })"
          :disabled="busy"
          title="View saved scores"
        >
          View Scoreboard
        </button>
        <button
          class="btn btn-secondary"
          @click="router.push({ name: 'mp-lobby' })"
          :disabled="busy"
          title="Play with friends (optional)"
          aria-label="Multiplayer lobby"
        >
          Multiplayer
        </button>
        <button
          class="btn btn-secondary"
          @click="router.push({ name: 'analytics' })"
          :disabled="busy"
          title="View analytics"
          aria-label="View analytics"
        >
          View Analytics
        </button>
      </div>
      <p v-if="loadError" class="error">{{ loadError }}</p>

      <p class="hint-save" aria-live="polite">
        <span class="dot" aria-hidden="true"></span>
        Progress auto-saved
      </p>
    </div>
  </section>
</template>

<style scoped>
.hero {
  padding: 2rem 1.5rem;
  background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(249,250,251,1));
  border: 1px solid #e5e7eb;
}
.hero-inner {
  display: grid;
  gap: 1rem;
  text-align: center;
  max-width: 880px;
  margin: 0 auto;
}
.hero-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text);
}
.hero-sub {
  color: var(--muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: .75rem;
  margin: .5rem 0 0.25rem;
}
.category {
  display: flex;
  align-items: center;
  gap: .75rem;
  background: var(--surface);
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: .75rem .9rem;
  text-align: left;
  cursor: pointer;
  transition: all .2s ease;
}
.category:hover { background: #f9fafb; }
.category.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--ring);
}
.category.locked {
  opacity: .7;
  cursor: default;
  border-style: dashed;
}
.cat-emoji {
  font-size: 1.4rem;
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center; 
  justify-content: center;
  background: #fff;
  border-radius: .75rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 1px 1px rgba(0,0,0,0.04);
}
.cat-info {
  display: grid;
  gap: .125rem;
}
.cat-label {
  font-weight: 700;
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: .35rem;
}
.lock {
  display: inline-flex;
  align-items: center;
  padding: .05rem .35rem;
  border-radius: .5rem;
  border: 1px solid #e5e7eb;
  background: linear-gradient(90deg, rgba(17,24,39,.04), rgba(255,255,255,1));
  color: #111827;
  font-size: .75rem;
}
.cat-hint {
  color: var(--muted);
  font-size: .85rem;
}

.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap; border: 0;
}

.offline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  background: var(--surface);
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: .75rem .9rem;
  margin: .5rem 0 1rem;
}
.offline-left { display: flex; align-items: center; gap: .75rem; }
.offline-badge {
  padding: .1rem .5rem;
  font-size: .75rem;
  font-weight: 800;
  color: #fff;
  background: var(--secondary);
  border-radius: 999px;
  box-shadow: 0 1px 2px rgba(0,0,0,.06);
}
.offline-info { display: grid; gap: .1rem; }
.offline-title { font-weight: 800; color: var(--text); }
.offline-sub { font-size: .85rem; color: var(--muted); }
.offline-right { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }

.switch { position: relative; display: inline-block; width: 44px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #e5e7eb; transition: .2s; border-radius: 999px; }
.slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,.1); }
.switch input:checked + .slider { background-color: var(--primary); }
.switch input:checked + .slider:before { transform: translateX(20px); }

.progress-msg { font-size: .85rem; color: var(--muted); margin-top: -.5rem; margin-bottom: .5rem; }

.offline-grid { display: grid; grid-template-columns: 1fr; gap: .5rem; margin-bottom: .25rem; }
.offline-row { display: grid; grid-template-columns: 1.2fr .8fr auto; align-items: center; gap: .5rem; border: 1px solid #e5e7eb; background: #fff; border-radius: .75rem; padding: .5rem .6rem; }
.off-cat { display: flex; align-items: center; gap: .5rem; }
.off-status { text-align: left; }
.off-actions { display: flex; gap: .5rem; justify-content: flex-end; flex-wrap: wrap; }

.badge-ok { color: var(--primary); background: #f0f7ff; border-color: #dbeafe; }
.badge-warn { color: #92400e; background: #fffbeb; border-color: #fde68a; }

.daily {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  background: var(--surface);
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: .75rem .9rem;
  margin: .5rem 0 1rem;
}
.daily-left { display: flex; align-items: center; gap: .75rem; }
.daily-badge {
  padding: .1rem .5rem;
  font-size: .75rem;
  font-weight: 800;
  color: #fff;
  background: var(--primary);
  border-radius: 999px;
  box-shadow: 0 1px 2px rgba(0,0,0,.06);
}
.daily-info { display: grid; gap: .1rem; }
.daily-title { font-weight: 800; color: var(--text); }
.daily-sub { font-size: .85rem; color: var(--muted); }
.daily-right { display: flex; align-items: center; gap: .5rem; }
.streak {
  display: inline-flex;
  align-items: center;
  padding: .15rem .5rem;
  border-radius: 999px;
  border: 1px solid #fde68a;
  background: linear-gradient(90deg, rgba(245,158,11,.12), rgba(255,255,255,1));
  color: var(--secondary);
  font-weight: 700;
  font-size: .8rem;
}

.path { padding: .75rem; margin-top: .5rem; border: 1px solid #e5e7eb; }
.path-title { font-weight: 800; color: var(--text); margin-bottom: .35rem; }
.path-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .35rem; text-align: left; }
.path-list li { display: grid; grid-template-columns: auto auto 1fr; gap: .4rem; align-items: center; }
.dot-blue { width: .5rem; height: .5rem; border-radius: 50%; background: #2563EB; box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
.t-label { font-weight: 700; color: var(--text); }
.t-reason { color: var(--muted); font-size: .9rem; }

.hero-actions {
  display: flex;
  gap: .75rem;
  justify-content: center;
  flex-wrap: wrap;
}
.error {
  color: var(--error);
}
.badge {
  margin-left: .5rem;
  padding: .1rem .5rem;
  font-size: .75rem;
  font-weight: 700;
  color: var(--primary);
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
}
.hint-save {
  margin-top: .25rem;
  font-size: .85rem;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .4rem;
}
.dot {
  width: .5rem; height: .5rem; border-radius: 50%;
  background: var(--secondary);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, .18);
}
</style>
