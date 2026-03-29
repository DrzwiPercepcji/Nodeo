import createClient from 'openapi-fetch'
import type { paths } from './schema'

const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL || '/api',
})

api.use({
  async onRequest({ request }) {
    const token = localStorage.getItem('nodeo_token')
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
})

export default api
