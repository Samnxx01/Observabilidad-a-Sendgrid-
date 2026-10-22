import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    // En desarrollo, /api se reenvia al backend (server-bus/backend, PORT=8080)
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
