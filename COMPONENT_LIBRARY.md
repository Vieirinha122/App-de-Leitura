# Component Library — Direção (Orbi Forge Style)

## Princípio
Componentes base inspirados no **shadcn/ui** (Radix primitives + Tailwind), mas **sem cara de IA genérica**:
- Paleta própria (ink/amber/sage) — **nunca** slate/zinc default
- Tipografia com identidade: **Fraunces** (display) + **DM Sans** (UI) + **JetBrains Mono** (code)
- Densidade editorial — não "dashboard genérico com shadow-lg em tudo"
- Motion intencional (spring, não ease-out genérico)
- Cada componente tem `className` pass-through para customização

## Estrutura alvo
```
src/components/
├── ui/                 # Primitivos base (Button, Input, Card, Badge, etc.)
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── tooltip.tsx
│   ├── dropdown-menu.tsx
│   ├── dialog.tsx
│   ├── toast.tsx
│   ├── avatar.tsx
│   ├── separator.tsx
│   ├── skeleton.tsx
│   └── index.ts        # Barrel export
├── forms/              # Compostos de formulário (FormField, Select, Textarea, etc.)
├── navigation/         # Breadcrumbs, Pagination, Tabs
├── feedback/           # Alert, Progress, ToastContainer
└── data-display/       # Table, List, CardGrid, EmptyState
```

## Componentes já na casca (mover para `ui/` depois)
- `Button` variants: `primary`, `secondary`, `ghost`, `accent`, `outline-accent`
- `Input` + `Label`
- `Badge` variants: `neutral`, `accent`, `sage`, `success`, `warning`, `error`
- `Card` + `CardHover`
- `Rating` (custom, não shadcn)
- `ToastContainer` + `useUIStore.toasts`
- `Navigation` (custom, não shadcn)
- `LoadingFallback`

## Convenções de código
```tsx
// Sempre: forwardRef + className pass-through + clsx/twMerge
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'outline-accent'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-ui font-medium rounded-lg transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
```

## Radix primitives a usar (instalar na ONDA 1)
- `@radix-ui/react-slot` (para `Slot` no Button)
- `@radix-ui/react-dialog` (Dialog, AlertDialog)
- `@radix-ui/react-dropdown-menu` (DropdownMenu)
- `@radix-ui/react-tooltip` (Tooltip)
- `@radix-ui/react-toast` (Toast) — ou manter nosso `ToastContainer` custom
- `@radix-ui/react-avatar` (Avatar)
- `@radix-ui/react-separator` (Separator)
- `@radix-ui/react-label` (Label)
- `@radix-ui/react-select` (Select)
- `@radix-ui/react-tabs` (Tabs)
- `@radix-ui/react-scroll-area` (ScrollArea)

## Não usar
- `lucide-react` icons em todo lugar sem critério — usar SVG inline ou `lucide` só onde faz sentido semântico
- `shadow-lg` / `shadow-xl` como default — usar `shadow-card`, `shadow-elevated`, `shadow-soft`
- `rounded-lg` em tudo — `rounded-xl` para cards, `rounded-lg` para buttons/inputs, `rounded-full` para badges/avatars
- Whitespace excessivo (`space-y-8`, `p-8` em mobile) — densidade `space-y-4` / `p-4` base

## Referência visual: Orbi Forge
- Tipografia serifada em headlines, sans limpa em UI
- Cor de destaque (amber) só em ações primárias e links
- Bordas sutis (`border-ink-200`), não linhas pesadas
- Micro-interações: `active:scale-[0.98]`, `hover:-translate-y-0.5` em cards
- Dark mode futuro: inverter ink/ink-50, manter amber/sage funcionais

---

**Próximo passo:** Na ONDA 1, extrair os componentes atuais para `src/components/ui/` com a convenção acima, instalar Radix primitives necessários, e criar o `cn` utility (clsx + tailwind-merge).