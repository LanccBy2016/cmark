/**
 * 打包 uTools 插件包（.upx，本质是 zip）
 *
 * uTools 上架要的是 upx，不是 asar；内容与 asar 那份一致：
 *   plugin.json（main 指向 index.html）+ preload.js + preload/ + logo.png + 前端产物
 *
 * 用法：node scripts/pack-upx.mjs
 * 产物：release/cmark-<version>.upx
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = path.join(root, 'app')
if (!fs.existsSync(path.join(app, 'index.html'))) {
  console.error('app 目录不完整，先跑 npm run build && node scripts/pack.mjs')
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const releaseDir = path.join(root, 'release')
fs.mkdirSync(releaseDir, { recursive: true })

// 先清掉同名旧包，避免 Compress-Archive 追加内容
const zipPath = path.join(releaseDir, 'cmark-' + pkg.version + '.zip')
const upxPath = path.join(releaseDir, 'cmark-' + pkg.version + '.upx')
for (const f of [zipPath, upxPath]) { try { fs.rmSync(f) } catch (e) {} }

// Windows 自带 Compress-Archive：-Path "dir\*" 让 zip 根就是文件本身
const ps = 'Compress-Archive -Path "' + path.join(app, '*') + '" -DestinationPath "' + zipPath + '" -Force'
execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' })
// 直接 rename 在 Windows 上容易 EPERM（目标被索引/杀软/资源管理器占用），
// 改成先复制再删源；复制也失败就退到带时间戳的文件名，至少不丢产物。
try {
  fs.copyFileSync(zipPath, upxPath)
  fs.rmSync(zipPath, { force: true })
} catch (e) {
  const alt = path.join(releaseDir, 'cmark-' + pkg.version + '-' + Date.now() + '.upx')
  fs.copyFileSync(zipPath, alt)
  fs.rmSync(zipPath, { force: true })
  console.warn('目标 upx 被占用，已改存为 ' + path.basename(alt))
  process.exitCode = 0
}

const size = fs.statSync(upxPath).size
console.log('uTools 插件包已生成：' + path.relative(root, upxPath) + '（' + Math.round(size / 1024 / 1024 * 10) / 10 + ' MB）')
console.log('上架时在 uTools 开发者中心选「导入插件包」，或本地测试时选该 .upx')
