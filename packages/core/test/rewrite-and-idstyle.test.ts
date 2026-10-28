import { describe, expect, it } from 'vitest'
import {
  buildTreeIndex, noteId, retargetMarkdownImageRefs, relativeRelPath, joinRelPath, normalizeRelPath,
} from '../src/index'

describe('目录节点 id 风格（plugin 用 basename，其它端用 rel）', () => {
  const input = {
    dirs: ['T1', 'T1/T2'],
    notes: [{ rel: 'T1/T2/n.md', title: 'n' }],
  }

  it("dirIdStyle='basename'：嵌套目录 id 用裸名（ZTools bundle 的历史约定）", () => {
    const { root, byDir } = buildTreeIndex(input, { dirIdStyle: 'basename' })
    const t1 = root.find((n) => n.id === 'T1')!
    expect(t1.kind).toBe('dir')
    const t2 = t1.children!.find((n) => n.kind === 'dir')!
    expect(t2.id).toBe('T2')                       // 裸名，不是 T1/T2
    expect(t2.children!.map((c) => c.id)).toEqual([noteId('T1/T2/n.md')])
    expect(byDir.get('T1/T2')!.map((c) => c.id)).toEqual([noteId('T1/T2/n.md')])
  })

  it("dirIdStyle='rel'：默认用完整相对路径", () => {
    const { root } = buildTreeIndex(input)
    const t2 = root[0].children!.find((n) => n.kind === 'dir')!
    expect(t2.id).toBe('T1/T2')
  })
})

describe('图片相对路径重算（对齐 ndb.js rewriteRelInText）', () => {
  const md = '# 标题\n\n![图](./pic.png)\n\n![外链](https://x/y.png)\n'

  it('同目录改名不动（oldDirRel === newDirRel）', () => {
    expect(retargetMarkdownImageRefs(md, { oldDirRel: 'A', newDirRel: 'A' })).toBe(md)
  })

  it('从根移到子目录：./pic.png → ../pic.png', () => {
    const out = retargetMarkdownImageRefs('![x](./pic.png)', { oldDirRel: '', newDirRel: 'A' })
    expect(out).toBe('![x](../pic.png)')
  })

  it('从 A 移到 A/B：./pic.png 指向的还是 A 目录里的图 → ../pic.png', () => {
    const out = retargetMarkdownImageRefs('![x](./pic.png)', { oldDirRel: 'A', newDirRel: 'A/B' })
    expect(out).toBe('![x](../pic.png)')
  })

  it('再下沉一层时 ../ 层数跟着加（A/B 的 ../../pic.png → A/B/C 的 ../../../pic.png）', () => {
    const out = retargetMarkdownImageRefs('![x](../../pic.png)', { oldDirRel: 'A/B', newDirRel: 'A/B/C' })
    expect(out).toBe('![x](../../../pic.png)')
  })

  it('从 A/B 移回根：../../pic.png → ./pic.png', () => {
    const out = retargetMarkdownImageRefs('![x](../../pic.png)', { oldDirRel: 'A/B', newDirRel: '' })
    expect(out).toBe('![x](./pic.png)')
  })

  it('外链 / data / 锚点 / attachment 一律不动', () => {
    const text = '![a](https://x/y.png) ![b](data:image/png;base64,xx) ![c](#h) ![d](attachment:abc)'
    expect(retargetMarkdownImageRefs(text, { oldDirRel: '', newDirRel: 'A' })).toBe(text)
  })

  it('代码块与行内代码里的示例不动', () => {
    const text = '```\n![x](./pic.png)\n```\n\n`![y](./pic.png)`\n'
    expect(retargetMarkdownImageRefs(text, { oldDirRel: '', newDirRel: 'A' })).toBe(text)
  })

  it('跑出仓库范围的不动', () => {
    const text = '![x](../../outside/pic.png)'
    expect(retargetMarkdownImageRefs(text, { oldDirRel: 'A', newDirRel: 'A/B' })).toBe(text)
  })

  it('目标文件不存在时不动（exists 回调为 false）', () => {
    const text = '![x](./missing.png)'
    expect(retargetMarkdownImageRefs(text, { oldDirRel: '', newDirRel: 'A', exists: () => false })).toBe(text)
    expect(retargetMarkdownImageRefs(text, { oldDirRel: '', newDirRel: 'A', exists: () => true })).toBe('![x](../missing.png)')
  })
})

describe('相对路径工具', () => {
  it('normalize / join / relative', () => {
    expect(normalizeRelPath('a//b/./c')).toBe('a/b/c')
    expect(joinRelPath('a/b', '../c.png')).toBe('a/c.png')
    expect(joinRelPath('', './x.png')).toBe('x.png')
    expect(relativeRelPath('A/B', 'A/pic.png')).toBe('../pic.png')
    expect(relativeRelPath('', 'pic.png')).toBe('pic.png')
    expect(relativeRelPath('A', 'A/pic.png')).toBe('pic.png')
  })
})
