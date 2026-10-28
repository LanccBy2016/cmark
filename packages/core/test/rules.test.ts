import { describe, expect, it } from 'vitest'
import {
  MAX_DIRS, MAX_FILES, isNoteFile, isTruncated, noteTitleFromName, shouldSkipEntry,
} from '../src/index'

describe('扫描规则（与 ndb.js walk 逐条对齐）', () => {
  it('隐藏项一律跳过，assets 只跳过目录', () => {
    expect(shouldSkipEntry('.git', true)).toBe(true)
    expect(shouldSkipEntry('.env', false)).toBe(true)
    expect(shouldSkipEntry('assets', true)).toBe(true)
    expect(shouldSkipEntry('assets', false)).toBe(false)   // 同名文件不跳（旧实现只 skip 目录）
    expect(shouldSkipEntry('日记', true)).toBe(false)
  })

  it('只有 md / markdown 算笔记，大小写不敏感', () => {
    expect(isNoteFile('a.md')).toBe(true)
    expect(isNoteFile('a.markdown')).toBe(true)
    expect(isNoteFile('a.MD')).toBe(true)
    expect(isNoteFile('a.txt')).toBe(false)
    expect(isNoteFile('a.md.bak')).toBe(false)
  })

  it('标题只取 basename 去扩展名，不带目录', () => {
    expect(noteTitleFromName('a.md')).toBe('a')
    expect(noteTitleFromName('v1.2.md')).toBe('v1.2')
    expect(noteTitleFromName('笔记.MARKDOWN')).toBe('笔记')
  })

  it('阈值判定：超出任一即截断', () => {
    expect(isTruncated(MAX_DIRS, 0)).toBe(false)
    expect(isTruncated(MAX_DIRS + 1, 0)).toBe(true)
    expect(isTruncated(0, MAX_FILES + 1)).toBe(true)
    expect(isTruncated(5, 5, 5, 5)).toBe(false)
    expect(isTruncated(6, 5, 5, 5)).toBe(true)
  })
})
