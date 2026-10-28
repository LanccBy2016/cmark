import fs from 'node:fs'
import path from 'node:path'
import {
  IGNORED_DIR_NAMES, MAX_DIRS, MAX_FILES, NOTE_EXT,
  isNoteFile, isTruncated, noteTitleFromName, shouldSkipEntry,
} from '@cmark/core'

export interface SyncScanFile {
  rel: string
  full: string
  title: string
  mtimeMs: number
  birthtimeMs: number
}

export interface SyncScanResult {
  dirs: string[]
  files: SyncScanFile[]
  truncated: boolean
}

export interface SyncScanOptions {
  maxDirs?: number
  maxFiles?: number
  ignoredDirNames?: readonly string[]
  noteExt?: RegExp
}

/**
 * 同步扫描（插件 preload 用）。
 *
 * 为什么同步：ZTools/uTools 的 bundle 是同步取数据的（`window.__NDB` 一调就要结果），
 * 改成 async 会波及整个前端调用面。规则、阈值、标题算法全部来自 @cmark/core，
 * 与 Tauri/Capacitor 的异步实现共用同一套判定——只有遍历方式是同步的。
 */
export function scanSync(rootAbs: string, options: SyncScanOptions = {}): SyncScanResult {
  const maxDirs = options.maxDirs ?? MAX_DIRS
  const maxFiles = options.maxFiles ?? MAX_FILES
  const rules = {
    ignoredDirNames: options.ignoredDirNames ?? IGNORED_DIR_NAMES,
    noteExt: options.noteExt ?? NOTE_EXT,
  }

  const dirs: string[] = []
  const files: SyncScanFile[] = []
  let truncated = false

  function walk(abs: string, rel: string): void {
    if (truncated) return
    if (isTruncated(dirs.length, files.length, maxDirs, maxFiles)) { truncated = true; return }
    let ents: fs.Dirent[]
    try { ents = fs.readdirSync(abs, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      if (shouldSkipEntry(e.name, e.isDirectory(), rules)) continue
      const childRel = rel ? `${rel}/${e.name}` : e.name
      const full = path.join(abs, e.name)
      if (e.isDirectory()) {
        dirs.push(childRel)
        walk(full, childRel)
      } else if (isNoteFile(e.name, rules)) {
        let st: fs.Stats | undefined
        try { st = fs.statSync(full) } catch { continue }
        files.push({
          rel: childRel,
          full,
          title: noteTitleFromName(e.name, rules),
          mtimeMs: st.mtimeMs,
          birthtimeMs: st.birthtimeMs || st.mtimeMs,
        })
      }
    }
  }

  walk(rootAbs, '')
  return { dirs, files, truncated }
}
