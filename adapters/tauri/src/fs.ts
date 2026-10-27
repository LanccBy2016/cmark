import { invoke } from '@tauri-apps/api/core'
import type { FileSystemPort, FsEntryInfo } from '@cmark/core'

/**
 * Tauri 端实现：每个方法对应 src-tauri/src/commands.rs 里的一个 #[tauri::command]。
 * 命名约定：`fs_*` / `sys_*`，Rust 侧入参一律 camelCase（Tauri 自动转 snake_case）。
 */
export const tauriFs: FileSystemPort = {
  exists: (path) => invoke<boolean>('fs_exists', { path }),
  readText: (path) => invoke<string>('fs_read_text', { path }),
  writeText: (path, data) => invoke<void>('fs_write_text', { path, data }),
  list: (path) => invoke<FsEntryInfo[]>('fs_list', { path }),
  mkdirp: (path) => invoke<void>('fs_mkdirp', { path }),
  rename: (from, to) => invoke<void>('fs_rename', { from, to }),
  remove: (path) => invoke<void>('fs_remove', { path }),
  pickDirectory: (title) => invoke<string | null>('sys_pick_directory', { title: title ?? null }),
}
