import { Outlet } from 'react-router-dom'
import Navigation from '@/components/Navigation'

export default function ShellHost() {
  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      <Navigation />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  )
}