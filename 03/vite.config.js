import { defineConfig } from 'vite';

/**
 * base: './' —— 产物用相对路径引用 /assets/*，
 * 使 dist/ 既可放在域名根路径，也可放在任意子路径（GitHub Pages 项目页、
 * Nginx location 子目录、对象存储子目录）下正常加载。
 */
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173, open: false },
  build: {
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
});
