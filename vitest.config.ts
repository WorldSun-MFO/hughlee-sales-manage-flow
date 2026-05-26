// ============================================================
// Vitest 設定 — 單元測試框架
// ============================================================
// 跑法:
//   npm run test            一次性跑全部測試(CI 用)
//   npm run test:watch      開啟 watch 模式邊改邊看(本機開發用)
//   npm run test:coverage   產出涵蓋率報告(寫進 ./coverage)
//
// 測試檔放哪:
//   - src/**/__tests__/*.test.ts(集中放,推薦)
//   - src/**/*.test.ts          (跟 source 同層,也支援)
//
// 不需要 vite-tsconfig-paths 套件 — 用下面手動 alias 解析 @/* 對到 src/*
// 即可,跟 tsconfig.json:paths 一致(@/lib/utils 等同 ./src/lib/utils)。
// ============================================================
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',           // 測 pure functions / schemas,不需要 DOM
    globals: false,                 // 強制 import { describe, it, expect } from 'vitest'
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts'],
      // 排除設定檔與只有型別的檔
      exclude: [
        'src/lib/**/*.test.ts',
        'src/lib/**/__tests__/**',
        'src/lib/types.ts',         // 純 type,沒 runtime
      ],
    },
  },
});
