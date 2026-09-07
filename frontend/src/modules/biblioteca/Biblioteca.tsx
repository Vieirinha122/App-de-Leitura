import { Library } from 'lucide-react'

export default function BibliotecaPlaceholder() {
  return (
    <div className="container-narrow py-12 text-center">
      <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-ink-100 flex items-center justify-center">
        <Library className="h-10 w-10 text-ink-400" />
      </div>
      <h2 className="font-display text-display-md text-ink-900 mb-3">Biblioteca</h2>
      <p className="text-body-lg text-ink-500 mb-6 max-w-prose mx-auto">
        Seus artigos salvos e lidos — em desenvolvimento (ONDA 3)
      </p>
      <p className="text-body-sm text-ink-400">Módulo será implementado na próxima onda</p>
    </div>
  )
}