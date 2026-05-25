import { defineConfig, type PluginOption, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, statSync, createReadStream } from 'node:fs'
import { resolve, normalize, join } from 'node:path'

// Optional: mount external game projects at /games/<name>/...
// Configure via env var:
//   GAMES_ROOT=C:\Users\kimok\Downloads\games  (folder containing per-game client dirs)
// Then a request to /games/big-bait/compiled/index_local.html serves
//   <GAMES_ROOT>/big-bait/client/compiled/index_local.html
// Anything under /games/big-bait/... resolves to <GAMES_ROOT>/big-bait/client/...
// so relative references like ../node_modules/... from compiled/ work.

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.mp4':  'video/mp4',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.atlas': 'text/plain; charset=utf-8',
  '.skel':  'application/octet-stream',
  '.spine': 'application/json; charset=utf-8',
  '.txt':   'text/plain; charset=utf-8',
}

function gamesStaticPlugin(gamesRoot: string | undefined): PluginOption {
  return {
    name: 'games-static',
    configureServer(server: ViteDevServer) {
      if (gamesRoot === undefined) return
      const root = resolve(gamesRoot)
      server.middlewares.use('/games', (req, res, next) => {
        const rawUrl = req.url ?? ''
        const pathPart = rawUrl.split('?')[0].split('#')[0]
        const decoded = decodeURIComponent(pathPart.replace(/^\/+/, ''))
        const slash = decoded.indexOf('/')
        if (slash === -1) {
          next()
          return
        }
        const gameName = decoded.slice(0, slash)
        const sub = decoded.slice(slash + 1)
        // Sandbox: resolve against per-game client folder, refuse traversal outside it
        const baseDir = normalize(join(root, gameName, 'client'))
        const target = normalize(join(baseDir, sub))
        if (!target.startsWith(baseDir)) {
          res.writeHead(403)
          res.end('forbidden')
          return
        }
        if (!existsSync(target) || !statSync(target).isFile()) {
          next()
          return
        }
        const ext = (target.match(/\.[^./\\]+$/)?.[0] ?? '').toLowerCase()
        const mime = MIME[ext] ?? 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' })
        createReadStream(target).pipe(res)
      })
    },
  }
}

const GAMES_ROOT = process.env.GAMES_ROOT

export default defineConfig({
  plugins: [
    react(),
    gamesStaticPlugin(GAMES_ROOT),
  ],
  server: {
    fs: {
      allow: [
        resolve('.'),
        ...(GAMES_ROOT ? [resolve(GAMES_ROOT)] : []),
      ],
    },
  },
})
