import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import { useAuthStore } from '@/lib/stores/authStore'

export default function ShellHost() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      <Navigation />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <footer className="border-t border-ink-200 bg-white py-6">
        <div className="container-narrow text-center text-caption text-ink-500">
          Daily Read &mdash; Sua leitura diária de tecnologia, IA e programação
        </div>
      </footer>
    </div>
  )
}