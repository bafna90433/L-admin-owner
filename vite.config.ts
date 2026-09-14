import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to every interface, so other PCs on the office wifi can open this
    // dev server by the machine's LAN address (not just localhost).
    host: true
  },
  preview: {
    host: true
  }
})
