import type { RelPath } from '../domain/types.js'

export interface CommitInfo {
  sha: string
  message: string
  author: string
  at: number
}

export interface StatusResult {
  staged: RelPath[]
  unstaged: RelPath[]
  untracked: RelPath[]
}

/**
 * 版本控制端口。
 *
 * 决策（见 MIGRATION.md「岗位选型」）：优先单引擎 isomorphic-git，
 * 桌面端可在仓库很大时切到 git2 快路径——行为契约由本接口固定。
 */
export interface GitPort {
  isRepo(dirAbs: string): Promise<boolean>
  init(dirAbs: string): Promise<void>
  status(dirAbs: string): Promise<StatusResult>
  /** paths 为空 = 全量 add（等价 `git add -A`） */
  commit(dirAbs: string, message: string, paths?: RelPath[]): Promise<string>
  push(dirAbs: string): Promise<void>
  pull(dirAbs: string): Promise<{ conflicts: RelPath[] }>
  log(dirAbs: string, limit: number): Promise<CommitInfo[]>
  diff(dirAbs: string, sha: string, path: RelPath): Promise<string>
}
