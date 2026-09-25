import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/modules': path.resolve(__dirname, 'src/modules'),
      '@/lib': path.resolve(__dirname, 'src/lib'),
      '@/routes': path.resolve(__dirname, 'src/routes'),
      '@/jobs': path.resolve(__dirname, 'src/jobs'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
    setupFiles: [],
  },
})