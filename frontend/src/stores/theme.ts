import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

function readStoredTheme(): 'dark' | 'light' | null {
  const v = localStorage.getItem('nodeo_theme')
  if (v === 'dark' || v === 'light') return v
  return null
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = defineStore('theme', () => {
  const stored = readStoredTheme()
  const explicit = ref(stored !== null)
  const dark = ref(stored === 'dark' ? true : stored === 'light' ? false : systemPrefersDark())

  let mq: MediaQueryList | null = null
  function onSystemChange() {
    if (explicit.value) return
    dark.value = systemPrefersDark()
  }

  if (typeof window !== 'undefined' && !explicit.value) {
    mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', onSystemChange)
  }

  function apply() {
    document.documentElement.classList.toggle('dark-mode', dark.value)
  }

  function toggle() {
    explicit.value = true
    if (mq) {
      mq.removeEventListener('change', onSystemChange)
      mq = null
    }
    dark.value = !dark.value
  }

  watch(dark, () => {
    apply()
    if (explicit.value) {
      localStorage.setItem('nodeo_theme', dark.value ? 'dark' : 'light')
    }
  })

  apply()

  return { dark, toggle }
})
