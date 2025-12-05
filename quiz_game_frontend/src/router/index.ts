import { createRouter, createWebHistory } from 'vue-router'
import type { Router } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'

const StartView = () => import('../views/StartView.vue')
const QuizView = () => import('../views/QuizView.vue')
const ResultView = () => import('../views/ResultView.vue')
const ScoreboardView = () => import('../views/ScoreboardView.vue')
const MultiplayerLobbyView = () => import('../views/MultiplayerLobbyView.vue')
const MultiplayerGameView = () => import('../views/MultiplayerGameView.vue')
const DailyQuizView = () => import('../views/DailyQuizView.vue')

const router: Router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'start', component: StartView },
    { path: '/quiz', name: 'quiz', component: QuizView },
    { path: '/results', name: 'results', component: ResultView },
    { path: '/scoreboard', name: 'scoreboard', component: ScoreboardView },
    { path: '/daily', name: 'daily', component: DailyQuizView },
    { path: '/multiplayer', name: 'mp-lobby', component: MultiplayerLobbyView },
    { path: '/multiplayer/game', name: 'mp-game', component: MultiplayerGameView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// Prompt to resume if navigating directly to /quiz
router.beforeEach(async (to) => {
  if (to.name === 'quiz') {
    // Pinia instance will be attached to app after creation;
    // in guards it's fine to call store directly
    const quiz = useQuizStore()
    if (!quiz.questions.length && quiz.hasSavedSession()) {
      const resume = window.confirm('We found an in-progress quiz. Would you like to resume?')
      if (resume) {
        await quiz.resumeIfAvailable()
      } else {
        quiz.resetSession()
      }
    }
  }
  return true
})

export default router
