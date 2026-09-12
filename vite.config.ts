import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  appType: 'mpa',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        work: fileURLToPath(new URL('./work/index.html', import.meta.url)),
      },
    },
  },
  plugins: [
    {
      name: 'work-page',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/work') {
            res.statusCode = 302
            res.setHeader('Location', '/work/')
            res.end()
            return
          }
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/work') {
            res.statusCode = 302
            res.setHeader('Location', '/work/')
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
})
