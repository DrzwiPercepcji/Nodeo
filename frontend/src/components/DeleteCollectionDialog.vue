<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import type { components } from '@/api/schema'

type Collection = components['schemas']['Collection']

const props = defineProps<{
  visible: boolean
  collection: Collection | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
}>()

const confirmName = ref('')

watch(
  () => props.visible,
  (v) => {
    if (v) confirmName.value = ''
  },
)

const expectedName = computed(() => props.collection?.name?.trim() ?? '')
const nameMatches = computed(
  () => expectedName.value.length > 0 && confirmName.value.trim() === expectedName.value,
)

function close() {
  emit('update:visible', false)
}

function onConfirm() {
  if (!nameMatches.value) return
  emit('confirm')
  close()
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Delete collection"
    modal
    :style="{ width: '26rem' }"
    :closable="true"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="delete-form">
      <Message
        severity="warn"
        :closable="false"
      >
        All media in this collection will be removed from the library. Objects are moved to S3
        <code>trash/</code> and permanently deleted after about 7 days (bucket lifecycle).
      </Message>
      <p
        v-if="collection"
        class="name-line"
      >
        Collection:
        <strong>{{ collection.name }}</strong>
      </p>
      <div class="field">
        <label for="del-confirm-name">Type the collection name to confirm</label>
        <InputText
          id="del-confirm-name"
          v-model="confirmName"
          :placeholder="expectedName || 'Name'"
          fluid
          autocomplete="off"
          @keydown.enter="nameMatches && onConfirm()"
        />
      </div>
    </div>
    <template #footer>
      <Button
        label="Cancel"
        text
        severity="secondary"
        @click="close"
      />
      <Button
        label="Delete collection"
        severity="danger"
        icon="pi pi-trash"
        :disabled="!nameMatches"
        @click="onConfirm"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.delete-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.delete-form :deep(.p-message) {
  margin: 0;
}

.name-line {
  margin: 0;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 500;
}

code {
  font-size: 0.8em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: var(--p-surface-ground);
}
</style>
