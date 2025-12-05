<script setup lang="ts">
import { computed } from 'vue'
import { useOfflineStore } from '@/stores/offline'
import type { CategoryKey } from '@/stores/quiz'
import { useRouter } from 'vue-router'

const offline = useOfflineStore()
const router = useRouter()

const summary = computed(() => offline.getStorageUsageSummary())

function remove(c: CategoryKey) {
  const ok = window.confirm('Delete cached pack for this category?')
  if (!ok) return
  offline.deletePack(c)
}

function clearAll() {
  const ok = window.confirm('Delete all cached packs?')
  if (!ok) return
  offline.clearAll()
}

</script>

<template>
  <section class="card manage">
    <div class="head">
      <h2>Manage Offline Packs</h2>
      <button class="btn btn-secondary" @click="router.back()">Back</button>
    </div>
    <p class="sub">Storage usage and cached question packs per category. Total questions: <strong>{{ summary.totalQuestions }}</strong></p>

    <div class="list">
      <div v-for="item in summary.categories" :key="item.category" class="row">
        <div class="l">
          <div class="title">{{ item.category }}</div>
          <div class="meta">
            <span>Questions: {{ item.size }}</span>
            <span v-if="item.lastUpdated"> • Updated: {{ new Date(item.lastUpdated).toLocaleString() }}</span>
            <span v-else> • Not downloaded</span>
          </div>
        </div>
        <div class="r">
          <button class="btn btn-secondary btn-xs" @click="remove(item.category)">Delete</button>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" @click="clearAll">Clear All</button>
    </div>
  </section>
</template>

<style scoped>
.manage { padding: 1rem; }
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .5rem; }
.sub { color: var(--muted); }
.list { display: grid; gap: .5rem; margin-top: .75rem; }
.row { display: flex; align-items: center; justify-content: space-between; gap: .5rem; background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem; padding: .6rem .75rem; }
.l { display: grid; gap: .15rem; }
.title { font-weight: 700; }
.meta { color: var(--muted); font-size: .9rem; }
.actions { margin-top: .75rem; display: flex; justify-content: flex-end; }
</style>
