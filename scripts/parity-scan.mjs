#!/usr/bin/env node
/**
 * 阶段 1 等价性验证：把 preload/ndb.js 原来那套 walk / sortKids / readTreeOrder
 * 原样搬进本脚本（旧实现），与切换后调用的 @cmark/core（新实现）跑同一批输入，
 * 逐项比对。任何一项不一致就退出码 1。
 *
 * 用法：npm run build:core && node scripts/parity-scan.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const core = require('../preload/cmark-core.cjs')

// ---------------- 旧实现（照抄改动前的 ndb.js） ----------------
const MD_EXT = /\.(md|markdown)$/i
const MAX_DIRS = 5000
const MAX_FILES = 20000

function oldWalk(dir, rel, acc) {
  if (acc.dirs.length > MAX_DIRS || acc.files.length > MAX_FILES) { acc.truncated = true; return }
  let ents = []
  try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch (e) { return }
  for (const e of ents) {
    if (e.name.startsWith('.')) continue
    if (e.name === 'assets') continue
    const r = rel ? rel + '/' + e.name : e.name
    const full = path.join(dir, e.name)
    if (e.isDirectory()) { acc.dirs.push(r); oldWalk(full, r, acc) }
    else if (MD_EXT.test(e.name)) acc.files.push({ rel: r, full })
  }
}

function oldSortKids(kids, seq) {
  if (!seq || !seq.length || !kids.length) return kids
  const idx = new Map()
  seq.forEach((id, i) => idx.set(id, i))
  return kids.slice().sort((a, b) => {
    const ia = idx.has(a.id) ? idx.get(a.id) : 1e9
    const ib = idx.has(b.id) ? idx.get(b.id) : 1e9
    return ia === ib ? 0 : ia - ib
  })
}

function oldParseOrder(text) {
  const out = {}
  let cur = ''
  String(text).split(/\r?\n/).forEach((line) => {
    const t = line.trim()
    if (!t) return
    if (t.charAt(0) === '#') {
      const name = t.slice(1).trim()
      cur = (name === '根目录' || name === '根' || name === '') ? '' : name.replace(/\/+$/, '')
      if (!out[cur]) out[cur] = []
      return
    }
    if (!out[cur]) out[cur] = []
    out[cur].push(t)
  })
  return out
}

// ---------------- 造一个带各种干扰项的库 ----------------
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmark-parity-'))
function mk(p, body = '') {
  const full = path.join(root, p)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, body, 'utf8')
}
mk('.git/HEAD', 'ref')
mk('.obsidian/app.json', '{}')
mk('assets/pic.png', 'bin')
mk('assets/nested/x.md', '# 不该出现')      // assets 整棵跳过（旧实现只在父层名匹配时跳过目录）
mk('README.md', '# root')
mk('notes.txt', 'not note')
mk('日记/2026-10-26.md', '# a')
mk('日记/2026-10-27.markdown', '# b')
mk('项目/想法.md', '# c')
mk('项目/设计/配色.md', '# d')
mk('项目/设计/深层/再深/终.md', '# e')
mk('空目录/.keep', '')
for (let i = 0; i < 60; i++) mk(`批量/${i % 7}/n${i}.md`, `# ${i}`)

// ---------------- 比对 ----------------
const acc = { dirs: [], files: [], truncated: false }
oldWalk(root, '', acc)
const neu = core.scanSync(root)

const sortStr = (a) => [...a].sort()
const oldDirs = sortStr(acc.dirs)
const newDirs = sortStr(neu.dirs)
const oldFiles = sortStr(acc.files.map((f) => f.rel))
const newFiles = sortStr(neu.files.map((f) => f.rel))

const fails = []
if (JSON.stringify(oldDirs) !== JSON.stringify(newDirs)) {
  fails.push(`dirs 不一致:\n  旧=${oldDirs.length} 新=${newDirs.length}\n  仅旧: ${oldDirs.filter((d) => !newDirs.includes(d))}\n  仅新: ${newDirs.filter((d) => !oldDirs.includes(d))}`)
}
if (JSON.stringify(oldFiles) !== JSON.stringify(newFiles)) {
  fails.push(`notes 不一致:\n  旧=${oldFiles.length} 新=${newFiles.length}\n  仅旧: ${oldFiles.filter((d) => !newFiles.includes(d))}\n  仅新: ${newFiles.filter((d) => !oldFiles.includes(d))}`)
}
if (!!acc.truncated !== !!neu.truncated) fails.push(`truncated 不一致: 旧=${acc.truncated} 新=${neu.truncated}`)

// 排序：同一批 kids 与同一份 seq
const kids = [
  { id: 'note/a.md' }, { id: 'note/b.md' }, { id: 'T1' }, { id: 'T2' }, { id: 'note/c.md' },
]
const seq = ['T2', 'note/b.md', 'T1']
if (JSON.stringify(oldSortKids(kids, seq).map((k) => k.id)) !== JSON.stringify(core.sortKids(kids, seq).map((k) => k.id))) {
  fails.push('sortKids 结果不一致')
}
const emptySeq = oldSortKids(kids, []).map((k) => k.id).join() + '|' + core.sortKids(kids, []).map((k) => k.id).join()
if (emptySeq.split('|')[0] !== emptySeq.split('|')[1]) fails.push('sortKids 空 seq 分支不一致')

// order.txt 解析：多段、带空格、带尾斜杠、根目录别名
const orderText = `# 根目录
T1
note/a.md

# T1
note/T1/b.md
# 项目/设计/
note/项目/设计/x.md
`
if (JSON.stringify(oldParseOrder(orderText)) !== JSON.stringify(core.parseOrder(orderText))) {
  fails.push('parseOrder 结果不一致')
}

fs.rmSync(root, { recursive: true, force: true })

if (fails.length) {
  console.error('❌ 等价性验证失败\n- ' + fails.join('\n- '))
  process.exit(1)
}
console.log(`✅ 等价性通过：${newDirs.length} 个目录 / ${newFiles.length} 篇笔记，规则与排序与旧实现完全一致`)
