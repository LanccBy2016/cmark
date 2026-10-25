import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // 输出目录必须叫 app，不能用 dist：
    // ZTools 发布 CLI 的 COPY_IGNORE_DIRS 会跳过 dist/build/node_modules，
    // 产物放进 dist 就拿不上去。市场要求构建产物随源码一起提交。
    outDir: 'app',
    emptyOutDir: true,
    target: 'chrome108',
    rollupOptions: {
      output: {
        manualChunks: {
          markdown: ['marked', 'katex', 'highlight.js', 'dompurify'],
          // 图表库体积大且只在含 mermaid / echarts 代码块时才需要，单独拆包按需加载
          mermaid: ['mermaid'],
          echarts: ['echarts'],
        },
      },
    },
  },
  server: { port: 5273 },
})
