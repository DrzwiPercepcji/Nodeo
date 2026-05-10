<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCollectionsStore } from '@/stores/collections'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import AppTopbar from '@/components/AppTopbar.vue'
import CollectionDialog from '@/components/CollectionDialog.vue'
import DeleteCollectionDialog from '@/components/DeleteCollectionDialog.vue'
import UnlockDialog from '@/components/UnlockDialog.vue'
import type { components } from '@/api/schema'

type Collection = components['schemas']['Collection']

const store = useCollectionsStore()
const router = useRouter()
const toast = useToast()

const showCreate = ref(false)
const editingCollection = ref<Collection | null>(null)
const showEdit = ref(false)
const unlockTarget = ref<Collection | null>(null)
const showUnlock = ref(false)
const unlockDialogRef = ref<InstanceType<typeof UnlockDialog> | null>(null)
const deletingId = ref<string | null>(null)
const deleteTarget = ref<Collection | null>(null)
const showDelete = ref(false)
const privateOpen = ref(false)

const publicCollections = computed(() =>
  store.collections.filter((c) => !c.is_encrypted),
)
const privateCollections = computed(() =>
  store.collections.filter((c) => c.is_encrypted),
)

onMounted(() => store.fetchAll())

async function handleCreate(data: { name: string; description: string; passphrase?: string }) {
  try {
    await store.create(data.name, data.description, data.passphrase)
    showCreate.value = false
    toast.add({ severity: 'success', summary: 'Created', detail: `Collection "${data.name}" created`, life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to create collection', life: 3000 })
  }
}

function openEdit(col: Collection) {
  editingCollection.value = col
  showEdit.value = true
}

async function handleEdit(data: { name: string; description: string }) {
  if (!editingCollection.value) return
  try {
    await store.update(editingCollection.value.id, data.name, data.description)
    showEdit.value = false
    toast.add({ severity: 'success', summary: 'Updated', detail: 'Collection updated', life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to update collection', life: 3000 })
  }
}

function openDelete(col: Collection) {
  deleteTarget.value = col
  showDelete.value = true
}

async function confirmDelete() {
  const col = deleteTarget.value
  if (!col) return
  deletingId.value = col.id
  try {
    await store.remove(col.id)
    toast.add({ severity: 'success', summary: 'Deleted', detail: `"${col.name}" deleted`, life: 3000 })
    deleteTarget.value = null
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete collection', life: 3000 })
  } finally {
    deletingId.value = null
  }
}

function handleCollectionClick(col: Collection) {
  if (col.is_encrypted && !col.is_unlocked) {
    unlockTarget.value = col
    showUnlock.value = true
    return
  }
  router.push(`/collections/${col.id}`)
}

async function handleUnlock(passphrase: string) {
  if (!unlockTarget.value) return
  const ok = await store.unlock(unlockTarget.value.id, passphrase)
  unlockDialogRef.value?.stopLoading()
  if (ok) {
    showUnlock.value = false
    toast.add({ severity: 'success', summary: 'Unlocked', detail: `"${unlockTarget.value.name}" unlocked for 1 hour`, life: 3000 })
    router.push(`/collections/${unlockTarget.value.id}`)
  } else {
    toast.add({ severity: 'error', summary: 'Wrong passphrase', detail: 'Could not unlock collection', life: 3000 })
  }
}
</script>

<template>
  <div class="layout">
    <AppTopbar />

    <main class="content">
      <div class="content-header">
        <h1>Collections</h1>
        <Button
          label="New Collection"
          icon="pi pi-plus"
          @click="showCreate = true"
        />
      </div>

      <ProgressSpinner
        v-if="store.loading"
        class="spinner"
      />

      <div
        v-else-if="store.collections.length === 0"
        class="empty-state"
      >
        <i
          class="pi pi-folder-open"
          style="font-size: 3rem; color: var(--p-text-muted-color)"
        />
        <p>No collections yet. Create one to get started.</p>
      </div>

      <template v-else>
        <div
          v-if="publicCollections.length > 0"
          class="grid"
        >
          <div
            v-for="col in publicCollections"
            :key="col.id"
            class="card"
            @click="handleCollectionClick(col)"
          >
            <div class="card-icon">
              <i
                class="pi pi-folder"
                style="color: var(--p-primary-color)"
              />
            </div>
            <div class="card-body">
              <h3>{{ col.name }}</h3>
              <p
                v-if="col.description"
                class="card-desc"
              >
                {{ col.description }}
              </p>
              <div class="card-meta">
                <span class="badge badge-open">
                  <i class="pi pi-folder" /> Open
                </span>
              </div>
            </div>
            <div
              class="card-actions"
              @click.stop
            >
              <Button
                icon="pi pi-pencil"
                text
                rounded
                size="small"
                severity="secondary"
                @click="openEdit(col)"
              />
              <Button
                icon="pi pi-trash"
                text
                rounded
                size="small"
                severity="danger"
                :loading="deletingId === col.id"
                @click="openDelete(col)"
              />
            </div>
          </div>
        </div>

        <div
          v-if="privateCollections.length > 0"
          class="private-section"
        >
          <button
            class="private-toggle"
            @click="privateOpen = !privateOpen"
          >
            <i class="pi pi-lock" />
            <span>Private collections ({{ privateCollections.length }})</span>
            <i
              class="pi pi-chevron-right toggle-chevron"
              :class="{ open: privateOpen }"
            />
          </button>

          <div
            v-if="privateOpen"
            class="grid"
          >
            <div
              v-for="col in privateCollections"
              :key="col.id"
              class="card"
              @click="handleCollectionClick(col)"
            >
              <div class="card-icon">
                <i
                  :class="col.is_unlocked ? 'pi pi-lock-open' : 'pi pi-lock'"
                  :style="{ color: col.is_unlocked ? 'var(--p-primary-color)' : 'var(--p-orange-500)' }"
                />
              </div>
              <div class="card-body">
                <h3>{{ col.name }}</h3>
                <p
                  v-if="col.description"
                  class="card-desc"
                >
                  {{ col.description }}
                </p>
                <div class="card-meta">
                  <span class="badge badge-encrypted">
                    <i class="pi pi-shield" /> Encrypted
                  </span>
                </div>
              </div>
              <div
                class="card-actions"
                @click.stop
              >
                <Button
                  icon="pi pi-pencil"
                  text
                  rounded
                  size="small"
                  severity="secondary"
                  @click="openEdit(col)"
                />
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  size="small"
                  severity="danger"
                  :loading="deletingId === col.id"
                  @click="openDelete(col)"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>

    <DeleteCollectionDialog
      v-model:visible="showDelete"
      :collection="deleteTarget"
      @confirm="confirmDelete"
    />

    <CollectionDialog
      v-model:visible="showCreate"
      @save="handleCreate"
    />
    <CollectionDialog
      v-model:visible="showEdit"
      :collection="editingCollection"
      @save="handleEdit"
    />
    <UnlockDialog
      ref="unlockDialogRef"
      v-model:visible="showUnlock"
      :collection-name="unlockTarget?.name ?? ''"
      @unlock="handleUnlock"
    />
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.content-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
}

.spinner {
  display: flex;
  justify-content: center;
  margin-top: 3rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--p-text-muted-color);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 10px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.card:hover {
  border-color: var(--p-primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 8px;
  background: var(--p-surface-ground);
  font-size: 1.25rem;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-body h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-desc {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  gap: 0.5rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  font-weight: 500;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.badge i {
  font-size: 0.65rem;
}

.badge-encrypted {
  background: color-mix(in srgb, var(--p-orange-500) 12%, transparent);
  color: var(--p-orange-500);
}

.badge-open {
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  color: var(--p-primary-color);
}

.card-actions {
  flex-shrink: 0;
  display: flex;
  gap: 0.125rem;
}

.private-section {
  margin-top: 2rem;
  border-top: 1px solid var(--p-surface-border);
  padding-top: 0.5rem;
}

.private-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.25rem;
  margin-bottom: 1rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
  transition: color 0.15s;
}

.private-toggle:hover {
  color: var(--p-text-color);
}

.private-toggle > .pi-lock {
  font-size: 0.9rem;
}

.toggle-chevron {
  font-size: 0.7rem;
  transition: transform 0.2s ease;
}

.toggle-chevron.open {
  transform: rotate(90deg);
}
</style>
