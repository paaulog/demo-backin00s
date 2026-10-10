/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * GitHub Pages não permite cabeçalhos HTTP, então a CSP vai numa meta tag.
 * A origem das funções serverless (Vercel) entra no connect-src e no img-src no build.
 */
function cspPlugin(apiBase: string): Plugin {
  const apiOrigin = apiBase ? new URL(apiBase).origin : '';
  const remoteArt = 'https://coverartarchive.org https://archive.org https://*.archive.org';
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://www.youtube.com https://s.ytimg.com",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${remoteArt} https://i.ytimg.com ${apiOrigin}`.trim(),
    "media-src 'self' blob:",
    `connect-src 'self' blob: ${remoteArt} ${apiOrigin}`.trim(),
    "worker-src 'self' blob:",
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'csp-meta',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        // No dev server o HMR precisa de eval/inline; a CSP vale só para o build.
        if (ctx.server) return [];
        return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE_PATH || '/demo-backin00s/',
    plugins: [react(), cspPlugin(env.VITE_API_BASE ?? '')],
    worker: { format: 'es' },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          spike: resolve(import.meta.dirname, 'spike.html'),
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.test.{ts,tsx}'],
      setupFiles: ['tests/unit/setup.ts'],
    },
  };
});
