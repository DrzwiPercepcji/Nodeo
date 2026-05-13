import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'

export const useSettingsStore = defineStore('settings', () => {
  const ytdlpCookiesConfigured = ref(false)
  const loading = ref(false)
  const saving = ref(false)

  async function fetchCookiesStatus() {
    loading.value = true
    try {
      const { data, error } = await api.GET('/settings/ytdlp-cookies')
      if (error) throw new Error('Failed to load cookie status')
      ytdlpCookiesConfigured.value = data?.configured ?? false
    } finally {
      loading.value = false
    }
  }

  async function saveCookies(cookies: string) {
    saving.value = true
    try {
      const { data, error } = await api.PUT('/settings/ytdlp-cookies', {
        body: { cookies },
      })
      if (error) {
        const msg =
          typeof error === 'object' && error !== null && 'error' in error
            ? String((error as { error?: unknown }).error)
            : 'Failed to save cookies'
        throw new Error(msg || 'Failed to save cookies')
      }
      ytdlpCookiesConfigured.value = data?.configured ?? false
    } finally {
      saving.value = false
    }
  }

  return { ytdlpCookiesConfigured, loading, saving, fetchCookiesStatus, saveCookies }
})
