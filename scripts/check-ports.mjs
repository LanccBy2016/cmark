/**
 * 结构门禁：守住分层边界，防止平台访问又散回去。
 *
 * 分层（依赖只能向下）：
 *   contracts  ← 纯类型，零依赖，只能 import 同目录
 *   core       ← 纯领域逻辑，不碰平台、不碰 runtime
 *   runtime    ← 端口注册表 + legacy 桥（唯一允许访问 window.__* 的地方）
 *   app        ← 应用服务（store、导出），依赖 contracts/core/runtime
 *   ui         ← 组件，依赖 contracts/core/runtime，禁止 import adapters
 *   adapters   ← 平台实现（electron / browser / tauri），实现 contracts
 *   apps       ← 各端入口，负责装配
 *
 * 用法：node scripts/check-ports.mjs           错误即失败
 *       node scripts/check-ports.mjs --report  额外打印目录概览
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'src')
const showReport = process.argv.includes('--report')

const IGNORE_DIRS = new Set(['node_modules', 'app', '.git', 'release', '.npm-publish'])
const BRIDGE_FILE = 'runtime/legacy-bridge.ts'

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(e.name)) out.push(p)
  }
  return out
}

const isComment = (t) => /^\s*(\/\/|\*|\/\*)/.test(t)
const NODE_IMPORT = /from\s+['"](?:node:)?(?:fs|path|os|child_process|electron|crypto)['"]|require\s*\(\s*['"](?:fs|path|os|child_process|electron)['"]/
const HOST_GLOBAL = /window\.(?:ztools|utools)\s*(?:\?\.|\.)/
const BRIDGE_GLOBAL = /window\.__[A-Za-z_]\w*\s*(?:\?\.|\.)/
const TAURI = /from\s+['"]@tauri-apps/
const IMPORT_RUNTIME = /from\s+['"][^'"]*runtime\/|from\s+['"][^'"]*adapters\//
const IMPORT_ADAPTERS = /from\s+['"][^'"]*\/adapters\//

const findings = []
const add = (level, file, line, rule, text) =>
  findings.push({ level, file: path.relative(root, file).replace(/\\/g, '/'), line, rule, text: text.trim().slice(0, 150) })

const files = walk(src)
for (const file of files) {
  const rel = path.relative(src, file).replace(/\\/g, '/')
  const top = rel.split('/')[0]
  const isContracts = top === 'contracts'
  const isCore = top === 'core'
  const isUi = top === 'ui'
  const isApp = top === 'app'
  const isRuntime = top === 'runtime'
  const isAdapter = top === 'adapters'

  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((text, i) => {
    if (isComment(text)) return
    const n = i + 1

    if (isContracts) {
      const m = text.match(/from\s+['"]([^'"]+)['"]/)
      if (m && !m[1].startsWith('./')) add('error', file, n, 'contracts 只能 import 同目录', text)
      if (BRIDGE_GLOBAL.test(text) || NODE_IMPORT.test(text)) add('error', file, n, 'contracts 不得依赖运行时', text)
      return
    }

    if (rel !== BRIDGE_FILE) {
      if (BRIDGE_GLOBAL.test(text)) add('error', file, n, '只有 runtime/legacy-bridge.ts 可以访问 window.__*', text)
      if (HOST_GLOBAL.test(text)) add('error', file, n, '只有 runtime 层可以访问宿主全局', text)
    }

    if (isCore && IMPORT_RUNTIME.test(text)) add('error', file, n, 'core 不得 import runtime/adapters（纯领域）', text)
    if (isUi && IMPORT_ADAPTERS.test(text)) add('error', file, n, 'ui 不得 import adapters', text)
    if (!isAdapter && TAURI.test(text)) add('error', file, n, '只有 adapters 可以依赖 @tauri-apps', text)
    if ((isCore || isApp || isUi || isRuntime) && NODE_IMPORT.test(text)) {
      add('error', file, n, 'core/app/ui/runtime 不得依赖 Node 或 Electron', text)
    }
  })
}

const errors = findings.filter((f) => f.level === 'error')

if (showReport) {
  const byTop = {}
  for (const f of files) {
    const top = path.relative(src, f).replace(/\\/g, '/').split('/')[0]
    byTop[top] = (byTop[top] || 0) + 1
  }
  console.log('目录概览：')
  Object.entries(byTop).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + String(v).padStart(3) + '  ' + k + '/'))
  console.log('')
}

console.log('结构门禁：扫描 src/ 下 ' + files.length + ' 个文件')
if (errors.length) {
  console.log('\n错误（' + errors.length + '）：')
  for (const f of errors.slice(0, 40)) {
    console.log('  ' + f.file + ':' + f.line + '  [' + f.rule + ']')
    console.log('      ' + f.text)
  }
  if (errors.length > 40) console.log('  ... 另外 ' + (errors.length - 40) + ' 条')
  console.log('\n结论：不通过')
  process.exit(1)
}
console.log('结论：通过（平台访问已收敛到 runtime/legacy-bridge.ts）')