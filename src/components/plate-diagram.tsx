/**
 * 代码块内的图表预览：```mermaid 画流程图 / 时序图，```echarts 用 option JSON 画统计图
 *
 * 图表不占用独立节点类型 —— Markdown 里图表本来就是代码块，
 * 保持这个形态，Obsidian / GitHub 打开也是对的。
 * 这里只在代码块下方追加一块渲染结果，源码仍然可编辑。
 */
import { useEffect, useRef, useState } from 'react'

export function Diagram({ kind, code }: { kind: 'mermaid' | 'echarts'; code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    let chart: { dispose: () => void } | null = null

    void (async () => {
      if (!ref.current) return
      try {
        if (kind === 'mermaid') {
          const mermaid = (await import('mermaid')).default
          mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
          const id = 'mmd-' + Math.random().toString(36).slice(2, 9)
          const { svg } = await mermaid.render(id, code)
          if (alive && ref.current) ref.current.innerHTML = svg
        } else {
          const echarts = await import('echarts')
          // 注意：这里不能 await requestAnimationFrame 再 init。
          // 等一帧的写法在开发期 StrictMode 双挂载 + 组件重建时会拿到失效的 ref，
          // 代码直接静默 return，图表就是一片空白。ref 在同步阶段一定有效，先 init。
          if (!alive || !ref.current) return
          const el = ref.current as HTMLDivElement
          const existing = echarts.getInstanceByDom(el)
          if (existing) existing.dispose()
          // 必须用 svg renderer：canvas 的位图内容不能被 cloneNode 复制，
          // 导出（走编辑区 DOM 快照）拿到的会是一块空白画布；SVG 是真实 DOM，能连样式带走。
          const inst = echarts.init(el, undefined, { renderer: 'svg' })
          // option 顶层的 height/width 不是 echarts 的合法配置项，
          // 但会被当成画布尺寸用，和容器实际尺寸打架：实测容器 320 却按 400 排版，
          // SVG 高度又写 320，X 轴分类标签和柱子底部全被裁到可视区外。
          const opt = JSON.parse(code) as Record<string, unknown>
          delete opt.height
          delete opt.width
          inst.setOption(opt)
          chart = inst
          // 尺寸在第一帧可能还没定型，下一拍按真实容器尺寸纠正一次。
          // 空参 resize() 读的是 echarts 自己缓存的尺寸，纠正不了，必须显式传。
          const fix = () => {
            if (!alive) return
            try {
              const w = el.clientWidth
              const h = el.clientHeight
              if (!w || !h) return
              const g = inst as unknown as { getWidth: () => number; getHeight: () => number }
              if (g.getWidth() !== w || g.getHeight() !== h) inst.resize({ width: w, height: h })
            } catch (e) {}
          }
          setTimeout(fix, 0)
          setTimeout(fix, 150)
        }
        if (alive) setErr('')
      } catch (e) {
        if (alive) setErr((e as Error)?.message || '渲染失败')
      }
    })()

    return () => {
      alive = false
      if (chart) {
        try {
          chart.dispose()
        } catch (e) {}
        chart = null
      }
    }
  }, [kind, code])

  return (
    <>
      <div
        className="diagram-canvas"
        ref={ref}
        style={kind === 'echarts' ? { width: '100%', height: 320 } : undefined}
      />
      {err ? <div className="diagram-err">{err}</div> : null}
    </>
  )
}
