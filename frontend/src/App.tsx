import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ShellHost from '@/app/ShellHost'
import LoadingFallback from '@/components/LoadingFallback'
import { useAuthStore } from '@/lib/stores/authStore'

// Lazy-loaded modules - code splitting per feature
const Hoje = lazy(() => import('@/modules/hoje'))
const Biblioteca = lazy(() => import('@/modules/biblioteca'))
const Historico = lazy(() => import('@/modules/historico'))
const Fontes = lazy(() => import('@/modules/fontes'))
const Auth = lazy(() => import('@/modules/auth'))

// Loading wrapper for auth routes (no shell)
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-50">
      {children}
    </div>
  )
}

// Protected route wrapper - redirects to login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<AuthLayout><Auth /></AuthLayout>} />
        <Route path="/register" element={<AuthLayout><Auth /></AuthLayout>} />

        {/* Protected routes under ShellHost */}
        <Route path="/" element={<ShellHost />}>
          <Route index element={<Navigate to="/hoje" replace />} />
          <Route
            path="hoje"
            element={
              <ProtectedRoute>
                <Hoje />
              </ProtectedRoute>
            }
          />
          <Route
            path="biblioteca"
            element={
              <ProtectedRoute>
                <Biblioteca />
              </ProtectedRoute>
            }
          />
          <Route
            path="historico"
            element={
              <ProtectedRoute>
                <Historico />
              </ProtectedRoute>
            }
          />
          <Route
            path="fontes"
            element={
              <ProtectedRoute>
                <Fontes />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/hoje" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App