<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

/**
 * Animated full-screen countdown overlay.
 * - Shows 3, 2, 1, and optional "Go!" with scale/fade/bounce animations.
 * - Emits 'complete' when finished or when user skips (via button or Escape).
 * - Accessible via role="status" and aria-live.
 */
const props = withDefaults(defineProps<{
  durationMsPerStep?: number
  showGo?: boolean
}>(), {
  durationMsPerStep: 700,
  showGo: true,
})

const emit = defineEmits<{
  (e: 'complete'): void
}>()

// Rendered steps, themed text
const steps = computed<string[]>(() => props.showGo ? ['3', '2', '1', 'Go!'] : ['3', '2', '1'])

const index = ref(0)
const running = ref(true)
let tickTimer: number | null = null

function cleanupTimer() {
  if (tickTimer != null) {
    clearTimeout(tickTimer)
    tickTimer = null
  }
}

function finish() {
  cleanupTimer()
  if (!running.value) return
  running.value = false
  emit('complete')
}

function scheduleNext() {
  cleanupTimer()
  const hasNext = index.value < steps.value.length - 1
  // Slightly longer pause on "Go!" end to allow visual punch
  const base = props.durationMsPerStep
  const delay = hasNext ? base : Math.min(600, Math.max(300, Math.floor(base * 0.85)))
  tickTimer = window.setTimeout(() => {
    if (!hasNext) {
      finish()
    } else {
      index.value += 1
      scheduleNext()
    }
  }, delay)
}

function skip() {
  finish()
}

function onKey(e: KeyboardEvent) {
  // Prevent Enter/Space from interacting with underlying app while overlay is active.
  if (!running.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    skip()
    return
  }
  if (e.key === 'Enter' || e.key === ' ') {
    // swallow to avoid accidental submit beneath
    e.preventDefault()
  }
}

onMounted(() => {
  index.value = 0
  running.value = true
  scheduleNext()
  window.addEventListener('keydown', onKey, { capture: true })
})

onBeforeUnmount(() => {
  cleanupTimer()
  // Cast options to EventListenerOptions to avoid any
  window.removeEventListener('keydown', onKey, { capture: true } as EventListenerOptions)
})
</script>

<template>
  <div
    class="overlay"
    aria-live="assertive"
    role="status"
    aria-label="Starting soon"
  >
    <div class="glass"></div>
    <div class="center">
      <transition name="pulse" mode="out-in">
        <div
          :key="index"
          class="digit"
          :class="[{ go: steps[index] === 'Go!' }]"
        >
          {{ steps[index] }}
        </div>
      </transition>
    </div>

    <button
      class="skip"
      type="button"
      @click="skip"
      aria-label="Skip countdown"
      title="Skip countdown"
    >
      Skip
    </button>
  </div>
</template>

<style scoped>
/* Full screen overlay with subtle gradient following Ocean Professional */
.overlay {
  position: fixed;
  z-index: 9999;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: auto;
}

.glass {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(59,130,246,0.10), rgba(249,250,251,1));
  backdrop-filter: blur(1px);
}

.center {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  text-align: center;
}

/* Animated digit styles */
.digit {
  font-weight: 900;
  color: var(--primary);
  text-shadow: 0 8px 30px rgba(37, 99, 235, 0.25);
  /* Responsive sizing */
  font-size: clamp(2.5rem, 6vw + 1rem, 5.5rem);
  line-height: 1;
  padding: 0.25rem 0.5rem;
}

.digit.go {
  color: var(--secondary);
  text-shadow: 0 8px 30px rgba(245, 158, 11, 0.25);
}

/* Transition for each step: scale/fade with slight bounce */
.pulse-enter-active, .pulse-leave-active {
  transition: all .4s cubic-bezier(.2,.75,.25,1.2);
}
.pulse-enter-from {
  opacity: 0;
  transform: scale(.7) translateY(6px);
}
.pulse-enter-to {
  opacity: 1;
  transform: scale(1) translateY(0);
}
.pulse-leave-from {
  opacity: 1;
  transform: scale(1);
}
.pulse-leave-to {
  opacity: 0;
  transform: scale(.9);
}

/* Skip button: subtle, accessible, keyboard focusable */
.skip {
  position: absolute;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  background: #ffffff;
  color: var(--text);
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: .4rem .75rem;
  font-weight: 700;
  box-shadow: 0 6px 18px rgba(0,0,0,.06);
  cursor: pointer;
  z-index: 1;
}
.skip:hover { background: #f9fafb; }
.skip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--ring);
}
</style>
