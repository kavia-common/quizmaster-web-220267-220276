<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="app-header" role="banner" aria-label="Quiz Game Header">
      <div class="brand">
        <span class="logo" aria-hidden="true">🧠</span>
        <div class="titles">
          <h1 class="app-title">QuizMaster</h1>
          <p class="app-subtitle">Test your knowledge</p>
        </div>
      </div>
    </header>

    <main class="app-main" role="main">
      <RouterView />
    </main>

    <footer class="app-footer" role="contentinfo">
      <small>&copy; {{ new Date().getFullYear() }} QuizMaster · Ocean Professional Theme</small>
    </footer>
  </div>
</template>

<style scoped>
/* Ocean Professional theme tokens */
:root {
  --primary: #2563EB;
  --secondary: #F59E0B;
  --success: #F59E0B;
  --error: #EF4444;
  --bg: #f9fafb;
  --surface: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --ring: rgba(37, 99, 235, 0.35);
}

.app-shell {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.app-header {
  background: linear-gradient(135deg, rgba(59,130,246,0.10), rgba(249,250,251,1));
  border-bottom: 1px solid #e5e7eb;
}

.brand {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.25rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo {
  font-size: 1.75rem;
  display: inline-flex;
  width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border-radius: 0.75rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 1px 1px rgba(0,0,0,0.04);
}

.titles {
  display: flex;
  flex-direction: column;
}

.app-title {
  font-size: 1.25rem;
  line-height: 1.2;
  font-weight: 700;
  color: var(--text);
}

.app-subtitle {
  font-size: 0.875rem;
  color: var(--muted);
}

.app-main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.25rem 1rem 2rem;
}

.app-footer {
  text-align: center;
  padding: 1rem;
  color: var(--muted);
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
}
</style>
