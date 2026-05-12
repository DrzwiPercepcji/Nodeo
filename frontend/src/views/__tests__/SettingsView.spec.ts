import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import ToastService from 'primevue/toastservice'
import SettingsView from '../SettingsView.vue'

const { toastAdd } = vi.hoisted(() => ({
  toastAdd: vi.fn(),
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAdd }),
}))

const mockApi = vi.hoisted(() => ({
  GET: vi.fn().mockResolvedValue({ data: { configured: false }, error: undefined }),
  PUT: vi.fn().mockResolvedValue({ data: { configured: true }, error: undefined }),
  use: vi.fn(),
}))

vi.mock('@/api', () => ({
  default: mockApi,
}))

function mountSettings() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/settings', name: 'settings', component: SettingsView },
    ],
  })
  router.push('/settings')

  const wrapper = mount(SettingsView, {
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

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the settings page with YouTube section', async () => {
    const { wrapper } = mountSettings()
    await flushPromises()
    expect(wrapper.text()).toContain('YouTube (yt-dlp)')
    expect(wrapper.text()).toContain('Cookie file')
  })

  it('shows "Not configured" when cookies are not set', async () => {
    const { wrapper } = mountSettings()
    await flushPromises()
    expect(wrapper.text()).toContain('Not configured')
  })

  it('shows masked value when cookies are configured', async () => {
    mockApi.GET.mockResolvedValueOnce({ data: { configured: true }, error: undefined })
    const { wrapper } = mountSettings()
    await flushPromises()
    expect(wrapper.text()).toContain('••••••••••••••••')
  })

  it('opens edit mode when Upload button is clicked', async () => {
    const { wrapper } = mountSettings()
    await flushPromises()

    const uploadBtn = wrapper.findAll('button').find(b => b.text().includes('Upload'))
    expect(uploadBtn).toBeTruthy()
    await uploadBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('opens edit mode when pencil icon is clicked (configured state)', async () => {
    mockApi.GET.mockResolvedValueOnce({ data: { configured: true }, error: undefined })
    const { wrapper } = mountSettings()
    await flushPromises()

    const editBtn = wrapper.findAll('button').find(b => b.find('.pi-pencil').exists())
    expect(editBtn).toBeTruthy()
    await editBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('cancels edit mode when Cancel is clicked', async () => {
    const { wrapper } = mountSettings()
    await flushPromises()

    const uploadBtn = wrapper.findAll('button').find(b => b.text().includes('Upload'))
    await uploadBtn!.trigger('click')
    await flushPromises()

    const cancelBtn = wrapper.findAll('button').find(b => b.text().includes('Cancel'))
    expect(cancelBtn).toBeTruthy()
    await cancelBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('calls saveCookies and shows toast on save', async () => {
    const { wrapper } = mountSettings()
    await flushPromises()

    const uploadBtn = wrapper.findAll('button').find(b => b.text().includes('Upload'))
    await uploadBtn!.trigger('click')
    await flushPromises()

    const textarea = wrapper.find('textarea')
    await textarea.setValue('# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\n')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save'))
    expect(saveBtn).toBeTruthy()
    await saveBtn!.trigger('click')
    await flushPromises()

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Saved',
      }),
    )
  })
})
