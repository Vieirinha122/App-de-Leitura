import { NavLink, useLocation } from 'react-router-dom'
import { BookOpen, Library, History, Rss, Menu, X, LogOut, User, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useUIStore } from '@/lib/stores/uiStore'
import { formatDate } from '@/lib/utils/date'

const navigation = [
  { path: '/hoje', label: 'Hoje', icon: BookOpen },
  { path: '/biblioteca', label: 'Biblioteca', icon: Library },
  { path: '/historico', label: 'Histórico', icon: History },
  { path: '/fontes', label: 'Fontes', icon: Rss }
] as const

export default function Navigation() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { user, isAuthenticated, logout } = useAuthStore()
  const { addToast } = useUIStore()

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setUserMenuOpen(false)
    try {
      await logout()
      addToast({ type: 'success', title: 'Saiu da conta', message: 'Até a próxima!' })
    } catch {
      addToast({ type: 'error', title: 'Erro', message: 'Não foi possível sair' })
    }
  }

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

          {/* User menu / Auth actions */}
          <div className="flex items-center gap-2 ml-auto">
            {isAuthenticated && user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-body-sm font-medium text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition-colors"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  aria-label="Menu do usuário"
                >
                  <div className="h-8 w-8 rounded-full bg-ink-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-ink-600" />
                  </div>
                  <span className="hidden sm:inline-block max-w-[120px] truncate">{user.name}</span>
                  <ChevronDown className={`h-4 w-4 text-ink-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 card shadow-elevated py-1 animate-fade-in" role="menu">
                    <div className="px-3 py-2 border-b border-ink-100">
                      <p className="text-body-sm font-medium text-ink-900 truncate">{user.name}</p>
                      <p className="text-caption text-ink-500 truncate">{user.email}</p>
                      {user.createdAt && (
                        <p className="text-caption text-ink-400 mt-1">Membro desde {formatDate(user.createdAt)}</p>
                      )}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-body-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            )}
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

              {isAuthenticated && user && (
                <div className="pt-2 border-t border-ink-200">
                  <div className="px-3 py-2">
                    <p className="text-body-sm font-medium text-ink-900">{user.name}</p>
                    <p className="text-caption text-ink-500">{user.email}</p>
                    {user.createdAt && (
                      <p className="text-caption text-ink-400 mt-0.5">Membro desde {formatDate(user.createdAt)}</p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-3 text-body font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors w-full"
                  >
                    <LogOut className="h-5 w-5" />
                    Sair
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
      </nav>
    </header>
  )
}