import { createRouter, createWebHistory } from 'vue-router'

const StartView = () => import('../views/StartView.vue')
const QuizView = () => import('../views/QuizView.vue')
const ResultView = () => import('../views/ResultView.vue')
const ScoreboardView = () => import('../views/ScoreboardView.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'start', component: StartView },
    { path: '/quiz', name: 'quiz', component: QuizView },
    { path: '/results', name: 'results', component: ResultView },
    { path: '/scoreboard', name: 'scoreboard', component: ScoreboardView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
