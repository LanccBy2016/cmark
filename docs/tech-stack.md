# CMark 最终技术栈（定稿）

> 一页纸版：每一层选了什么、为什么、当前状态。改这一页 = 改架构决定。

## 1. 分层

```
┌────────────────────────────── apps（壳，每个端一个目录）──────────────────────────────┐
│ plugin-ztools   plugin-utools   desktop(Win/Mac)   mobile(Android/iOS)   harmony(预留) │
└───────────────┬──────────────────────┬──────────────────────┬──────────────────────────┘
                │                      │                      │
        adapters/node            adapters/tauri        adapters/capacitor   adapters/arkts
        (node:fs · git)     (invoke → Rust commands)   (Filesystem/Share…)   (ArkWeb 桥，未实现)
                │                      │                      │
                └──────────────┬───────┴──────────────────────┘
                               ▼
        packages/core   领域模型 + useCases + ports（纯 TS，零宿主 API）
        packages/ui     React 组件 + Plate/Slate 编辑器（唯一 UI 实现）
        packages/markdown  解析渲染管线（marked/remark + katex + mermaid）
```

## 2. 决策表

| 层 | 选型 | 一句话理由 | 状态 |
|---|---|---|---|
| 仓库 | **npm workspaces** monorepo（`packages/*`、`adapters/*`、`apps/*`） | 一仓多壳，核心与 UI 只一份 | ✅ 已落地 |
| 语言（核心/UI） | **TypeScript** | 必须跑在 JS 插件宿主里（ZTools/uTools），TS 是唯一能覆盖 6 端的语言 | ✅ |
| 语言（桌面壳） | **Rust（Tauri v2）** | 10–15MB、原生窗口/托盘/文件关联；只写宿主能力，不写业务 | 🟡 骨架 |
| 语言（鸿蒙壳） | **ArkTS**（预留） | 纯血鸿蒙只能原生；用 ArkWeb 装现有前端，不重写 UI | ⬜ 未开始 |
| UI 框架 | **React 18 + Vite 6** | 现有资产，不重写 | ✅ |
| 编辑器 | **Plate / Slate**（保留） | 项目最贵资产（16.7k 行 UI 的核心），任何方案都不重写 | ✅ |
| 状态 | **zustand** | 现有 | ✅ |
| Markdown | **marked + remark-gfm/math + katex + mermaid + highlight.js** | 现有，跨端一致 | ✅ |
| 桌面 | **Tauri v2**（Windows 优先，macOS 同码） | 体积与原生能力的最优解；Windows 需 WebView2 | 🟡 骨架 |
| 移动 | **Capacitor**（Android 先，iOS 等账号） | 系统集成插件现成；核心是 TS，Tauri 移动端优势用不上 | ⬜ |
| 鸿蒙 | **ArkTS 壳 + ArkWeb**（`capacitor-openharmony` 可复用思路） | 官方 Tauri 不支持鸿蒙；ArkWeb 的 `registerJavaScriptProxy` 支持同步方法 | ⬜ 预留 |
| 插件宿主 | **ZTools / uTools 双壳**（不合并） | plugin.json、feature code、注入时机、审核材料都不同 | ✅ 现有 |
| Git | **契约单引擎：isomorphic-git 为默认**；桌面/插件可切 `system` | 移动端与鸿蒙不可能调系统 git；单引擎才能行为一致 | 🟡 契约已定，实现待迁 |
| 存储 | **纯文件**：`.md` + `~/.cmark-config.json` + `.cmark/order.txt` | 无数据库，用户可随时带走；与插件版互通 | ✅ 兼容 |
| 导出 | 长图走**前端 html-to-image**；PDF/HTML 由壳侧编排 | Tauri 无 capturePage，前端方案统一两端 | ⬜ |
| 测试 | **vitest**（core 用例 + 一致性回归）；沿用 `scripts/test-e2e.mjs` | 核心跨端一致靠测试兜住 | ✅ core 6/6 |
| CI | **GitHub Actions**：core 测试 + desktop 矩阵（win / mac-arm64 / mac-x64） | macOS 无法从 Windows 交叉编译，CI 是唯一无 Mac 路径 | ✅ |
| 发布 | `main` 发插件（`app/` 入库）；`desktop-v*` tag 发桌面 | 两条线互不阻塞 | ✅ 约定 |

## 3. 各端产物

| 端 | 命令 | 产物 | 备注 |
|---|---|---|---|
| ZTools | `npm run pack` | `.zpx` / asar | 沿用现状 |
| uTools | 同结构单独壳 | `.upx` | feature code 不同 |
| Windows | `cd apps/desktop && npx tauri build` | NSIS `setup.exe` / `.msi` | 需 MSVC + WebView2 |
| macOS | CI `desktop-v*` tag | `.dmg` / `.app` | 未签名可运行（首次右键打开） |
| Android | `cd apps/mobile && npx cap sync android` | `.apk` / `.aab` | 沙盒目录 + 可选 SAF |
| iOS | 同 Android | `.ipa` | **需 Apple 开发者账号**，否则不投入 |
| HarmonyOS | DevEco Studio | `.hap` | 需真机/云真机验收 IME 与文件选择 |

## 4. 明确不用

| 方案 | 否决理由 |
|---|---|
| MAUI 原生 UI | 编辑器要重写，3–6 个月，收益为零 |
| MAUI + WebView | 每端自己焊原生桥，macOS 是 Catalyst，不支持 Linux |
| uni-app / HBuilderX 一条链 | 出不了 Windows/macOS；5+ 运行时无 Node、无 git，撑不起核心能力 |
| Tauri 官方鸿蒙 | 官方未支持（issue #11112 仍开着），时间不可控 |
| Electron 桌面 | 体积 ~150MB；仅当「只维护一套壳」优先级高于桌面体验时才考虑 |

## 5. 什么情况会改这页

- **拿到 Apple 开发者账号** → 移动端排期里加 iOS。
- **有真实鸿蒙用户信号** → 做 `apps/harmony` + `adapters/arkts`。
- **isomorphic-git 覆盖不了用户的 SSH 远端** → 桌面/插件默认切回 `system` 引擎，但契约不变。
- **桌面体积不是问题、且不想维护两种壳** → 桌面从 Tauri 改为 Capacitor+Electron（core/UI 不动，只换 apps 与适配器）。

## 6. 已知风险

1. **isomorphic-git 的 SSH 支持弱于系统 git**：用户用 `git@` 远端时可能失败 → 保留 `git.engine='system'` 开关兜底。
2. **iOS WKWebView 里 Plate 的中文输入法**：产品级风险，做 iOS 前先花 2 天 spike。
3. **鸿蒙 ArkWeb 同步 JS 桥性能**：每次 fs 调用跨语言，大仓库 `git status` 可能卡 → 先压测再决定是否在 ArkTS 侧编 libgit2。
4. **Windows 老设备没有 WebView2** → 安装包内置引导（Evergreen Bootstrapper）。
