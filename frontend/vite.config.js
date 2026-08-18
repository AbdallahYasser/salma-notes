import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Backend runs separately in dev (uvicorn src.main:app --port 8080).
    // Proxying keeps frontend + API on the same origin so the auth cookie
    // behaves the same as production, where FastAPI serves the built SPA.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
