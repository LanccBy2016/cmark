import type { FileSystemPort } from '../ports/fs.js'
import type { NoteRef, RelPath, ScanResult } from '../domain/types.js'

/**
 * 扫描工作区（对应 preload/ndb.js 的 walk）。
 *
 * 与旧实现的四条约定必须保持一致，否则用户看到的树会变：
 *  1. 跳过 `.` 开头的隐藏文件/目录（.git / .obsidian / .cmark 等）
 *  2. 跳过 `assets` 目录（图片附件，笔记里通过 assets/xxx.png 引用，不进笔记树）
 *  3. 只把 `.md` / `.markdown` 当笔记
 *  4. 目录/文件数超阈值就停挖并标记 truncated（用户误选工程目录时不至于卡死）
 */
export interface ScanOptions {
  maxDirs?: number
  maxFiles?: number
  ignoredDirNames?: string[]
  noteExt?: RegExp
  /** 用于把 rel 拼成绝对路径（Node 用 path.join，其他端用 /） */
  join?: (rel: RelPath) => string
}

const DEFAULTS: Required<Omit<ScanOptions, 'join'>> = {
  maxDirs: 5000,
  maxFiles: 20000,
  ignoredDirNames: ['assets'],
  noteExt: /\.(md|markdown)$/i,
}

export function stripNoteExt(name: string, noteExt: RegExp = DEFAULTS.noteExt): string {
  return name.replace(noteExt, '')
}

export async function scanWorkspace(
  fs: FileSystemPort,
  rootAbs: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const opt = { ...DEFAULTS, ...options }
  const join = options.join ?? ((rel: RelPath) => `${rootAbs}/${rel}`)
  const dirs: RelPath[] = []
  const notes: NoteRef[] = []
  let truncated = false

  async function walk(abs: string, rel: RelPath): Promise<void> {
    if (truncated) return
    if (dirs.length > opt.maxDirs || notes.length > opt.maxFiles) {
      truncated = true
      return
    }
    const entries = await fs.list(abs)
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      if (e.isDir && opt.ignoredDirNames.includes(e.name)) continue
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.isDir) {
        dirs.push(childRel)
        await walk(join(childRel), childRel)
      } else if (opt.noteExt.test(e.name)) {
        notes.push({
          rel: childRel,
          title: stripNoteExt(e.name, opt.noteExt),
          abs: join(childRel),
        })
      }
    }
  }

  await walk(rootAbs, '')
  return { dirs, notes, truncated }
}
