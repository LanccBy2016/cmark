/**
 * 搜索：Ctrl+F 打开
 *
 * 两种范围（对齐 V1.0.0）：
 *   - 当前笔记：在编辑器里高亮命中，Enter / Shift+Enter 上下跳
 *   - 全部笔记：后端遍历工作区，列出笔记与命中片段，点击打开
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Editor as SlateEditor, Range, Transforms, Node } from 'slate'
import type { Editor as SlateEditorType } from 'slate'
import { ReactEditor } from 'slate-react'
import { useNotes } from '../store/notes'

type Hit = { rel: string; name: string; snippet: string; count: number }
type Scope = 'note' | 'all'

type Api = {
  searchNotes?: (q: string, limit?: number) => { ok: boolean; data?: Hit[]; message?: string }
}

export function SearchDialog({
  open,
  onClose,
  editor,
}: {
  open: boolean
  onClose: () => void
  editor: SlateEditorType
}) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<Scope>('note')
  const [hits, setHits] = useState<Hit[]>([])
  const [idx, setIdx] = useState(0)
  const [total, setTotal] = useState(0)
  const openNote = useNotes((s) => s.openNote)
  const setSearchTerm = useNotes((s) => s.setSearchTerm)
  const currentRel = useNotes((s) => s.currentRel)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSearchTerm('')
      setQ('')
      setHits([])
      setIdx(0)
      setTotal(0)
      window.setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  /** 当前笔记：数出所有命中（用于 x/y 显示），并跳到第 idx 个 */
  const locateInNote = useCallback(
    (query: string, target: number, focusEditor = false) => {
      if (!query || !currentRel) {
        setTotal(0)
        return
      }
      const lower = query.toLowerCase()
      const positions: { path: number[]; offset: number }[] = []
      for (const [node, path] of Node.nodes(editor)) {
        if (!('text' in node) || typeof node.text !== 'string') continue
        const t = node.text.toLowerCase()
        let from = 0
        for (;;) {
          const i = t.indexOf(lower, from)
          if (i < 0) break
          positions.push({ path, offset: i })
          from = i + lower.length
        }
      }
      setTotal(positions.length)
      if (!positions.length) return
      const p = positions[Math.max(0, Math.min(positions.length - 1, target))]
      try {
        const sel = {
          anchor: { path: p.path, offset: p.offset },
          focus: { path: p.path, offset: p.offset + query.length },
        }
        Transforms.select(editor, sel as never)
        // 不能在这里 ReactEditor.focus：搜索框还在输入，抢焦点会让后续字符
        // 直接写进正文、并且替换掉刚选中的命中区间
        if (focusEditor) ReactEditor.focus(editor)
        const el = ReactEditor.toDOMRange(editor, sel as never)
        void el
      } catch (e) {}
    },
    [editor, currentRel]
  )

  const search = useCallback(
    (query: string) => {
      setIdx(0)
      if (!query.trim()) {
        setHits([])
        setTotal(0)
        return
      }
      if (scope === 'note') locateInNote(query, 0, false)
      else {
        const api = window.__CMARK as unknown as Api
        const r = api?.searchNotes?.(query, 80)
        setHits(r?.ok && Array.isArray(r.data) ? r.data : [])
      }
    },
    [scope, locateInNote]
  )

  const step = useCallback(
    (dir: 1 | -1) => {
      if (scope !== 'note' || total === 0) return
      const next = (idx + dir + total) % total
      setIdx(next)
      locateInNote(q, next, true)
    },
    [scope, idx, total, q, locateInNote]
  )

  const closeAll = useCallback(() => {
    setSearchTerm('')
    onClose()
  }, [onClose, setSearchTerm])

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setSearchTerm('')
        onClose()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) step(-1)
        else step(1)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        setScope((s) => (s === 'note' ? 'all' : 'note'))
      }
    },
    [onClose, step]
  )

  // 切范围时用同一个词重搜
  useEffect(() => {
    if (open && q) search(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  if (!open) return null

  return (
    <div className="search-mask" onClick={closeAll}>
      <div className="search-box" onClick={(e) => e.stopPropagation()}>
        <div className="search-head">
          <input
            ref={inputRef}
            className="search-input"
            value={q}
            placeholder={scope === 'note' ? '在当前笔记中查找' : '在所有笔记中查找'}
            onChange={(e) => {
              const v = e.target.value
              setQ(v)
              setSearchTerm(scope === 'note' ? v : '')
              search(v)
            }}
            onKeyDown={onKey}
          />
          <span className="search-count">
            {scope === 'note' ? (total ? `${idx + 1} / ${total}` : '无结果') : hits.length ? `${hits.length} 篇` : '无结果'}
          </span>
          <button
            className={'search-scope' + (scope === 'note' ? ' on' : '')}
            type="button"
            title="仅当前笔记（Tab 切换）"
            onClick={() => setScope('note')}
          >
            当前笔记
          </button>
          <button
            className={'search-scope' + (scope === 'all' ? ' on' : '')}
            type="button"
            title="所有笔记（Tab 切换）"
            onClick={() => {
              setScope('all')
              setSearchTerm('')
            }}
          >
            所有笔记
          </button>
          <button className="gp-close" type="button" title="关闭" onClick={closeAll} style={{ position: 'static' }}>
            ×
          </button>
        </div>

        {scope === 'all' && hits.length ? (
          <div className="search-list">
            {hits.map((h) => (
              <button
                key={h.rel}
                type="button"
                className="search-hit"
                onClick={() => {
                  openNote(h.rel)
                  onClose()
                }}
              >
                <span className="search-name">{h.name}</span>
                <span className="search-badge">{h.count}</span>
                <span className="search-snip">{h.snippet}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="search-foot">
          {scope === 'note' ? 'Enter 下一个 · Shift+Enter 上一个 · Tab 切换范围 · Esc 关闭' : '点击结果打开笔记 · Tab 切换范围 · Esc 关闭'}
        </div>
      </div>
    </div>
  )
}

void Range
void SlateEditor