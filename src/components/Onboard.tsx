/**
 * 首次使用引导：选目录 → 认识现有文件 → 决定是否启用版本控制
 *
 * 只在还没有做过引导时出现（.cmark/onboard.json 里没记录），
 * 已经用起来的用户永远不会看到它。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNotes } from '../store/notes'

type Bridge = {
  getConfig?: () => { workspace: string; initialized: boolean; workspaceExists: boolean }
  pickWorkspace?: () => { ok: boolean; canceled?: boolean; message?: string; workspace?: string }
  countMarkdown?: (dir?: string) => { markdown: number; folders: number }
  shellShowWorkspace?: () => void
  listTree?: () => unknown
}

type GitApi = {
  inspect?: () => { isRepo?: boolean }
  initRepo?: () => Promise<{ ok: boolean; message?: string }>
  adoptRepo?: () => Promise<{ ok: boolean; message?: string }>
}

const bridge = () => window.__CMARK as unknown as Bridge
const git = () => window.__znotesGit as unknown as GitApi | undefined

export function Onboard() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [ws, setWs] = useState('')
  const [count, setCount] = useState(0)
  const [isRepo, setIsRepo] = useState(false)
  const [busy, setBusy] = useState(false)
  const refreshTree = useNotes((s) => s.refreshTree)

  useEffect(() => {
    // onboard.json 里有 done 就再也不会出现
    const z = window.__ZNOTES as unknown as { onboardGet?: () => Record<string, unknown> } | undefined
    let done = false
    try {
      done = !!(z?.onboardGet?.() as { done?: boolean })?.done
    } catch (e) {}
    if (done) return
    const cfg = bridge()?.getConfig?.()
    // 已经初始化过的老用户不打扰
    if (cfg?.initialized && cfg.workspaceExists) {
      markDone()
      return
    }
    setOpen(true)
    setWs(cfg?.workspace || '')
    void probe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const probe = useCallback(() => {
    const b = bridge()
    try {
      const c = b?.countMarkdown?.()
      setCount(c?.markdown || 0)
    } catch (e) {}
    try {
      const s = git()?.inspect?.()
      setIsRepo(!!s?.isRepo)
    } catch (e) {}
  }, [])

  const markDone = useCallback(() => {
    try {
      const z = window.__ZNOTES as unknown as { onboardSet?: (d: Record<string, unknown>) => void } | undefined
      z?.onboardSet?.({ done: true, at: Date.now() })
    } catch (e) {}
  }, [])

  const pick = useCallback(() => {
    const r = bridge()?.pickWorkspace?.()
    if (!r?.ok) return
    setWs(r.workspace || '')
    probe()
  }, [probe])

  const finish = useCallback(() => {
    markDone()
    setOpen(false)
    refreshTree()
    window.setTimeout(() => window.location.reload(), 200)
  }, [markDone, refreshTree])

  if (!open) return null

  return (
    <div className="onboard-mask">
      <div className="onboard">
        <div className="ob-head">
          <span className="ob-title">开始使用 CMark</span>
          <span className="ob-step">{step + 1} / 3</span>
        </div>

        <div className="ob-body">
          {step === 0 ? (
            <>
              <p className="ob-lead">笔记以纯 Markdown 文件保存在你这个目录里，随时可以用其它编辑器打开。</p>
              <div className="ob-ws">
                <span className="ob-ws-icon">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3">
                    <path d="M1.8 4.2h4.4l1.2 1.6h6.8v6.4H1.8z" />
                  </svg>
                </span>
                <span className="ob-ws-path" title={ws}>
                  {ws || '尚未选择'}
                </span>
                <button type="button" className="gp-b" onClick={pick}>
                  {ws ? '更换' : '选择目录'}
                </button>
              </div>
              <p className="ob-hint">默认会用文档目录下的 CMark 文件夹。</p>
            </>
          ) : step === 1 ? (
            <>
              <p className="ob-lead">
                {count > 0 ? `这里已经有 ${count} 篇 Markdown 笔记，会直接读进来。` : '这个目录还是空的，可以从头开始。'}
              </p>
              <ul className="ob-list">
                <li>
                  <b>{count}</b> 篇笔记
                </li>
                <li>
                  版本控制 <b>{isRepo ? '已启用' : '未启用'}</b>
                </li>
              </ul>
              {!isRepo ? (
                <p className="ob-hint">
                  启用后每次改动都会留有历史，可以回溯任意版本；不启用也能正常写笔记，之后在设置里随时可以开。
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="ob-lead">准备就绪。</p>
              <ul className="ob-list">
                <li>左侧目录树右键可以新建笔记与文件夹</li>
                <li>Ctrl+F 搜索，Ctrl+B 加粗，Ctrl+1/2/3 标题</li>
                <li>顶部工具栏可以插入表格、代码块、图片</li>
              </ul>
            </>
          )}
        </div>

        <div className="ob-acts">
          {step > 0 ? (
            <button type="button" className="gp-b" onClick={() => setStep((v) => v - 1)}>
              上一步
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" className="gp-b" onClick={finish}>
            跳过
          </button>
          {step === 1 && !isRepo ? (
            <button
              type="button"
              className="gp-b"
              disabled={busy || !ws}
              onClick={async () => {
                setBusy(true)
                try {
                  const r = await git()?.initRepo?.()
                  if (r?.ok) setIsRepo(true)
                } finally {
                  setBusy(false)
                }
              }}
            >
              启用版本控制
            </button>
          ) : null}
          <button
            type="button"
            className="gp-b primary"
            disabled={step === 0 && !ws}
            onClick={() => (step < 2 ? setStep((v) => v + 1) : finish())}
          >
            {step < 2 ? '下一步' : '开始使用'}
          </button>
        </div>
      </div>
    </div>
  )
}