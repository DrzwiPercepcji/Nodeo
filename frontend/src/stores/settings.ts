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
      const { data } = await api.GET('/settings/ytdlp-cookies')
      ytdlpCookiesConfigured.value = data?.configured ?? false
    } finally {
      loading.value = false
    }
  }

  async function saveCookies(cookies: string) {
    saving.value = true
    try {
      const { data } = await api.PUT('/settings/ytdlp-cookies', {
        body: { cookies },
      })
      ytdlpCookiesConfigured.value = data?.configured ?? false
    } finally {
      saving.value = false
    }
  }

  return { ytdlpCookiesConfigured, loading, saving, fetchCookiesStatus, saveCookies }
})
