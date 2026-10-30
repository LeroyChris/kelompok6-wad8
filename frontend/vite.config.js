import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Expose API base to the client. Prefer VITE_API_BASE_URL; keep
// NEXT_PUBLIC_API_BASE_URL for backwards compatibility.
const apiBase =
  process.env.VITE_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'process.env.NEXT_PUBLIC_API_BASE_URL': JSON.stringify(apiBase),
  },
  envPrefix: ['VITE_', 'NEXT_PUBLIC'],
})
