<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaStore } from '@/stores/media'
import { useAuthStore } from '@/stores/auth'
import Button from 'primevue/button'
import type { components } from '@/api/schema'

type Media = components['schemas']['Media']

const route = useRoute()
const router = useRouter()
const mediaStore = useMediaStore()
const auth = useAuthStore()

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

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <div class="topbar-left">
        <Button icon="pi pi-arrow-left" text rounded severity="secondary" @click="router.back()" />
        <h2>{{ media?.title ?? 'Player' }}</h2>
      </div>
      <div class="topbar-actions">
        <span class="username">{{ auth.username }}</span>
        <Button icon="pi pi-sign-out" text rounded severity="secondary" @click="handleLogout" />
      </div>
    </header>

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

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1.5rem;
  background: rgba(0, 0, 0, 0.9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.topbar-left { display: flex; align-items: center; gap: 0.5rem; }
.topbar-left h2 { font-size: 1rem; font-weight: 600; color: #fff; }
.topbar-actions { display: flex; align-items: center; gap: 0.5rem; }
.username { font-size: 0.875rem; color: rgba(255, 255, 255, 0.6); }

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
