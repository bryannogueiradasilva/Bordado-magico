import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
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
      host: true, // 🔥 todos
      allowedHosts: [
        'site-bordado-magico-267339025814.us-central1.run.app',
        'site-bordado-magico-579156839935.us-central1.run.app',
        '.run.app' // 🔥 libera TODOS os domínios do Cloud Run
      ],
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
  };
});