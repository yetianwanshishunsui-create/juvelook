// 单文件测试版：前台 H5、医生端、运营后台打包进一个自包含的 HTML（脚本、样式、字体全部内嵌）
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

// 文件开头写入 UTF-8 BOM：部分程序（Windows 应用、微信 / QQ 文件预览等）不读 <meta charset>，
// 没有 BOM 会按 GBK 解码导致中文乱码
const utf8Bom = () => ({
  name: 'utf8-bom',
  writeBundle(options, bundle) {
    for (const name of Object.keys(bundle)) {
      if (!name.endsWith('.html')) continue;
      const file = resolve(options.dir, name);
      const text = readFileSync(file, 'utf8');
      if (!text.startsWith('\uFEFF')) writeFileSync(file, '\uFEFF' + text, 'utf8');
    }
  },
});

export default defineConfig({
  plugins: [vue(), viteSingleFile(), utf8Bom()],
  base: './',
  build: {
    target: ['es2019', 'safari13'],
    outDir: 'dist-standalone',
    emptyOutDir: true,
    assetsInlineLimit: () => true,
    rollupOptions: { input: resolve(import.meta.dirname, 'standalone.html') },
  },
});
