<script setup lang="ts">
import { ref, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import type { ImportSubmitPayload } from './types'

defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  submit: [payload: ImportSubmitPayload]
}>()

const url = ref('')
const title = ref('')
const profile = ref('mp3-192')

const audioProfiles = [
  { label: 'MP3 128 kbps (compact)', value: 'mp3-128' },
  { label: 'MP3 192 kbps (recommended)', value: 'mp3-192' },
  { label: 'MP3 320 kbps (high quality)', value: 'mp3-320' },
  { label: 'AAC 256 kbps (high quality)', value: 'aac-256' },
]

const youtubeUrlPattern = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/).+/

const isValidUrl = computed(() => youtubeUrlPattern.test(url.value.trim()))

function handleSubmit() {
  if (!isValidUrl.value) return
  emit('submit', {
    source: 'youtube',
    url: url.value.trim(),
    title: title.value.trim() || undefined,
    profile: profile.value,
  })
}
</script>

<template>
  <div class="yt-plugin-form">
    <div class="field">
      <label for="yt-url">YouTube URL</label>
      <InputText
        id="yt-url"
        v-model="url"
        placeholder="https://www.youtube.com/watch?v=..."
        fluid
        :disabled="disabled"
        :invalid="url.length > 0 && !isValidUrl"
      />
      <small
        v-if="url.length > 0 && !isValidUrl"
        class="field-error"
      >
        Enter a valid YouTube URL
      </small>
    </div>

    <div class="field">
      <label for="yt-title">Title (optional)</label>
      <InputText
        id="yt-title"
        v-model="title"
        placeholder="Auto-detected from YouTube if empty"
        fluid
        :disabled="disabled"
      />
    </div>

    <div class="field">
      <label for="yt-profile">Audio quality</label>
      <Select
        id="yt-profile"
        v-model="profile"
        :options="audioProfiles"
        option-label="label"
        option-value="value"
        fluid
        :disabled="disabled"
      />
    </div>

    <Button
      label="Import"
      icon="pi pi-download"
      :disabled="!isValidUrl || disabled"
      :loading="disabled"
      class="import-btn"
      @click="handleSubmit"
    />
  </div>
</template>

<style scoped>
.yt-plugin-form {
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

.field-error {
  color: var(--p-red-500);
}

.import-btn {
  align-self: flex-end;
}
</style>
