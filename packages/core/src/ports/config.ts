/**
 * 配置端口：格式与现有 `~/.cmark-config.json` 完全兼容（迁移期可与插件版共存）。
 */
export interface AppConfig {
  /** 工作区绝对路径 */
  workspace: string
  theme?: 'light' | 'dark' | 'auto'
  /** Git 自动同步配置（沿用现有字段命名） */
  git?: {
    enabled: boolean
    autoSync?: boolean
    intervalMs?: number
    pushEnabled?: boolean
    pullBeforePush?: boolean
    commitMessage?: string
    remoteUrl?: string
  }
  [key: string]: unknown
}

export interface ConfigPort {
  read(): Promise<AppConfig | null>
  write(cfg: AppConfig): Promise<void>
  /** 配置文件的绝对路径（用于「在设置里显示我是从哪读的」） */
  path(): string
}
