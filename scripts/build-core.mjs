#!/usr/bin/env node
/**
 * 把 @cmark/core + node 适配器打成 preload 可直接 require 的单文件 CJS。
 *
 * 产物：preload/cmark-core.cjs（入库，插件发版不依赖构建机有 esbuild）
 * 用法：npm run build:core
 */
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const result = await build({
  entryPoints: [path.join(root, 'adapters/node/src/bundle.ts')],
  outfile: path.join(root, 'preload/cmark-core.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
  metafile: true,
})

const bytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0
console.log(`[build:core] preload/cmark-core.cjs  ${(bytes / 1024).toFixed(1)} KB`)
