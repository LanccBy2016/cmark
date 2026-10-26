/**
 * 打离线安装包 .zpx（给自己仓库 Releases 用）
 *
 * 为什么要这个脚本：ZTools 客户端除了插件市场，还支持「导入本地插件」，
 * 文件对话框只认 .zpx 与 .zip。其中 .zpx 的格式是 **asar 的 gzip 压缩包**
 * （主进程按 GZIP_MAGIC 判断后 gunzip 出 asar，再解包安装），
 * 所以这里把 app/ 打成 asar 再 gzip 即可，不需要客户端内部的私有封装。
 *
 * 用法：
 *   node scripts/pack.mjs        # 先准备 app/（vite build 之后跑）
 *   node scripts/pack-zpx.mjs    # 产出 release/cmark-<版本>.zpx
 *
 * 想同时产出 .zip（客户端也认，根目录就是插件根）：
 *   node scripts/pack-zpx.mjs --zip
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDir = path.join(root, 'app')
const outDir = path.join(root, 'release')

if (!fs.existsSync(path.join(appDir, 'plugin.json'))) {
  console.error('app/plugin.json 不存在，先跑：npm run build && node scripts/pack.mjs')
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'))
const version = pkg.version || '0.0.0'
const base = `${pkg.name}-${version}`
fs.mkdirSync(outDir, { recursive: true })

const asarCli =
  process.env.ASAR_CLI || 'E:/AI-Agent/utools8.0/unpack/asar/node_modules/@electron/asar/bin/asar.js'
if (!fs.existsSync(asarCli)) {
  console.error('找不到 asar CLI：' + asarCli + '\n可用环境变量 ASAR_CLI 指定 @electron/asar 的 bin/asar.js 路径')
  process.exit(1)
}

const asarPath = path.join(outDir, `${base}.asar`)
fs.rmSync(asarPath, { force: true })
execFileSync(process.execPath, [asarCli, 'pack', appDir, asarPath], { stdio: 'inherit' })
if (!fs.existsSync(asarPath) || fs.statSync(asarPath).size === 0) {
  console.error('!! asar 没生成，停下来查（asar pack 偶尔静默失败）')
  process.exit(1)
}

// .zpx = asar 的 gzip
const zpxPath = path.join(outDir, `${base}.zpx`)
fs.writeFileSync(zpxPath, zlib.gzipSync(fs.readFileSync(asarPath)))

const mb = (p) => (fs.statSync(p).size / 1048576).toFixed(1) + ' MB'
console.log('asar: ' + asarPath + '  (' + mb(asarPath) + ')')
console.log('zpx : ' + zpxPath + '  (' + mb(zpxPath) + ')')

if (process.argv.includes('--zip')) {
  // 客户端也接受 zip（zip 根目录 = 插件根目录）。
  // 注意不能用 `tar -a`：Windows 上 git-bash 自带的 GNU tar 不支持 -a 生成 zip，会静默失败。
  const zipPath = path.join(outDir, `${base}.zip`)
  fs.rmSync(zipPath, { force: true })
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Compress-Archive -Path '${appDir}\\*' -DestinationPath '${zipPath}' -Force`],
      { stdio: 'inherit' }
    )
  } else {
    execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: appDir, stdio: 'inherit' })
  }
  if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
    console.error('zip 打包失败')
    process.exit(1)
  }
  console.log('zip : ' + zipPath + '  (' + mb(zipPath) + ')')
}

console.log('\n分发方式：ZTools → 设置 → 插件 → 更多 → 导入本地插件，选 ' + path.basename(zpxPath))