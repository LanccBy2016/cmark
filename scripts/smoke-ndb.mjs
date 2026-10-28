#!/usr/bin/env node
/**
 * 端到端冒烟：把 preload/ndb.js 真正装起来，指向一个临时笔记库，
 * 验证扫盘/建树/读取在切换 @cmark/core 后仍然工作。
 *
 * 用法：npm run build:core && node scripts/smoke-ndb.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'cmark-smoke-'))
const put = (rel, body) => {
  const full = path.join(lib, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, body, 'utf8')
}
put('README.md', '# 根笔记\n\n![图](assets/a.png)')
put('日记/2026-10-26.md', '# 今天\n\n内容')
put('日记/2026-10-27.md', '# 明天')
put('项目/设计/配色.md', '# 配色')
put('.git/HEAD', 'ref')
put('assets/a.png', 'png')
// 老库兼容：.cmark 下旧版带 .txt 后缀的元数据（新版改成无扩展名）
put('.cmark/order.txt', '# 日记\nnote/日记/2026-10-27.md\nnote/日记/2026-10-26.md\n')
put('.cmark/near.txt', '')

process.env.ZNOTES_WORKSPACE = lib
const install = require('../preload/ndb.js')
const win = { addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } }
install(win, null)

const fails = []
const size = win.__ZNOTES.rescan()
const docs = []
// 通过 __NSTORE/get 面拿不到全量，直接用 scan 面验证可读性
const noteId = 'note/日记/2026-10-26.md'
const doc = win.__NDB.get(noteId)
if (!doc) fails.push('取不到 ' + noteId)
else {
  if (doc.title !== '2026-10-26') fails.push(`标题不对: ${doc.title}`)
  if (!String(doc.plain || '').includes('今天')) fails.push('正文没读到')
}

// 树：folder doc 的 children 里目录 id 必须是裸名（bundle 的约定）
const folderDoc = win.__NDB.get('folder/项目')
if (!folderDoc) fails.push('取不到 folder/项目')
else {
  const design = (folderDoc.children || []).find((c) => c.name === '设计')
  if (!design) fails.push('folder/项目 下缺「设计」')
  else if (design.id !== '设计') fails.push(`子目录 id 应为裸名，实际=${design.id}`)
}

// 旧 order.txt 的目录内排序必须被读进来：27 日排在 26 日之前（文件系统序是反的）
const diaryDoc = win.__NDB.get('folder/日记')
const diaryOrder = (diaryDoc?.children || []).map((c) => c.id)
if (diaryOrder[0] !== 'note/日记/2026-10-27.md') {
  fails.push(`旧版 order.txt 排序没生效: ${JSON.stringify(diaryOrder)}`)
}

// 写一次 near 标记 → 应生成 .cmark/near（无扩展名）并删掉旧 near.txt
win.__ZNOTES.setNoteNear('note/README.md', true)
const nearNew = fs.existsSync(path.join(lib, '.cmark/near'))
const nearOld = fs.existsSync(path.join(lib, '.cmark/near.txt'))
if (!nearNew) fails.push('.cmark/near 未生成（写入没走新文件名）')
if (nearOld) fails.push('.cmark/near.txt 未被迁移删除')

const rootDoc = win.__NDB.get('__root__')
if (!rootDoc) fails.push('取不到 __root__')
else {
  const names = (rootDoc.children || []).map((c) => c.name || c.id)
  for (const want of ['日记', '项目']) if (!names.includes(want)) fails.push(`__root__ 缺顶层目录 ${want}`)
}

fs.rmSync(lib, { recursive: true, force: true })

if (fails.length) {
  console.error('❌ 冒烟失败\n- ' + fails.join('\n- '))
  process.exit(1)
}
console.log(`✅ ndb 冒烟通过：docs=${size}，笔记可读、folder/__root__ 树结构正确（子目录 id 为裸名）`)
