import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'
import type { components } from '@/api/schema'

type Collection = components['schemas']['Collection']

export const useCollectionsStore = defineStore('collections', () => {
  const collections = ref<Collection[]>([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      const { data } = await api.GET('/collections')
      collections.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function create(name: string, description: string, passphrase?: string) {
    const body: Record<string, string> = { name, description }
    if (passphrase) body.passphrase = passphrase
    const { data, error } = await api.POST('/collections', { body: body as never })
    if (error) throw new Error('Failed to create collection')
    collections.value.unshift(data!)
    return data!
  }

  async function update(id: string, name: string, description: string) {
    const { error } = await api.PUT('/collections/{id}', {
      params: { path: { id } },
      body: { name, description },
    })
    if (error) throw new Error('Failed to update collection')
    const existing = collections.value.find((c) => c.id === id)
    if (existing) Object.assign(existing, { name, description })
  }

  async function remove(id: string) {
    const { error } = await api.DELETE('/collections/{id}', {
      params: { path: { id } },
    })
    if (error) throw new Error('Failed to delete collection')
    collections.value = collections.value.filter((c) => c.id !== id)
  }

  async function unlock(id: string, passphrase: string): Promise<boolean> {
    const { data, error } = await api.POST('/collections/{id}/unlock', {
      params: { path: { id } },
      body: { passphrase },
    })
    if (error || !data?.success) return false
    const existing = collections.value.find((c) => c.id === id)
    if (existing) existing.is_unlocked = true
    return true
  }

  return { collections, loading, fetchAll, create, update, remove, unlock }
})
