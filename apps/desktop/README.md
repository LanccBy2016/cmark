# desktop（Tauri v2）

一份代码出 Windows + macOS。前端复用仓库根的 `app/` 构建产物，Rust 只做宿主能力。

## 依赖

- Rust 1.77+、`cargo`、平台工具链（Windows: MSVC Build Tools）
- Windows 需 WebView2（Win10 1803+ 自带或安装 Evergreen Runtime）
- macOS 打包需 Xcode 命令行工具 + 签名证书（`APPLE_CERTIFICATE` / `APPLE_ID` 环境变量）

## 命令

```bash
cd apps/desktop
npm run dev        # tauri dev（前端先 npm run dev）
npm run build:win  # → src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe
npm run build:mac  # → src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/*.dmg
```

## 与插件的差异（必须自己实现的部分）

| 插件里靠宿主 | 桌面版替代 |
|---|---|
| `ztools.getPath('downloads')` | `tauri::path::PathResolver` 或 `dirs` crate |
| `ztools.showOpenDialog` | `tauri-plugin-dialog` |
| `ztools.shellOpenExternal` | `tauri-plugin-opener` |
| `ztools.createBrowserWindow`（导出长图） | 前端 `html-to-image`（Tauri 无 capturePage） |
| `ztools.onPluginEnter` | 单实例回调 + 窗口 focus |
| `ztools.getCopyedFiles` | `clipboard-win`（Windows CF_HDROP），macOS 单独实现 |
