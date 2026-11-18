import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { devvit } from '@devvit/start/vite';

export default defineConfig(({ command }) => {
  if (command === 'build') {
    return {
      plugins: [react(), tailwind(), devvit()],
    };
  }

  return {
    root: 'src/client',
    publicDir: false,
    plugins: [
      react(),
      tailwind(),
      {
        name: 'owl-line-root',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/' || req.url === '/index.html') {
              res.writeHead(302, { Location: '/splash.html' });
              res.end();
              return;
            }
            next();
          });
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': 'http://127.0.0.1:8787',
        '/internal': 'http://127.0.0.1:8787',
      },
    },
  };
});