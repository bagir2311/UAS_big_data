import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  plugins: [
    react(), 
    viteSingleFile({ useRecommendedBuildConfig: false }) // Kita atur manual biar aman
  ],
  base: './', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000, // 100MB limit (paksa semua masuk)
    rollupOptions: {
      output: {
        manualChunks: undefined, // Jangan pecah file
      },
    },
  },
})