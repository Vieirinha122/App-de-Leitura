import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useUIStore } from '@/lib/stores/uiStore'

type FormMode = 'login' | 'register'

export default function AuthPage() {
  const navigate = useNavigate()
  const { login, register, isLoading: authLoading, error: authError, clearError } = useAuthStore()
  const { addToast } = useUIStore()

  const [mode, setMode] = useState<FormMode>('login')
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof formData>>({})

  const validateForm = (): boolean => {
    const newErrors: Partial<typeof formData> = {}

    if (mode === 'register' && !formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido'
    }
    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Senha deve ter pelo menos 8 caracteres'
    }
    if (mode === 'register' && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Senhas não conferem'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    clearError()

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password)
      } else {
        await register(formData.name, formData.email, formData.password)
      }
      addToast({ type: 'success', title: mode === 'login' ? 'Bem-vindo de volta!' : 'Conta criada com sucesso!' })
      navigate('/hoje')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao autenticar'
      addToast({ type: 'error', title: 'Erro', message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const switchMode = () => {
    setMode(prev => prev === 'login' ? 'register' : 'login')
    setErrors({})
    clearError()
  }

  const isSubmitDisabled = isSubmitting || authLoading

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
            <span className="font-display text-display-lg text-ink-900 font-semibold">Daily Read</span>
          <h1 className="font-display text-display-md text-ink-900 mb-2">
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </h1>
          <p className="text-body text-ink-500">
            {mode === 'login'
              ? 'Acesse sua leitura diária de tecnologia e IA'
              : 'Comece sua jornada de leitura diária'}
          </p>
        </div>

        {/* Form card */}
        <div className="card p-6 sm:p-8 animate-fade-in">
          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-body-sm" role="alert">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="label">Nome</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={e => handleChange('name', e.target.value)}
                  className={`input ${errors.name ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                  placeholder="Seu nome"
                  autoComplete="name"
                  disabled={isSubmitDisabled}
                  aria-invalid={errors.name ? 'true' : 'false'}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                />
                {errors.name && (
                  <p id="name-error" className="mt-1 text-caption text-rose-600" role="alert">{errors.name}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                className={`input ${errors.email ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                placeholder="seu@email.com"
                autoComplete="email"
                disabled={isSubmitDisabled}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-caption text-rose-600" role="alert">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={e => handleChange('password', e.target.value)}
                  minLength={8}
                  maxLength={128}
                  className={`input pr-12 ${errors.password ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  disabled={isSubmitDisabled}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="mt-1 text-caption text-ink-600">Senha deve ter pelo menos 8 caracteres</p>
              )}
              {errors.password && (
                <p id="password-error" className="mt-1 text-caption text-rose-600" role="alert">{errors.password}</p>
              )}
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="confirmPassword" className="label">Confirmar senha</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={e => handleChange('confirmPassword', e.target.value)}
                  className={`input ${errors.confirmPassword ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isSubmitDisabled}
                  aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                  aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
                />
                {errors.confirmPassword && (
                  <p id="confirm-error" className="mt-1 text-caption text-rose-600" role="alert">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3 text-body"
              disabled={isSubmitDisabled}
            >
              {isSubmitDisabled ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{mode === 'login' ? 'Entrando...' : 'Criando conta...'}</span>
                </>
              ) : (
                mode === 'login' ? 'Entrar' : 'Criar conta'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-body-sm text-ink-500">
            {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'} {' '}
            <button
              type="button"
              onClick={switchMode}
              className="link font-medium"
            >
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-caption text-ink-400">
          Ao continuar, você concorda com nossos{' '}
          <a href="#" className="link">Termos de Uso</a>{' '}
          e{' '}
          <a href="#" className="link">Política de Privacidade</a>
        </p>
      </div>
    </div>
  )
}