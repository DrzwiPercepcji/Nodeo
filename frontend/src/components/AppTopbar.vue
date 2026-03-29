<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'

defineProps<{
  title?: string
  showBack?: boolean
}>()

const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <Button v-if="showBack" icon="pi pi-arrow-left" text rounded severity="secondary" @click="router.back()" />
      <h2>{{ title || 'Nodeo' }}</h2>
    </div>
    <div class="topbar-actions">
      <Button
        :icon="theme.dark ? 'pi pi-sun' : 'pi pi-moon'"
        text
        rounded
        severity="secondary"
        @click="theme.toggle()"
      />
      <span class="username">{{ auth.username }}</span>
      <Button icon="pi pi-sign-out" text rounded severity="secondary" @click="handleLogout" />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.topbar-left h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.username {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  margin-right: 0.25rem;
}

@media (max-width: 640px) {
  .topbar {
    padding: 0.5rem 1rem;
  }

  .username {
    display: none;
  }

  .topbar-left h2 {
    font-size: 1rem;
  }
}
</style>
