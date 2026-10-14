import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [vue()],
  // 相对路径：H5 可部署在域名根目录或任意子路径下
  base: './',
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:3100' },
  },
  build: {
    target: ['es2019', 'safari13'],
    // 两个入口：公众号 H5（含医生端）与运营后台
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), admin: resolve(import.meta.dirname, 'admin.html') },
    },
  },
});
