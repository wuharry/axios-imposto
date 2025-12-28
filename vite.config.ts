import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    // 自動生成 TypeScript 型別宣告檔 (.d.ts)
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts'],
    }),
  ],

  // ⚡ 1. Esbuild 進階設定 (編譯階段)
  // 這裡控制 esbuild 如何轉換你的程式碼
  esbuild: {
    // 打包時自動移除 console.log 和 debugger (生產環境最佳實踐)
    drop: ['console', 'debugger'],
    // 目標語法版本
    target: 'es2015',
  },

  build: {
    // ⚡ 2. 指定壓縮器為 esbuild (速度比 terser 快 20-40 倍)
    // 雖然 Vite 預設就是 esbuild，但顯式宣告可以確保不被意外改成 terser
    minify: 'esbuild',

    // 設定庫模式 (Library Mode)
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AxiosImpostor', // UMD 模式下的全域變數名稱 (window.AxiosImpostor)
      fileName: (format) => {
        if (format === 'es') return 'index.mjs';
        if (format === 'cjs') return 'index.js';
        return `index.${format}.js`;
      },
      formats: ['es', 'umd', 'cjs'],
      // 同時輸出 ESM (給現代專案) 和 UMD (給舊專案/CDN)
    },

    // 📦 3. Rollup 設定 (處理依賴與輸出)
    rollupOptions: {
      // 確保外部化處理那些你不想打包進庫的依賴
      // 例如：如果你之後用了 'lodash' 但不想把它包進去，就寫在這裡
      // 確保不打包 node_modules 裡的套件
      external: [],

      output: {
        // 在 UMD 模式下，為外部依賴提供全域變數名稱
        globals: {},
        // 保持輸出程式碼的緊湊性
        compact: true,
      },
    },

    // 報表：打包後在控制台顯示檔案大小 (gzip 後)
    reportCompressedSize: true,
  },
});
