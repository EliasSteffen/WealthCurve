import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { quotesApi } from './server/vitePlugin.ts'

export default defineConfig({
  // quotesApi bedient /api/quotes schon im Dev-Server - ohne das bräuchte es
  // `vercel dev`, nur um einen Kursverlauf zu sehen.
  plugins: [react(), tailwindcss(), quotesApi()],
  resolve: {
    // Tests liegen unter test/ und spiegeln src/ - ohne Alias würden ihre
    // Importe zu ../../../src/... und bei jeder Verschiebung brechen.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts?(x)'],
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
})
