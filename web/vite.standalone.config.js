// 单文件测试版：前台 H5、医生端、运营后台打包进一个自包含的 HTML（脚本、样式、字体全部内嵌）
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  base: './',
  build: {
    target: ['es2019', 'safari13'],
    outDir: 'dist-standalone',
    emptyOutDir: true,
    assetsInlineLimit: () => true,
    rollupOptions: { input: resolve(import.meta.dirname, 'standalone.html') },
  },
});
