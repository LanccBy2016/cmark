# CMark

本地 Markdown 笔记，用 Git 管理版本、同步多端。跑在 [ZTools](https://github.com/ztools) 插件体系里。

笔记就是磁盘上的 `.md` 文件，没有数据库、没有私有格式。用任何编辑器都能打开，
用 Git 就能同步和回溯。CMark 只负责把这些变成顺手的事。

## 功能

- **目录树**：直接映射磁盘结构，支持拖拽移动、改名、新建、删除
- **富文本编辑**：基于 Plate，所见即所得，同时保证 Markdown 源码干净
- **Git 集成**：分支栏、改动列表、提交历史、拉取 / 推送，全部内置
- **代码块**：27 种语言、语法高亮、右上角切换语言、一键复制
- **表格**：可视化操作行列、对齐、增删
- **图表**：```mermaid 流程图 / 时序图，```echarts 统计图，编辑区直接渲染
- **公式**：`$行内$` 与 `$$块级$$`，KaTeX 渲染
- **图片**：粘贴自动存入 `.cmark/attachments`，支持拖动缩放
- **导出**：Markdown / HTML / PDF / 长图，导出结果与编辑区所见一致
- **全文搜索**：标题与正文，命中高亮，上下键跳转
- **源码模式**：一键切回 Markdown 原文，带行号

## 扩展语法

在标准 CommonMark + GFM 之外额外支持：

| 语法 | 效果 |
|---|---|
| `==高亮==` | 高亮标记 |
| `^上标^` / `~下标~` | 上下标 |
| `$x^2$` / `$$...$$` | 行内 / 块级公式 |
| ```` ```mermaid ```` | 流程图、时序图 |
| ```` ```echarts ```` | ECharts 统计图 |
| `[TOC]` | 目录 |
| `[[双链]]` | 笔记互链 |

这些语法在 Obsidian、Typora、GitHub 里会降级显示为普通文本，不会破坏文件可用性。

## 数据存放

笔记本身：你指定的任意目录（建议独立 Git 仓库）。

元数据放在笔记目录下的 `.cmark/`：

| 路径 | 内容 |
|---|---|
| `.cmark/attachments/` | 粘贴进来的图片等附件 |
| `.cmark/image-style.json` | 图片缩放比例（不写进 Markdown） |

Markdown 源文件始终保持标准语法，附件以相对路径引用。

## 安装

从 ZTools 插件市场安装，或手动构建（见下）后把 `dist` 目录注册为插件。

## 开发

```bash
npm install
npm run dev      # 本地调试
npm run build    # 构建，产物在 dist/
npm run pack     # 打包成 ZTools 插件
```

技术栈：React 18 + TypeScript + Vite + Zustand + Plate + Mermaid + ECharts + KaTeX。

## 许可

[MIT](LICENSE)。第三方组件见 [THIRD-PARTY.md](THIRD-PARTY.md)。

## 致谢

编辑体验参考了 Typora、Obsidian 的不少细节；Markdown 渲染依赖 remark / unified 生态；
Git 面板的思路来自 Obsidian Git。
