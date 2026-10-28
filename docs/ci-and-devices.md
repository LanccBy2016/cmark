# 没有设备时怎么出包 / 怎么验

## 手上的设备与可验证范围

| 端 | 需要什么硬件 | 你手上有 | 出包方式 | 能否自己验 |
|---|---|---|---|---|
| Windows | Windows 主机 | ✅ 工作电脑 | 本地 `npx tauri build` | ✅ |
| Android | 任意主机 + 安卓机 | ✅ 安卓手机 | 本地 Gradle / `cap sync` | ✅ |
| macOS | **必须有 macOS** | ❌ | **GitHub Actions `macos-14`**（`.github/workflows/desktop.yml`） | ⚠️ 只能收包，无法本机运行 |
| iOS | macOS + Apple 开发者账号 | ❌ | CI + 签名（$99/年） | ❌ 没有账号装不上 |
| HarmonyOS NEXT | Windows/macOS + DevEco Studio（Windows 版可装） | ❌ 设备 | DevEco 打包 `.hap` | ⚠️ 只能用模拟器，IME 行为与真机不同 |

## 关键事实

- **Tauri 不能跨平台编译到 macOS**：Windows/Linux 上无法产出 dmg，必须 macOS runner（CI 或借机器）。
- **未签名的 macOS 产物**依旧可运行：用户首次打开需右键 → 打开，或 `xattr -dr com.apple.quarantine`。上架/免警告需要 Apple Developer 账号 + notarize。
- **iOS 没有 Apple 账号 = 无法安装到任何真机**（TestFlight 也要账号），所以这条线在拿到账号前不投入。
- **鸿蒙**：DevEco Studio 有 Windows 版，模拟器能跑起来做开发验证；但 ArkWeb 的中文输入法、文件选择器行为必须真机验，发布前要借机器或用云真机。

## 建议的推进顺序（按「能否自己验证」排）

1. **Windows 桌面**（Tauri）——你能验，先做，出 exe。
2. **Android**（Capacitor）——你能验，第二做，出 apk。
3. **macOS**——有真实用户要再说；到那时直接跑 `desktop-v*` tag 的 CI，拿未签名 dmg 试水。
4. **iOS / 鸿蒙**——等账号 / 等设备 / 等需求，适配器只留接口不实现（现在是这个状态）。

**原则：不为「无法验证的平台」提前写适配器**——写完没跑过等于没写，回归成本反而更高。
