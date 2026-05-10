<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

defineProps<{
  visible: boolean
  title: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
}>()

function close() {
  emit('update:visible', false)
}

function onConfirm() {
  emit('confirm')
  close()
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Delete"
    modal
    :style="{ width: '24rem' }"
    :closable="true"
    @update:visible="emit('update:visible', $event)"
  >
    <p class="confirm-text">
      Are you sure you want to delete <strong>{{ title }}</strong>?
    </p>
    <template #footer>
      <Button
        label="Cancel"
        text
        severity="secondary"
        @click="close"
      />
      <Button
        label="Delete"
        severity="danger"
        icon="pi pi-trash"
        @click="onConfirm"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.confirm-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
}
</style>
