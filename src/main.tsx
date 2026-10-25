import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installMockIfNeeded } from './core/mock'
import 'katex/dist/katex.min.css'
import './styles/app.css'

// 浏览器里没有 preload 时用本地 mock 数据，装了真插件时这行不生效
installMockIfNeeded()

/** 把运行时错误写到磁盘可读的位置，避免白屏后无从查起 */
function recordError(where: string, e: unknown) {
  const msg = e instanceof Error ? `${e.message}\n${(e.stack || '').split('\n').slice(0, 8).join('\n')}` : String(e)
  console.error('[cmark]', where, msg)
  try {
    const prev = localStorage.getItem('cmark:lastError') || ''
    localStorage.setItem('cmark:lastError', `${new Date().toISOString()} ${where}\n${msg}\n\n---prev---\n${prev.slice(0, 2000)}`)
  } catch (err) {}
}

window.addEventListener('error', (e) => recordError('window.error', e.error || e.message))
window.addEventListener('unhandledrejection', (e) => recordError('unhandledrejection', e.reason))

/** 渲染期错误在这里兜住，页面不会整片空白 */
class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) {
    return { err }
  }
  componentDidCatch(err: Error) {
    recordError('render', err)
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, fontFamily: 'Consolas, monospace', fontSize: 12, color: '#cf222e', whiteSpace: 'pre-wrap' }}>
          {'渲染失败：\n\n' + this.state.err.message + '\n\n' + (this.state.err.stack || '').split('\n').slice(0, 12).join('\n')}
        </div>
      )
    }
    return this.props.children
  }
}

window.addEventListener('load', () => {
  const last = localStorage.getItem('cmark:lastError')
  if (last) console.warn('[cmark] 上次错误:', last)
})

// 不用 StrictMode：它会把 effect 跑两遍，编辑器实例会双建
createRoot(document.getElementById('root')!).render(
  <Boundary>
    <App />
  </Boundary>
)
