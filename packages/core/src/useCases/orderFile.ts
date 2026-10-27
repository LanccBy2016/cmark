import type { NodeId, TreeOrder } from '../domain/types.js'

/**
 * `.cmark/order.txt` 的读写（对应 ndb.js readTreeOrder / writeTreeOrder）。
 *
 * 文件格式（写入时保持稳定，diff 不抖动）：
 *   # 根目录
 *   note/a.md
 *   T1
 *
 *   # T1
 *   note/T1/b.md
 *
 * 约定：根目录永远在最前，其余目录按路径字典序；内容不变就不写盘
 * （否则每次扫描都会刷新 mtime，Git 工作区永远挂着「已修改」）。
 */
export const ROOT_LABEL = '根目录'

export function parseOrder(text: string): TreeOrder {
  const out: TreeOrder = {}
  let cur = ''
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    if (t.startsWith('#')) {
      const name = t.slice(1).trim()
      cur = name === ROOT_LABEL || name === '根' ? '' : name.replace(/\/+$/, '')
      if (!out[cur]) out[cur] = []
      continue
    }
    if (!out[cur]) out[cur] = []
    out[cur].push(t)
  }
  return out
}

export function serializeOrder(order: TreeOrder): string {
  const keys = Object.keys(order)
    .filter((k) => Array.isArray(order[k]) && order[k].length > 0)
    .sort((a, b) => {
      if (a === b) return 0
      if (a === '') return -1
      if (b === '') return 1
      return a < b ? -1 : 1
    })

  const lines: string[] = []
  keys.forEach((k, i) => {
    if (i) lines.push('')
    lines.push(`# ${k === '' ? ROOT_LABEL : k}`)
    for (const id of order[k]) lines.push(String(id))
  })
  return lines.join('\n') + '\n'
}

/** 返回 null 表示内容没变，调用方应跳过写盘（保住 mtime） */
export function diffOrder(prev: string, next: string): string | null {
  return prev === next ? null : next
}

export type { TreeOrder, NodeId }
