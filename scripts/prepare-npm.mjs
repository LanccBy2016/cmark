/**
 * 组装 npm 发布目录。
 *
 * ZTools 的「从 npm 安装」拿到 tarball 后，直接读解压出来的 package/plugin.json，
 * 再把 package/ 整个改名成插件目录。所以 plugin.json、index.html、logo.png、preload.js
 * 必须平铺在 npm 包根，不能套一层 app/ 或 dist/。
 *
 * 本脚本把 vite 的构建产物 app/ 平铺到发布目录，并生成一份包级 package.json
 * （仓库根那份是开发用的，name 是 cmark，不能直接 publish）。
 *
 * 用法：
 *   node scripts/prepare-npm.mjs                 # 输出到系统临时目录 cmark-npm
 *   node scripts/prepare-npm.mjs --out <目录>     # 指定输出目录
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDir = path.join(root, 'app')

// npm 包名：ZTools 里「从 npm 安装」就填这个名字
// 裸名 cmark 已被 node-cmark 占用，只能用 scope
const PUBLISH_NAME = process.env.NPM_PACKAGE_NAME || '@lancc/cmark'

// 必须平铺在包根的文件/目录
const REQUIRED = ['plugin.json', 'index.html', 'logo.png', 'preload.js', 'preload']
// 打进包的文件白名单（package.json / README / LICENSE 由 npm 自动带上）
const FILES = [
  'plugin.json',
  'index.html',
  'logo.png',
  'preload.js',
  'preload/',
  'assets/',
  'export-file/',
  'fonts/',
  'katex.min.css',
  'CHANGELOG.md'
]

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outDir = path.resolve(outIdx >= 0 ? args[outIdx + 1] : path.join(os.tmpdir(), 'cmark-npm'))

const fail = (msg) => {
  console.error('[prepare-npm] 失败：' + msg)
  process.exit(1)
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const sizeOf = (dir) => {
  let bytes = 0
  let files = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      const r = sizeOf(p)
      bytes += r.bytes
      files += r.files
    } else {
      bytes += fs.statSync(p).size
      files++
    }
  }
  return { bytes, files }
}

if (!fs.existsSync(appDir)) fail('app/ 不存在，先跑 npm run build')
for (const need of REQUIRED) {
  if (!fs.existsSync(path.join(appDir, need))) fail('构建产物缺少 ' + need + '，重新跑 npm run build 与 node scripts/pack.mjs')
}

const pkg = readJson(path.join(root, 'package.json'))
const plugin = readJson(path.join(appDir, 'plugin.json'))

if (plugin.main !== 'index.html') fail('app/plugin.json 的 main 应为 index.html，实际为 ' + plugin.main)
if (!plugin.name) fail('app/plugin.json 缺少 name')
if (plugin.version !== pkg.version) {
  fail('版本不一致：package.json ' + pkg.version + '，app/plugin.json ' + plugin.version + '（重新构建后再发）')
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
fs.cpSync(appDir, outDir, { recursive: true })

for (const extra of ['README.md', 'CHANGELOG.md', 'LICENSE']) {
  const from = path.join(root, extra)
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(outDir, extra))
}

const publishPkg = {
  name: PUBLISH_NAME,
  version: pkg.version,
  description: pkg.description,
  keywords: pkg.keywords,
  author: pkg.author,
  license: pkg.license,
  homepage: pkg.homepage,
  repository: pkg.repository,
  bugs: pkg.bugs,
  files: FILES,
  publishConfig: { registry: 'https://registry.npmjs.org/' }
}
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(publishPkg, null, 2) + '\n', 'utf8')

const { bytes, files } = sizeOf(outDir)
console.log('[prepare-npm] 发布目录：' + outDir)
console.log('[prepare-npm] 包名 ' + PUBLISH_NAME + ' 版本 ' + pkg.version)
console.log('[prepare-npm] ' + files + ' 个文件，解包 ' + (bytes / 1048576).toFixed(1) + ' MB')
console.log('[prepare-npm] 下一步：cd "' + outDir + '" && npm publish --provenance --access public')