/**
 * 端到端往返测试：md → toNodes → inflateDoc → deflateDoc → toMarkdown
 *
 * 这条链路就是编辑器真实的读写路径，测试它才有意义；
 * 只测 ndb.js 的 toNodes/toMarkdown 会漏掉行内层与 codeblock 搬运的问题。
 *
 * 用法：node scripts/test-e2e.mjs
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)

// 先把 TS 的行内层打成 CJS，node 才能 require（用 esbuild 的 js 入口，避开 Windows 下 npx 的 shim）
const cjsPath = path.resolve('scripts/_inline.cjs')
const esbuildBin = path.resolve('node_modules/esbuild/bin/esbuild')
if (!fs.existsSync(cjsPath) || process.argv.includes('--rebuild')) {
  execFileSync(
    process.execPath,
    [esbuildBin, 'src/core/inline.ts', '--bundle', '--format=cjs', '--platform=node',
     '--external:marked', '--outfile=scripts/_inline.cjs', '--log-level=error'],
    { stdio: 'ignore' }
  )
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmark-e2e-'))
const ws = path.join(tmp, 'notes')
fs.mkdirSync(ws, { recursive: true })
const cfgPath = path.join(tmp, 'cfg.json')
fs.writeFileSync(cfgPath, JSON.stringify({ workspace: ws, initialized: true }), 'utf8')

const installNDB = require(path.resolve('preload/ndb.js'))
const { inflateDoc, deflateDoc } = require(path.resolve('scripts/_inline.cjs'))

const win = {}
installNDB(win, cfgPath)
const Z = win.__ZNOTES

const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex')

/** 完整往返：模拟编辑器打开再保存 */
function roundtrip(md) {
  const nodes = inflateDoc(Z.toNodes(md))
  return Z.toMarkdown(deflateDoc(nodes))
}

const cases = [
  ['纯段落', ['第一段。', '', '第二段。'].join('\n')],
  ['标题', ['# 一级', '', '正文。'].join('\n')],
  ['行内格式', '正文有 **粗体**、*斜体*、`code`、~~删除~~、==高亮== 和 <u>下划线</u>。'],
  ['链接', '看 [链接](https://example.com)。'],
  ['嵌套强调', '这是 **加粗里的 *斜体*** 效果。'],
  ['无序列表', ['- 一', '- 二', '- 三'].join('\n')],
  ['有序列表', ['1. 一', '2. 二'].join('\n')],
  ['引用', ['> 第一行', '> 第二行'].join('\n')],
  ['代码块（多行）', ['```js', 'const x = 1', 'const y = 2', '```'].join('\n')],
  ['代码块（带语言）', ['```python', 'print(1)', '```'].join('\n')],
  ['表格', ['| 列A | 列B |', '| --- | --- |', '| 1 | 2 |'].join('\n')],
  ['表格（对齐）', ['| 左 | 中 | 右 |', '| :-- | :-: | --: |', '| a | b | c |'].join('\n')],
  ['图片（段内）', '截图如下 ![配图](attachment:abc123) 完。'],
  ['图片（独立行）', '![截图](attachment:def456)'],
  ['分隔线', ['上', '', '---', '', '下'].join('\n')],
  ['任务列表', ['- [ ] 未完成', '- [x] 已完成'].join('\n')],
  ['公式块', ['$$', 'E = mc^2', '$$'].join('\n')],
  ['硬换行段落', ['第一行', '第二行', '', '新段'].join('\n')],
  ['嵌套列表', ['- 一级', '  - 二级', '    - 三级'].join('\n')],
  ['综合', [
    '# 综合', '', '段落里有 **粗体** 和 `代码`。', '',
    '- 列表一', '- 列表二', '', '> 引用', '',
    '```js', 'const a = 1', '```', '',
    '| a | b |', '| --- | --- |', '| 1 | 2 |',
  ].join('\n')],
]

// 判定标准分两级：
//   严格幂等（二次往返 === 一次往返）是必须满足的红线；
//   首次往返与原文不同，只有在"每次都不一样"时才算缺陷（那才会在 git 里反复抖动）。
let pass = 0
const fails = []
const normalized = []

for (const [name, md] of cases) {
  const back = roundtrip(md)
  const again = roundtrip(back)
  const stable = md5(back) === md5(again)

  if (!stable) {
    fails.push({ name, md, back, again })
    console.log(`  FAIL  ${name}（不收敛：每次往返都在变）`)
    console.log('        原:', JSON.stringify(md))
    console.log('        一次:', JSON.stringify(back))
    console.log('        二次:', JSON.stringify(again))
  } else if (back !== md) {
    normalized.push({ name, md, back })
    pass++
    console.log(`  OK*   ${name}（首次规范化一次，之后稳定）`)
  } else {
    pass++
    console.log(`  PASS  ${name}`)
  }
}

if (normalized.length) {
  console.log('\n首次规范化明细（改一次就稳定，V1.0.0 也是这个行为）：')
  for (const n of normalized) {
    console.log(`  - ${n.name}: ${JSON.stringify(n.md)} → ${JSON.stringify(n.back)}`)
  }
}

// 代码块编辑后能否存住（这是评审指出的最严重一条）
console.log('\n代码块编辑验证：')
const cbNodes = inflateDoc(Z.toNodes(['```js', 'const a = 1', '```'].join('\n')))
const cbEl = cbNodes[0]
const cbText = (cbEl.children || []).map((c) => c.text).join('')
console.log('  打开时 children 文本:', JSON.stringify(cbText))
cbEl.children = [{ text: 'const a = 2' }] // 模拟用户改成 2
const saved = Z.toMarkdown(deflateDoc([cbEl]))
console.log('  编辑后保存:', JSON.stringify(saved))
console.log('  是否存住新值:', saved.includes('const a = 2') ? 'YES' : 'NO（旧 content 覆盖了编辑）')

console.log(`\n结果: ${pass} 通过（其中 ${normalized.length} 属首次规范化）/ ${fails.length} 不收敛 (共 ${cases.length})`)
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(fails.length === 0 ? 0 : 1)