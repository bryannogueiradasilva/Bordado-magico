import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
const env = loadEnv(mode, '.', '');

return {
base: '/', // ✅ CORRETO

```
plugins: [
  react(),
  tailwindcss()
],

define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
},

resolve: {
  alias: {
    '@': path.resolve(__dirname, '.'),
  },
},

server: {
  host: true,
  allowedHosts: ['.run.app'],
  hmr: process.env.DISABLE_HMR !== 'true',
},

preview: {
  host: true,
  port: 8080,
},

build: {
  outDir: 'dist',
  sourcemap: false,
  minify: true,
},
```

};
});
