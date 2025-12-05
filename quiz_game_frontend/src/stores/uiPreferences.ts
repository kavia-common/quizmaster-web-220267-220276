import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * UI Preferences store
 * - Persists lightweight preferences to localStorage
 * - Currently supports Auto Next (2s) mode
 */

const STORAGE_KEY = 'quizmaster:uiPrefs.v1'
type UiPrefsSchema = {
  version: number
  autoNextEnabled: boolean
}
const VERSION = 1

function readPrefs(): UiPrefsSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: VERSION, autoNextEnabled: false }
    const obj = JSON.parse(raw) as Partial<UiPrefsSchema>
    const enabled = typeof obj.autoNextEnabled === 'boolean' ? obj.autoNextEnabled : false
    return { version: VERSION, autoNextEnabled: enabled }
  } catch {
    return { version: VERSION, autoNextEnabled: false }
  }
}
function writePrefs(p: UiPrefsSchema) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // ignore
  }
}

// PUBLIC_INTERFACE
export const useUiPreferencesStore = defineStore('uiPreferences', () => {
  const persisted = readPrefs()
  const autoNextEnabled = ref<boolean>(persisted.autoNextEnabled)

  function persist() {
    writePrefs({ version: VERSION, autoNextEnabled: autoNextEnabled.value })
  }

  // PUBLIC_INTERFACE
  function setAutoNext(v: boolean) {
    autoNextEnabled.value = !!v
    persist()
  }

  // PUBLIC_INTERFACE
  function toggleAutoNext() {
    setAutoNext(!autoNextEnabled.value)
  }

  return {
    autoNextEnabled,
    setAutoNext,
    toggleAutoNext,
  }
})
