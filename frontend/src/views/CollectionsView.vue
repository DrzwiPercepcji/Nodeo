<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'

const auth = useAuthStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <h2>Nodeo</h2>
      <div class="topbar-actions">
        <span class="username">{{ auth.username }}</span>
        <Button icon="pi pi-sign-out" text rounded severity="secondary" @click="handleLogout" />
      </div>
    </header>

    <main class="content">
      <div class="content-header">
        <h1>Collections</h1>
      </div>

      <div class="empty-state">
        <i class="pi pi-folder-open" style="font-size: 3rem; color: var(--p-text-muted-color)"></i>
        <p>No collections yet. Create one to get started.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
}

.topbar h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.username {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.content-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--p-text-muted-color);
}
</style>
