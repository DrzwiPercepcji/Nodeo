<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Password from 'primevue/password'
import Button from 'primevue/button'

const props = defineProps<{
  visible: boolean
  collectionName: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  unlock: [passphrase: string]
}>()

const passphrase = ref('')
const loading = ref(false)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      passphrase.value = ''
      loading.value = false
    }
  },
)

function handleUnlock() {
  if (!passphrase.value) return
  loading.value = true
  emit('unlock', passphrase.value)
}

defineExpose({ stopLoading: () => (loading.value = false) })
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Unlock Collection"
    modal
    :style="{ width: '24rem' }"
  >
    <div class="unlock-form">
      <p class="unlock-hint">
        <i class="pi pi-lock" /> Enter passphrase for <strong>{{ collectionName }}</strong>
      </p>
      <Password
        v-model="passphrase"
        placeholder="Passphrase"
        :feedback="false"
        toggleMask
        fluid
        @keydown.enter="handleUnlock"
      />
    </div>

    <template #footer>
      <Button label="Cancel" text severity="secondary" @click="emit('update:visible', false)" />
      <Button label="Unlock" icon="pi pi-lock-open" @click="handleUnlock" :loading="loading" :disabled="!passphrase" />
    </template>
  </Dialog>
</template>

<style scoped>
.unlock-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.unlock-hint {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.unlock-hint i {
  margin-right: 0.25rem;
}
</style>
