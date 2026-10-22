import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Même origine pour le front et l'API en dev : pas de CORS, cookies simples, SSE sans configuration.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
