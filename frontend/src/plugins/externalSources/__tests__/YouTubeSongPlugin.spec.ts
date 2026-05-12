import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import YouTubeSongPlugin from '../YouTubeSongPlugin.vue'

function mountPlugin(disabled = false) {
  return mount(YouTubeSongPlugin, {
    props: { disabled },
    global: {
      plugins: [
        [PrimeVue, {
          theme: {
            preset: Aura,
            options: { darkModeSelector: '.dark-mode' },
          },
        }],
      ],
    },
  })
}

describe('YouTubeSongPlugin', () => {
  it('renders URL, title and profile fields', () => {
    const wrapper = mountPlugin()
    expect(wrapper.find('#yt-url').exists()).toBe(true)
    expect(wrapper.find('#yt-title').exists()).toBe(true)
    expect(wrapper.find('#yt-profile').exists()).toBe(true)
  })

  it('import button is disabled when URL is empty', () => {
    const wrapper = mountPlugin()
    const btn = wrapper.find('.import-btn button, button.import-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('shows validation error for invalid URL', async () => {
    const wrapper = mountPlugin()
    await wrapper.find('#yt-url').setValue('not-a-url')
    expect(wrapper.find('.field-error').exists()).toBe(true)
    expect(wrapper.find('.field-error').text()).toContain('valid YouTube URL')
  })

  it('accepts valid YouTube URLs', async () => {
    const wrapper = mountPlugin()
    const validUrls = [
      'https://www.youtube.com/watch?v=zw79RVnlCb0',
      'https://youtu.be/zw79RVnlCb0',
      'https://youtube.com/shorts/zw79RVnlCb0',
    ]
    for (const url of validUrls) {
      await wrapper.find('#yt-url').setValue(url)
      expect(wrapper.find('.field-error').exists()).toBe(false)
    }
  })

  it('emits submit with correct payload on valid URL', async () => {
    const wrapper = mountPlugin()
    await wrapper.find('#yt-url').setValue('https://www.youtube.com/watch?v=zw79RVnlCb0')
    await wrapper.find('#yt-title').setValue('My Song')

    const importBtn = wrapper.find('.import-btn button, button.import-btn')
    await importBtn.trigger('click')

    expect(wrapper.emitted('submit')).toHaveLength(1)
    const payload = wrapper.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload.source).toBe('youtube')
    expect(payload.url).toBe('https://www.youtube.com/watch?v=zw79RVnlCb0')
    expect(payload.title).toBe('My Song')
    expect(payload.profile).toBe('mp3-192')
  })

  it('omits title from payload when empty', async () => {
    const wrapper = mountPlugin()
    await wrapper.find('#yt-url').setValue('https://www.youtube.com/watch?v=zw79RVnlCb0')

    const importBtn = wrapper.find('.import-btn button, button.import-btn')
    await importBtn.trigger('click')

    const payload = wrapper.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload.title).toBeUndefined()
  })

  it('disables all inputs when disabled prop is true', () => {
    const wrapper = mountPlugin(true)
    expect(wrapper.find('#yt-url').attributes('disabled')).toBeDefined()
    expect(wrapper.find('#yt-title').attributes('disabled')).toBeDefined()
  })
})
