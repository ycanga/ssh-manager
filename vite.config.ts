import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['keytar', 'ssh2'],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            rollupOptions: {
              external: ['keytar', 'ssh2'],
            },
          },
        },
      },
    }),
  ],
  build: {
    rollupOptions: {
      external: ['electron', 'keytar', 'ssh2'],
    },
  },
})

