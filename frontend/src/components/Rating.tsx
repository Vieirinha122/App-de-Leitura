import { ThumbsUp, ThumbsDown, Minus } from 'lucide-react'
import { type Rating } from '@/types/domain'

type RatingOption = {
  value: Rating
  label: string
  icon: React.ReactNode
  description: string
}

const options: RatingOption[] = [
  {
    value: 'like',
    label: 'Muito bom',
    icon: <ThumbsUp className="h-5 w-5" />,
    description: 'Aprendi algo valioso'
  },
  {
    value: 'neutral',
    label: 'Interessante',
    icon: <Minus className="h-5 w-5" />,
    description: 'Valeu a leitura'
  },
  {
    value: 'dislike',
    label: 'Não gostei',
    icon: <ThumbsDown className="h-5 w-5" />,
    description: 'Não foi relevante pra mim'
  }
]

interface RatingProps {
  value: Rating | null
  onChange: (rating: Rating) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function Rating({ value, onChange, disabled, size = 'md' }: RatingProps) {
  const sizeClasses = {
    sm: 'gap-1.5 p-1.5',
    md: 'gap-2 p-2',
    lg: 'gap-3 p-3'
  }

  const buttonSizes = {
    sm: 'p-2 text-xs',
    md: 'p-3 text-sm',
    lg: 'p-4 text-base'
  }

  return (
    <div className={`flex items-center ${sizeClasses[size]}`} role="radiogroup" aria-label="Avaliar artigo">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => !disabled && onChange(option.value)}
          className={`
            relative flex flex-col items-center gap-1.5 rounded-xl border-2 transition-all duration-200
            ${buttonSizes[size]}
            ${value === option.value
              ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-[0_0_0_2px_rgb(245_158_11/0.3)]'
              : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50 active:scale-[0.98]'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <span className="flex items-center justify-center" aria-hidden="true">
            {option.icon}
          </span>
          <span className="font-medium">{option.label}</span>
          <span className="text-caption text-ink-500 hidden sm:block">{option.description}</span>
        </button>
      ))}
    </div>
  )
}