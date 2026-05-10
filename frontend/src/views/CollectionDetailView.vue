<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaStore } from '@/stores/media'
import { useCollectionsStore } from '@/stores/collections'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import AppTopbar from '@/components/AppTopbar.vue'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import UploadDialog from '@/components/UploadDialog.vue'
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog.vue'
import type { components } from '@/api/schema'
import { mediaMetadataSubtitle } from '@/utils/mediaMetadataDisplay'

type Media = components['schemas']['Media']

const route = useRoute()
const router = useRouter()
const mediaStore = useMediaStore()
const collectionsStore = useCollectionsStore()
const toast = useToast()

const collectionId = route.params.id as string
const searchQuery = ref('')
const showUpload = ref(false)
const uploadDialogRef = ref<InstanceType<typeof UploadDialog> | null>(null)
const deletingId = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const deleteTarget = ref<{ id: string; title: string } | null>(null)
const pollingIds = ref<Set<string>>(new Set())

type MediaProgress = NonNullable<Media['progress']>

const processingProgress = ref<Record<string, MediaProgress>>({})

const STAGE_LABEL: Record<MediaProgress['stage'], string> = {
  transcoding: 'Transcoding',
  thumbnails: 'Thumbnails',
  encrypting: 'Encrypting',
  uploading_main: 'Uploading',
  uploading_thumbs: 'Uploading thumbs',
}

const collection = computed(() =>
  collectionsStore.collections.find((c) => c.id === collectionId),
)

const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return mediaStore.items
  return mediaStore.items.filter((m) => {
    const title = (m.title ?? '').toLowerCase()
    const desc = (m.description ?? '').toLowerCase()
    return title.includes(q) || desc.includes(q)
  })
})

const hasReadyAudio = computed(() =>
  mediaStore.items.some((m) => m.status === 'ready' && m.media_type === 'audio'),
)

onMounted(async () => {
  if (!collectionsStore.collections.length) await collectionsStore.fetchAll()
  await mediaStore.fetchByCollection(collectionId)
  startPollingProcessing()
})

function startPollingProcessing() {
  const processing = mediaStore.items.filter((m) => m.status === 'processing')
  for (const m of processing) pollStatus(m.id)
}

async function pollStatus(mediaId: string) {
  if (pollingIds.value.has(mediaId)) return
  pollingIds.value.add(mediaId)

  const pollMs = 2000

  const check = async () => {
    const media = await mediaStore.fetchSingle(mediaId)
    if (!media || media.status !== 'processing') {
      pollingIds.value.delete(mediaId)
      const next = { ...processingProgress.value }
      delete next[mediaId]
      processingProgress.value = next
      await mediaStore.fetchByCollection(collectionId)
      if (media?.status === 'ready') {
        toast.add({ severity: 'success', summary: 'Ready', detail: `"${media.title}" is ready`, life: 3000 })
      }
      return
    }
    if (media.progress) {
      processingProgress.value = { ...processingProgress.value, [mediaId]: media.progress }
    }
    setTimeout(check, pollMs)
  }
  setTimeout(check, pollMs)
}

async function handleUpload(data: { file: File; title: string; description: string; profile: string }) {
  try {
    const mediaId = await mediaStore.upload(
      collectionId,
      data.file,
      data.title,
      data.description,
      data.profile,
      (pct) => uploadDialogRef.value?.setProgress(pct),
    )
    uploadDialogRef.value?.done()
    showUpload.value = false
    toast.add({ severity: 'info', summary: 'Processing', detail: 'File uploaded, processing in progress...', life: 5000 })
    await mediaStore.fetchByCollection(collectionId)
    pollStatus(mediaId)
  } catch {
    uploadDialogRef.value?.done()
    toast.add({ severity: 'error', summary: 'Error', detail: 'Upload failed', life: 3000 })
  }
}

function openDelete(id: string, title: string) {
  deleteTarget.value = { id, title }
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  deletingId.value = target.id
  try {
    await mediaStore.remove(target.id)
    toast.add({ severity: 'success', summary: 'Deleted', detail: `"${target.title}" deleted`, life: 3000 })
    deleteTarget.value = null
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete', life: 3000 })
  } finally {
    deletingId.value = null
  }
}

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || sec < 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function processingLabel(id: string): string {
  const p = processingProgress.value[id]
  if (!p) return 'Processing…'
  const stage = STAGE_LABEL[p.stage] ?? p.stage
  let line = `${stage} · ${p.overall_percent}%`
  if (
    p.stage === 'transcoding'
    && p.current_sec != null
    && p.total_sec != null
    && p.total_sec > 0
  ) {
    line += ` (${formatDuration(p.current_sec)}/${formatDuration(p.total_sec)})`
  }
  return line
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Extra preview frame indices (1..n-1) for hover strip; main poster uses frame 0. */
function stripFrameIndices(count: number | null | undefined): number[] {
  const n = typeof count === 'number' ? count : 0
  if (n <= 1) return []
  return Array.from({ length: n - 1 }, (_, i) => i + 1)
}

function openMedia(media: Media) {
  if (media.status !== 'ready') return
  if (media.media_type === 'audio') {
    router.push({ path: `/collections/${collectionId}/playlist`, query: { start: media.id } })
  } else {
    router.push(`/media/${media.id}`)
  }
}

</script>

<template>
  <div class="layout">
    <AppTopbar
      :title="collection?.name ?? 'Collection'"
      show-back
    />

    <main class="content">
      <div class="content-header">
        <div>
          <h1>{{ collection?.name }}</h1>
          <p
            v-if="collection?.description"
            class="subtitle"
          >
            {{ collection.description }}
          </p>
        </div>
        <div class="header-actions">
          <Button
            v-if="hasReadyAudio"
            label="Playlist"
            icon="pi pi-list"
            severity="secondary"
            aria-label="Open audio playlist"
            @click="router.push(`/collections/${collectionId}/playlist`)"
          />
          <Button
            label="Upload"
            icon="pi pi-upload"
            aria-label="Upload media"
            @click="showUpload = true"
          />
        </div>
      </div>

      <div
        v-if="!mediaStore.loading && mediaStore.items.length > 0"
        class="search-row"
      >
        <InputText
          v-model="searchQuery"
          type="search"
          placeholder="Search title or description…"
          class="search-input"
          aria-label="Filter media by title or description"
        />
      </div>

      <ProgressSpinner
        v-if="mediaStore.loading"
        class="spinner"
      />

      <div
        v-else-if="mediaStore.items.length === 0"
        class="empty-state"
      >
        <i
          class="pi pi-video"
          style="font-size: 3rem; color: var(--p-text-muted-color)"
        />
        <p>No media yet. Upload a video or audio file to get started.</p>
      </div>

      <div
        v-else-if="filteredItems.length === 0"
        class="empty-state"
      >
        <i
          class="pi pi-search"
          style="font-size: 3rem; color: var(--p-text-muted-color)"
        />
        <p>No media matches your search.</p>
      </div>

      <div
        v-else
        class="media-grid"
      >
        <div
          v-for="media in filteredItems"
          :key="media.id"
          class="media-card"
          @click="openMedia(media)"
        >
          <div
            class="thumb-container"
            :class="{ 'has-hover-strip': (media.thumb_frame_count ?? 0) > 1 }"
          >
            <img
              v-if="media.status === 'ready' && media.media_type === 'video'"
              :src="mediaStore.thumbUrl(media.id, 0)"
              :alt="media.title"
              class="thumb"
              loading="lazy"
            >
            <div
              v-if="media.status === 'ready' && media.media_type === 'video' && stripFrameIndices(media.thumb_frame_count).length"
              class="thumb-strip"
              aria-hidden="true"
            >
              <img
                v-for="fi in stripFrameIndices(media.thumb_frame_count)"
                :key="fi"
                :src="mediaStore.thumbUrl(media.id, fi)"
                alt=""
                loading="lazy"
              >
            </div>
            <div
              v-else-if="media.status === 'ready' && media.media_type === 'audio'"
              class="thumb-placeholder audio-thumb"
            >
              <i
                class="pi pi-headphones"
                style="font-size: 2.5rem; color: var(--p-primary-color)"
              />
            </div>
            <div
              v-else
              class="thumb-placeholder"
            >
              <ProgressSpinner
                v-if="media.status === 'processing'"
                style="width: 2rem; height: 2rem"
              />
              <i
                v-else
                class="pi pi-exclamation-triangle"
                style="font-size: 1.5rem; color: var(--p-red-500)"
              />
            </div>
            <span
              v-if="media.duration_sec"
              class="duration-badge"
            >{{ formatDuration(media.duration_sec) }}</span>
          </div>

          <div class="media-info">
            <h4>{{ media.title }}</h4>
            <p
              v-if="mediaMetadataSubtitle(media.metadata)"
              class="media-tags"
            >
              {{ mediaMetadataSubtitle(media.metadata) }}
            </p>
            <div class="media-meta">
              <Tag
                v-if="media.status === 'processing'"
                :value="processingLabel(media.id)"
                severity="warn"
              />
              <Tag
                v-else-if="media.status === 'error'"
                value="Error"
                severity="danger"
              />
              <span
                v-else
                class="meta-text"
              >{{ media.profile }} &middot; {{ formatSize(media.file_size_bytes) }}</span>
            </div>
          </div>

          <div
            class="media-actions"
            @click.stop
          >
            <Button
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              :loading="deletingId === media.id"
              @click="openDelete(media.id, media.title)"
            />
          </div>
        </div>
      </div>
    </main>

    <UploadDialog
      ref="uploadDialogRef"
      v-model:visible="showUpload"
      :collection-id="collectionId"
      @upload="handleUpload"
    />

    <ConfirmDeleteDialog
      v-model:visible="showDeleteConfirm"
      :title="deleteTarget?.title ?? ''"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.layout { min-height: 100vh; }

.content { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }

.content-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.search-row {
  margin-bottom: 1.5rem;
}

.search-input {
  width: 100%;
  max-width: 28rem;
}

.content-header h1 { font-size: 1.5rem; font-weight: 600; }
.subtitle { color: var(--p-text-muted-color); font-size: 0.9rem; margin-top: 0.25rem; }

.spinner { display: flex; justify-content: center; margin-top: 3rem; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--p-text-muted-color);
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.media-card {
  border-radius: 10px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.media-card:hover {
  border-color: var(--p-primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.thumb-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--p-surface-ground);
  overflow: hidden;
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-strip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 3px;
  padding: 6px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.88));
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.has-hover-strip:hover .thumb-strip {
  opacity: 1;
}

.thumb-strip img {
  flex: 1;
  min-width: 0;
  height: 44px;
  object-fit: cover;
  border-radius: 3px;
}

.thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.duration-badge {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
}

.media-info {
  padding: 0.75rem 1rem;
}

.media-info h4 {
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.25rem;
}

.media-tags {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  margin: 0 0 0.25rem;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-meta { display: flex; align-items: center; gap: 0.5rem; }
.meta-text { font-size: 0.75rem; color: var(--p-text-muted-color); }

.media-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 0.5rem 0.5rem;
}
</style>
