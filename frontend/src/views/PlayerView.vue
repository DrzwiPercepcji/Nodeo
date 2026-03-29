<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
  <div class="layout">
    <AppTopbar :title="media?.title ?? 'Player'" showBack />

    <main class="player-content" v-if="media">
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
    </main>
  </div>
</template>

<style scoped>
.layout { min-height: 100vh; background: #000; }

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
</style>
