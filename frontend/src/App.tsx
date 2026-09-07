import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ShellHost from '@/app/ShellHost'
import LoadingFallback from '@/components/LoadingFallback'

// Lazy-loaded modules - code splitting per feature
const Hoje = lazy(() => import('@/modules/hoje'))
const Biblioteca = lazy(() => import('@/modules/biblioteca'))
const Historico = lazy(() => import('@/modules/historico'))
const Fontes = lazy(() => import('@/modules/fontes'))

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public routes (if any) */}
        {/* Authenticated routes under ShellHost */}
        <Route path="/" element={<ShellHost />}>
          <Route index element={<Navigate to="/hoje" replace />} />
          <Route path="hoje" element={<Hoje />} />
          <Route path="biblioteca" element={<Biblioteca />} />
          <Route path="historico" element={<Historico />} />
          <Route path="fontes" element={<Fontes />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/hoje" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App