import { describe, expect, it } from 'vitest'
import { MemoryFs, buildTree, parseOrder, scanWorkspace, serializeOrder, noteId, dirId } from '../src/index.js'

/** 一份带「各种干扰项」的迷你工作区：隐藏目录、assets、非 md、嵌套目录 */
function workspace() {
  return new MemoryFs({
    '/ws': true,
    '/ws/.git': true,
    '/ws/.obsidian': true,
    '/ws/assets': true,
    '/ws/assets/pic.png': 'binary',
    '/ws/日记': true,
    '/ws/日记/2026-10-26.md': '# 今天',
    '/ws/日记/2026-10-27.md': '# 明天',
    '/ws/项目': true,
    '/ws/项目/想法.md': '# 想法',
    '/ws/项目/草稿.markdown': '# 草稿',
    '/ws/项目/设计': true,
    '/ws/项目/设计/配色.md': '# 配色',
    '/ws/README.md': '# 根笔记',
    '/ws/notes.txt': 'not a note',
  })
}

describe('scanWorkspace（对齐 ndb.js walk 的四条约定）', () => {
  it('跳过隐藏目录 / assets / 非 md，只收 md+markdown', async () => {
    const fs = workspace()
    const r = await scanWorkspace(fs, '/ws', { join: (rel) => `/ws/${rel}` })
    expect(r.truncated).toBe(false)
    expect(new Set(r.notes.map((n) => n.rel))).toEqual(new Set([
      'README.md',
      '日记/2026-10-26.md',
      '日记/2026-10-27.md',
      '项目/草稿.markdown',
      '项目/设计/配色.md',
      '项目/想法.md',
    ]))
    expect(r.dirs.sort()).toEqual(['日记', '项目', '项目/设计'])
  })

  it('标题去扩展名，绝对路径由 join 决定', async () => {
    const fs = workspace()
    const r = await scanWorkspace(fs, '/ws', { join: (rel) => `/ws/${rel}` })
    const n = r.notes.find((x) => x.rel === '项目/草稿.markdown')!
    expect(n.title).toBe('草稿')  // 与 ndb.js stripExt 一致：basename 去扩展名，不带目录
    expect(n.abs).toBe('/ws/项目/草稿.markdown')
  })
})

describe('buildTree（对齐 ndb.js buildTree）', () => {
  it('目录自包含、节点 id 用 note/<rel> 与 <dirRel>', async () => {
    const fs = workspace()
    const { dirs, notes } = await scanWorkspace(fs, '/ws', { join: (rel) => `/ws/${rel}` })
    const tree = buildTree({ dirs, notes })

    const rootIds = tree.map((n) => n.id)
    expect(rootIds).toContain(noteId('README.md'))
    expect(rootIds).toContain(dirId('日记'))

    const diary = tree.find((n) => n.id === '日记')!
    expect(diary.children?.map((c) => c.id)).toEqual([noteId('日记/2026-10-26.md'), noteId('日记/2026-10-27.md')])

    const design = tree.find((n) => n.id === '项目')!.children!.find((c) => c.id === '项目/设计')!
    expect(design.children!.map((c) => c.id)).toEqual([noteId('项目/设计/配色.md')])
  })

  it('按 order.txt 顺序排，未登记的排在最后且保持相对次序', async () => {
    const fs = workspace()
    const { dirs, notes } = await scanWorkspace(fs, '/ws', { join: (rel) => `/ws/${rel}` })
    const order = parseOrder('# 根目录\n日记\nREADME.md\n')
    const tree = buildTree({ dirs, notes, order })
    expect(tree.slice(0, 2).map((n) => n.id)).toEqual(['日记', noteId('README.md')])
    expect(tree[tree.length - 1].id).toBe('项目')   // 未登记 → 末尾
  })
})

describe('order.txt 读写（对齐 readTreeOrder / writeTreeOrder）', () => {
  it('parse → serialize 往返稳定，根目录置顶、其余字典序', () => {
    const text = serializeOrder({
      '项目': ['note/项目/想法.md', '项目/设计'],
      '': ['日记', 'note/README.md'],
      '日记': ['note/日记/2026-10-26.md'],
    })
    expect(text.startsWith('# 根目录\n')).toBe(true)
    expect(text.indexOf('# 日记') < text.indexOf('# 项目')).toBe(true)  // 字典序

    const back = parseOrder(text)
    expect(back['']).toEqual(['日记', 'note/README.md'])
    expect(back['项目']).toEqual(['note/项目/想法.md', '项目/设计'])
    expect(serializeOrder(back)).toBe(text)   // 幂等
  })

  it('空目录段被丢掉（不写空标题）', () => {
    expect(serializeOrder({ '': [], 'A': ['note/a.md'] })).toBe('# A\nnote/a.md\n')
  })
})
