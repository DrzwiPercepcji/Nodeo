<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import AppTopbar from '@/components/AppTopbar.vue'

const settings = useSettingsStore()
const toast = useToast()

const editing = ref(false)
const cookieText = ref('')

onMounted(() => settings.fetchCookiesStatus())

function startEdit() {
  editing.value = true
  cookieText.value = ''
}

function cancelEdit() {
  editing.value = false
  cookieText.value = ''
}

async function saveCookies() {
  try {
    await settings.saveCookies(cookieText.value)
    editing.value = false
    cookieText.value = ''
    toast.add({ severity: 'success', summary: 'Saved', detail: 'yt-dlp cookies updated', life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to save cookies', life: 3000 })
  }
}
</script>

<template>
  <div class="layout">
    <AppTopbar title="Settings" show-back />

    <main class="content">
      <section class="settings-section">
        <h2>YouTube (yt-dlp)</h2>

        <div class="setting-row">
          <div class="setting-info">
            <label class="setting-label">Cookie file</label>
            <p class="setting-desc">
              Netscape-format cookie file used by yt-dlp for authenticated YouTube downloads.
              Export from your browser using a cookie extension.
            </p>
          </div>

          <div class="setting-control">
            <template v-if="!editing">
              <div
                v-if="settings.ytdlpCookiesConfigured"
                class="cookie-status configured"
              >
                <span class="masked-value">••••••••••••••••</span>
                <Button
                  icon="pi pi-pencil"
                  text
                  rounded
                  size="small"
                  severity="secondary"
                  @click="startEdit"
                />
              </div>
              <div
                v-else
                class="cookie-status not-configured"
              >
                <span class="status-text">Not configured</span>
                <Button
                  label="Upload"
                  icon="pi pi-upload"
                  size="small"
                  @click="startEdit"
                />
              </div>
            </template>

            <template v-else>
              <div class="cookie-edit">
                <Textarea
                  v-model="cookieText"
                  placeholder="Paste Netscape cookie file content here..."
                  rows="8"
                  class="cookie-textarea"
                  auto-resize
                />
                <div class="cookie-edit-actions">
                  <Button
                    label="Cancel"
                    text
                    size="small"
                    severity="secondary"
                    @click="cancelEdit"
                  />
                  <Button
                    label="Save"
                    icon="pi pi-check"
                    size="small"
                    :loading="settings.saving"
                    :disabled="!cookieText.trim()"
                    @click="saveCookies"
                  />
                </div>
              </div>
            </template>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.content {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.settings-section {
  margin-bottom: 2.5rem;
}

.settings-section h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--p-surface-border);
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-label {
  font-weight: 500;
  font-size: 0.9rem;
}

.setting-desc {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-top: 0.25rem;
  line-height: 1.4;
}

.setting-control {
  margin-top: 0.25rem;
}

.cookie-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.masked-value {
  font-family: monospace;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
}

.status-text {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.cookie-edit {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cookie-textarea {
  width: 100%;
  font-family: monospace;
  font-size: 0.8rem;
}

.cookie-edit-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
