import { createRouter, createWebHistory } from 'vue-router'
import type { Router } from 'vue-router'
import { useQuizStore } from '../stores/quiz'

const StartView = () => import('../views/StartView.vue')
const QuizView = () => import('../views/QuizView.vue')
const ResultView = () => import('../views/ResultView.vue')
const ScoreboardView = () => import('../views/ScoreboardView.vue')
const MultiplayerLobbyView = () => import('../views/MultiplayerLobbyView.vue')
const MultiplayerGameView = () => import('../views/MultiplayerGameView.vue')
const DailyQuizView = () => import('../views/DailyQuizView.vue')
const AnalyticsView = () => import('../views/AnalyticsView.vue')
const ManageOfflineView = () => import('../views/ManageOfflineView.vue')
const TournamentLobbyView = () => import('../views/TournamentLobbyView.vue')
const TournamentPlayView = () => import('../views/TournamentPlayView.vue')
const TournamentResultsView = () => import('../views/TournamentResultsView.vue')

const CustomQuizHomeView = () => import('../views/CustomQuizHomeView.vue')
const CustomQuizBuilderView = () => import('../views/CustomQuizBuilderView.vue')
const CustomQuizPlayView = () => import('../views/CustomQuizPlayView.vue')
const CustomQuizImportView = () => import('../views/CustomQuizImportView.vue')

const router: Router = createRouter({
  // Use explicit fallback to '/' if BASE_URL is undefined to avoid dev/preview subpath issues
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes: [
    { path: '/', name: 'start', component: StartView },
    { path: '/quiz', name: 'quiz', component: QuizView },
    { path: '/results', name: 'results', component: ResultView },
    { path: '/scoreboard', name: 'scoreboard', component: ScoreboardView },
    { path: '/daily', name: 'daily', component: DailyQuizView },
    { path: '/analytics', name: 'analytics', component: AnalyticsView },
    { path: '/offline/manage', name: 'offline-manage', component: ManageOfflineView },
    { path: '/multiplayer', name: 'mp-lobby', component: MultiplayerLobbyView },
    { path: '/multiplayer/game', name: 'mp-game', component: MultiplayerGameView },
    { path: '/tournament', name: 'tournament-lobby', component: TournamentLobbyView },
    { path: '/tournament/play', name: 'tournament-play', component: TournamentPlayView },
    { path: '/tournament/results', name: 'tournament-results', component: TournamentResultsView },

    // Custom quizzes
    { path: '/custom', name: 'custom-home', component: CustomQuizHomeView },
    { path: '/custom/new', name: 'custom-new', component: CustomQuizBuilderView },
    { path: '/custom/edit/:id', name: 'custom-edit', component: CustomQuizBuilderView, props: true },
    { path: '/custom/play/:id', name: 'custom-play', component: CustomQuizPlayView, props: true },
    { path: '/custom/import/:token', name: 'custom-import', component: CustomQuizImportView, props: true },

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
