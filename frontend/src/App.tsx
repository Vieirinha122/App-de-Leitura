import { lazy, Suspense, useEffect, useRef } from 'react'
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
const Onboarding = lazy(() => import('@/modules/onboarding'))

// Loading wrapper for auth routes (no shell)
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-50">
      {children}
    </div>
  )
}

// Protected route wrapper - redireciona para /login se não autenticado
// e para /boas-vindas se autenticado mas sem onboarding completo
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Usuário autenticado sem onboarding completo → força onboarding
  if (!user?.onboardingCompleted) {
    return <Navigate to="/boas-vindas" replace />
  }

  return <>{children}</>
}

// Layout de onboarding: só checa autenticação, NÃO verifica onboardingCompleted
// (senão criaria loop infinito redirecionando /boas-vindas → /boas-vindas)
function ProtectedNoNavLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return (
    <div className="min-h-screen bg-ink-50">
      {children}
    </div>
  )
}

// Wrapper that runs checkAuth once on app mount (page reload).
// Uses a ref to capture the *initial* persisted value so that a fresh login
// does not trigger a redundant /me call (which can fail on mobile with
// cross-site cookies not yet available).
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const checkAuth = useAuthStore((s) => s.checkAuth)
  const initialAuth = useRef(useAuthStore.getState().isAuthenticated)

  useEffect(() => {
    if (initialAuth.current) {
      checkAuth()
    }
  }, [checkAuth])

  return <>{children}</>
}

function App() {
  return (
    <AuthInitializer>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<AuthLayout><Auth /></AuthLayout>} />
          <Route path="/register" element={<AuthLayout><Auth /></AuthLayout>} />

          {/* Protected onboarding without Navigation header */}
          <Route
            path="/boas-vindas"
            element={<ProtectedNoNavLayout><Onboarding /></ProtectedNoNavLayout>}
          />

          {/* Protected routes under ShellHost (with Navigation) */}
          <Route path="/" element={<ShellHost />}>
            <Route index element={<Navigate to="/hoje" replace />} />
            <Route
              path="hoje"
              element={<ProtectedRoute><Hoje /></ProtectedRoute>}
            />
            <Route
              path="biblioteca"
              element={<ProtectedRoute><Biblioteca /></ProtectedRoute>}
            />
            <Route
              path="historico"
              element={<ProtectedRoute><Historico /></ProtectedRoute>}
            />
            <Route
              path="fontes"
              element={<ProtectedRoute><Fontes /></ProtectedRoute>}
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/hoje" replace />} />
        </Routes>
      </Suspense>
    </AuthInitializer>
  )
}

export default App