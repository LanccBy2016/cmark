/**
 * 顶部搜索栏
 *
 * 为什么不用宿主的 setSubInput：
 *   ZTools 的子输入框由宿主渲染在插件窗口外（宿主 DOM 里），焦点在它身上时
 *   插件页收不到任何键盘事件，上下键切换命中、回车打开、Esc 清空全都没法做。
 *   V1.0.0 在 uTools 上能用，是因为 uTools 会把按键转发给插件；ZTools 没有这个能力。
 *   所以这里自己画一条，外观对齐宿主那条（高 48px、左侧放大镜）。
 *
 * 交互（对齐 V1.0.0 的搜素体验）：
 *   输入      → 实时搜标题 + 正文，目录树只留命中项并自动展开
 *   上下键     → 在命中列表里移动，自动打开对应文件并高亮
 *   回车       → 打开当前选中的命中
 *   Esc        → 清空搜索
 *   Ctrl+F     → 聚焦搜索框
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNotes } from '../store/notes'

export function SearchBar() {
  const searchTerm = useNotes((s) => s.searchTerm)
  const searchNotes = useNotes((s) => s.searchNotes)
  const searchHits = useNotes((s) => s.searchHits)
  const currentRel = useNotes((s) => s.currentRel)
  const openNote = useNotes((s) => s.openNote)

  const [text, setText] = useState(searchTerm)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const keys = useMemo(() => Object.keys(searchHits), [searchHits])
  const total = keys.length

  /* 外部清空（比如 Esc 或切工作区）时同步 */
  useEffect(() => {
    setText(searchTerm)
  }, [searchTerm])

  /* 命中变化后把光标收回第一个 */
  useEffect(() => {
    setCursor(0)
  }, [searchHits])

  /* Ctrl+F 聚焦 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openAt = (idx: number) => {
    const rel = keys[idx]
    if (!rel) return
    setCursor(idx)
    if (rel !== currentRel) {
      try {
        void openNote(rel)
      } catch (e) {}
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (total) openAt((cursor + 1) % total)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (total) openAt((cursor - 1 + total) % total)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (total) openAt(cursor)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setText('')
      searchNotes('')
      inputRef.current?.blur()
    }
  }

  const onChange = (v: string) => {
    setText(v)
    searchNotes(v)
  }

  return (
    <div className="search-bar">
      <span className="search-bar-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="7" cy="7" r="4.2" />
          <path d="M10.2 10.2 13.5 13.5" />
        </svg>
      </span>
      <input
        ref={inputRef}
        className="search-bar-input"
        type="text"
        value={text}
        placeholder="搜索所有笔记（标题与正文）"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {text.trim() ? (
        <>
          <span className="search-bar-count">
            {total ? `${cursor + 1}/${total}` : '无命中'}
          </span>
          <button
            type="button"
            className="search-bar-clear"
            title="清空搜索 Esc"
            onClick={() => {
              setText('')
              searchNotes('')
              inputRef.current?.focus()
            }}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </>
      ) : null}
    </div>
  )
}