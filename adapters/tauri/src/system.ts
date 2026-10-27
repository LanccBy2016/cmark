import { invoke } from '@tauri-apps/api/core'
import type { SystemPort } from '@cmark/core'

export const tauriSystem: SystemPort = {
  openExternal: (url) => invoke<void>('sys_open_external', { url }),
  revealPath: (abs) => invoke<void>('sys_reveal_path', { path: abs }),
  copyText: (text) => invoke<void>('sys_copy_text', { text }),
  notify: (title, body) => invoke<void>('sys_notify', { title, body: body ?? null }),
  platform: () => 'tauri',
}
