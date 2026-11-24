/**
 * 生成 GitHub Release 说明：取 CHANGELOG.md 里对应版本的那一段。
 *
 * 为什么需要它：workflow 原来用 `gh release create --generate-notes`，
 * 生成出来的只有一行「Full Changelog: .../compare/...」，用户看不到这版改了什么。
 * 发版说明本来就写在 CHANGELOG 里，直接取那一段最省事，也避免两处措辞不一致。
 *
 * 用法：node scripts/release-notes.mjs 1.2.5 > release-notes.md
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ver = String(process.argv[2] || '')
  .trim()
  .replace(/^v/i, '')
if (!ver) {
  console.error('用法：node scripts/release-notes.mjs <version>')
  process.exit(1)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = path.join(root, 'CHANGELOG.md')
if (!fs.existsSync(file)) {
  console.error('找不到 CHANGELOG.md：' + file)
  process.exit(1)
}

const lines = fs.readFileSync(file, 'utf8').split('\n')
const start = lines.findIndex((l) => {
  const t = l.trim()
  if (!t.startsWith('## ')) return false
  const head = t.slice(3).trim()
  return head === ver || head === 'v' + ver || head.startsWith(ver + ' ') || head.startsWith('v' + ver + ' ')
})

let body = ''
if (start >= 0) {
  const buf = []
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('## ')) break
    buf.push(lines[i])
  }
  body = buf.join('\n').trim()
}

const install = [
  '## 安装',
  '',
  '- ZTools 插件市场：搜索 `cmark` 或 `markdown`',
  '- 从 npm 安装：`@lancc/cmark@' + ver + '`',
  '- 离线包：下载下方 `cmark-' + ver + '.upx`，在 ZTools 设置 → 插件 → 更多 → 导入本地插件',
  '',
  '升级后需重启 ZTools 生效；笔记与配置文件不受影响。',
].join('\n')

process.stdout.write((body ? body + '\n\n' : '') + install + '\n')
if (!body) console.error('[release-notes] CHANGELOG 里没有 ' + ver + ' 的段落，只输出安装说明')