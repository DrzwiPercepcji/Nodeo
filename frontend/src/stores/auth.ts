import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('nodeo_token') || '')
  const username = ref('')

  const isLoggedIn = computed(() => !!token.value)

  async function login(user: string, password: string) {
    const { data, error, response } = await api.POST('/auth/login', {
      body: { username: user, password },
    })
    if (error || !data) {
      const msg = (error as { error?: string } | undefined)?.error || 'Login failed'
      const err = new Error(msg)
      ;(err as Error & { status: number }).status = response.status
      throw err
    }
    token.value = data.token
    localStorage.setItem('nodeo_token', data.token)
    username.value = user
  }

  async function fetchMe() {
    if (!token.value) return
    const { data, error } = await api.GET('/auth/me')
    if (error || !data) {
      logout()
      return
    }
    username.value = data.username
  }

  function logout() {
    token.value = ''
    username.value = ''
    localStorage.removeItem('nodeo_token')
  }

  return { token, username, isLoggedIn, login, fetchMe, logout }
})
