import { execFile } from 'node:child_process'
import type { GitPort, StatusResult, RelPath } from '@cmark/core'

/**
 * Node 端 Git：沿用现有 preload/git-service.js 的做法（调系统 git）。
 * 迁移期保持行为一致；后续若要免装 git，换成 isomorphic-git，接口不变。
 */
function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message))
      resolve(stdout)
    })
  })
}

export const nodeGit: GitPort = {
  async isRepo(dir) {
    try { await git(dir, ['rev-parse', '--is-inside-work-tree']); return true } catch { return false }
  },
  async init(dir) { await git(dir, ['init']) },
  async status(dir): Promise<StatusResult> {
    const out = await git(dir, ['status', '--porcelain'])
    const res: StatusResult = { staged: [], unstaged: [], untracked: [] }
    for (const line of out.split('\n')) {
      if (!line.trim()) continue
      const x = line[0], y = line[1], file = line.slice(3).trim()
      if (x === '?' && y === '?') res.untracked.push(file)
      else {
        if (x !== ' ' && x !== '?') res.staged.push(file)
        if (y !== ' ') res.unstaged.push(file)
      }
    }
    return res
  },
  async commit(dir, message, paths?: RelPath[]) {
    await git(dir, ['add', ...(paths?.length ? paths : ['-A'])])
    await git(dir, ['commit', '-m', message])
    return (await git(dir, ['rev-parse', 'HEAD'])).trim()
  },
  async push(dir) { await git(dir, ['push']) },
  async pull(dir) {
    const out = await git(dir, ['pull'])
    const conflicts = out.split('\n').filter((l) => l.startsWith('CONFLICT')).map((l) => l.split(' ').pop()!)
    return { conflicts }
  },
  async log(dir, limit) {
    const out = await git(dir, ['log', `-${limit}`, '--pretty=format:%H%x1f%s%x1f%an%x1f%at'])
    return out.split('\n').filter(Boolean).map((l) => {
      const [sha, message, author, at] = l.split('\x1f')
      return { sha, message, author, at: Number(at) }
    })
  },
  diff: (dir, sha, file) => git(dir, ['diff', `${sha}^`, sha, '--', file]),
}
