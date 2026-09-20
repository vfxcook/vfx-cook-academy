import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here, '');
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8080';
  const proxy = { target: apiTarget, changeOrigin: true } as const;

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(here, 'src') }
    },
    server: {
      port: Number(env.VITE_PORT || 5173),
      proxy: {
        '/api': proxy,
        '/uploads': proxy,
        '/healthz': proxy,
        '/readyz': proxy
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      chunkSizeWarningLimit: 1200
    }
  };
});
