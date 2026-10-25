import { create } from 'zustand'
import type { TreeNode } from '../types/global'
import type { Editor as SlateEditor } from 'slate'

/** 编辑器命令面（Slate 语义）：工具栏和快捷键都走这里 */
export type EditorApi = {
  /** 给选区加/去行内标记，如 bold / italic / code / strike / highlight / underline */
  toggleMark: (mark: 'bold' | 'italic' | 'code' | 'strike' | 'highlight' | 'underline') => void
  /** 给选区加链接 */
  setLink: (href: string) => void
  /** 切换块类型：heading(level) / paragraph / blockquote / list */
  toggleBlock: (kind: 'paragraph' | 'blockquote' | 'bulleted-list' | 'numbered-list' | 'task-list' | 'heading', level?: number) => void
  /** 插入独立节点：代码块 / 表格 / 分割线 / 公式块 */
  insertNode: (kind: 'codeblock' | 'table' | 'hr' | 'math') => void
  /** 在光标处插入一段文本（内联公式等） */
  insertText: (text: string) => void
  /** 插入图片：rel 是工作区内的相对路径（assets/xxx.png） */
  insertImage: (rel: string, alt?: string) => void
  /** 把一段 Markdown 解析成块级节点后插入（AI 生成的图表/表格用它） */
  insertMarkdown: (md: string) => void
  focus: () => void
}

interface NoteState {
  workspace: string
  tree: TreeNode[]
  truncated: boolean
  currentRel: string
  content: string
  savedContent: string
  saving: boolean
  message: string
  editorApi: EditorApi | null
  /** 当前编辑器实例（搜索定位需要它） */
  editor: SlateEditor | null
  /** 光标处的行内标记，工具栏据此显示激活态 */
  activeMarks: Record<string, boolean>
  /** 光标所在的块类型 */
  activeBlock: { type: string; level?: number; checked?: boolean; lang?: string }
  /** 当前笔记是否只读（locked.txt） */
  locked: boolean
  /** 每次 openNote 自增，用于强制编辑器重新灌入（同一 rel 重载时 effect 也要跑） */
  loadRevision: number
  /** 当前笔记是否已设为全局搜索指令（near.txt） */
  near: boolean
  /** 是否隐藏编辑工具栏 */
  toolbarHidden: boolean
  /** 源码模式：直接编辑 Markdown 原文 */
  sourceMode: boolean
  /** 正文字号档位 */
  /** 正文字号 12..16（V1.0.0 五档：紧凑/偏小/默认/偏大/舒适） */
  bodyFontSize: number
  /** AI 面板开关（工具栏触发） */
  aiOpen: boolean
  /** 搜索词：非空时编辑器里高亮所有命中 */
  searchTerm: string
  /** 全文索引：搜索要能命中正文，必须先把内容读进内存（对应 V1.0.0 的 NOTES_DIC） */
  notesIndex: { rel: string; text: string }[]
  /** 命中表：rel -> 命中字段与片段 */
  searchHits: Record<string, { field: 'title' | 'content'; snippet: string }>
  /** 命中文件的顺序：严格按目录树（受 order.txt 影响），上下键与默认命中都按它走 */
  hitOrder: string[]
  /** 打开时磁盘文件的 mtime，用于检测外部改动 */
  diskMtime: number
  /** 外部改动冲突：非空时表示磁盘被别的程序改过，暂停自动保存 */
  conflict: string

  refreshTree: () => void
  openNote: (rel: string) => void
  setContent: (text: string) => void
  save: () => void
  setMessage: (msg: string, ms?: number) => void
  setEditorApi: (api: EditorApi | null) => void
  setEditor: (ed: SlateEditor | null) => void
  /** 把当前内容记为「已保存」，用于打开笔记后建立基准，避免未编辑就落盘 */
  markClean: (text: string) => void
  setActive: (
    marks: Record<string, boolean>,
    block: { type: string; level?: number; checked?: boolean; lang?: string }
  ) => void
  toggleLocked: () => void
  toggleNear: () => void
  toggleToolbar: () => void
  toggleSourceMode: () => void
  setBodyFontSize: (v: number) => void
  setAiOpen: (v: boolean) => void
  /** 关掉当前笔记（删除它之前调用，避免自动保存把它写回来） */
  clearCurrent: () => void
  setSearchTerm: (v: string) => void
  /** 重建全文索引 */
  buildIndex: () => void
  /** 按关键词搜索标题与正文，结果写入 searchHits */
  searchNotes: (kw: string) => void
  /** 冲突时用户选择覆盖磁盘 */
  forceSave: () => void
  /** 冲突时用户选择重新载入磁盘 */
  reloadFromDisk: () => void
}

let messageTimer: number | undefined

export const useNotes = create<NoteState>((set, get) => ({
  workspace: '',
  tree: [],
  truncated: false,
  currentRel: '',
  content: '',
  savedContent: '',
  saving: false,
  message: '',
  editorApi: null,
  editor: null,
  activeMarks: {},
  activeBlock: { type: 'paragraph' },
  locked: false,
  loadRevision: 0,
  near: false,
  toolbarHidden: false,
  sourceMode: false,
  bodyFontSize: 14,
  aiOpen: false,
  searchTerm: '',
  notesIndex: [],
  searchHits: {},
  hitOrder: [],
  diskMtime: 0,
  conflict: '',

  refreshTree() {
    const r = window.__CMARK.listTree()
    set({ workspace: r.workspace, tree: r.children, truncated: r.truncated })
  },

  openNote(rel) {
    // 每次打开都自增：同一 rel 重新载入（git 面板还原、冲突后重读）时，
    // 编辑器 effect 只依赖 currentRel 的话不会重跑，会拿旧文档覆盖磁盘新内容
    set({ loadRevision: (get().loadRevision || 0) + 1 })
    const { currentRel, content, savedContent, save } = get()
    if (currentRel && content !== savedContent) save()

    // 读失败不能当空笔记：否则用户一敲字就把整篇原正文覆盖成几个字
    const res = window.__CMARK.readNoteEx?.(rel)
    let text = ''
    let mtime = 0
    if (res) {
      if (!res.ok) {
        // 文件已经不在了（典型场景：git 丢弃改动把未跟踪的新文件直接删掉，
        // 随后 git 面板回调 reloadNote 重新打开它）——这不是错误，静默收场即可
        const gone = res.code === 'ENOENT' || /ENOENT/i.test(String(res.message || ''))
        if (gone) {
          set({
            currentRel: '',
            content: '',
            savedContent: '',
            conflict: '',
            message: '这篇笔记已不存在',
          })
          try {
            get().refreshTree()
          } catch (e) {}
          return
        }
        set({
          conflict: '',
          message: `打开失败：${res.message || res.code || '无法读取文件'}`,
        })
        return
      }
      text = res.text ?? ''
      mtime = res.mtime ?? 0
    } else {
      // 老接口兜底（没有 readNoteEx 时仍走原路径）
      if (window.__CMARK.exists && !window.__CMARK.exists(rel)) {
        set({ message: '这篇笔记已不存在' })
        get().refreshTree()
        return
      }
      text = window.__CMARK.readNote(rel)
      mtime = window.__CMARK.statNote?.(rel)?.mtime ?? 0
    }

    // 只读状态由数据层决定（locked.txt），界面据此禁写
    const st = window.__ZNOTES?.readNoteState?.(rel)
    set({
      currentRel: rel,
      content: text,
      savedContent: text,
      diskMtime: mtime,
      conflict: '',
      locked: !!(st && st.locked),
      near: !!(st && st.near),
    })
  },

  setContent(text) {
    set({ content: text })
  },

  save() {
    const { currentRel, content, savedContent, locked } = get()
    if (!currentRel || content === savedContent) return
    if (locked) {
      get().setMessage('该笔记已设为只读，未保存', 2600)
      return
    }
    // 文件在磁盘上已经没了（被删除、被重命名、被拖走）→ 不能补写，否则会复活一篇旧笔记，
    // 但必须告诉用户，否则他会以为一直在保存，实际编辑了十几分钟全丢
    if (window.__CMARK?.exists && !window.__CMARK.exists(currentRel)) {
      set({ savedContent: content, conflict: '文件已不在原位置（可能被移动或删除）' })
      get().setMessage('这篇笔记已不在原位置，内容未保存', 5000)
      return
    }

    // 外部改动检测：磁盘 mtime 变了说明被别的编辑器/同步工具改过，
    // 直接写会覆盖别人的改动，停下来把选择权交给用户
    const now = window.__CMARK.statNote?.(currentRel)
    if (now && now.ok && get().diskMtime && now.mtime && now.mtime !== get().diskMtime) {
      set({ conflict: '磁盘上的文件已被其它程序修改' })
      get().setMessage('这篇笔记在磁盘上被改过，已暂停保存', 5000)
      return
    }

    set({ saving: true })
    const r = window.__CMARK.writeNote(currentRel, content)
    set({ saving: false })
    if (r.ok) {
      const st = window.__CMARK.statNote?.(currentRel)
      set({ savedContent: content, diskMtime: st?.mtime || get().diskMtime, conflict: '' })
    } else {
      get().setMessage('保存失败：' + (r.message || '未知错误'), 4000)
    }
  },

  setMessage(msg, ms = 2500) {
    set({ message: msg })
    if (messageTimer) window.clearTimeout(messageTimer)
    messageTimer = window.setTimeout(() => set({ message: '' }), ms)
  },

  setEditorApi(api) {
    set({ editorApi: api })
  },

  setEditor(ed) {
    set({ editor: ed })
  },

  markClean(text) {
    set({ content: text, savedContent: text })
  },

  setActive(marks, block) {
    set({ activeMarks: marks, activeBlock: block })
  },

  toggleToolbar() {
    set({ toolbarHidden: !get().toolbarHidden })
  },

  toggleSourceMode() {
    set({ sourceMode: !get().sourceMode })
  },

  forceSave() {
    const { currentRel, content } = get()
    if (!currentRel) return
    set({ conflict: '', savedContent: '' })  // 骗过「内容没变」的短路
    const r = window.__CMARK.writeNote(currentRel, content)
    const st = window.__CMARK.statNote?.(currentRel)
    if (r.ok) set({ savedContent: content, diskMtime: st?.mtime || 0 })
    else get().setMessage('保存失败：' + (r.message || ''), 4000)
  },

  reloadFromDisk() {
    const { currentRel } = get()
    if (!currentRel) return
    set({ conflict: '' })
    get().openNote(currentRel)
    get().setMessage('已重新载入磁盘上的版本', 2400)
  },

  buildIndex() {
    const bridge = window.__CMARK as unknown as { loadAllNotes?: () => { rel: string; text: string }[] }
    let list: { rel: string; text: string }[] = []
    try {
      list = bridge?.loadAllNotes?.() || []
    } catch (e) {
      list = []
    }
    set({ notesIndex: list })
  },

  searchNotes(kw) {
    const q = String(kw ?? '').trim().toLowerCase()
    if (!q) {
      set({ searchTerm: '', searchHits: {}, hitOrder: [] })
      // 不要在这里 setSubInputValue：宿主会把它当成一次输入变化回调回来，
      // 于是 searchNotes('') -> setSubInputValue('') -> 回调 -> searchNotes('') 无限循环，
      // 表现就是搜索框一直闪、打不进字。同步只在 Esc 那种「框里还有字」的场景做。
      return
    }
    const hits: Record<string, { field: 'title' | 'content'; snippet: string }> = {}
    // 索引为空时先建一次（首次搜索时兜底）
    const index = get().notesIndex.length ? get().notesIndex : (() => {
      const bridge = window.__CMARK as unknown as { loadAllNotes?: () => { rel: string; text: string }[] }
      let l: { rel: string; text: string }[] = []
      try {
        l = bridge?.loadAllNotes?.() || []
      } catch (e) {}
      if (l.length) set({ notesIndex: l })
      return l
    })()

    for (const n of index) {
      const fileName = n.rel.split('/').pop() || n.rel
      const title = fileName.replace(/\.md$/i, '')
      if (title.toLowerCase().includes(q)) {
        hits[n.rel] = { field: 'title', snippet: '' }
        continue
      }
      const idx = n.text.toLowerCase().indexOf(q)
      if (idx >= 0) {
        const start = Math.max(0, idx - 30)
        const snippet = n.text.slice(start, idx + q.length + 40).replace(/\s+/g, ' ').trim()
        hits[n.rel] = { field: 'content', snippet }
      }
    }
    // 命中顺序必须跟目录树一致：索引是文件系统遍历序，树是 order.txt 排过的序，
    // 直接用 Object.keys 会出现「上下键跳着走」的问题
    const ordered: string[] = []
    const walk = (list: TreeNode[]) => {
      for (const n of list) {
        if (n.type === 'folder') walk(n.children || [])
        else if (Object.prototype.hasOwnProperty.call(hits, n.rel)) ordered.push(n.rel)
      }
    }
    walk(get().tree || [])
    // 兜底：索引里有、但树里暂时没有的（比如刚建还没刷新），按原顺序补在后面
    for (const rel of Object.keys(hits)) {
      if (!ordered.includes(rel)) ordered.push(rel)
    }

    set({ searchTerm: kw, searchHits: hits, hitOrder: ordered })

    // 自动打开第一个命中（用户要求：搜索后默认落在排第一的那条）。
    // 加一点延迟，避免每敲一个字就切一次文件。
    const keys = ordered
    if (keys.length) {
      const target = keys[0]
      setTimeout(() => {
        if (get().searchTerm !== kw) return
        try {
          void get().openNote(target)
          // 打开是搜索触发的，焦点应留在搜索框里，方便继续用上下键翻命中；
          // 否则焦点会留在正文，上下键变成移动光标
          window.setTimeout(() => {
            try {
              const z = (window as unknown as { ztools?: { subInputFocus?: () => void } }).ztools
              z?.subInputFocus?.()
            } catch (e) {}
          }, 120)
        } catch (e) {}
      }, 350)
    }
  },

  setSearchTerm(v) {
    set({ searchTerm: v })
  },

  clearCurrent() {
    set({ currentRel: '', content: '', savedContent: '', locked: false, near: false })
  },

  /** 设为全局搜索指令：写 near.txt + 向 ZTools 注册 feature */
  toggleNear() {
    const { currentRel, near, setMessage } = get()
    if (!currentRel) return
    const next = !near
    const r = window.__ZNOTES?.setNoteNear?.(currentRel, next)
    if (r && r.ok === false) {
      setMessage('设置失败：' + (r.message || '未知原因'), 3200)
      return
    }
    const title = currentRel.split('/').pop()!.replace(/\.(md|markdown)$/i, '')
    try {
      const z = window.ztools as unknown as {
        setFeature?: (o: { code: string; icon?: string; explain?: string; cmds?: string[] }) => void
        removeFeature?: (code: string) => void
      }
      const code = 'note/' + currentRel
      if (next) {
        z?.setFeature?.({ code, icon: 'logo', explain: '打开笔记「' + title + '」', cmds: [title] })
      } else {
        z?.removeFeature?.(code)
      }
    } catch (e) {}
    set({ near: next })
    setMessage(next ? '已设为全局搜索：「' + title + '」' : '已取消全局搜索', 2400)
  },

  setAiOpen(v) {
    set({ aiOpen: v })
  },

  setBodyFontSize(v: number) {
    const n = Math.min(16, Math.max(12, Math.round(Number(v) || 14)))
    set({ bodyFontSize: n })
    try {
      window.localStorage.setItem('cmark-dev-body-font-size', String(n))
    } catch (e) {}
  },

  toggleLocked() {
    const { currentRel, locked, setMessage } = get()
    if (!currentRel) return
    const r = window.__ZNOTES?.setNoteLocked?.(currentRel, !locked)
    if (r && r.ok) {
      set({ locked: !locked })
      setMessage(!locked ? '已设为只读' : '已取消只读', 1800)
    } else {
      // 失败不能静默：用户会以为已经锁上了
      setMessage('设置只读失败：' + (r?.message || '接口不可用'), 3600)
    }
  },
}))

// 开发期调试出口：便于用 CDP 直接驱动 store。
// 必须包在 DEV 里 —— 生产构建时 Vite 会把整块静态剔除，
// 发布产物里不能留任何可以从 DevTools 直接改文档状态的入口。
if (import.meta.env.DEV) {
  try {
    const w = window as unknown as { __cmarkStore?: unknown; __notesStore?: unknown }
    w.__cmarkStore = useNotes
    w.__notesStore = useNotes
  } catch (e) {}
}
