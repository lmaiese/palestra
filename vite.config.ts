import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Firestore (~150 KB gzip) is its own lazy chunk, loaded only after the owner
// check (src/App.tsx → src/ui/app/firestoreRepo.ts). The warning limit is raised
// to fit that single SDK chunk; the DoD budget (350 KB gzip total) is checked by `npm run size`.
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
  },
})
