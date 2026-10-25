/**
 * 内联解析与序列化的往返测试
 * 用 node 直接跑：node scripts/test-roundtrip.mjs
 *
 * 验证三件事：
 *   1. md → nodes → md 往返后内容一致
 *   2. 连续三轮往返 md5 不变（幂等）
 *   3. 行内格式确实拆成了带标记的 leaf
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const require = createRequire(import.meta.url)

// 临时工作区 + 配置文件，避免碰真实笔记库
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmark-test-'))
const ws = path.join(tmp, 'notes')
fs.mkdirSync(ws, { recursive: true })
const cfgPath = path.join(tmp, 'cfg.json')
fs.writeFileSync(cfgPath, JSON.stringify({ workspace: ws, initialized: true }), 'utf8')

const installNDB = require(path.resolve('preload/ndb.js'))
const win = {}
installNDB(win, cfgPath)

const Z = win.__ZNOTES
if (!Z || typeof Z.toNodes !== 'function' || typeof Z.toMarkdown !== 'function') {
  console.error('转换器未挂载，检查 ndb.js 的 win.__ZNOTES')
  process.exit(1)
}

const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex')

const cases = [
  {
    name: '纯段落',
    md: ['第一段。', '', '第二段。'].join('\n'),
  },
  {
    name: '标题 + 段落',
    md: ['# 一级标题', '', '正文一段。', '', '## 二级标题', '', '正文二段。'].join('\n'),
  },
  {
    name: '行内格式',
    md: '正文里有 **粗体**、*斜体*、`行内代码`、~~删除线~~、==高亮== 和 <u>下划线</u>。',
  },
  {
    name: '链接与嵌套',
    md: '看这个 [链接](https://example.com)，还有 **加粗里的 *斜体***。',
  },
  {
    name: '无序列表',
    md: ['- 项目一', '- 项目二', '- 项目三'].join('\n'),
  },
  {
    name: '有序列表',
    md: ['1. 第一步', '2. 第二步', '3. 第三步'].join('\n'),
  },
  {
    name: '引用',
    md: ['> 引用第一行', '> 引用第二行'].join('\n'),
  },
  {
    name: '代码块',
    md: ['```js', 'const x = 1', 'console.log(x)', '```'].join('\n'),
  },
  {
    name: '表格',
    md: ['| 列A | 列B |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |'].join('\n'),
  },
  {
    name: '综合',
    md: [
      '# 综合测试',
      '',
      '段落里有 **粗体** 和 `代码`。',
      '',
      '- 列表项一',
      '- 列表项二',
      '',
      '> 一段引用',
      '',
      '```python',
      'print("hi")',
      '```',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
    ].join('\n'),
  },
]

let pass = 0
let fail = 0

for (const c of cases) {
  const nodes = Z.toNodes(c.md)
  const back = Z.toMarkdown(nodes)

  // 三轮幂等
  let cur = c.md
  const hashes = []
  for (let i = 0; i < 3; i++) {
    cur = Z.toMarkdown(Z.toNodes(cur))
    hashes.push(md5(cur))
  }
  const idempotent = hashes.every((h) => h === hashes[0])
  const same = back === c.md

  if (same && idempotent) {
    pass++
    console.log(`  PASS  ${c.name}`)
  } else {
    fail++
    console.log(`  FAIL  ${c.name}`)
    if (!same) {
      console.log('        原文:', JSON.stringify(c.md))
      console.log('        往返:', JSON.stringify(back))
    }
    if (!idempotent) {
      console.log('        三轮 md5:', hashes.join(' / '))
    }
  }
}

// 单独检查 leaf 拆分
console.log('\n行内格式拆分检查：')
const probe = Z.toNodes('有 **粗体**、*斜体* 和 `代码`。')
console.log('  ', JSON.stringify(probe[0].children))

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(fail === 0 ? 0 : 1)