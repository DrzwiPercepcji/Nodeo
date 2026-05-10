import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'

const postMock = vi.fn()
const getMock = vi.fn()

vi.mock('@/api', () => ({
  default: {
    POST: (...args: unknown[]) => postMock(...args),
    GET: (...args: unknown[]) => getMock(...args),
    use: vi.fn(),
  },
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('login stores token and username on success', async () => {
    postMock.mockResolvedValue({ data: { token: 'jwt-token' }, error: undefined, response: { status: 200 } })
    const store = useAuthStore()
    await store.login('alice', 'secret')
    expect(store.token).toBe('jwt-token')
    expect(store.username).toBe('alice')
    expect(localStorage.getItem('nodeo_token')).toBe('jwt-token')
  })

  it('login throws when API returns error', async () => {
    postMock.mockResolvedValue({ data: undefined, error: { error: 'Unauthorized' }, response: { status: 401 } })
    const store = useAuthStore()
    await expect(store.login('a', 'b')).rejects.toThrow('Unauthorized')
  })

  it('logout clears token and storage', async () => {
    postMock.mockResolvedValue({ data: { token: 't' }, error: undefined, response: { status: 200 } })
    const store = useAuthStore()
    await store.login('u', 'p')
    store.logout()
    expect(store.token).toBe('')
    expect(store.username).toBe('')
    expect(localStorage.getItem('nodeo_token')).toBeNull()
  })
})
