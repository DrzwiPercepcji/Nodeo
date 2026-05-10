<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMediaStore } from '@/stores/media'
import { useCollectionsStore } from '@/stores/collections'
import Button from 'primevue/button'
import AppTopbar from '@/components/AppTopbar.vue'
import ProgressSpinner from 'primevue/progressspinner'
import type { components } from '@/api/schema'
import { mediaMetadataSubtitle } from '@/utils/mediaMetadataDisplay'

type Media = components['schemas']['Media']

const route = useRoute()
const mediaStore = useMediaStore()
const collectionsStore = useCollectionsStore()

const collectionId = route.params.id as string
const startMediaId = typeof route.query.start === 'string' ? route.query.start : undefined

const audioRef = ref<HTMLAudioElement | null>(null)
const currentIndex = ref(0)
const shuffleOn = ref(false)
const shuffledOrder = ref<Media[] | null>(null)
/** Cycles: off → all → one */
const repeatMode = ref<'off' | 'all' | 'one'>('off')
const isPlayingUi = ref(false)
const coverArtFailed = ref(new Set<string>())

const collection = computed(() =>
  collectionsStore.collections.find((c) => c.id === collectionId),
)

const sortedAudios = computed(() =>
  mediaStore.items
    .filter((m) => m.status === 'ready' && m.media_type === 'audio')
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
)

const queue = computed(() => shuffledOrder.value ?? sortedAudios.value)

const currentTrack = computed(() => queue.value[currentIndex.value] ?? null)

const currentTrackSubtitle = computed(() => mediaMetadataSubtitle(currentTrack.value?.metadata))

function hasCoverArt(track: Media): boolean {
  return Boolean(track.metadata?.artist && track.metadata?.album) && !coverArtFailed.value.has(track.id)
}

function onCoverError(mediaId: string) {
  coverArtFailed.value = new Set(coverArtFailed.value).add(mediaId)
}

function shuffleArray<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function reapplyShuffle() {
  const keepId = queue.value[currentIndex.value]?.id
  if (shuffleOn.value) {
    shuffledOrder.value = shuffleArray(sortedAudios.value.slice())
  } else {
    shuffledOrder.value = null
  }
  if (keepId) {
    const ix = queue.value.findIndex((m) => m.id === keepId)
    currentIndex.value = ix >= 0 ? ix : 0
  } else {
    currentIndex.value = 0
  }
}

watch(shuffleOn, () => {
  reapplyShuffle()
})

function cycleRepeat() {
  const order: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one']
  const i = order.indexOf(repeatMode.value)
  repeatMode.value = order[(i + 1) % order.length]!
}

const repeatLabel = computed(() => {
  if (repeatMode.value === 'all') return 'Repeat all'
  if (repeatMode.value === 'one') return 'Repeat one'
  return 'Repeat off'
})

const repeatIcon = computed(() => {
  if (repeatMode.value === 'one') return 'pi pi-replay'
  if (repeatMode.value === 'all') return 'pi pi-refresh'
  return 'pi pi-repeat'
})

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || sec < 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function bindAudioEl(el: HTMLAudioElement | null) {
  audioRef.value = el
  if (!el) return
  el.addEventListener('play', () => { isPlayingUi.value = true })
  el.addEventListener('pause', () => { isPlayingUi.value = false })
}

function onAudioEnded() {
  if (repeatMode.value === 'one') {
    const a = audioRef.value
    if (a) {
      a.currentTime = 0
      void a.play()
    }
    return
  }
  if (currentIndex.value < queue.value.length - 1) {
    currentIndex.value += 1
    return
  }
  if (repeatMode.value === 'all' && queue.value.length > 0) {
    currentIndex.value = 0
  }
}

function goPrev() {
  const n = queue.value.length
  if (n === 0) return
  if (currentIndex.value > 0) {
    currentIndex.value -= 1
  } else if (repeatMode.value === 'all') {
    currentIndex.value = n - 1
  } else {
    return
  }
  void audioRef.value?.play()
}

function goNext() {
  if (currentIndex.value < queue.value.length - 1) {
    currentIndex.value += 1
    void audioRef.value?.play()
  } else if (repeatMode.value === 'all' && queue.value.length > 0) {
    currentIndex.value = 0
    void audioRef.value?.play()
  }
}

function jumpTo(index: number) {
  if (index < 0 || index >= queue.value.length) return
  currentIndex.value = index
  void audioRef.value?.play()
}

function togglePlayPause() {
  const a = audioRef.value
  if (!a) return
  if (a.paused) void a.play()
  else a.pause()
}

onMounted(async () => {
  if (!collectionsStore.collections.length) await collectionsStore.fetchAll()
  await mediaStore.fetchByCollection(collectionId)
  shuffledOrder.value = null
  shuffleOn.value = false
  if (startMediaId) {
    const ix = sortedAudios.value.findIndex((m) => m.id === startMediaId)
    currentIndex.value = ix >= 0 ? ix : 0
  } else {
    currentIndex.value = 0
  }
})

</script>

<template>
  <div class="layout">
    <AppTopbar
      :title="collection ? `Playlist · ${collection.name}` : 'Playlist'"
      show-back
    />

    <main class="content">
      <ProgressSpinner
        v-if="mediaStore.loading"
        class="spinner"
      />

      <div
        v-else-if="sortedAudios.length === 0"
        class="empty-state"
      >
        <i
          class="pi pi-headphones"
          aria-hidden="true"
        />
        <p>No ready audio tracks in this collection.</p>
        <p class="hint">
          Upload audio or wait for processing to finish.
        </p>
      </div>

      <template v-else>
        <div class="now-playing">
          <div
            class="artwork"
            aria-hidden="true"
          >
            <img
              v-if="currentTrack && hasCoverArt(currentTrack)"
              :src="mediaStore.coverArtUrl(currentTrack.id)"
              alt=""
              class="artwork-img"
              @error="onCoverError(currentTrack!.id)"
            >
            <i
              v-else
              class="pi pi-headphones artwork-icon"
            />
          </div>
          <h1 class="track-title">
            {{ currentTrack?.title ?? '—' }}
          </h1>
          <p
            v-if="currentTrackSubtitle"
            class="track-tags"
          >
            {{ currentTrackSubtitle }}
          </p>
          <p
            v-if="currentTrack?.description"
            class="track-desc"
          >
            {{ currentTrack.description }}
          </p>
          <p class="track-meta">
            <span v-if="currentTrack?.duration_sec">{{ formatDuration(currentTrack.duration_sec) }}</span>
            <span class="sep">·</span>
            <span>{{ currentIndex + 1 }} / {{ queue.length }}</span>
          </p>
        </div>

        <audio
          v-if="currentTrack"
          :key="currentTrack.id"
          ref="bindAudioEl"
          controls
          autoplay
          class="audio-el"
          :src="mediaStore.streamUrl(currentTrack.id)"
          @ended="onAudioEnded"
        >
          Your browser does not support audio.
        </audio>

        <div class="transport">
          <Button
            icon="pi pi-step-backward"
            rounded
            severity="secondary"
            class="transport-btn"
            :disabled="queue.length === 0 || (currentIndex <= 0 && repeatMode !== 'all')"
            aria-label="Previous track"
            @click="goPrev"
          />
          <Button
            :icon="isPlayingUi ? 'pi pi-pause' : 'pi pi-play'"
            rounded
            class="transport-btn play-btn"
            aria-label="Play or pause"
            @click="togglePlayPause"
          />
          <Button
            icon="pi pi-step-forward"
            rounded
            severity="secondary"
            class="transport-btn"
            :disabled="queue.length === 0 || (currentIndex >= queue.length - 1 && repeatMode !== 'all')"
            aria-label="Next track"
            @click="goNext"
          />
        </div>

        <div class="modes">
          <Button
            :icon="shuffleOn ? 'pi pi-shuffle' : 'pi pi-arrow-right-arrow-left'"
            :severity="shuffleOn ? 'primary' : 'secondary'"
            rounded
            class="mode-btn"
            label="Shuffle"
            @click="shuffleOn = !shuffleOn"
          />
          <Button
            :icon="repeatIcon"
            :severity="repeatMode !== 'off' ? 'primary' : 'secondary'"
            rounded
            class="mode-btn"
            :label="repeatLabel"
            @click="cycleRepeat"
          />
        </div>

        <section
          class="queue-section"
          aria-label="Queue"
        >
          <h2 class="queue-heading">
            Queue
          </h2>
          <ul class="queue-list">
            <li
              v-for="(track, i) in queue"
              :key="track.id"
            >
              <button
                type="button"
                class="queue-item"
                :class="{ active: i === currentIndex }"
                @click="jumpTo(i)"
              >
                <span class="qi-idx">{{ i + 1 }}</span>
                <img
                  v-if="hasCoverArt(track)"
                  :src="mediaStore.coverArtUrl(track.id)"
                  alt=""
                  class="qi-art"
                  @error="onCoverError(track.id)"
                >
                <span
                  v-else
                  class="qi-art-placeholder"
                >
                  <i class="pi pi-headphones" />
                </span>
                <span class="qi-main">
                  <span class="qi-title">{{ track.title }}</span>
                  <span
                    v-if="mediaMetadataSubtitle(track.metadata)"
                    class="qi-sub"
                  >{{ mediaMetadataSubtitle(track.metadata) }}</span>
                </span>
                <span
                  v-if="track.duration_sec != null"
                  class="qi-dur"
                >{{ formatDuration(track.duration_sec) }}</span>
              </button>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  background: var(--p-surface-ground);
}

.content {
  max-width: 560px;
  margin: 0 auto;
  padding: 1rem 1.25rem 2rem;
}

.spinner {
  display: flex;
  justify-content: center;
  margin-top: 3rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--p-text-muted-color);
}

.empty-state .pi {
  font-size: 3.5rem;
  margin-bottom: 1rem;
  color: var(--p-primary-color);
}

.hint {
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.now-playing {
  text-align: center;
  margin-bottom: 1.25rem;
}

.artwork {
  width: min(220px, 70vw);
  height: min(220px, 70vw);
  margin: 0 auto 1.25rem;
  border-radius: 20px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.artwork-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 20px;
}

.artwork-icon {
  font-size: 5rem;
  color: var(--p-primary-color);
}

.track-title {
  font-size: clamp(1.15rem, 4vw, 1.4rem);
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 0.35rem;
  color: var(--p-text-color);
}

.track-tags {
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
  margin: 0 0 0.35rem;
  line-height: 1.35;
}

.track-desc {
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.track-meta {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.sep {
  margin: 0 0.35rem;
}

.audio-el {
  width: 100%;
  min-height: 54px;
  margin-bottom: 1rem;
}

.transport {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.transport-btn {
  width: 3.5rem;
  height: 3.5rem;
  min-width: 3.5rem;
  min-height: 3.5rem;
}

.play-btn {
  width: 4.25rem;
  height: 4.25rem;
  min-width: 4.25rem;
  min-height: 4.25rem;
}

.modes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.mode-btn {
  min-height: 3rem;
  padding-left: 1rem;
  padding-right: 1rem;
}

.queue-section {
  border-top: 1px solid var(--p-surface-border);
  padding-top: 1rem;
}

.queue-heading {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
}

.queue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 40vh;
  overflow-y: auto;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 3rem;
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.35rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  background: var(--p-surface-card);
  font: inherit;
  text-align: left;
  cursor: pointer;
  color: var(--p-text-color);
  transition: border-color 0.15s, background 0.15s;
}

.queue-item:hover {
  border-color: var(--p-primary-color);
}

.queue-item.active {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 12%, var(--p-surface-card));
}

.qi-idx {
  font-variant-numeric: tabular-nums;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  min-width: 1.5rem;
}

.qi-art {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.qi-art-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  background: var(--p-surface-ground);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.qi-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  overflow: hidden;
}

.qi-title {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.qi-sub {
  width: 100%;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qi-dur {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .transport-btn {
    width: 3.25rem;
    height: 3.25rem;
    min-width: 3.25rem;
    min-height: 3.25rem;
  }

  .play-btn {
    width: 4rem;
    height: 4rem;
    min-width: 4rem;
    min-height: 4rem;
  }

  .artwork-icon {
    font-size: 4rem;
  }

  .artwork-img {
    border-radius: 14px;
  }
}
</style>
