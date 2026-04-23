import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: "localhost",
    port: 5188,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:4001",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:4001",
        changeOrigin: true,
      },
    },
  },
})
