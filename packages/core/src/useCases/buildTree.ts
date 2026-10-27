import type { NoteRef, NodeId, RelPath, TreeNode, TreeOrder } from '../domain/types.js'

/** 目录 rel 的父目录（根目录返回 ''），与 ndb.js dirOf 同义 */
export function dirOf(rel: RelPath): RelPath {
  const i = rel.lastIndexOf('/')
  return i < 0 ? '' : rel.slice(0, i)
}

export function baseName(rel: RelPath): string {
  const i = rel.lastIndexOf('/')
  return i < 0 ? rel : rel.slice(i + 1)
}

export const noteId = (rel: RelPath): NodeId => `note/${rel}`
export const dirId = (rel: RelPath): NodeId => rel

/**
 * 按用户拖动顺序排序（对应 ndb.js sortKids）。
 * 未出现在顺序表里的元素保持原位排到末尾——这样新增文件默认在最后，不会打乱已有顺序。
 */
export function sortKids(kids: TreeNode[], seq?: NodeId[]): TreeNode[] {
  if (!seq || seq.length === 0 || kids.length === 0) return kids
  const idx = new Map<NodeId, number>()
  seq.forEach((id, i) => idx.set(id, i))
  const at = (k: TreeNode) => (idx.has(k.id) ? (idx.get(k.id) as number) : 1e9)
  return kids.slice().sort((a, b) => at(a) - at(b))
}

export interface BuildTreeInput {
  dirs: RelPath[]
  notes: NoteRef[]
  order?: TreeOrder
}

/**
 * 构建树（对应 ndb.js buildTree）：目录自包含子节点，节点 id 沿用 note/<rel> 与 <dirRel>。
 * 纯函数，不碰磁盘——同一份扫描结果 + 同一份 order.txt 永远得到同样的树。
 */
export function buildTree(input: BuildTreeInput): TreeNode[] {
  const { dirs, notes, order = {} } = input

  const notesByDir = new Map<RelPath, NoteRef[]>()
  for (const n of notes) {
    const d = dirOf(n.rel)
    const arr = notesByDir.get(d) ?? []
    arr.push(n)
    notesByDir.set(d, arr)
  }

  const dirsByParent = new Map<RelPath, RelPath[]>()
  for (const d of dirs) {
    const p = dirOf(d)
    const arr = dirsByParent.get(p) ?? []
    arr.push(d)
    dirsByParent.set(p, arr)
  }

  const inline = (dirRel: RelPath): TreeNode[] => {
    const kids: TreeNode[] = []
    for (const n of notesByDir.get(dirRel) ?? []) {
      kids.push({ id: noteId(n.rel), name: n.title, kind: 'note' })
    }
    for (const sub of dirsByParent.get(dirRel) ?? []) {
      kids.push({ id: dirId(sub), name: baseName(sub), kind: 'dir', children: inline(sub) })
    }
    return sortKids(kids, order[dirRel])
  }

  return inline('')
}

/** 便于 UI 按 id 查找（视图层用，不参与核心逻辑） */
export function flattenTree(tree: TreeNode[], out = new Map<NodeId, TreeNode>()): Map<NodeId, TreeNode> {
  for (const n of tree) {
    out.set(n.id, n)
    if (n.children?.length) flattenTree(n.children, out)
  }
  return out
}
