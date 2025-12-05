import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useQuizStore } from './stores/quiz'

/**
 * PUBLIC_INTERFACE
 * Bootstrap the QuizMaster application:
 * - Creates Vue app
 * - Installs Pinia and Router
 * - Attempts to silently resume any saved quiz session before mounting
 */
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Try to hydrate any saved session before mount
try {
  const quiz = useQuizStore(pinia)
  // do not force prompt here; just hydrate silently if valid
  void quiz.resumeIfAvailable()
} catch {
  // ignore if any init error
}

app.mount('#app')
