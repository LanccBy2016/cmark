import type { NoteRef, NodeId, RelPath, TreeNode, TreeOrder } from '../domain/types'

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

/** 按用户拖动顺序排序；未登记的排末尾并保持相对次序 */
export function sortKids<T extends { id: NodeId }>(kids: T[], seq?: NodeId[]): T[] {
  if (!seq || seq.length === 0 || kids.length === 0) return kids
  const idx = new Map<NodeId, number>()
  seq.forEach((id, i) => idx.set(id, i))
  const at = (k: T) => (idx.has(k.id) ? (idx.get(k.id) as number) : 1e9)
  return kids.slice().sort((a, b) => at(a) - at(b))
}

export interface BuildTreeInput {
  dirs: RelPath[]
  notes: NoteRef[]
  order?: TreeOrder
}

export interface TreeIndex {
  /** 根目录的子节点 */
  root: TreeNode[]
  /** 每个目录的子节点视图（key 为目录相对路径，根为 ''） */
  byDir: Map<RelPath, TreeNode[]>
}

/**
 * 一次构建全树，同时给出「每个目录的子节点」视图。
 * folder doc 需要的是 byDir.get(dir)，根节点是 root —— 避免各端自己再递归一遍。
 */
export function buildTreeIndex(input: BuildTreeInput): TreeIndex {
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

  const byDir = new Map<RelPath, TreeNode[]>()
  const build = (dirRel: RelPath): TreeNode[] => {
    const cached = byDir.get(dirRel)
    if (cached) return cached
    const kids: TreeNode[] = []
    for (const n of notesByDir.get(dirRel) ?? []) {
      kids.push({ id: noteId(n.rel), name: n.title, kind: 'note' })
    }
    for (const sub of dirsByParent.get(dirRel) ?? []) {
      kids.push({ id: dirId(sub), name: baseName(sub), kind: 'dir', children: build(sub) })
    }
    const sorted = sortKids(kids, order[dirRel])
    byDir.set(dirRel, sorted)
    return sorted
  }

  const root = build('')
  return { root, byDir }
}

/** 构建树（只要根节点时用这个） */
export function buildTree(input: BuildTreeInput): TreeNode[] {
  return buildTreeIndex(input).root
}

export function flattenTree(tree: TreeNode[], out = new Map<NodeId, TreeNode>()): Map<NodeId, TreeNode> {
  for (const n of tree) {
    out.set(n.id, n)
    if (n.children?.length) flattenTree(n.children, out)
  }
  return out
}
