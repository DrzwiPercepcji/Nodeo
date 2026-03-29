<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'

const props = defineProps<{
  visible: boolean
  collectionId: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  upload: [data: { file: File; title: string; description: string; profile: string }]
}>()

const file = ref<File | null>(null)
const title = ref('')
const description = ref('')
const profile = ref('720p')
const uploading = ref(false)
const progress = ref(0)

const profileOptions = [
  { label: '480p (SD, low bandwidth)', value: '480p' },
  { label: '720p (HD, recommended)', value: '720p' },
  { label: '1080p (Full HD)', value: '1080p' },
  { label: '1080p 60fps (High quality)', value: '1080p60' },
]

watch(() => props.visible, (v) => {
  if (v) {
    file.value = null
    title.value = ''
    description.value = ''
    profile.value = '720p'
    uploading.value = false
    progress.value = 0
  }
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

defineExpose({
  setProgress: (pct: number) => { progress.value = pct },
  done: () => { uploading.value = false },
})
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Upload Video"
    modal
    :closable="!uploading"
    :style="{ width: '30rem' }"
  >
    <div class="upload-form">
      <div class="field">
        <label>Video file</label>
        <input type="file" accept="video/*" @change="onFileSelect" :disabled="uploading" />
        <small v-if="file" class="file-info">{{ (file.size / 1024 / 1024).toFixed(1) }} MB</small>
      </div>

      <div class="field">
        <label for="upl-title">Title</label>
        <InputText id="upl-title" v-model="title" placeholder="Video title" fluid :disabled="uploading" />
      </div>

      <div class="field">
        <label for="upl-desc">Description</label>
        <Textarea id="upl-desc" v-model="description" placeholder="Optional description" rows="2" fluid :disabled="uploading" />
      </div>

      <div class="field">
        <label for="upl-profile">Quality profile</label>
        <Select
          id="upl-profile"
          v-model="profile"
          :options="profileOptions"
          optionLabel="label"
          optionValue="value"
          fluid
          :disabled="uploading"
        />
      </div>

      <ProgressBar v-if="uploading" :value="progress" :showValue="true" class="upload-progress" />
      <small v-if="uploading && progress >= 100" class="processing-hint">
        Upload complete. Server is transcoding and processing...
      </small>
    </div>

    <template #footer>
      <Button label="Cancel" text severity="secondary" @click="emit('update:visible', false)" :disabled="uploading" />
      <Button label="Upload" icon="pi pi-upload" @click="handleUpload" :loading="uploading" :disabled="!file || !title.trim()" />
    </template>
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

.file-info {
  color: var(--p-text-muted-color);
}

.upload-progress {
  margin-top: 0.5rem;
}

.processing-hint {
  color: var(--p-primary-color);
  font-style: italic;
}
</style>
