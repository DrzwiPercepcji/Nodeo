<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaStore } from '@/stores/media'
import AppTopbar from '@/components/AppTopbar.vue'
import type { components } from '@/api/schema'

type Media = components['schemas']['Media']

const route = useRoute()
const router = useRouter()
const mediaStore = useMediaStore()

const mediaId = route.params.id as string
const media = ref<Media | null>(null)
const isAudio = computed(() => media.value?.media_type === 'audio')

onMounted(async () => {
  media.value = await mediaStore.fetchSingle(mediaId)
})

function formatDuration(sec: number | null | undefined): string {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div class="layout" :class="{ 'layout-audio': isAudio }">
    <AppTopbar :title="media?.title ?? 'Player'" showBack />

    <main v-if="media" :class="isAudio ? 'audio-content' : 'player-content'">
      <!-- Video player -->
      <template v-if="!isAudio">
        <div class="video-wrapper">
          <video
            controls
            autoplay
            :src="mediaStore.streamUrl(media.id)"
            class="video-player"
          >
            Your browser does not support video playback.
          </video>
        </div>

        <div class="video-info">
          <h1>{{ media.title }}</h1>
          <p v-if="media.description" class="description">{{ media.description }}</p>
          <div class="meta">
            <span v-if="media.duration_sec">{{ formatDuration(media.duration_sec) }}</span>
            <span v-if="media.file_size_bytes">{{ formatSize(media.file_size_bytes) }}</span>
            <span>{{ media.profile }}</span>
          </div>
        </div>
      </template>

      <!-- Audio player -->
      <template v-else>
        <div class="audio-artwork">
          <i class="pi pi-headphones audio-icon" />
        </div>

        <div class="audio-info">
          <h1>{{ media.title }}</h1>
          <p v-if="media.description" class="description">{{ media.description }}</p>
          <div class="meta">
            <span v-if="media.duration_sec">{{ formatDuration(media.duration_sec) }}</span>
            <span v-if="media.file_size_bytes">{{ formatSize(media.file_size_bytes) }}</span>
            <span>{{ media.profile }}</span>
          </div>
        </div>

        <audio
          controls
          autoplay
          :src="mediaStore.streamUrl(media.id)"
          class="audio-player"
        >
          Your browser does not support audio playback.
        </audio>
      </template>
    </main>
  </div>
</template>

<style scoped>
.layout { min-height: 100vh; background: #000; }
.layout-audio { background: var(--p-surface-ground); }

.player-content {
  max-width: 1200px;
  margin: 0 auto;
}

.video-wrapper {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}

.video-player {
  width: 100%;
  height: 100%;
  display: block;
}

.video-info {
  padding: 1.5rem;
  color: #fff;
}

.video-info h1 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.description {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

/* Audio player styles */
.audio-content {
  max-width: 600px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.audio-artwork {
  width: 200px;
  height: 200px;
  border-radius: 16px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2rem;
}

.audio-icon {
  font-size: 5rem;
  color: var(--p-primary-color);
}

.audio-info {
  margin-bottom: 2rem;
}

.audio-info h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--p-text-color);
}

.audio-info .description {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.audio-info .meta {
  justify-content: center;
  color: var(--p-text-muted-color);
}

.audio-player {
  width: 100%;
  max-width: 500px;
}

@media (max-width: 640px) {
  .audio-artwork {
    width: 150px;
    height: 150px;
  }

  .audio-icon {
    font-size: 3.5rem;
  }

  .audio-content {
    padding: 2rem 1rem;
  }
}
</style>
