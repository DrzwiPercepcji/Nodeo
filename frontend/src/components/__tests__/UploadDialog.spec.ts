import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import UploadDialog from '../UploadDialog.vue'

const DialogStub = {
  template: '<div v-if="visible" class="dialog-stub"><slot /><slot name="footer" /></div>',
  props: ['visible', 'header', 'modal', 'closable'],
}

function mountDialog(visible = true) {
  return mount(UploadDialog, {
    props: {
      visible,
      collectionId: 'col-123',
    },
    global: {
      plugins: [
        [PrimeVue, {
          theme: {
            preset: Aura,
            options: { darkModeSelector: '.dark-mode' },
          },
        }],
      ],
      stubs: {
        Dialog: DialogStub,
      },
    },
  })
}

function findTabByText(wrapper: ReturnType<typeof mount>, text: string) {
  const tabs = wrapper.findAll('[data-pc-name="tab"]')
  return tabs.find(t => t.text().includes(text))
}

describe('UploadDialog', () => {
  it('renders Upload and External tabs', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('Upload')
    expect(wrapper.text()).toContain('External')
    const uploadTab = findTabByText(wrapper, 'Upload')
    const externalTab = findTabByText(wrapper, 'External')
    expect(uploadTab).toBeDefined()
    expect(externalTab).toBeDefined()
  })

  it('shows upload form by default (Upload tab active)', () => {
    const wrapper = mountDialog()
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
    expect(wrapper.find('#upl-title').exists()).toBe(true)
  })

  it('switches to External tab and shows plugin list', async () => {
    const wrapper = mountDialog()

    const externalTab = findTabByText(wrapper, 'External')!
    await externalTab.trigger('click')
    await flushPromises()

    expect(wrapper.find('.plugin-list').exists()).toBe(true)
    expect(wrapper.find('.plugin-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Single YouTube Song')
  })

  it('navigates into plugin form when plugin card is clicked', async () => {
    const wrapper = mountDialog()

    const externalTab = findTabByText(wrapper, 'External')!
    await externalTab.trigger('click')
    await flushPromises()

    await wrapper.find('.plugin-card').trigger('click')
    await flushPromises()

    expect(wrapper.find('.plugin-view').exists()).toBe(true)
    expect(wrapper.find('.back-link').exists()).toBe(true)
    expect(wrapper.find('#yt-url').exists()).toBe(true)
  })

  it('navigates back to plugin list via back button', async () => {
    const wrapper = mountDialog()

    const externalTab = findTabByText(wrapper, 'External')!
    await externalTab.trigger('click')
    await flushPromises()

    await wrapper.find('.plugin-card').trigger('click')
    await flushPromises()
    expect(wrapper.find('.plugin-view').exists()).toBe(true)

    await wrapper.find('.back-link').trigger('click')
    await flushPromises()

    expect(wrapper.find('.plugin-list').exists()).toBe(true)
    expect(wrapper.find('.plugin-view').exists()).toBe(false)
  })

  it('emits import event when plugin submits', async () => {
    const wrapper = mountDialog()

    const externalTab = findTabByText(wrapper, 'External')!
    await externalTab.trigger('click')
    await flushPromises()

    await wrapper.find('.plugin-card').trigger('click')
    await flushPromises()

    await wrapper.find('#yt-url').setValue('https://www.youtube.com/watch?v=zw79RVnlCb0')
    const importBtn = wrapper.find('.import-btn button, button.import-btn')
    await importBtn.trigger('click')

    expect(wrapper.emitted('import')).toHaveLength(1)
    const payload = wrapper.emitted('import')![0][0] as Record<string, unknown>
    expect(payload.source).toBe('youtube')
    expect(payload.url).toBe('https://www.youtube.com/watch?v=zw79RVnlCb0')
  })

  it('emits upload event when upload form is submitted', async () => {
    const wrapper = mountDialog()

    const file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' })
    const input = wrapper.find('input[type="file"]')

    Object.defineProperty(input.element, 'files', {
      value: [file],
      writable: false,
    })
    await input.trigger('change')
    await flushPromises()

    await wrapper.find('#upl-title').setValue('My Track')
    await flushPromises()

    const uploadBtn = wrapper.find('.form-actions').findAll('button')
      .find(b => b.text().includes('Upload'))!
    await uploadBtn.trigger('click')

    expect(wrapper.emitted('upload')).toHaveLength(1)
    const payload = wrapper.emitted('upload')![0][0] as Record<string, unknown>
    expect(payload.title).toBe('My Track')
    expect((payload.file as File).name).toBe('test.mp3')
  })

  it('exposes setProgress and done methods', () => {
    const wrapper = mountDialog()
    const vm = wrapper.vm as unknown as { setProgress: (n: number) => void; done: () => void }
    expect(typeof vm.setProgress).toBe('function')
    expect(typeof vm.done).toBe('function')
  })

  it('does not render dialog contents when not visible', () => {
    const wrapper = mountDialog(false)
    expect(wrapper.find('.dialog-stub').exists()).toBe(false)
  })
})
