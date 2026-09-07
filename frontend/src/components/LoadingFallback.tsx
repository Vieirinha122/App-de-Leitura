export default function LoadingFallback() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <svg
            className="h-12 w-12 text-ink-200"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
              className="animate-spin"
            />
          </svg>
          <svg
            className="absolute inset-0 h-12 w-12 text-amber-500"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="animate-spin"
            />
          </svg>
        </div>
        <p className="text-body text-ink-500">Carregando...</p>
      </div>
    </div>
  )
}