/**
 * 单文件构建：把 JS / CSS 全部内联进一个 index.html。
 * 产物 dist-single/index.html 可直接双击用浏览器打开（无需服务器、
 * 无 ES module 跨域限制），也可通过微信 / 邮件分发。
 *
 *   npm run build:single
 */
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    outDir: 'dist-single',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 8000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
