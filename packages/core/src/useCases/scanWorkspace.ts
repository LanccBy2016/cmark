import type { FileSystemPort } from '../ports/fs'
import type { NoteRef, RelPath, ScanResult } from '../domain/types'
import {
  IGNORED_DIR_NAMES, MAX_DIRS, MAX_FILES, NOTE_EXT,
  isNoteFile, isTruncated, noteTitleFromName, shouldSkipEntry,
} from '../domain/rules'

export interface ScanOptions {
  maxDirs?: number
  maxFiles?: number
  ignoredDirNames?: readonly string[]
  noteExt?: RegExp
  /** 把 rel 拼成绝对路径 */
  join?: (rel: RelPath) => string
}

export function stripNoteExt(name: string, noteExt: RegExp = NOTE_EXT): string {
  return name.replace(noteExt, '')
}

/**
 * 异步扫描（Tauri / 浏览器 / 移动端用）。
 * 规则全部来自 domain/rules，与 Node 同步实现（adapters/node/scanSync）共用同一套判定。
 */
export async function scanWorkspace(
  fs: FileSystemPort,
  rootAbs: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const maxDirs = options.maxDirs ?? MAX_DIRS
  const maxFiles = options.maxFiles ?? MAX_FILES
  const rules = { ignoredDirNames: options.ignoredDirNames ?? IGNORED_DIR_NAMES, noteExt: options.noteExt ?? NOTE_EXT }
  const join = options.join ?? ((rel: RelPath) => `${rootAbs}/${rel}`)
  const dirs: RelPath[] = []
  const notes: NoteRef[] = []
  let truncated = false

  async function walk(abs: string, rel: RelPath): Promise<void> {
    if (truncated) return
    if (isTruncated(dirs.length, notes.length, maxDirs, maxFiles)) { truncated = true; return }
    const entries = await fs.list(abs)
    for (const e of entries) {
      if (shouldSkipEntry(e.name, e.isDir, rules)) continue
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.isDir) {
        dirs.push(childRel)
        await walk(join(childRel), childRel)
      } else if (isNoteFile(e.name, rules)) {
        notes.push({ rel: childRel, title: noteTitleFromName(e.name, rules), abs: join(childRel) })
      }
    }
  }

  await walk(rootAbs, '')
  return { dirs, notes, truncated }
}
