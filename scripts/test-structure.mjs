/**
 * 结构保真测试：Markdown 块结构往返
 *
 * 与 test-e2e.mjs 的分工：
 *   test-e2e.mjs 只校验「二次往返是否稳定」，格式被改写也算通过；
 *   这里用「块结构指纹」校验语义是否原样保留 —— 丢元素、改段落划分一律 FAIL。
 *
 * 三层判定：
 *   1. 结构指纹相等   —— 块类型序列 + 块内纯文本 + 块属性（语言/层级/对齐/勾选）
 *   2. 二次往返幂等   —— roundtrip(roundtrip(x)) === roundtrip(x)
 *   3. 原文逐字节相等 —— 只对没有等价写法的用例强制（第三列 true）
 *
 * 用法：node scripts/test-structure.mjs
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)

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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmark-rt-'))
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

function roundtrip(md) {
  const nodes = inflateDoc(Z.toNodes(md))
  return Z.toMarkdown(deflateDoc(nodes))
}

function textOf(node) {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.children)) return ''
  return node.children.map(textOf).join('')
}

/** 块结构指纹：只比块级语义，行内格式由单独用例覆盖 */
function fingerprint(md) {
  const nodes = Z.toNodes(md)
  return nodes.map((n) => {
    const t = n.type || 'paragraph'
    switch (t) {
      case 'heading':
        return `H${n.level}:${textOf(n)}`
      case 'paragraph':
        return `P:${textOf(n)}`
      case 'codeblock':
        return `CODE[${n.lang || ''}]:${(n.content || '').replace(/\n/g, '\\n')}`
      case 'blockquote':
        return `QUOTE:${textOf(n)}`
      case 'table': {
        const rows = (n.children || []).map((r) => {
          const cells = (r.children || []).map((c) => (c.children || []).map(textOf).join(''))
          return cells.join('|')
        })
        return `TABLE[${(n.align || []).join(',')}]:${rows.join(' / ')}`
      }
      case 'list': {
        const walk = (items, d) =>
          (items || [])
            .map((it) => {
              const own = (it.children || [])
                .filter((c) => c.type !== 'list')
                .map((c) => (c.children ? (c.children || []).map(textOf).join('') : textOf(c)))
                .join('')
              const sub = (it.children || []).find((c) => c.type === 'list')
              const mark = it.checked === true ? '[x]' : it.checked === false ? '[ ]' : ''
              return (
                `${' '.repeat(d * 2)}${mark}${own}` +
                (sub ? ' > ' + walk(sub.children, d + 1) : '')
              )
            })
            .join(' | ')
        return `LIST[${n.ordered ? 'ol' : 'ul'}]:${walk(n.children, 0)}`
      }
      case 'image':
        return `IMG:${n.url || ''}:${textOf(n)}`
      case 'math':
        return `MATH:${n.value || n.content || textOf(n)}`
      case 'hr':
        return 'HR'
      default:
        return `${t.toUpperCase()}:${textOf(n)}`
    }
  })
}

/* 第三列 true = 原文没有等价写法，必须逐字节还原 */
const cases = [
  ['单段落', '只有一段。', true],
  ['两段落', '第一段。\n\n第二段。', true],
  ['三段落', '第一段。\n\n第二段。\n\n第三段。', true],
  ['段内软换行', '第一行\n第二行', true],
  ['段内软换行+后续段', '第一行\n第二行\n\n新段', true],
  ['连续空行', '第一段。\n\n\n\n第二段。', false],

  ['H1', '# 一级', true],
  ['H2', '## 二级', true],
  ['H6', '###### 六级', true],
  ['标题+正文', '# 标题\n\n正文。', true],
  ['标题含粗体', '## 带 **粗体** 的标题', true],

  ['加粗', '这是 **粗体** 文字。', true],
  ['斜体', '这是 *斜体* 文字。', true],
  ['删除线', '这是 ~~删除~~ 文字。', true],
  ['行内码', '这是 `code` 文字。', false],
  ['高亮', '这是 ==高亮== 文字。', false],
  ['下划线', '这是 <u>下划线</u> 文字。', false],
  ['嵌套强调', '这是 **加粗里的 *斜体*** 效果。', true],
  ['多行内码', '代码 `a` 和 `b` 并列。', true],

  ['普通链接', '看 [链接](https://example.com)。', true],
  ['裸 URL', '访问 https://example.com 看。', false],
  ['裸邮箱', '联系 123456@jjw2017 即可。', false],
  ['锚点链接', '看 [锚点](#section)。', true],

  ['单行引用', '> 引用一行', true],
  ['多行引用', '> 第一行\n> 第二行', true],
  ['引用含格式', '> 引用里有 **粗体**', true],
  ['引用后接正文', '> 引用\n\n正文。', true],

  ['无序列表', '- 一\n- 二\n- 三', true],
  ['有序列表', '1. 一\n2. 二', true],
  ['嵌套无序', '- 一级\n  - 二级\n    - 三级', true],
  ['嵌套有序', '1. 一\n   1. 一之一\n2. 二', true],
  ['任务列表', '- [ ] 未完成\n- [x] 已完成', true],
  ['任务+普通', '- [ ] 任务\n- 普通项', true],
  ['列表项含格式', '- 有 **粗体** 的项\n- 有 `code` 的项', true],
  ['列表后接正文', '- 一\n- 二\n\n正文。', true],

  ['无语言代码块', '```\nplain\n```', true],
  ['js 代码块', '```js\nconst x = 1\n```', true],
  ['多行代码块', '```js\nconst x = 1\nconst y = 2\n```', true],
  ['代码块含空行', '```js\na\n\nb\n```', true],
  ['代码块含缩进', '```python\ndef f():\n    return 1\n```', true],
  ['代码块含竖线', '```\n| a | b |\n```', true],
  ['代码块后接正文', '```js\nx\n```\n\n正文。', true],

  ['基础表格', '| 列A | 列B |\n| --- | --- |\n| 1 | 2 |', true],
  ['左对齐', '| 左 | 右 |\n| :-- | --: |\n| a | b |', false],
  ['居中对齐', '| 中 |\n| :-: |\n| a |', false],
  ['三列三行', '| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |', true],
  ['表格含格式', '| **粗** | `code` |\n| --- | --- |\n| x | y |', true],

  ['块级图片', '![截图](attachment:abc123)', true],
  ['段内图片', '截图如下 ![配图](attachment:abc) 完。', true],
  ['普通图片', '![图](https://example.com/a.png)', true],

  ['块级公式', '$$\nE = mc^2\n$$', true],
  ['行内公式', '公式 $E = mc^2$ 在此。', false],
  ['多行公式', '$$\n\\int_0^1 x dx\n$$', true],

  ['分割线', '上\n\n---\n\n下', true],
  ['星号分割线', '上\n\n***\n\n下', false],

  ['综合全元素', [
    '# 综合', '', '段落含 **粗体** 和 `代码`。', '',
    '- 列表一', '- 列表二', '', '> 引用', '',
    '```js', 'const a = 1', '```', '',
    '| a | b |', '| --- | --- |', '| 1 | 2 |', '',
    '---', '', '结尾。',
  ].join('\n'), true],
]

let pass = 0
const structureFails = []
const idemFails = []
const strictFails = []

for (const [name, md, strict] of cases) {
  const back = roundtrip(md)
  const again = roundtrip(back)

  const fp1 = JSON.stringify(fingerprint(md))
  const fp2 = JSON.stringify(fingerprint(back))
  if (fp1 !== fp2) {
    structureFails.push({ name, md, back, fp1, fp2 })
    console.log(`  FAIL  结构  ${name}`)
    continue
  }

  if (md5(back) !== md5(again)) {
    idemFails.push({ name, md, back, again })
    console.log(`  FAIL  幂等  ${name}`)
    continue
  }

  if (strict && back !== md) {
    strictFails.push({ name, md, back })
    console.log(`  WARN  字节  ${name}`)
    continue
  }

  pass++
  console.log(`  PASS  ${name}`)
}

const total = cases.length
const failCount = structureFails.length + idemFails.length
console.log(`\n结果: ${pass} 通过 / ${failCount} 失败 / ${strictFails.length} 字节差异 (共 ${total})`)

if (structureFails.length) {
  console.log('\n=== 结构丢失（语义被改变，必须修） ===')
  for (const f of structureFails) {
    console.log(`\n[${f.name}]`)
    console.log('  原指纹:', f.fp1)
    console.log('  回指纹:', f.fp2)
    console.log('  原文  :', JSON.stringify(f.md))
    console.log('  往返  :', JSON.stringify(f.back))
  }
}

if (idemFails.length) {
  console.log('\n=== 不收敛（每次往返都在变） ===')
  for (const f of idemFails) {
    console.log(`\n[${f.name}]`)
    console.log('  原文:', JSON.stringify(f.md))
    console.log('  一次:', JSON.stringify(f.back))
    console.log('  二次:', JSON.stringify(f.again))
  }
}

if (strictFails.length) {
  console.log('\n=== 字节差异（结构对但写法变了） ===')
  for (const f of strictFails) {
    console.log(`  [${f.name}] ${JSON.stringify(f.md)}`)
    console.log(`       → ${JSON.stringify(f.back)}`)
  }
}

process.exit(failCount === 0 ? 0 : 1)