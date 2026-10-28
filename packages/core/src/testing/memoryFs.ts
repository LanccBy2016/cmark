import type { FileSystemPort } from '../ports/fs'
import type { FsEntryInfo } from '../domain/types'

/**
 * 内存文件系统：单测与「各端一致性回归」的基准实现。
 * 路径一律用 / 与绝对路径（mock 里根目录固定为 /ws）。
 */
export class MemoryFs implements FileSystemPort {
  private files = new Map<string, { text?: string; dir?: true }>()

  constructor(init?: Record<string, string | true>) {
    for (const [path, v] of Object.entries(init ?? {})) {
      this.files.set(normalize(path), v === true ? { dir: true } : { text: v })
    }
  }

  async exists(abs: string) {
    return this.files.has(normalize(abs))
  }
  async readText(abs: string) {
    const f = this.files.get(normalize(abs))
    if (!f || f.dir) throw new Error(`ENOENT: ${abs}`)
    return f.text ?? ''
  }
  async writeText(abs: string, data: string) {
    this.files.set(normalize(abs), { text: data })
  }
  async list(abs: string): Promise<FsEntryInfo[]> {
    const dir = normalize(abs).replace(/\/$/, '')
    const prefix = dir === '' ? '' : dir + '/'
    const seen = new Set<string>()
    const out: FsEntryInfo[] = []
    for (const [path, v] of this.files) {
      if (!path.startsWith(prefix)) continue
      const rest = path.slice(prefix.length)
      if (!rest) continue
      const name = rest.split('/')[0]
      if (seen.has(name)) continue
      seen.add(name)
      const isDir = rest.includes('/') || !!v.dir
      out.push({ name, path: prefix + name, isDir, mtimeMs: 0 })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }
  async mkdirp(abs: string) {
    this.files.set(normalize(abs), { dir: true })
  }
  async rename(fromAbs: string, toAbs: string) {
    const from = normalize(fromAbs), to = normalize(toAbs)
    const f = this.files.get(from)
    if (!f) throw new Error(`ENOENT: ${fromAbs}`)
    this.files.delete(from)
    this.files.set(to, f)
  }
  async remove(abs: string) {
    const target = normalize(abs)
    for (const path of [...this.files.keys()]) {
      if (path === target || path.startsWith(target + '/')) this.files.delete(path)
    }
  }
  async pickDirectory() {
    return '/ws'
  }
  /** 测试辅助：读出所有路径，便于断言「没有留下空壳目录」 */
  snapshot(): string[] {
    return [...this.files.keys()].sort()
  }
}

function normalize(p: string): string {
  return p.replace(/\/+/g, '/').replace(/\/+$/, '')
}

export { normalize }
