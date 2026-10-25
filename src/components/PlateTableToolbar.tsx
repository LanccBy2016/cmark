/**
 * 表格操作栏（对齐 V1.0.0 的做法）
 *
 * V1.0.0 是在 <table><caption> 里渲染一排图标按钮，caption 天然位于表格顶部、
 * 不参与表格布局、不遮挡内容，也不用绝对定位，所以永远不会跟富文本工具栏打架。
 * 这里照搬这个结构，按钮顺序也一致：
 *   上方插入行 / 下方插入行 / 删除行 | 左侧插入列 / 右侧插入列 / 删除列 | 左对齐 / 居中 / 右对齐 | 删除整个表格
 */
import { Fragment } from 'react'
import { TablePlugin } from '@platejs/table/react'
import { getTableAbove } from '@platejs/table'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Columns3,
  Rows3,
  Trash2,
} from 'lucide-react'
import { useEditorPlugin } from 'platejs/react'

type Align = 'left' | 'center' | 'right'

export function TableToolbar() {
  const { editor, tf } = useEditorPlugin(TablePlugin)

  /** 把整列所有单元格的 align 设成同一个值（V1.0.0 也是按列设置） */
  const setColumnAlign = (align: Align) => {
    try {
      const res = getTableAbove(editor as never) as [unknown, number[]] | undefined
      const sel = editor.selection
      if (!res || !sel) return
      const [tableNode, tablePath] = res
      const rel = sel.anchor.path.slice(tablePath.length)
      const colIdx = rel[1]
      if (typeof colIdx !== 'number') return
      const rows = ((tableNode as { children?: unknown[] }).children || []).length
      for (let r = 0; r < rows; r++) {
        try {
          editor.tf.setNodes({ align } as never, { at: [...tablePath, r, colIdx] })
        } catch (e) {
          /* 该行没有这一列（合并表头等情况），跳过 */
        }
      }
    } catch (e) {
      console.error('[table-align]', e)
    }
  }

  const items: Array<{ k: string; tip: string; icon: React.ReactNode; run: () => void; sep?: boolean; danger?: boolean }> = [
    {
      k: 'rowUp',
      tip: '上方插入行',
      icon: <ArrowUpToLine size={15} strokeWidth={1.8} />,
      run: () => tf.insert.tableRow({ before: true }),
    },
    { k: 'rowDown', tip: '下方插入行', icon: <ArrowDownToLine size={15} strokeWidth={1.8} />, run: () => tf.insert.tableRow() },
    { k: 'delRow', tip: '删除行', icon: <Rows3 size={15} strokeWidth={1.8} />, run: () => tf.remove.tableRow(), danger: true },
    {
      k: 'colLeft',
      tip: '左侧插入列',
      icon: <ArrowLeftToLine size={15} strokeWidth={1.8} />,
      run: () => tf.insert.tableColumn({ before: true }),
    },
    { k: 'colRight', tip: '右侧插入列', icon: <ArrowRightToLine size={15} strokeWidth={1.8} />, run: () => tf.insert.tableColumn() },
    { k: 'delCol', tip: '删除列', icon: <Columns3 size={15} strokeWidth={1.8} />, run: () => tf.remove.tableColumn(), sep: true, danger: true },
    { k: 'alignLeft', tip: '列左对齐', icon: <AlignLeft size={15} strokeWidth={1.8} />, run: () => setColumnAlign('left') },
    { k: 'alignCenter', tip: '列居中对齐', icon: <AlignCenter size={15} strokeWidth={1.8} />, run: () => setColumnAlign('center') },
    { k: 'alignRight', tip: '列右对齐', icon: <AlignRight size={15} strokeWidth={1.8} />, run: () => setColumnAlign('right'), sep: true },
    { k: 'delTable', tip: '删除整个表格', icon: <Trash2 size={15} strokeWidth={1.8} />, run: () => tf.remove.table(), danger: true },
  ]

  return (
    <Fragment>
      {items.map((it) => (
        <Fragment key={it.k}>
          <button
            type="button"
            title={it.tip}
            className={'tc-btn' + (it.danger ? ' danger' : '')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              try {
                it.run()
                editor.tf.focus()
              } catch (err) {
                console.error('[table-toolbar]', it.k, err)
              }
            }}
          >
            {it.icon}
          </button>
          {/* 空 span 是分组分隔，::after 画竖线，规则来自 V1.0.0 */}
          {it.sep ? <span /> : null}
        </Fragment>
      ))}
    </Fragment>
  )
}
