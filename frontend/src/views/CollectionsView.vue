<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCollectionsStore } from '@/stores/collections'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import ConfirmDialog from 'primevue/confirmdialog'
import CollectionDialog from '@/components/CollectionDialog.vue'
import UnlockDialog from '@/components/UnlockDialog.vue'
import type { components } from '@/api/schema'

type Collection = components['schemas']['Collection']

const auth = useAuthStore()
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

onMounted(() => store.fetchAll())

function handleLogout() {
  auth.logout()
  router.push('/login')
}

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

async function handleDelete(col: Collection) {
  deletingId.value = col.id
  try {
    await store.remove(col.id)
    toast.add({ severity: 'success', summary: 'Deleted', detail: `"${col.name}" deleted`, life: 3000 })
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
  // TODO Phase 5: navigate to collection media view
}

async function handleUnlock(passphrase: string) {
  if (!unlockTarget.value) return
  const ok = await store.unlock(unlockTarget.value.id, passphrase)
  unlockDialogRef.value?.stopLoading()
  if (ok) {
    showUnlock.value = false
    toast.add({ severity: 'success', summary: 'Unlocked', detail: `"${unlockTarget.value.name}" unlocked for 1 hour`, life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: 'Wrong passphrase', detail: 'Could not unlock collection', life: 3000 })
  }
}
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <h2>Nodeo</h2>
      <div class="topbar-actions">
        <span class="username">{{ auth.username }}</span>
        <Button icon="pi pi-sign-out" text rounded severity="secondary" @click="handleLogout" />
      </div>
    </header>

    <main class="content">
      <div class="content-header">
        <h1>Collections</h1>
        <Button label="New Collection" icon="pi pi-plus" @click="showCreate = true" />
      </div>

      <ProgressSpinner v-if="store.loading" class="spinner" />

      <div v-else-if="store.collections.length === 0" class="empty-state">
        <i class="pi pi-folder-open" style="font-size: 3rem; color: var(--p-text-muted-color)"></i>
        <p>No collections yet. Create one to get started.</p>
      </div>

      <div v-else class="grid">
        <div
          v-for="col in store.collections"
          :key="col.id"
          class="card"
          @click="handleCollectionClick(col)"
        >
          <div class="card-icon">
            <i
              :class="col.is_encrypted ? (col.is_unlocked ? 'pi pi-lock-open' : 'pi pi-lock') : 'pi pi-folder'"
              :style="{ color: col.is_encrypted && !col.is_unlocked ? 'var(--p-orange-500)' : 'var(--p-primary-color)' }"
            />
          </div>
          <div class="card-body">
            <h3>{{ col.name }}</h3>
            <p v-if="col.description" class="card-desc">{{ col.description }}</p>
            <div class="card-meta">
              <span v-if="col.is_encrypted" class="badge badge-encrypted">
                <i class="pi pi-shield" /> Encrypted
              </span>
              <span v-else class="badge badge-open">
                <i class="pi pi-folder" /> Open
              </span>
            </div>
          </div>
          <div class="card-actions" @click.stop>
            <Button icon="pi pi-pencil" text rounded size="small" severity="secondary" @click="openEdit(col)" />
            <Button
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              :loading="deletingId === col.id"
              @click="handleDelete(col)"
            />
          </div>
        </div>
      </div>
    </main>

    <ConfirmDialog />

    <CollectionDialog v-model:visible="showCreate" @save="handleCreate" />
    <CollectionDialog v-model:visible="showEdit" :collection="editingCollection" @save="handleEdit" />
    <UnlockDialog
      ref="unlockDialogRef"
      v-model:visible="showUnlock"
      :collectionName="unlockTarget?.name ?? ''"
      @unlock="handleUnlock"
    />
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
}

.topbar h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.username {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
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
</style>
