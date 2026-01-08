import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/SCS-Dangjian-Study-Room-Booking', 
  build: {
    outDir: 'dist',
  }
})