/**
 * 打包：vite build 之后，把 plugin.json / preload 相关文件复制到 dist，
 * 再用 @electron/asar 打成 cmark-<version>.asar
 *
 * 用法：node scripts/pack.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

if (!fs.existsSync(dist)) {
  console.error('dist 不存在，先跑 npm run build')
  process.exit(1)
}

// 1. plugin.json / logo
for (const f of ['plugin.json']) {
  fs.copyFileSync(path.join(root, f), path.join(dist, f))
}
const logoSvg = path.join(root, 'public', 'logo.png')
if (fs.existsSync(logoSvg)) fs.copyFileSync(logoSvg, path.join(dist, 'logo.png'))

// 2. preload 及其依赖
fs.copyFileSync(path.join(root, 'preload.js'), path.join(dist, 'preload.js'))
const preloadDir = path.join(root, 'preload')
fs.mkdirSync(path.join(dist, 'preload'), { recursive: true })
for (const f of fs.readdirSync(preloadDir)) {
  if (f.endsWith('.js') || f === 'package.json') {
    fs.copyFileSync(path.join(preloadDir, f), path.join(dist, 'preload', f))
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
console.log('dist 就绪，版本 ' + pkg.version)
console.log('下一步：npx @electron/asar pack dist cmark-' + pkg.version + '.asar')
