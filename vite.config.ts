import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Injects the list of built files into dist/sw.js so the service worker can
 * precache the whole app shell on install (offline from the first visit).
 * public/sw.js carries two placeholders: the precache list and the cache version.
 */
function swPrecache(): Plugin {
  let outDir = 'dist'
  return {
    name: 'palestra-sw-precache',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js')
      if (!existsSync(swPath)) return
      const files: string[] = []
      const walk = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, e.name)
          if (e.isDirectory()) walk(p)
          else files.push('/' + relative(outDir, p).split('\\').join('/'))
        }
      }
      walk(outDir)
      const list = ['/', ...files.filter((f) => f !== '/sw.js' && f !== '/index.html' && !f.endsWith('.map')).sort()]
      const version = createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 12)
      const src = readFileSync(swPath, 'utf8')
        .replace('/*__PRECACHE__*/[]', JSON.stringify(list))
        .replace('/*__VERSION__*/dev', version)
      writeFileSync(swPath, src)
    },
  }
}

// Firestore (~150 KB gzip) is its own lazy chunk, loaded only after the owner
// check (src/App.tsx → src/ui/app/firestoreRepo.ts). The warning limit is raised
// to fit that single SDK chunk; the DoD budget (350 KB gzip total) is checked by `npm run size`.
export default defineConfig({
  plugins: [react(), swPrecache()],
  build: {
    chunkSizeWarningLimit: 600,
  },
})
