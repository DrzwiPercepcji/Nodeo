import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { useMediaStore } from '@/stores/media'
import { useCollectionsStore } from '@/stores/collections'
import PlaylistView from '../PlaylistView.vue'
import type { components } from '@/api/schema'

vi.mock('@/api', () => ({
  default: {
    GET: vi.fn().mockResolvedValue({ data: [], error: undefined }),
    POST: vi.fn().mockResolvedValue({ data: {}, error: undefined }),
    PUT: vi.fn().mockResolvedValue({ data: {}, error: undefined }),
    DELETE: vi.fn().mockResolvedValue({ data: {}, error: undefined }),
    use: vi.fn(),
  },
}))

type Media = components['schemas']['Media']
type Collection = components['schemas']['Collection']

function fakeTrack(id: string, title: string, overrides?: Partial<Media>): Media {
  return {
    id,
    collection_id: 'col-1',
    title,
    media_type: 'audio',
    status: 'ready',
    profile: 'mp3-192',
    created_at: `2025-01-0${id}T00:00:00Z`,
    ...overrides,
  } as Media
}

const tracks: Media[] = [
  fakeTrack('1', 'Song A', { metadata: { artist: 'Artist X', album: 'Album Y' }, duration_sec: 180 }),
  fakeTrack('2', 'Song B', { duration_sec: 240 }),
  fakeTrack('3', 'Song C', { duration_sec: 120 }),
]

const publicCollection: Collection = {
  id: 'col-1',
  name: 'My Music',
  is_encrypted: false,
  is_unlocked: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const encryptedCollection: Collection = {
  ...publicCollection,
  name: 'Private',
  is_encrypted: true,
}

/* ── MediaSession mock ── */
let msHandlers: Record<string, MediaSessionActionHandler | null>
let msMetadata: MediaMetadata | null
let msPlaybackState: MediaSessionPlaybackState

function installMediaSessionMock() {
  msHandlers = {}
  msMetadata = null
  msPlaybackState = 'none'

  vi.stubGlobal('MediaMetadata', class {
    title: string; artist: string; album: string; artwork: MediaImage[]
    constructor(init: MediaMetadataInit = {}) {
      this.title = init.title ?? ''
      this.artist = init.artist ?? ''
      this.album = init.album ?? ''
      this.artwork = init.artwork ?? []
    }
  })

  Object.defineProperty(navigator, 'mediaSession', {
    configurable: true,
    value: {
      get metadata() { return msMetadata },
      set metadata(v: MediaMetadata | null) { msMetadata = v },
      get playbackState() { return msPlaybackState },
      set playbackState(v: MediaSessionPlaybackState) { msPlaybackState = v },
      setActionHandler(action: string, handler: MediaSessionActionHandler | null) {
        msHandlers[action] = handler
      },
    },
  })
}

/**
 * Mount PlaylistView, then populate store items so that the `watch(currentTrack)`
 * watcher fires (currentTrack transitions from null → first track).
 */
async function mountPlaylist(collection: Collection = publicCollection) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/collections/:id/playlist', name: 'collection-playlist', component: PlaylistView },
      { path: '/', name: 'collections', component: { template: '<div />' } },
    ],
  })
  await router.push(`/collections/${collection.id}/playlist`)
  await router.isReady()

  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })

  const mediaStore = useMediaStore(pinia)
  const collectionsStore = useCollectionsStore(pinia)

  collectionsStore.collections = [collection]
  mediaStore.loading = true

  const wrapper = mount(PlaylistView, {
    global: {
      plugins: [
        pinia,
        router,
        [PrimeVue, { theme: { preset: Aura, options: { darkModeSelector: '.dark-mode' } } }],
      ],
      stubs: {
        AppTopbar: { template: '<header />' },
      },
    },
  })

  mediaStore.items = [...tracks]
  mediaStore.loading = false
  await flushPromises()

  return { wrapper, mediaStore, collectionsStore, router }
}

/* ── Tests ── */
describe('PlaylistView', () => {
  let savedDocTitle: string

  beforeEach(() => {
    savedDocTitle = document.title
    installMediaSessionMock()
    localStorage.setItem('nodeo_token', 'test-token')
  })

  afterEach(() => {
    document.title = savedDocTitle
    vi.restoreAllMocks()
  })

  describe('play/pause button', () => {
    it('togglePlayPause pauses when audio is playing', async () => {
      const { wrapper } = await mountPlaylist()

      const audio = wrapper.find('audio').element as HTMLAudioElement
      const pauseSpy = vi.spyOn(audio, 'pause')
      vi.spyOn(audio, 'paused', 'get').mockReturnValue(false)

      const playBtn = wrapper.find('[aria-label="Play or pause"]')
      await playBtn.trigger('click')

      expect(pauseSpy).toHaveBeenCalled()
    })

    it('togglePlayPause plays when audio is paused', async () => {
      const { wrapper } = await mountPlaylist()

      const audio = wrapper.find('audio').element as HTMLAudioElement
      const playSpy = vi.spyOn(audio, 'play').mockResolvedValue()
      vi.spyOn(audio, 'paused', 'get').mockReturnValue(true)

      const playBtn = wrapper.find('[aria-label="Play or pause"]')
      await playBtn.trigger('click')

      expect(playSpy).toHaveBeenCalled()
    })

    it('shows pause icon on play event, play icon on pause event', async () => {
      const { wrapper } = await mountPlaylist()

      const audio = wrapper.find('audio')
      await audio.trigger('play')
      await flushPromises()

      let playBtn = wrapper.find('[aria-label="Play or pause"]')
      expect(playBtn.html()).toContain('pi-pause')

      await audio.trigger('pause')
      await flushPromises()

      playBtn = wrapper.find('[aria-label="Play or pause"]')
      expect(playBtn.html()).toContain('pi-play')
    })
  })

  describe('document title', () => {
    it('updates document.title to current track title for public collection', async () => {
      await mountPlaylist(publicCollection)
      expect(document.title).toBe('Song A')
    })

    it('does NOT update document.title for encrypted collection', async () => {
      const before = document.title
      await mountPlaylist(encryptedCollection)
      expect(document.title).toBe(before)
    })

    it('restores original title on unmount', async () => {
      const before = document.title
      const { wrapper } = await mountPlaylist(publicCollection)
      expect(document.title).toBe('Song A')

      wrapper.unmount()
      expect(document.title).toBe(before)
    })
  })

  describe('MediaSession API', () => {
    it('registers play, pause, previoustrack, nexttrack handlers', async () => {
      await mountPlaylist()

      expect(msHandlers['play']).toBeTypeOf('function')
      expect(msHandlers['pause']).toBeTypeOf('function')
      expect(msHandlers['previoustrack']).toBeTypeOf('function')
      expect(msHandlers['nexttrack']).toBeTypeOf('function')
    })

    it('removes default seekbackward and seekforward handlers', async () => {
      await mountPlaylist()
      expect(msHandlers['seekbackward']).toBeNull()
      expect(msHandlers['seekforward']).toBeNull()
    })

    it('sets metadata with track info on first track load', async () => {
      await mountPlaylist()
      expect(msMetadata).not.toBeNull()
      expect(msMetadata!.title).toBe('Song A')
      expect(msMetadata!.artist).toBe('Artist X')
      expect(msMetadata!.album).toBe('Album Y')
    })

    it('updates playbackState on play/pause events', async () => {
      const { wrapper } = await mountPlaylist()

      const audio = wrapper.find('audio')
      await audio.trigger('play')
      await flushPromises()
      expect(msPlaybackState).toBe('playing')

      await audio.trigger('pause')
      await flushPromises()
      expect(msPlaybackState).toBe('paused')
    })

    it('clears metadata and handlers on unmount', async () => {
      const { wrapper } = await mountPlaylist()
      expect(msMetadata).not.toBeNull()

      wrapper.unmount()

      expect(msMetadata).toBeNull()
      expect(msPlaybackState).toBe('none')
      expect(msHandlers['play']).toBeNull()
      expect(msHandlers['pause']).toBeNull()
      expect(msHandlers['previoustrack']).toBeNull()
      expect(msHandlers['nexttrack']).toBeNull()
    })
  })

  describe('track navigation', () => {
    it('next button advances to next track', async () => {
      const { wrapper } = await mountPlaylist()
      expect(wrapper.find('.track-title').text()).toBe('Song A')

      const nextBtn = wrapper.find('[aria-label="Next track"]')
      await nextBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.track-title').text()).toBe('Song B')
    })

    it('prev button goes to previous track', async () => {
      const { wrapper } = await mountPlaylist()

      const nextBtn = wrapper.find('[aria-label="Next track"]')
      await nextBtn.trigger('click')
      await flushPromises()
      expect(wrapper.find('.track-title').text()).toBe('Song B')

      const prevBtn = wrapper.find('[aria-label="Previous track"]')
      await prevBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.track-title').text()).toBe('Song A')
    })

    it('clicking a queue item jumps to that track', async () => {
      const { wrapper } = await mountPlaylist()

      const items = wrapper.findAll('.queue-item')
      await items[2]!.trigger('click')
      await flushPromises()

      expect(wrapper.find('.track-title').text()).toBe('Song C')
    })

    it('updates document title and MediaSession on track change', async () => {
      const { wrapper } = await mountPlaylist(publicCollection)
      expect(document.title).toBe('Song A')
      expect(msMetadata!.title).toBe('Song A')

      const nextBtn = wrapper.find('[aria-label="Next track"]')
      await nextBtn.trigger('click')
      await flushPromises()

      expect(document.title).toBe('Song B')
      expect(msMetadata!.title).toBe('Song B')
    })
  })
})
