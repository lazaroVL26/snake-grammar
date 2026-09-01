import { defineConfig } from 'vite';

/** Porta do servidor de ranking (server/index.mjs). */
const API_PORT = Number(process.env.API_PORT ?? 8080);

export default defineConfig({
  base: './',
  server: {
    // Aceita conexoes da rede local, nao so de localhost.
    host: true,
    port: 5178,
    proxy: {
      // Em desenvolvimento o ranking vive no servidor Node, em outra porta.
      '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: true },
    },
  },
  preview: { host: true, port: 5179 },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
