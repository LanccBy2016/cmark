/**
 * 领域类型：只描述「笔记/目录/仓库」是什么，不含任何宿主 API。
 * 与现有 preload/ndb.js 的约定保持一致，便于平滑迁移。
 */

/** 笔记在仓库内的相对路径，如 `日记/2026-10-26.md`（永远用 / 分隔） */
export type RelPath = string

/** 笔记 id 约定（沿用 ndb.js）：笔记 `note/<rel>`，目录直接用 rel（根目录为空串） */
export type NodeId = string

export interface NoteRef {
  rel: RelPath
  /** 去掉扩展名的标题，UI 默认展示用 */
  title: string
  /** 磁盘绝对路径（仅用于适配器定位，不参与排序/比较） */
  abs?: string
}

export interface FsEntryInfo {
  name: string
  path: string
  isDir: boolean
  mtimeMs: number
}

/** 树节点：目录自包含子节点，UI 可直接渲染（对应 ndb.js buildTree 的 inline） */
export interface TreeNode {
  id: NodeId
  name: string
  kind: 'dir' | 'note'
  children?: TreeNode[]
}

export interface ScanResult {
  dirs: RelPath[]
  notes: NoteRef[]
  /** 超过目录/文件阈值被截断（UI 提示「目录过多」） */
  truncated: boolean
}

/** 每个目录下子元素的拖动顺序：{ '<dirRel>': ['note/a.md', 'T1', ...] }，根目录 key 为 '' */
export type TreeOrder = Record<string, NodeId[]>
