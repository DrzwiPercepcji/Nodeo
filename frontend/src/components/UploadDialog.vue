<script setup lang="ts">
import { ref, watch, computed, shallowRef } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { getExternalSourcePlugins } from '@/plugins/externalSources/registry'
import type { ExternalSourcePlugin, ImportSubmitPayload } from '@/plugins/externalSources/types'

const props = defineProps<{
  visible: boolean
  collectionId: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  upload: [data: { file: File; title: string; description: string; profile: string }]
  import: [data: ImportSubmitPayload]
}>()

const file = ref<File | null>(null)
const title = ref('')
const description = ref('')
const profile = ref('720p')
const uploading = ref(false)
const importing = ref(false)
const progress = ref(0)
const activeTab = ref('upload')
const selectedPlugin = shallowRef<ExternalSourcePlugin | null>(null)

const externalPlugins = getExternalSourcePlugins()

const busy = computed(() => uploading.value || importing.value)

const videoProfiles = [
  { label: '480p (SD, low bandwidth)', value: '480p' },
  { label: '720p (HD, recommended)', value: '720p' },
  { label: '1080p (Full HD)', value: '1080p' },
  { label: '1080p 60fps (High quality)', value: '1080p60' },
]

const audioProfiles = [
  { label: 'MP3 128 kbps (compact)', value: 'mp3-128' },
  { label: 'MP3 192 kbps (recommended)', value: 'mp3-192' },
  { label: 'MP3 320 kbps (high quality)', value: 'mp3-320' },
  { label: 'AAC 256 kbps (high quality)', value: 'aac-256' },
]

const isAudio = computed(() => {
  if (!file.value) return false
  if (file.value.type.startsWith('audio/')) return true
  const ext = file.value.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  return ['.mp3', '.m4a', '.aac', '.ogg', '.flac', '.wav', '.wma', '.opus', '.webm'].includes(ext || '')
})

const profileOptions = computed(() => isAudio.value ? audioProfiles : videoProfiles)
const mediaLabel = computed(() => isAudio.value ? 'audio' : 'video')

watch(() => props.visible, (v) => {
  if (v) {
    file.value = null
    title.value = ''
    description.value = ''
    profile.value = '720p'
    uploading.value = false
    importing.value = false
    progress.value = 0
    activeTab.value = 'upload'
    selectedPlugin.value = null
  }
})

watch(isAudio, (audio) => {
  profile.value = audio ? 'mp3-192' : '720p'
})

function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (selected) {
    file.value = selected
    if (!title.value) {
      title.value = selected.name.replace(/\.[^.]+$/, '')
    }
  }
}

function handleUpload() {
  if (!file.value || !title.value.trim()) return
  uploading.value = true
  emit('upload', {
    file: file.value,
    title: title.value.trim(),
    description: description.value.trim(),
    profile: profile.value,
  })
}

function handleImportSubmit(payload: ImportSubmitPayload) {
  importing.value = true
  emit('import', payload)
}

function selectPlugin(plugin: ExternalSourcePlugin) {
  selectedPlugin.value = plugin
}

function backToPluginList() {
  selectedPlugin.value = null
}

defineExpose({
  setProgress: (pct: number) => { progress.value = pct },
  done: () => { uploading.value = false; importing.value = false },
})
</script>

<template>
  <Dialog
    :visible="visible"
    header="Add Media"
    modal
    :closable="!busy"
    :style="{ width: '32rem' }"
    @update:visible="emit('update:visible', $event)"
  >
    <Tabs
      :value="activeTab"
      @update:value="activeTab = $event as string"
    >
      <TabList>
        <Tab value="upload">
          <i class="pi pi-upload" />
          Upload
        </Tab>
        <Tab value="external">
          <i class="pi pi-globe" />
          External
        </Tab>
      </TabList>

      <TabPanels>
        <TabPanel value="upload">
          <div class="upload-form">
            <div class="field">
              <label>Media file</label>
              <input
                type="file"
                accept="video/*,audio/*"
                :disabled="busy"
                @change="onFileSelect"
              >
              <div
                v-if="file"
                class="file-meta"
              >
                <span class="file-info">{{ (file.size / 1024 / 1024).toFixed(1) }} MB</span>
                <span class="file-type-badge">{{ isAudio ? 'Audio' : 'Video' }}</span>
              </div>
            </div>

            <div class="field">
              <label for="upl-title">Title</label>
              <InputText
                id="upl-title"
                v-model="title"
                placeholder="Media title"
                fluid
                :disabled="busy"
              />
            </div>

            <div class="field">
              <label for="upl-desc">Description</label>
              <Textarea
                id="upl-desc"
                v-model="description"
                placeholder="Optional description"
                rows="2"
                fluid
                :disabled="busy"
              />
            </div>

            <div class="field">
              <label for="upl-profile">Quality profile</label>
              <Select
                id="upl-profile"
                v-model="profile"
                :options="profileOptions"
                option-label="label"
                option-value="value"
                fluid
                :disabled="busy"
              />
            </div>

            <ProgressBar
              v-if="uploading"
              :value="progress"
              :show-value="true"
              class="upload-progress"
            />
            <small
              v-if="uploading && progress >= 100"
              class="processing-hint"
            >
              Upload complete. Server is processing {{ mediaLabel }}...
            </small>

            <div class="form-actions">
              <Button
                label="Cancel"
                text
                severity="secondary"
                :disabled="busy"
                @click="emit('update:visible', false)"
              />
              <Button
                label="Upload"
                icon="pi pi-upload"
                :loading="uploading"
                :disabled="!file || !title.trim()"
                @click="handleUpload"
              />
            </div>
          </div>
        </TabPanel>

        <TabPanel value="external">
          <div
            v-if="!selectedPlugin"
            class="plugin-list"
          >
            <div
              v-for="plugin in externalPlugins"
              :key="plugin.id"
              class="plugin-card"
              @click="selectPlugin(plugin)"
            >
              <i
                :class="plugin.icon"
                class="plugin-icon"
              />
              <div class="plugin-info">
                <h4>{{ plugin.name }}</h4>
                <p>{{ plugin.description }}</p>
              </div>
              <i class="pi pi-chevron-right plugin-arrow" />
            </div>
          </div>

          <div
            v-else
            class="plugin-view"
          >
            <button
              class="back-link"
              :disabled="busy"
              @click="backToPluginList"
            >
              <i class="pi pi-arrow-left" />
              {{ selectedPlugin.name }}
            </button>

            <component
              :is="selectedPlugin.component"
              :disabled="importing"
              @submit="handleImportSubmit"
            />
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>

<style scoped>
.upload-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 500;
  font-size: 0.875rem;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-info {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.file-type-badge {
  font-size: 0.8rem;
  font-weight: 500;
}

.upload-progress {
  margin-top: 0.5rem;
}

.processing-hint {
  color: var(--p-primary-color);
  font-style: italic;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.plugin-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.plugin-card:hover {
  border-color: var(--p-primary-color);
  background: var(--p-surface-hover);
}

.plugin-icon {
  font-size: 1.5rem;
  color: var(--p-primary-color);
  flex-shrink: 0;
}

.plugin-info {
  flex: 1;
  min-width: 0;
}

.plugin-info h4 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 0.15rem;
}

.plugin-info p {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin: 0;
}

.plugin-arrow {
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.plugin-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: var(--p-primary-color);
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 0;
}

.back-link:hover {
  text-decoration: underline;
}

.back-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
