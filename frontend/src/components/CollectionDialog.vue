<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import type { components } from '@/api/schema'

type Collection = components['schemas']['Collection']

const props = defineProps<{
  visible: boolean
  collection?: Collection | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [data: { name: string; description: string; passphrase?: string }]
}>()

const name = ref('')
const description = ref('')
const encrypted = ref(false)
const passphrase = ref('')

const isEdit = ref(false)

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    if (props.collection) {
      isEdit.value = true
      name.value = props.collection.name
      description.value = props.collection.description ?? ''
      encrypted.value = props.collection.is_encrypted
      passphrase.value = ''
    } else {
      isEdit.value = false
      name.value = ''
      description.value = ''
      encrypted.value = false
      passphrase.value = ''
    }
  },
)

function handleSave() {
  if (!name.value.trim()) return
  emit('save', {
    name: name.value.trim(),
    description: description.value.trim(),
    passphrase: !isEdit.value && encrypted.value ? passphrase.value : undefined,
  })
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="isEdit ? 'Edit Collection' : 'New Collection'"
    modal
    :style="{ width: '28rem' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="dialog-form">
      <div class="field">
        <label for="col-name">Name</label>
        <InputText
          id="col-name"
          v-model="name"
          placeholder="Collection name"
          fluid
        />
      </div>

      <div class="field">
        <label for="col-desc">Description</label>
        <Textarea
          id="col-desc"
          v-model="description"
          placeholder="Optional description"
          rows="3"
          fluid
        />
      </div>

      <div
        v-if="!isEdit"
        class="field-check"
      >
        <Checkbox
          v-model="encrypted"
          input-id="col-enc"
          :binary="true"
        />
        <label for="col-enc">Encrypt with passphrase</label>
      </div>

      <div
        v-if="!isEdit && encrypted"
        class="field"
      >
        <label for="col-pass">Passphrase</label>
        <Password
          id="col-pass"
          v-model="passphrase"
          placeholder="Enter passphrase"
          :feedback="false"
          toggle-mask
          fluid
        />
      </div>
    </div>

    <template #footer>
      <Button
        label="Cancel"
        text
        severity="secondary"
        @click="emit('update:visible', false)"
      />
      <Button
        :label="isEdit ? 'Save' : 'Create'"
        :disabled="!name.trim()"
        @click="handleSave"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-form {
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

.field-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
