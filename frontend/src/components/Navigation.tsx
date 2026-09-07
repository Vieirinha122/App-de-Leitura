import { NavLink, useLocation } from 'react-router-dom'
import { BookOpen, Library, History, Rss, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { path: '/hoje', label: 'Hoje', icon: BookOpen },
  { path: '/biblioteca', label: 'Biblioteca', icon: Library },
  { path: '/historico', label: 'Histórico', icon: History },
  { path: '/fontes', label: 'Fontes', icon: Rss }
] as const

export default function Navigation() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <nav className="container-narrow" aria-label="Navegação principal">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <NavLink to="/hoje" className="flex items-center gap-2 shrink-0" aria-label="Daily Read - Início">
            <span className="font-display text-display-sm text-ink-900 font-semibold tracking-tight">
              Daily Read
            </span>
            <span className="hidden sm:inline-block h-5 w-px bg-ink-200" aria-hidden="true" />
            <span className="hidden sm:inline text-overline text-ink-500 font-medium">
              Leitura diária
            </span>
          </NavLink>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-body-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-ink-100 text-ink-900'
                      : 'text-ink-500 hover:text-ink-700 hover:bg-ink-50'
                  }`
                }
                aria-current={location.pathname === item.path ? 'page' : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg text-ink-500 hover:text-ink-700 hover:bg-ink-50 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile navigation */}
        {mobileOpen && (
          <div id="mobile-nav" className="md:hidden py-4 animate-slide-down">
            <nav className="flex flex-col gap-1" aria-label="Navegação mobile">
              {navigation.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg text-body font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-ink-100 text-ink-900'
                        : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50'
                    }`
                  }
                  aria-current={location.pathname === item.path ? 'page' : undefined}
                >
                  <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </nav>
    </header>
  )
}