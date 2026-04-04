import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import ToastService from 'primevue/toastservice'
import { useAuthStore } from '@/stores/auth'
import LoginView from '../LoginView.vue'

const { toastAdd } = vi.hoisted(() => ({
  toastAdd: vi.fn(),
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAdd }),
}))

function mountLogin() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: { template: '<div />' } }],
  })
  const wrapper = mount(LoginView, {
    global: {
      plugins: [
        createTestingPinia({ createSpy: vi.fn, stubActions: false }),
        router,
        [PrimeVue, {
          theme: {
            preset: Aura,
            options: { darkModeSelector: '.dark-mode' },
          },
        }],
        ToastService,
      ],
    },
  })
  return { wrapper, router }
}

describe('LoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders username and password fields for tests and accessibility', () => {
    const { wrapper } = mountLogin()
    expect(wrapper.find('#username').exists()).toBe(true)
    expect(wrapper.find('#password').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
  })

  it('submits credentials and navigates home on success', async () => {
    const { wrapper, router } = mountLogin()
    const auth = useAuthStore()
    vi.spyOn(auth, 'login').mockResolvedValue(undefined)
    const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined)

    await wrapper.get('#username').setValue('alice')
    await wrapper.get('#password').setValue('secret')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(auth.login).toHaveBeenCalledWith('alice', 'secret')
    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  it('shows toast when login fails', async () => {
    const { wrapper } = mountLogin()
    const auth = useAuthStore()
    vi.spyOn(auth, 'login').mockRejectedValue(new Error('bad'))

    await wrapper.get('#username').setValue('u')
    await wrapper.get('#password').setValue('p')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Login failed',
      }),
    )
  })

  it('does not call login when fields are empty', async () => {
    const { wrapper } = mountLogin()
    const auth = useAuthStore()
    const loginSpy = vi.spyOn(auth, 'login').mockResolvedValue(undefined)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(loginSpy).not.toHaveBeenCalled()
  })
})
