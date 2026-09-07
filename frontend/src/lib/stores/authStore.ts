import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { apiFetch, apiFetchVoid } from '@/lib/api/client'

export type User = {
  id: string
  name: string
  email: string
  createdAt: string
}

type AuthState = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await apiFetch<{ user: User }>('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
          })
          set({ user: data.user, isAuthenticated: true })
        } catch (error) {
          if (error instanceof Error) {
            set({ error: error.message })
          }
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await apiFetch<{ user: User }>('/api/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
          })
          set({ user: data.user, isAuthenticated: true })
        } catch (error) {
          if (error instanceof Error) {
            set({ error: error.message })
          }
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      logout: async () => {
        set({ isLoading: true })
        try {
          await apiFetchVoid('/api/v1/auth/logout', { method: 'POST' })
        } finally {
          set({ user: null, isAuthenticated: false, isLoading: false, error: null })
        }
      },

      checkAuth: async () => {
        try {
          const { data } = await apiFetch<User>('/api/v1/auth/me')
          set({ user: data, isAuthenticated: true })
        } catch {
          set({ user: null, isAuthenticated: false })
        }
      }
    }),
    {
      name: 'daily-read-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)