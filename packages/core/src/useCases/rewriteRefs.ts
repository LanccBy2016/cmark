/**
 * 笔记内图片相对路径的重算（对应 ndb.js 的 rewriteRelInText / rewriteSeg）。
 *
 * 为什么必须有：笔记被改名、拖到别的目录、或整个目录被移动后，原来算好的 `../` 层数全错，
 * 图片会集体失效。所以每次落位后要按「旧目录 → 新目录」把引用重算一遍。
 *
 * 与旧实现的等价点：
 *  - 只动 Markdown 图片语法 `![alt](url)`，代码块/行内代码/$$ 公式里的示例不碰
 *  - 外链（http/data/file/attachment/#/mailto）不改
 *  - 解析结果跑出仓库范围的不改
 *  - 目标文件不存在的不改（避免把失效引用改坏）—— 由 exists 回调判定
 *  - 结果不以 `.` 开头时补 `./`（与 path.relative + 前缀逻辑一致）
 *
 * 与旧实现的差异：这里用「相对仓库根的路径」做运算（posix 语义），不碰绝对路径与盘符，
 * 所以 Node / Tauri / 移动端算出来的结果完全一样。
 */
export const IMG_MD = /(!\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g
const CODE_SEG = /(```[\s\S]*?```|~~~[\s\S]*?~~~|\$\$[\s\S]*?\$\$|`+[^`]*`+)/g
const EXTERNAL = /^(https?:|data:|file:|attachment:|#|mailto:)/i

export interface RetargetOptions {
  /** 笔记原来的目录（相对仓库根，根为 ''） */
  oldDirRel: string
  /** 笔记新的目录（相对仓库根） */
  newDirRel: string
  /** 判断相对仓库根的路径是否存在；不传 = 全部视为存在（纯逻辑测试） */
  exists?: (relPath: string) => boolean
}

export function normalizeRelPath(p: string): string {
  const out: string[] = []
  for (const seg of String(p).split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (out.length === 0) return '..' // 出界，交给调用方处理
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out.join('/')
}

export function joinRelPath(dirRel: string, rel: string): string {
  if (!rel) return normalizeRelPath(dirRel)
  if (rel.startsWith('/')) return normalizeRelPath(rel)
  return normalizeRelPath(`${dirRel}/${rel}`)
}

/** 从 fromDirRel 指向 toRel 的相对路径（'pic.png' / '../a/pic.png'） */
export function relativeRelPath(fromDirRel: string, toRel: string): string {
  const from = fromDirRel ? fromDirRel.split('/').filter(Boolean) : []
  const to = toRel ? toRel.split('/').filter(Boolean) : []
  let i = 0
  while (i < from.length && i < to.length && from[i] === to[i]) i++
  const up = from.slice(i).map(() => '..')
  const rest = to.slice(i)
  if (up.length === 0 && rest.length === 0) return ''
  return [...up, ...rest].join('/')
}

function rewriteSegment(seg: string, opts: RetargetOptions): string {
  return seg.replace(IMG_MD, (whole, pre: string, url: string, post: string) => {
    if (EXTERNAL.test(url)) return whole
    const absRel = joinRelPath(opts.oldDirRel, url)
    if (absRel.startsWith('..')) return whole          // 跑出仓库
    if (opts.exists && !opts.exists(absRel)) return whole
    let rel = relativeRelPath(opts.newDirRel, absRel)
    if (rel && !rel.startsWith('.')) rel = `./${rel}`
    return pre + rel + post
  })
}

export function retargetMarkdownImageRefs(text: string, opts: RetargetOptions): string {
  if (!text || opts.oldDirRel === opts.newDirRel) return text
  const segs = String(text).split(CODE_SEG)
  return segs.map((seg, i) => (i % 2 === 1 ? seg : rewriteSegment(seg, opts))).join('')
}
