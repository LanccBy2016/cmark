# plugin-ztools

ZTools 壳：只做两件事——**挂桥**和**转发**，业务逻辑一行不写。

```
preload.js  →  把 @cmark/core + @cmark/adapter-node 组装成 window.__CMARK / __ZNOTES / __znotesGit
app/        →  前端构建产物（由根目录 `npm run build` 产出，本仓库仍入库）
```

桥的契约见 `packages/core/src/ports/`：前端只认端口方法，插件端在 preload 里实现。

> 迁移期说明：现在仓库根目录的 `preload/`（8794 行）仍是线上实现。
> 按 MIGRATION.md 阶段 0 的节奏，先迁 `ndb.js`（数据层）与 `git-service.js`（版本层），
> 面板（`git-panel.js` / `settings-panel.js` / `remote-wizard.js`）留到阶段 2 重写成 React。
