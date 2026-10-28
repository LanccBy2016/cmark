import type { FsEntryInfo } from '../domain/types'

/**
 * 文件系统端口：所有平台适配器唯一需要实现的 IO 面。
 * core 里的用例只依赖这个接口，换端（Node / Tauri / Capacitor）只换实现。
 */
export interface FileSystemPort {
  exists(abs: string): Promise<boolean>
  readText(abs: string): Promise<string>
  writeText(abs: string, data: string): Promise<void>
  /** 列目录（只一层，不递归）；实现方需容忍目录不存在（返回空数组） */
  list(abs: string): Promise<FsEntryInfo[]>
  mkdirp(abs: string): Promise<void>
  /** 兼作移动/重命名（同目录重命名就是 rename） */
  rename(fromAbs: string, toAbs: string): Promise<void>
  /** 删到系统回收站；没有回收站概念的平台直接删 */
  remove(abs: string): Promise<void>
  /** 可选：目录变化监听（桌面有，移动端通常没有） */
  watch?(abs: string, onChange: () => void): () => void
  /** 可选：让用户挑工作区目录（移动端返回 null，由用例回落到沙盒目录） */
  pickDirectory?(title?: string): Promise<string | null>
}
