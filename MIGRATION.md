# CMark 多端化迁移（一个核心 + N 个壳）

本目录结构在 `monorepo` 分支上落地，`main` 的 ZTools 插件发版不受影响。

## 0. 审计结论（迁移前实测）

| 项 | 数字 | 含义 |
|---|---|---|
| 宿主 API 面 | 11 个方法（`getPath` / `showOpenDialog` / `showSaveDialog` / `shellOpenExternal` / `shellOpenPath` / `shellShowItemInFolder` / `createBrowserWindow` / `showNotification` / `copyText` / `getCopyedFiles` / `onPluginEnter`） | 全是 Electron 原生能力的薄封装 → 能独立打包 |
| preload 逻辑 | 8 794 行 | 需要拆成 core（纯逻辑）+ adapter（IO） |
| preload 内 `createElement` | git-panel 71 / settings-panel 23 / remote-wizard 17 / 其它 13 | ★ 这三个面板是 preload 注入 DOM，必须搬回前端重写 |
| 前端 UI | 16 678 行（React + Plate/Slate） | 最值钱资产，**任何方案都不重写** |
| 配置 / 数据 | `~/.cmark-config.json` + 用户选的工作区（纯文件） | 迁移无损，可与插件版来回切 |
| 系统依赖 | `execFile('git')` | 用户机器没装 git 就跑不了 → 桌面走 git2 / 或内置 |

## 1. 仓库结构

```
packages/core        纯 TS：domain + useCases + ports（零宿主 API）
packages/markdown    解析渲染管线（待迁）
packages/ui          编辑器与面板组件（待迁，阶段 2）
adapters/node        ZTools / uTools 用：node:fs + 系统 git
adapters/tauri       Windows / macOS 用：invoke → Rust commands
adapters/capacitor   Android / iOS 用（阶段 4）
apps/plugin-ztools   插件壳：plugin.json + preload 桥
apps/plugin-utools   插件壳（结构同上，feature code 不同）
apps/desktop         Tauri：一份代码出 win + mac
apps/mobile          Capacitor（阶段 4）
```

## 2. 现有文件 → 新位置

| 现有 | 行数 | 去向 |
|---|---|---|
| `preload/ndb.js` | 1406 | 已抽：`core/useCases/scanWorkspace.ts` + `buildTree.ts` + `orderFile.ts`（纯逻辑）；IO 走 `FileSystemPort` |
| `preload/git-service.js` | 1462 | `core/ports/git.ts` 契约 + `adapters/*/git.ts`；编排与状态机（autoSync/失败暂停）待迁 |
| `preload/git-panel.js` | 1365 | ⚠️ 手搓 DOM → `packages/ui/panels/GitPanel.tsx` |
| `preload/settings-panel.js` | 958 | ⚠️ → `packages/ui/panels/SettingsPanel.tsx` |
| `preload/remote-setup.js` + `remote-wizard.js` | 718 | `core/useCases/remote.ts` + `ui/panels/RemoteWizard.tsx` |
| `preload/branch-bar / rename-note / ws-prefs / export-css` | 463 | 分别进 core / ui |
| `preload.js` | 1870 | 拆成 host-contract + 各端 bootstrap（每端 ~150 行） |

## 3. 分期（每步都能发版）

| 阶段 | 内容 | 完成判据 |
|---|---|---|
| **0（本次）** | workspace 骨架 + `core` 的 domain/ports/用例 + 内存实现 + 单测；node 与 tauri 两个适配器骨架 | `npm run test:core` 全绿；不改任何现有行为 |
| 1 | 插件端把 `ndb.js` 的数据层切到 `core/useCases/*` + `adapters/node` | ZTools 线上行为一致（树/排序/重命名回归） |
| 2 | 三个手搓 DOM 面板重写成 React | 插件端 UI 与现在等价 |
| 3 | `apps/desktop` 出 exe（git 先用系统 git，后续切 git2） | Windows 真机跑通「打开工作区 / 编辑 / 提交推送 / 导出」 |
| 4 | `apps/mobile`（Capacitor），先 Android 后 iOS | Android 跑通「沙盒目录 + 编辑 + 同步」 |

## 4. 岗位选型（已定）

- **桌面：Tauri v2** —— 10–15MB、原生窗口/托盘/文件关联；Windows 需 WebView2。
- **移动：Capacitor** —— 系统集成（Files App、分享、键盘避让）插件现成；与桌面共用同一份
  `packages/core` + `packages/ui`。核心是 TS，Tauri 移动端「复用 Rust crate」的优势在这里用不上。
- **Git 单引擎**：契约在 `core/ports/git.ts`；默认 `isomorphic-git`（六端一致），
  桌面在大仓库时可切 `git2`（`fast-git` feature），行为契约不变。
- **导出长图**：改前端 `html-to-image`，去掉 `createBrowserWindow` 依赖（Tauri 无 capturePage）。

## 5. 本地命令

```bash
npm install                 # 根：workspaces 只含 packages/* adapters/*
npm run test:core           # core 单测（vitest）
npm run typecheck:core      # core 类型检查

npm run build               # 前端 → app/（插件产物，照旧入库）
npm run pack                # 插件打包（照旧）

cd apps/desktop && npm i    # 桌面端依赖（tauri CLI）单独装，避免拖慢根安装
npm run dev                 # tauri dev
npm run build:win           # Windows exe（NSIS）
```

## 6. 已知坑

- `contextIsolation`：插件壳必须挂 `window.__CMARK`；桌面版 Tauri 没有这个限制，但**前端桥的写法要统一**，否则两套实现会分叉。
- 插件端两个壳（ztools / utools）**不要合并**：`plugin.json`、feature code、preload 注入时机、市场审核材料都不同。
- 移动端 `pickDirectory()` 返回 null → 用例回落到沙盒 `Documents/CMark`；桌面才让用户任意选目录。
- iOS WKWebView 里 Plate 的中文输入法与软键盘遮挡是产品级风险，阶段 4 前先做 2 天 spike。
