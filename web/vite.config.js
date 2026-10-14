import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

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
  },
});
