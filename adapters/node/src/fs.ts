import { promises as fsp } from 'node:fs'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { FileSystemPort } from '@cmark/core'

/** Node 端实现：ZTools / uTools 插件用（宿主都是 Electron，preload 里可直接 require） */
export const nodeFs: FileSystemPort = {
  async exists(abs) {
    try { await fsp.access(abs); return true } catch { return false }
  },
  readText: (abs) => fsp.readFile(abs, 'utf8'),
  writeText: async (abs, data) => {
    await fsp.mkdir(path.dirname(abs), { recursive: true })
    await fsp.writeFile(abs, data, 'utf8')
  },
  async list(abs) {
    try {
      return (await fsp.readdir(abs, { withFileTypes: true })).map((d) => ({
        name: d.name,
        path: path.join(abs, d.name),
        isDir: d.isDirectory(),
        mtimeMs: 0,
      }))
    } catch { return [] }
  },
  mkdirp: async (abs) => { await fsp.mkdir(abs, { recursive: true }) },
  rename: (from, to) => fsp.rename(from, to),
  remove: (abs) => fsp.rm(abs, { recursive: true, force: true }),
  watch(abs, onChange) {
    try {
      const w = fsSync.watch(abs, { recursive: true }, () => onChange())
      return () => w.close()
    } catch { return () => {} }
  },
  async pickDirectory(title) {
    // 插件里走宿主对话框；这里给 Node 直跑时的兜底
    const z = (globalThis as any).ztools ?? (globalThis as any).utools
    const picked = z?.showOpenDialog?.({ title, properties: ['openDirectory'] })
    return picked?.[0] ?? null
  },
}

export const homeConfigPath = () => path.join(os.homedir(), '.cmark-config.json')
