import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createEditor, Editor as SlateEditor, Transforms, Node } from 'slate'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'
import { withHistory } from 'slate-history'
import { useNotes, type EditorApi } from '../store/notes'
import { emptyDoc, normalizeDoc, type CMarkElement } from '../core/slate-model'
import { inflateDoc, deflateDoc } from '../core/inline'
import { RenderElement, RenderLeaf } from '../editor/renderers'
import {
  withShortcuts,
  handleKeyDown,
  currentBlock,
  currentTableCell,
  toggleHeading,
  toggleBlockquote,
  toggleList,
  toggleParagraph,
  insertTable,
} from '../editor/withPlugins'
import { TableMenu } from './TableMenu'

/** 编辑器内容 → Markdown（序列化单一来源仍是 ndb.js） */
function toMd(value: CMarkElement[]): string {
  try {
    const ndb = window.__ZNOTES as unknown as { toMarkdown?: (nodes: unknown) => string } | undefined
    if (ndb && typeof ndb.toMarkdown === 'function') return ndb.toMarkdown(deflateDoc(value))
  } catch (e) {}
  return value.map((n) => Node.string(n)).join('\n\n')
}

/** Markdown → 编辑器节点 */
function toNodes(md: string): CMarkElement[] {
  try {
    const ndb = window.__ZNOTES as unknown as { toNodes?: (md: string) => unknown } | undefined
    if (ndb && typeof ndb.toNodes === 'function') return normalizeDoc(inflateDoc(ndb.toNodes(md)))
  } catch (e) {}
  return emptyDoc()
}

export function Editor() {
  const { content, currentRel, setContent, setActive, markClean, locked, setMessage, sourceMode, searchTerm } = useNotes()

  // 每次切换笔记重建 editor：撤销栈跟着清空，否则 Ctrl+Z 会撤到上一篇的内容
  const editor = useMemo(
    () => withShortcuts(withHistory(withReact(createEditor()))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentRel]
  )

  // 依赖里必须带 sourceMode：从源码模式切回来时 Slate 子树会重新挂载，
  // 只认 currentRel 的话 memo 会返回切走前的旧内容，用户敲一个字就把它写回去
  const initialValue = useMemo<CMarkElement[]>(
    () => toNodes(content),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentRel, sourceMode]
  )

  // 基准里带上 rel：React 的 effect 是子先父后，靠 useEffect 清空 baseline
  // 会晚于 Slate 首帧的 onChange，切笔记时第一次 onChange 会拿上一篇的 md 比较，
  // 判定「内容变了」→ 把新笔记标脏 → 600ms 后自动保存重写一遍
  const baselineRef = useRef<{ rel: string; md: string | null }>({ rel: '', md: null })

  const onChange = useCallback(
    (value: CMarkElement[]) => {
      // 工具栏激活态：跟随光标所在块与行内标记
      const marks = (SlateEditor.marks(editor) || {}) as Record<string, unknown>
      const blk = currentBlock(editor)
      setActive(
        {
          bold: !!marks.bold,
          italic: !!marks.italic,
          underline: !!marks.underline,
          code: !!marks.code,
          strike: !!marks.strike,
          highlight: !!marks.highlight,
          link: !!marks.link,
        },
        blk
          ? {
              type: (blk[0] as { type: string }).type,
              level: (blk[0] as { level?: number }).level,
              checked: (blk[0] as { checked?: boolean }).checked,
              lang: (blk[0] as { lang?: string }).lang,
            }
          : { type: 'paragraph' }
      )

      // 只有光标/选区变化时不必做「全文档 → Markdown」：这是每按键 O(全文档) 的开销来源
      const ops = (editor as unknown as { operations: { type: string }[] }).operations || []
      if (ops.length && ops.every((op) => op.type === 'set_selection')) {
        const blk = currentBlock(editor)
        const marks = (SlateEditor.marks(editor) || {}) as Record<string, unknown>
        setActive(
          {
            bold: !!marks.bold,
            italic: !!marks.italic,
            underline: !!marks.underline,
            code: !!marks.code,
            strike: !!marks.strike,
            highlight: !!marks.highlight,
            link: !!marks.link,
          },
          blk
            ? {
                type: (blk[0] as { type: string }).type,
                level: (blk[0] as { level?: number }).level,
                checked: (blk[0] as { checked?: boolean }).checked,
                lang: (blk[0] as { lang?: string }).lang,
              }
            : { type: 'paragraph' }
        )
        return
      }

      const md = toMd(value)
      const base = baselineRef.current
      // 换了笔记：把这一篇的首次序列化直接作为干净基准
      if (base.rel !== currentRel) {
        baselineRef.current = { rel: currentRel, md }
        markClean(md)
        return
      }
      if (base.md === null) {
        baselineRef.current = { rel: currentRel, md }
        markClean(md)
        return
      }
      if (md === base.md) return
      baselineRef.current = { rel: currentRel, md }
      setContent(md)
    },
    [editor, setContent, setActive, markClean]
  )

  /* ---------------- 搜索高亮 ---------------- */

  const decorate = useCallback(
    ([node, path]: [unknown, number[]]) => {
      const q = searchTerm.trim().toLowerCase()
      if (!q) return []
      const n = node as { text?: string }
      if (typeof n.text !== 'string') return []
      const text = n.text.toLowerCase()
      const out: { anchor: { path: number[]; offset: number }; focus: { path: number[]; offset: number }; searchHit: true }[] = []
      let from = 0
      for (;;) {
        const i = text.indexOf(q, from)
        if (i < 0) break
        out.push({
          anchor: { path, offset: i },
          focus: { path, offset: i + q.length },
          searchHit: true,
        })
        from = i + q.length
      }
      return out
    },
    [searchTerm]
  )

  /* ---------------- 命令面 ---------------- */

  const actions = useMemo(() => {
    const askLink = () => {
      const sel = editor.selection
      const picked = sel && !isCollapsed(sel) ? SlateEditor.string(editor, sel) : ''
      const href = window.prompt('链接地址', picked.startsWith('http') ? picked : 'https://')
      if (!href) return
      if (sel && !isCollapsed(sel)) SlateEditor.addMark(editor, 'link', href)
      else Transforms.insertText(editor, href)
      ReactEditor.focus(editor)
    }

    const guard = () => {
      if (!locked) return false
      setMessage('该笔记已设为只读', 2200)
      return true
    }

    return {
      toggleMark(m: 'bold' | 'italic' | 'underline' | 'code' | 'strike' | 'highlight') {
        if (guard()) return
        const cur = SlateEditor.marks(editor) as Record<string, unknown> | null
        if (cur && cur[m]) SlateEditor.removeMark(editor, m)
        else SlateEditor.addMark(editor, m, true)
        ReactEditor.focus(editor)
      },
      setLink: askLink,
      toggleBlock(
        kind: 'paragraph' | 'blockquote' | 'bulleted-list' | 'numbered-list' | 'task-list' | 'heading',
        level?: number
      ) {
        if (guard()) return
        if (kind === 'heading') toggleHeading(editor, Math.min(6, Math.max(1, level || 1)) as 1 | 2 | 3)
        else if (kind === 'blockquote') toggleBlockquote(editor)
        else if (kind === 'paragraph') toggleParagraph(editor)
        else toggleList(editor, kind)
        ReactEditor.focus(editor)
      },
      insertNode(kind: 'codeblock' | 'table' | 'hr' | 'math') {
        if (guard()) return
        const tail = () =>
          Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] } as never)
        if (kind === 'codeblock') {
          Transforms.insertNodes(editor, { type: 'codeblock', lang: '', children: [{ text: '' }] } as never)
          tail()
        } else if (kind === 'table') {
          insertTable(editor, 2, 2)
        } else if (kind === 'hr') {
          Transforms.insertNodes(editor, { type: 'hr', children: [{ text: '' }] } as never)
          tail()
        } else if (kind === 'math') {
          Transforms.insertNodes(editor, { type: 'math', value: '', children: [{ text: '' }] } as never)
          tail()
        }
        ReactEditor.focus(editor)
      },
      insertText(text: string) {
        if (locked) {
          setMessage('该笔记已设为只读，未插入', 2400)
          return
        }
        Transforms.insertText(editor, text)
        ReactEditor.focus(editor)
      },
      /** 插入一段 Markdown：先解析成块级节点，再原样插入（AI 生成的图表/表格用） */
      insertMarkdown(md: string) {
        if (locked) {
          setMessage('该笔记已设为只读，未插入', 2400)
          return
        }
        try {
          const nodes = toNodes(md)
          if (!nodes.length) return
          Transforms.insertNodes(editor, nodes as never)
          Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] } as never)
          ReactEditor.focus(editor)
        } catch (err) {
          setMessage('插入失败：' + ((err as Error)?.message || ''), 3000)
        }
      },
      focus() {
        ReactEditor.focus(editor)
      },
    }
  }, [editor, locked, setMessage])

  const { setEditorApi, setEditor } = useNotes()
  useEffect(() => {
    setEditor(editor)
    return () => setEditor(null)
  }, [editor, setEditor])
  useEffect(() => {
    const api: EditorApi = {
      toggleMark: actions.toggleMark,
      setLink: (href: string) => {
        SlateEditor.addMark(editor, 'link', href)
        ReactEditor.focus(editor)
      },
      toggleBlock: actions.toggleBlock,
      insertNode: actions.insertNode,
      insertText: actions.insertText,
      insertImage: () => {},
      insertMarkdown: actions.insertMarkdown,
      focus: actions.focus,
    }
    setEditorApi(api)
    return () => setEditorApi(null)
  }, [actions, editor, setEditorApi])

  /* ---------------- 表格右键菜单 ---------------- */

  const [menu, setMenu] = useState<{ x: number; y: number; path: number[] } | null>(null)

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const cell = currentTableCell(editor)
      if (!cell) return
      e.preventDefault()
      setMenu({ x: e.clientX, y: e.clientY, path: cell[1] })
    },
    [editor]
  )

  /* ---------------- 粘贴图片 ---------------- */

  const onPaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || [])
      const hasImage = files.some((f) => f.type.startsWith('image/'))
      if (!hasImage) return
      e.preventDefault()
      if (locked) {
        setMessage('该笔记已设为只读', 2200)
        return
      }
      const file = files[0] as File & { path?: string }
      const bridge = window.__CMARK as unknown as {
        saveImageToWorkspace?: (srcPath?: string, base64?: string) => { ok: boolean; rel?: string; message?: string }
      }
      let r = file.path ? bridge?.saveImageToWorkspace?.(file.path) : undefined
      if (!r || !r.ok) {
        // Electron 偶尔拿不到 File.path，退回读 base64
        const b64 = await readFileAsDataUrl(file)
        r = bridge?.saveImageToWorkspace?.(undefined, b64)
      }
      if (r && r.ok && r.rel) {
        Transforms.insertNodes(editor, {
          type: 'image',
          url: r.rel,
          alt: file.name || '图片',
          children: [{ text: '' }],
        } as never)
        Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] } as never)
      } else {
        setMessage(r?.message || '图片保存失败', 3000)
      }
    },
    [editor, locked, setMessage]
  )

  if (sourceMode) {
    return (
      <div className="editor-host">
        <textarea
          className="source-editor"
          value={content}
          spellCheck={false}
          readOnly={locked}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
    )
  }

  return (
    <div className="editor-host">
      <Slate
        key={currentRel}
        editor={editor}
        initialValue={initialValue}
        onChange={onChange as (v: unknown[]) => void}
      >
        <Editable
          className={locked ? 'editor-readonly' : undefined}
          readOnly={locked}
          renderElement={RenderElement}
          renderLeaf={RenderLeaf}
          decorate={decorate as never}
          placeholder="开始写点什么…"
          spellCheck={false}
          autoFocus={false}
          onKeyDown={(e) => {
            if (handleKeyDown(editor, e, actions)) return
          }}
          onContextMenu={onContextMenu}
          onPaste={onPaste}
        />
      </Slate>
      {menu && (
        <TableMenu
          x={menu.x}
          y={menu.y}
          cellPath={menu.path}
          editor={editor}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

function isCollapsed(sel: { anchor: unknown; focus: unknown }): boolean {
  return JSON.stringify(sel.anchor) === JSON.stringify(sel.focus)
}


/** 把 File 读成 data URL（拿不到 File.path 时兜底） */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = () => resolve('')
    fr.readAsDataURL(file)
  })
}
