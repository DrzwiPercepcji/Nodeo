<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) return
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    router.push('/')
  } catch {
    toast.add({ severity: 'error', summary: 'Login failed', detail: 'Invalid credentials', life: 3000 })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>Nodeo</h1>
        <p>Private media streaming</p>
      </div>

      <form
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <div class="field">
          <label for="username">Username</label>
          <InputText
            id="username"
            v-model="username"
            placeholder="Enter username"
            autocomplete="username"
            fluid
          />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <Password
            id="password"
            v-model="password"
            placeholder="Enter password"
            :feedback="false"
            toggle-mask
            autocomplete="current-password"
            fluid
          />
        </div>

        <Button
          type="submit"
          label="Sign in"
          :loading="loading"
          fluid
        />
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 2.5rem;
  border-radius: 12px;
  background: var(--p-surface-card);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.login-header p {
  margin-top: 0.25rem;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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
</style>
