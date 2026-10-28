/**
 * 扫描规则（唯一真相）。
 *
 * 与 preload/ndb.js 的 walk 保持完全一致，任何一端要改「跳过什么/算不算笔记」，
 * 只改这里，不许在各端各写一份：
 *  1. `.` 开头的隐藏文件/目录一律跳过（.git / .obsidian / .cmark …）
 *  2. `assets` 目录跳过（图片附件，通过 assets/xxx.png 直接引用，不进笔记树）
 *  3. 只有 .md / .markdown 算笔记
 *  4. 目录/笔记数超阈值就停挖并标记 truncated（用户误选工程目录时不卡死）
 */
export const MAX_DIRS = 5000
export const MAX_FILES = 20000
export const IGNORED_DIR_NAMES: readonly string[] = ['assets']
export const NOTE_EXT = /\.(md|markdown)$/i

export interface RuleOptions {
  ignoredDirNames?: readonly string[]
  noteExt?: RegExp
}

/** 目录项是否整棵跳过（隐藏项 或 附件目录） */
export function shouldSkipEntry(name: string, isDir: boolean, opts: RuleOptions = {}): boolean {
  if (!name || name.startsWith('.')) return true
  if (isDir && (opts.ignoredDirNames ?? IGNORED_DIR_NAMES).includes(name)) return true
  return false
}

/** 文件是否算笔记 */
export function isNoteFile(name: string, opts: RuleOptions = {}): boolean {
  return (opts.noteExt ?? NOTE_EXT).test(name)
}

/** 标题：basename 去扩展名（与 ndb.js stripExt 一致，不带目录） */
export function noteTitleFromName(name: string, opts: RuleOptions = {}): string {
  return name.replace(opts.noteExt ?? NOTE_EXT, '')
}

export function isTruncated(dirCount: number, fileCount: number, maxDirs = MAX_DIRS, maxFiles = MAX_FILES): boolean {
  return dirCount > maxDirs || fileCount > maxFiles
}
