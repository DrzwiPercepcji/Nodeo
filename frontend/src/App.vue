<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import Toast from 'primevue/toast'

const auth = useAuthStore()
useThemeStore()

onMounted(() => {
  auth.fetchMe()
})
</script>

<template>
  <Toast />
  <RouterView />
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    'Fira Sans',
    'Droid Sans',
    'Helvetica Neue',
    sans-serif;
  min-height: 100vh;
  background: var(--p-surface-ground);
  color: var(--p-text-color);
  transition: background-color 0.2s, color 0.2s;
}
</style>
