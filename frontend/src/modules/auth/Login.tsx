import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Mail, Lock, User } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useUIStore } from '@/lib/stores/uiStore'

type FormMode = 'login' | 'register' | 'reset'

// Calcula número da edição baseado no dia do ano (1-366)
function getEditionNumber(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  return Math.floor(diff / 86400000)
}

interface FormConfig {
  title: string
  subtitle: string
  showName: boolean
  showConfirmPassword: boolean
  showForgotLink: boolean
  showEmail: boolean
  submitLabel: string
  submitLoadingLabel: string
  switchLabel: string
  switchTarget: FormMode
  switchText: string
  apiEndpoint: string
  apiSuccessMessage: string
  redirectTo: string
}

const MODE_CONFIG: Record<FormMode, FormConfig> = {
  login: {
    title: 'Entrar',
    subtitle: 'Acesse sua leitura diária de tecnologia e IA',
    showName: false,
    showConfirmPassword: false,
    showForgotLink: true,
    showEmail: true,
    submitLabel: 'Entrar',
    submitLoadingLabel: 'Entrando...',
    switchLabel: 'Criar conta',
    switchTarget: 'register',
    switchText: 'Não tem conta?',
    apiEndpoint: '/api/v1/auth/login',
    apiSuccessMessage: 'Bem-vindo de volta!',
    redirectTo: '/hoje'
  },
  register: {
    title: 'Criar conta',
    subtitle: 'Comece sua jornada de leitura diária',
    showName: true,
    showConfirmPassword: true,
    showForgotLink: false,
    showEmail: true,
    submitLabel: 'Criar conta',
    submitLoadingLabel: 'Criando conta...',
    switchLabel: 'Entrar',
    switchTarget: 'login',
    switchText: 'Já tem conta?',
    apiEndpoint: '/api/v1/auth/register',
    apiSuccessMessage: 'Conta criada com sucesso!',
    redirectTo: '/boas-vindas'
  },
  reset: {
    title: 'Nova senha',
    subtitle: 'Digite a nova senha',
    showName: false,
    showConfirmPassword: true,
    showForgotLink: false,
    showEmail: false,
    submitLabel: 'Salvar nova senha',
    submitLoadingLabel: 'Salvando...',
    switchLabel: 'Voltar ao login',
    switchTarget: 'login',
    switchText: 'Lembrou a senha?',
    apiEndpoint: '/api/v1/auth/reset-password',
    apiSuccessMessage: 'Senha redefinida com sucesso!',
    redirectTo: '/login'
  }
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { login, register, isLoading: authLoading, clearError } = useAuthStore()
  const { addToast } = useUIStore()

  const [mode, setMode] = useState<FormMode>('login')
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof formData>>({})
  const editionNumber = getEditionNumber()

  const config = MODE_CONFIG[mode]

  const validateForm = (): boolean => {
    const newErrors: Partial<typeof formData> = {}

    if (config.showName && !formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }
    if (config.showEmail) {
      if (!formData.email.trim()) {
        newErrors.email = 'Email é obrigatório'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Email inválido'
      }
    }
    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Senha deve ter pelo menos 8 caracteres'
    }
    if (config.showConfirmPassword && formData.password !== formData.confirmPassword) {
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

    const emailNormalizado = formData.email.trim().toLowerCase()

    try {
      const body = config.showName
        ? { name: formData.name, email: emailNormalizado, password: formData.password }
        : { email: emailNormalizado, password: formData.password, confirmPassword: formData.confirmPassword }

      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        // Erro de validação do backend (ex: domínio não permitido)
        if (data.fields) {
          const fieldErrors: Partial<typeof formData> = {}
          for (const [field, messages] of Object.entries(data.fields)) {
            const key = field.replace('body.', '') as keyof typeof formData
            if (key in formData) {
              fieldErrors[key] = Array.isArray(messages) ? messages[0] : String(messages)
            }
          }
          setErrors(fieldErrors)
          return
        }
        throw new Error(data.message || 'Erro ao processar')
      }

      // Login/registro usam o store para setar cookies/estado
      if (mode === 'login') {
        await login(emailNormalizado, formData.password)
      } else if (mode === 'register') {
        await register(formData.name, emailNormalizado, formData.password)
      }
      // Reset direto não precisa chamar store — a rota já atualizou a senha no banco

      addToast({ type: 'success', title: config.apiSuccessMessage })
      // No reset, volta pro modo login antes de navegar (mesma rota não remonta)
      if (mode === 'reset') {
        setMode('login')
      }
      setTimeout(() => navigate(config.redirectTo, { replace: true }), 0)
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

  const switchMode = (target?: FormMode) => {
    const nextMode = target ?? config.switchTarget
    
    // Ao ir para reset, preserva o email digitado no login e limpa senhas
    if (nextMode === 'reset') {
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }))
    } else {
      // Ao voltar do reset para login, limpa senhas mas mantém email
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }))
    }
    
    setMode(nextMode)
    setErrors({})
    clearError()
  }

  const isSubmitDisabled = isSubmitting || authLoading

  return (
    <div className="min-h-screen flex bg-ink-50">
      {/* Painel esquerdo — editorial, só desktop */}
      <aside className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden">
        {/* Imagem de fundo */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/login-hero.webp"
            alt="Livro aberto sob luz da manhã — seu refúgio de leitura diária"
            className="w-full h-full object-cover"
            loading="eager"
          />
          {/* Overlay gradiente escuro para legibilidade do texto */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/95 via-ink-900/80 to-ink-800/40" />
        </div>

        {/* Conteúdo editorial por cima da imagem */}
        <div className="relative z-10 flex flex-col h-full p-8 sm:p-12 lg:p-16 xl:p-20 text-ink-50">
          {/* Topo: marca + edição */}
          <div className="flex flex-col items-start gap-2 mb-4 animate-fade-in">
            <span className="font-display text-display-lg font-semibold tracking-tight">Daily Read</span>
            <div className="flex items-center gap-3 text-caption uppercase tracking-wider text-amber-300/90">
              <span>EDIÇÃO Nº</span>
              <span className="font-mono text-amber-400">{String(editionNumber).padStart(4, '0')}</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Feed Sincronizado</span>
            </div>
          </div>

          {/* Meio: espaço respirável — o conteúdo "empurra" o card para baixo */}
          <div className="flex-1 flex flex-col justify-between">
            {/* Espaço vazio intencional — ritmo editorial */}

            {/* Card de artigo ilustrativo (design material) */}
            <article className="animate-slide-up stagger-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 sm:p-6 max-w-xs">
              <div className="flex items-center gap-2 text-caption uppercase tracking-wider text-amber-300/80 mb-3">
                <span>Artigo do dia</span>
              </div>
              <h3 className="font-display text-display-sm font-medium leading-snug mb-3">
                Como a IA está redefinindo o futuro do trabalho criativo
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-caption text-ink-300/80">
                <span>MIT Technology Review</span>
                <span>7 min de leitura</span>
              </div>
            </article>
          </div>

          {/* Rodapé: promessa da marca */}
          <p className="text-body-sm text-ink-400/90 max-w-sm animate-fade-in stagger-3">
            Sua leitura diária curada das melhores fontes de tecnologia e IA.
            Sem ruído, sem algoritmo — só o que importa.
          </p>
        </div>
      </aside>

      {/* Painel direito — formulário */}
      <main className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 xl:p-16">
        <div className="w-full max-w-md">
          {/* Header da marca (mobile) / reforço (desktop) */}
          <div className="lg:hidden text-center mb-10 animate-fade-in">
            <span className="font-display text-display-lg text-ink-900 font-semibold">Daily Read</span>
            <p className="mt-1 text-caption uppercase tracking-wider text-amber-600">
              Edição Nº {String(editionNumber).padStart(4, '0')}
            </p>
          </div>

          {/* Card do formulário */}
          <div className="card p-6 sm:p-8 animate-slide-up">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {config.showName && (
                <div>
                  <label htmlFor="name" className="label flex items-center gap-2">
                    <User className="h-4.5 w-4.5 text-ink-400 shrink-0" aria-hidden="true" />
                    <span>Nome</span>
                  </label>
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

              {config.showEmail && (
                <div>
                  <label htmlFor="email" className="label flex items-center gap-2">
                    <Mail className="h-4.5 w-4.5 text-ink-400 shrink-0" aria-hidden="true" />
                    <span>Email</span>
                  </label>
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
              )}

              <div>
                <label htmlFor="password" className="label flex items-center gap-2">
                  <Lock className="h-4.5 w-4.5 text-ink-400 shrink-0" aria-hidden="true" />
                  <span>Senha</span>
                </label>
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
                {(mode === 'register' || mode === 'reset') && (
                  <p className="mt-1 text-caption text-ink-600">Senha deve ter pelo menos 8 caracteres</p>
                )}
                {errors.password && (
                  <p id="password-error" className="mt-1 text-caption text-rose-600" role="alert">{errors.password}</p>
                )}
              </div>

              {config.showConfirmPassword && (
                <div>
                  <label htmlFor="confirmPassword" className="label flex items-center gap-2">
                    <Lock className="h-4.5 w-4.5 text-ink-400 shrink-0" aria-hidden="true" />
                    <span>Confirmar senha</span>
                  </label>
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

              {config.showForgotLink && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="link text-body-sm"
                  >
                    Esqueci a senha?
                  </button>
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
                    <span>{config.submitLoadingLabel}</span>
                  </>
                ) : (
                  config.submitLabel
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-body-sm text-ink-500">
              {config.switchText} {' '}
              <button
                type="button"
                onClick={() => switchMode(config.switchTarget)}
                className="link font-medium"
              >
                {config.switchLabel}
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
      </main>
    </div>
  )
}