import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/EditorPlate'
import { Toolbar } from './components/Toolbar'
import { IconMenu } from './components/icons'
import { SearchDialog } from './components/SearchDialog'
import { MoreMenu } from './components/MoreMenu'
import { PushStatus } from './components/PushStatus'
import { Onboard } from './components/Onboard'
import { AiPanel } from './components/AiPanel'
import { useNotes } from './store/notes'

export default function App() {
  const currentRel = useNotes((s) => s.currentRel)
  const content = useNotes((s) => s.content)
  const savedContent = useNotes((s) => s.savedContent)
  const save = useNotes((s) => s.save)
  const message = useNotes((s) => s.message)
  const buildIndex = useNotes((s) => s.buildIndex)
  const searchNotes = useNotes((s) => s.searchNotes)
  const refreshTree = useNotes((s) => s.refreshTree)



  // Git 面板未初始化仓库时点「打开设置」：先收起 git 面板再开设置
  useEffect(() => {
    const h = () => {
      const g = (window as unknown as { __zgsOpen?: () => void }).__zgsOpen
      if (g) g()
    }
    window.addEventListener('cmark-open-settings', h)
    return () => window.removeEventListener('cmark-open-settings', h)
  }, [])

  const [searchOpen, setSearchOpen] = useState(false)
  const conflict = useNotes((s) => s.conflict)
  const forceSave = useNotes((s) => s.forceSave)
  const reloadFromDisk = useNotes((s) => s.reloadFromDisk)
  const sourceMode = useNotes((s) => s.sourceMode)
  const toggleSourceMode = useNotes((s) => s.toggleSourceMode)
  const aiOpen = useNotes((s) => s.aiOpen)
  const setAiOpen = useNotes((s) => s.setAiOpen)
  const bodyFontSize = useNotes((s) => s.bodyFontSize)
  const locked = useNotes((s) => s.locked)
  const toggleLocked = useNotes((s) => s.toggleLocked)
  const near = useNotes((s) => s.near)
  const toggleNear = useNotes((s) => s.toggleNear)
  const editorInstance = useNotes((s) => s.editor)
  const [sidebarHidden, setSidebarHidden] = useState(false)

  // 自动保存：输入停止 600ms 落盘
  useEffect(() => {
    if (!currentRel || content === savedContent) return
    const t = window.setTimeout(() => save(), 600)
    return () => window.clearTimeout(t)
  }, [content, savedContent, currentRel, save])

  // 关闭前必须落盘；失焦不写盘。
  // 原来失焦也写，切到别的编辑器看一眼就把内容落盘了，会放大与外部改动的覆盖碰撞。
  useEffect(() => {
    const flush = () => {
      const s = useNotes.getState()
      if (s.currentRel && s.content !== s.savedContent) s.save()
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  // 磁盘变化 → 刷新树
  useEffect(() => {
    if (window.__CMARK && window.__CMARK.onWorkspaceChange) {
      window.__CMARK.onWorkspaceChange(() => {
        window.setTimeout(() => refreshTree(), 250)
      })
    }
  }, [refreshTree])

  // Ctrl+Alt+, 折叠侧边栏
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key === ',') {
        e.preventDefault()
        setSidebarHidden((v) => !v)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /**
   * 顶部搜索框来自宿主：zTools 的 setSubInput 在窗口顶部渲染子输入框。
   * 签名沿用 uTools 顺序 setSubInput(callback, placeholder)，
   * 回调参数是 { text: string }，取值必须走 .text。
   */
  useEffect(() => {
    const z = (
      window as unknown as {
        ztools?: {
          setSubInput?: (cb: (arg: unknown) => void, ph?: string) => void
          removeSubInput?: () => void
          subInputFocus?: () => void
        }
      }
    ).ztools
    if (!z?.setSubInput) return

    const handler = (arg: unknown) => {
      // 我们自己调 setSubInputValue 时宿主会回调一次，跳过它免得形成循环
      if ((window as unknown as { __cmarkSyncing?: boolean }).__cmarkSyncing) return
      const raw = arg as { text?: unknown } | string | undefined
      let text = ''
      if (typeof raw === 'string') text = raw
      else if (raw && typeof raw === 'object' && 'text' in raw) text = String((raw as { text?: unknown }).text ?? '')
      searchNotes(text)
    }

    try {
      z.setSubInput(handler, '搜索所有笔记')
      window.setTimeout(() => {
        try {
          z.subInputFocus?.()
        } catch (e) {}
      }, 150)
    } catch (e) {}

    /**
     * 唤醒时把焦点还给搜索框。
     *
     * 这里必须非常克制：subInputFocus 是宿主级的，一调就把焦点从编辑器抢走。
     *   - 只挂在 onPluginEnter（真正的插件进入事件），不挂 window.focus
     *     （window.focus 在点编辑器时也会触发，会把光标一直拽回搜索框）
     *   - 焦点已经在插件内部（编辑器/文本框）时直接跳过
     *   - 最多试两次，避免在窗口还没激活时反复抢
     */
    const refocus = () => {
      const ae = document.activeElement as HTMLElement | null
      if (ae) {
        if (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') return
        if (ae.closest && ae.closest('.plate-content')) return
      }
      let tries = 0
      const tick = () => {
        tries++
        const cur = document.activeElement as HTMLElement | null
        if (cur && (cur.tagName === 'TEXTAREA' || (cur.closest && cur.closest('.plate-content')))) return
        try {
          z.subInputFocus?.()
        } catch (e) {}
        if (tries < 2) window.setTimeout(tick, 220)
      }
      tick()
    }

    let offEnter: (() => void) | undefined
    try {
      const zz = window as unknown as {
        ztools?: { onPluginEnter?: (cb: () => void) => (() => void) | void }
      }
      offEnter = zz.ztools?.onPluginEnter?.(refocus) || undefined
    } catch (e) {}

    return () => {
      try {
        offEnter?.()
      } catch (e) {}
      try {
        z.removeSubInput?.()
      } catch (e) {}
    }
  }, [searchNotes])

  /**
   * 搜索态下的键盘操作。
   * 焦点在宿主的子输入框里，但 ZTools 会把按键转发到插件页的 window，
   * 所以这里用 capture 阶段监听：上下键在命中列表里移动并打开文件，Esc 清空。
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useNotes.getState()
      if (!st.searchTerm.trim()) return
      /**
       * 规则（用户口径）：搜索态下，只要焦点不在编辑区，上下键就用作目录导航。
       * 焦点在编辑区时让给编辑器，正常移动光标。
       * 注意不要额外排除 INPUT —— 焦点可能在插件自己的输入控件上，那些也应当导航。
       */
      const ae = document.activeElement as HTMLElement | null
      const inEditor =
        !!ae &&
        (ae.isContentEditable ||
          !!(ae.closest && (ae.closest('.plate-content') || ae.closest('.editor-card'))))
      if (inEditor) return
      // 顺序必须跟目录树一致，否则上下键会跳着走
      const keys = st.hitOrder.length ? st.hitOrder : Object.keys(st.searchHits)
      if (!keys.length) return
      const cur = keys.indexOf(st.currentRel)

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const dir = e.key === 'ArrowDown' ? 1 : -1
        const next = cur < 0 ? 0 : (cur + dir + keys.length) % keys.length
        try {
          void st.openNote(keys[next])
        } catch (err) {}
      } else if (e.key === 'Escape') {
        e.preventDefault()
        st.searchNotes('')
        // Unity: 这一步只在用户主动清空时做，清宿主框里的残留文字
        try {
          const z = (window as unknown as { ztools?: { setSubInputValue?: (v: string) => void } }).ztools
          // 用一个短标志挡住这次赋值引发的回调，避免又绕回 searchNotes
          ;(window as unknown as { __cmarkSyncing?: boolean }).__cmarkSyncing = true
          z?.setSubInputValue?.('')
          window.setTimeout(() => {
            ;(window as unknown as { __cmarkSyncing?: boolean }).__cmarkSyncing = false
          }, 50)
        } catch (err) {}
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // 全文索引：正文搜索的前提，先把所有笔记读进内存
  useEffect(() => {
    buildIndex()
  }, [buildIndex])

  // 校准「全局搜索指令」的图标：旧版本注册动态指令时把 icon 写成 'logo'（缺扩展名），
  // ZTools 拼出来是 .../cmark-x.y.z.asar/logo，文件不存在 —— 目标指令列表里就是破图。
  // 注册记录在 ZTools 的库里，改代码不会自动更新，所以每次启动按 near.txt 重注册一遍。
  // 延时是因为要先等 ndb 扫描完成，否则 readNoteState 拿不到 near 标记。
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        useNotes.getState().syncNearFeatures()
      } catch (e) {}
    }, 2500)
    return () => window.clearTimeout(t)
  }, [])

  // 字数：中文按字、英文按词，代码块不计

  // 字号档位挂到根节点，CSS 用变量控制
  useEffect(() => {
    document.documentElement.style.setProperty('--body-font-size', bodyFontSize + 'px')
    try {
      window.localStorage.setItem('cmark-dev-body-font-size', String(bodyFontSize))
    } catch (e) {}
  }, [bodyFontSize])

  /** 打开 V1.0.0 原版 git 面板（global = 工作区 / file = 当前笔记） */
  const openGit = useCallback((mode: 'global' | 'file') => {
    const fn = (window as unknown as { __zgpToggle?: (m: string) => void }).__zgpToggle
    if (fn) fn(mode)
  }, [])

  /** 打开 V1.0.0 原版设置面板 */
  const openSettings = useCallback(() => {
    const fn = (window as unknown as { __zgsToggle?: () => void }).__zgsToggle
    if (fn) fn()
  }, [])

  /** 给 preload 里的原版模块提供宿主钩子 */
  useEffect(() => {
    ;(window as unknown as { __cmarkHost?: () => unknown }).__cmarkHost = () => ({
      currentRel,
      flushSave: () => useNotes.getState().save(),
      reloadNote: (rel: string) => useNotes.getState().openNote(rel),
      refreshTree: () => useNotes.getState().refreshTree(),
      pickDir: () => {
        const r = window.__CMARK.pickWorkspace?.()
        if (r?.ok) window.setTimeout(() => window.location.reload(), 400)
      },
    })
  }, [currentRel])

  const noteName = currentRel ? currentRel.split('/').pop()!.replace(/\.(md|markdown)$/i, '') : ''

  return (
    <div className={'app' + (sidebarHidden ? ' sidebar-hidden' : '')}>
      {!sidebarHidden ? <Sidebar onOpenGitPanel={() => openGit('global')} onOpenSettings={openSettings} /> : null}
      <main className="main">
        {/* 未打开笔记时不渲染整条头部：所有操作都在侧边栏 */}
        {currentRel ? (
        <div className="header">
          <div className="menu-toggle">
            <button
              className="iconbtn"
              title="隐藏侧边栏 Ctrl+Alt+,"
              onClick={() => setSidebarHidden((v) => !v)}
            >
              <IconMenu />
            </button>
          </div>
          <div className="title">
            {currentRel ? (
              <input
                type="text"
                readOnly
                value={noteName}
                placeholder=""
                spellCheck={false}
                title="文件名请在左侧目录树中右键重命名"
              />
            ) : (
              <span className="title-empty">未打开笔记</span>
            )}
          </div>
          {/* 头部右侧按钮：只在打开了笔记时出现（V1.0.0 的 !r && 判断） */}
          <div className="handle" style={currentRel ? undefined : { display: 'none' }}>
            <PushStatus
              onOpen={() => openGit('file')}
            />
            <button
              className={'iconbtn' + (locked ? ' on' : '')}
              title={locked ? '笔记当前只读，点击恢复编辑' : '禁止编辑(设为只读)'}
              onClick={toggleLocked}
            >
              {locked ? (
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <rect x="3.2" y="7" width="9.6" height="6.6" rx="1.4" />
                  <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <rect x="3.2" y="7" width="9.6" height="6.6" rx="1.4" />
                  <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.7-.6" />
                </svg>
              )}
            </button>
            <button
              className={'iconbtn' + (near ? ' on' : '')}
              title={near ? '已是全局搜索指令，点击取消' : '设为全局搜索'}
              onClick={toggleNear}
            >
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.6 1.9 8.3 3.2l.6.6-3.4 3.4H3.4l-.7.7 2.9 2.9-3.3 3.3a.5.5 0 0 0 .7.7l3.3-3.3 2.9 2.9.7-.7v-2.1l3.4-3.4.6.6 1.3-1.3z" />
              </svg>
            </button>
            <button
              className={'iconbtn' + (sourceMode ? ' on' : '')}
              title={sourceMode ? '源码模式（点击回到富文本）' : '源码模式（直接编辑 Markdown）'}
              onClick={toggleSourceMode}
            >
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.4 4.4 2.2 8l3.2 3.6" />
                <path d="M10.6 4.4 13.8 8l-3.2 3.6" />
              </svg>
            </button>
            <MoreMenu />
          </div>
        </div>
        ) : null}

        {/* 外部改动冲突：暂停自动保存，把选择权交给用户 */}
        {conflict ? (
          <div className="conflict-bar">
            <svg
              className="cf-ico"
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 2.1 1.5 13.5h13z" />
              <path d="M8 6.2v3.1" />
              <path d="M8 11.5v.1" />
            </svg>
            <span className="cf-text">{conflict}，自动保存已暂停</span>
            <span className="cf-actions">
              <button type="button" className="cf-btn" onClick={reloadFromDisk}>
                载入磁盘版本
              </button>
              <button type="button" className="cf-btn danger" onClick={forceSave}>
                用当前内容覆盖磁盘
              </button>
            </span>
          </div>
        ) : null}

        {/* 工具栏 35px：没打开笔记时不渲染 */}
        {currentRel ? <Toolbar /> : null}

        {/* content：灰底 + 白卡片 */}
        <div className="content">
          {currentRel ? (
            <div className="editor-card">
              <Editor />
            </div>
          ) : (
            <div className="note-empty">
              <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 7h18l8 8v26a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
                <path d="M29 7v8h8" />
                <path d="M16 24h16M16 31h11" />
              </svg>
              <div className="note-empty-title">还没有打开笔记</div>
              <div className="note-empty-desc">从左侧目录树里选一篇，或者右键新建</div>
            </div>
          )}
        </div>
      </main>

      <Onboard />
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />
      {editorInstance ? (
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} editor={editorInstance} />
      ) : null}

      {message && <div className="toast">{message}</div>}
    </div>
  )
}
