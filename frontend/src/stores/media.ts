import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'
import type { components } from '@/api/schema'

type Media = components['schemas']['Media']

export const useMediaStore = defineStore('media', () => {
  const items = ref<Media[]>([])
  const loading = ref(false)

  async function fetchByCollection(collectionId: string) {
    loading.value = true
    try {
      const { data } = await api.GET('/collections/{id}/media', {
        params: { path: { id: collectionId } },
      })
      items.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function fetchSingle(id: string): Promise<Media | null> {
    const { data } = await api.GET('/media/{id}', { params: { path: { id } } })
    return data ?? null
  }

  async function remove(id: string) {
    const { error } = await api.DELETE('/media/{id}', { params: { path: { id } } })
    if (error) throw new Error('Failed to delete media')
    items.value = items.value.filter((m) => m.id !== id)
  }

  async function upload(
    collectionId: string,
    file: File,
    title: string,
    description: string,
    profile: string,
    onProgress?: (pct: number) => void,
  ): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title)
    formData.append('description', description)
    formData.append('profile', profile)

    const token = localStorage.getItem('nodeo_token') || ''
    const baseUrl = import.meta.env.VITE_API_URL || '/api'

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${baseUrl}/collections/${collectionId}/media`)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      }

      xhr.onload = () => {
        if (xhr.status === 202) {
          const data = JSON.parse(xhr.responseText)
          resolve(data.id as string)
        } else {
          reject(new Error(xhr.responseText || 'Upload failed'))
        }
      }

      xhr.onerror = () => reject(new Error('Network error'))
      xhr.send(formData)
    })
  }

  function streamUrl(mediaId: string): string {
    const token = localStorage.getItem('nodeo_token') || ''
    const baseUrl = import.meta.env.VITE_API_URL || '/api'
    return `${baseUrl}/media/${mediaId}/stream?token=${encodeURIComponent(token)}`
  }

  function thumbUrl(mediaId: string, frameIndex = 0): string {
    const token = localStorage.getItem('nodeo_token') || ''
    const baseUrl = import.meta.env.VITE_API_URL || '/api'
    const i = frameIndex > 0 ? `&i=${frameIndex}` : ''
    return `${baseUrl}/media/${mediaId}/thumb?token=${encodeURIComponent(token)}${i}`
  }

  return { items, loading, fetchByCollection, fetchSingle, remove, upload, streamUrl, thumbUrl }
})
