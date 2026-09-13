import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({})
      }
    })
  })
}

/**
 * Runs the files in /api during `npm run dev` the way Vercel runs them in
 * production, so the online mode is playable across browser tabs locally —
 * no Vercel CLI, no credentials (api/_lib/kv.ts falls back to memory).
 */
function apiDevServer(): Plugin {
  return {
    name: 'imposter-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
        if (!pathname.startsWith('/api/')) return next()
        // Anything under _lib is a helper, never an endpoint.
        if (pathname.includes('/_')) return next()

        const file = `${root}api${pathname.slice(4)}.ts`
        if (!existsSync(file)) return next()

        void (async () => {
          try {
            const url = new URL(req.url ?? '/', 'http://localhost')
            const shim = req as IncomingMessage & { query: unknown; body: unknown }
            shim.query = Object.fromEntries(url.searchParams)
            shim.body = req.method === 'POST' ? await readBody(req) : {}

            const out = res as ServerResponse & {
              status: (code: number) => unknown
              json: (body: unknown) => void
            }
            out.status = (code: number) => {
              res.statusCode = code
              return out
            }
            out.json = (body: unknown) => {
              if (!res.headersSent) res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(body))
            }

            const mod = await server.ssrLoadModule(file)
            await (mod.default as (a: unknown, b: unknown) => unknown)(req, out)
          } catch (error) {
            server.ssrFixStacktrace(error as Error)
            if (!res.headersSent) res.statusCode = 500
            res.end(JSON.stringify({ error: (error as Error).message }))
          }
        })()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDevServer()],
  server: { host: true, port: 5173 },
})
