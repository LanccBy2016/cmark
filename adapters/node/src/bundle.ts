/**
 * 插件端打包入口：esbuild 把 @cmark/core + node 适配器打成单文件 CJS，
 * preload 里 `require('./cmark-core.cjs')` 即可（ZTools/uTools 的 preload 是 CommonJS）。
 */
export * from '@cmark/core'
export { scanSync } from './scanSync'
export type { SyncScanFile, SyncScanResult, SyncScanOptions } from './scanSync'
export { nodeFs, nodeGit, nodeConfig } from './index'
