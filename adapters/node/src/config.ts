import { promises as fsp } from 'node:fs'
import type { AppConfig, ConfigPort } from '@cmark/core'
import { homeConfigPath } from './fs.js'

/** 与现有插件完全兼容：~/.cmark-config.json（含 v1 的 .znotes-config.json 迁移） */
export function nodeConfig(): ConfigPort {
  const file = homeConfigPath()
  return {
    path: () => file,
    async read() {
      try { return JSON.parse(await fsp.readFile(file, 'utf8')) as AppConfig } catch { return null }
    },
    async write(cfg) { await fsp.writeFile(file, JSON.stringify(cfg, null, 2), 'utf8') },
  }
}
