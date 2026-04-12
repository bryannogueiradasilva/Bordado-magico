import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
base: '/',

plugins: [
react(),
tailwindcss()
],

resolve: {
alias: {
'@': path.resolve(__dirname),
},
},

server: {
host: true,
allowedHosts: ['.run.app'],
},

preview: {
host: true,
port: 8080,
},

build: {
outDir: 'dist',
}
})
