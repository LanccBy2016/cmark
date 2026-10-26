/* 设置面板：从 Git 面板中独立出来，入口在侧边栏底部齿轮按钮。
   只用 Git 面板那套 .zgp-* 样式，宿主容器换成 #zgs-root。 */
function logBoot () {}   // 调试打点已关闭

module.exports = function attachSettingsPanel (win) {
  logBoot('enter')
  const doc = win.document
  if (!doc || doc.getElementById('zgs-root')) return
  // preload 可能在 document-start 阶段执行，这时 body/head 还不存在，等 DOM 就绪再来
  if (!doc.body) {
    setTimeout(function () { try { attachSettingsPanel(win) } catch (e) {} }, 60)
    return
  }

  const ICON = {
    gear: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0-1.3a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z"/><path d="M13.1 9.2a4.9 4.9 0 0 0 0-2.4l1.2-.9-1.2-2-1.4.6a5 5 0 0 0-2-1.2L9.4 1.8h-2.8l-.3 1.5a5 5 0 0 0-2 1.2l-1.4-.6-1.2 2 1.2.9a4.9 4.9 0 0 0 0 2.4l-1.2.9 1.2 2 1.4-.6a5 5 0 0 0 2 1.2l.3 1.5h2.8l.3-1.5a5 5 0 0 0 2-1.2l1.4.6 1.2-2-1.2-.9zm-1.7-.4l1 .7-.3.5-1.1-.5a3.7 3.7 0 0 1-1.9 1.1l-.3 1.2h-.6l-.3-1.2a3.7 3.7 0 0 1-1.9-1.1l-1.1.5-.3-.5 1-.7a3.6 3.6 0 0 1 0-2.3l-1-.7.3-.5 1.1.5a3.7 3.7 0 0 1 1.9-1.1l.3-1.2h.6l.3 1.2a3.7 3.7 0 0 1 1.9 1.1l1.1-.5.3.5-1 .7a3.6 3.6 0 0 1 0 2.3z"/></svg>',
    x: '×'
  }

  function esc (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  const G = win.__znotesGit

  // ---------- 样式：定位 + 侧边栏底部按钮 ----------
  const style = doc.createElement('style')
  style.textContent = `
  #zgs-root{position:fixed;top:0;right:0;width:520px;max-width:96vw;height:100%;z-index:99998;
    display:none;flex-direction:column;background:var(--zgp-bg,#1b1b1f);color:var(--zgp-fg,#e6e6e6);
    border-left:1px solid var(--zgp-bd,rgba(255,255,255,.12));box-shadow:-8px 0 24px rgba(0,0,0,.28);
    font-family:inherit;}
  #zgs-root.open{display:flex;animation:zgs-in .22s cubic-bezier(.2,.8,.2,1);}
  @keyframes zgs-in{from{transform:translateX(24px);opacity:.4}to{transform:translateX(0);opacity:1}}
  .zgs-head{display:flex;align-items:center;justify-content:space-between;gap:10px;
    padding:14px 16px 12px;border-bottom:1px solid var(--zgp-bd,rgba(255,255,255,.12));}
  .zgs-title{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600;}
  .zgs-title svg{width:15px;height:15px;fill:currentColor;opacity:.85;}
  .zgs-body{flex:1;overflow:auto;padding:4px 0 18px;}
  .znotes-sbtn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;
    padding:7px 8px;border:none;border-radius:6px;background:transparent;color:inherit;
    font-size:11.5px;cursor:pointer;opacity:.72;transition:background .15s,opacity .15s;}
  .znotes-sbtn:hover{background:rgba(128,128,128,.16);opacity:1;}
  .znotes-sbtn svg{width:13px;height:13px;fill:currentColor;flex:0 0 13px;}
  /* 目录树要让出底部按钮的空间，否则树会压住 footer（按钮点不到） */
  .sidebar-tree{flex:1 1 auto;min-height:0;}
  /* 底部按钮改为绝对定位 + 容器预留 padding：按钮晚挂载时不再改变树的高度，
     避免打开插件瞬间出现一次高度跳变 */
  .sidebar-body{position:relative;padding-bottom:34px;box-sizing:border-box;}
  .znotes-footer{padding:6px 8px;border-top:1px solid rgba(128,128,128,.18);flex:0 0 auto;
    position:absolute;left:0;right:0;bottom:0;z-index:2;background:inherit;}
  /* 顶部工具条整行不要：新建文件夹/新建笔记/折叠全部/工作区变更记录 全在里面，
     新建走右键菜单，git 操作由顶部那条 git 工具条承担 */
  .sidebar-header{display:none !important;}
  /* 设置面板自己的确认层：git-panel 的 askConfirm 把遮罩挂到 display:none 的 #zgp-root，
     在设置里复用会弹出点不到的框，所以这里独立实现一套 */
  .zgs-mask{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);
    display:flex;align-items:center;justify-content:center;}
  .zgs-dlg{background:var(--zgp-bg,#1b1b1f);color:var(--zgp-fg,#e6e6e6);
    border:1px solid var(--zgp-bd,rgba(255,255,255,.14));border-radius:10px;
    padding:18px 18px 14px;max-width:440px;width:calc(100% - 48px);
    box-shadow:0 12px 32px rgba(0,0,0,.45);}
  .zgs-dlg-msg{font-size:12.5px;line-height:1.8;color:var(--zgp-fg2,#cfcfcf);word-break:break-word;}
  .zgs-dlg-row{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;}
  .zgp-in[disabled]{opacity:.5;cursor:not-allowed;}
  /* ---------- 设置面板排版规范 ---------- */
  /* 状态信息用键值对齐，而不是把多个字段串成一行用中点隔开 */
  .zgs-kv{display:grid;grid-template-columns:64px 1fr;gap:7px 12px;align-items:baseline;
    margin:4px 0 6px;padding:10px 12px;border-radius:8px;background:rgba(128,128,128,.08);}
  .zgs-kv dt{font-size:11.5px;color:var(--zgp-fg3,#8b8b93);}
  .zgs-kv dd{margin:0;font-size:12.5px;color:var(--zgp-fg,#e6e6e6);word-break:break-all;line-height:1.5;}
  .zgs-kv dd.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;}
  .zgs-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;
    vertical-align:1px;background:#3ddc97;box-shadow:0 0 0 2px rgba(61,220,151,.18);}
  .zgs-dot.off{background:#7c7c85;box-shadow:none;}
  /* 子分组标题：故意做得比分区标题轻，避免"子分组比父级更重"的层级倒置 */
  .zgs-sub{font-size:11.5px;font-weight:600;color:#adadb8;
    margin:18px 0 8px;letter-spacing:.03em;}
  .zgs-sub:first-child{margin-top:12px;}
  /* 持久 label：只靠 placeholder 的话，输入后语义就消失了 */
  .zgs-lab{display:block;font-size:11.5px;color:var(--zgp-fg3,#8b8b93);margin:0 0 5px;}
  /* 危险按钮：移除远端这种不能和主按钮同权重并排 */
  /* 用 #zgs-body 提高优先级：否则被 git-panel 的 .zgp-b 规则覆盖成普通按钮 */
  #zgs-body .zgp-b.danger{color:#ff8f85 !important;background:transparent !important;
    border:1px solid rgba(255,120,110,.42) !important;margin-left:auto;}
  #zgs-body .zgp-b.danger:hover{background:rgba(255,120,110,.12) !important;
    border-color:rgba(255,120,110,.6) !important;}
  /* 折叠块：低频配置（提交者身份、提交信息）默认收起，减少视觉噪音 */
  .zgs-fold{margin:18px 0 6px;}
  .zgs-fold > summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:7px;
    padding:2px 0;font-size:11.5px;font-weight:600;color:#adadb8;letter-spacing:.03em;
    user-select:none;transition:color .15s;}
  .zgs-fold > summary::-webkit-details-marker{display:none;}
  .zgs-fold > summary::before{content:'▸';display:inline-block;font-size:10px;opacity:.75;
    transition:transform .16s ease;transform-origin:50% 50%;}
  .zgs-fold[open] > summary::before{transform:rotate(90deg);}
  .zgs-fold > summary:hover{color:var(--zgp-fg,#e6e6e6);}
  .zgs-fold > summary .zgs-fold-badge{font-weight:400;color:var(--zgp-fg3,#8b8b93);}
  .zgs-fold[open] > summary{margin-bottom:10px;}

  /* details 的收起靠浏览器默认的 display:none，但本文件给内容元素写了
     .zgs-lab{display:block} / .zgp-row{display:flex} 这类作者样式，
     特异性更高会把内容顶出来，所以这里显式隐藏非 summary 的子元素 */
  .zgs-fold:not([open]) > *:not(summary){display:none !important;}
  /* 分区级折叠（提交信息）的标题用分区标题的规格 */
  .zgs-fold.seclvl{margin:0;}
  .zgs-fold.seclvl > summary{font-size:12.5px;letter-spacing:.02em;color:var(--zgp-fg,#e6e6e6);opacity:.95;}
  /* 分区标题：整块里最重的一级，提亮加大，和子分组、说明文字拉开层次 */
  #zgs-body .zgp-sec h5{font-weight:600;font-size:12.5px;letter-spacing:.02em;
    color:var(--zgp-fg,#e6e6e6);opacity:.95;}
  /* 分区内一致性：输入框统一高度与 focus 态 */
  /* 弹窗里的校验错误行 */
  .zgs-dlg-err{display:none;margin-top:9px;font-size:11.5px;line-height:1.5;color:#ff8f85;
    background:rgba(255,120,110,.1);border-radius:6px;padding:6px 9px;word-break:break-all;}
  /* 状态卡里的远端地址可能很长，允许在任意位置折行 */
  .zgs-kv-url{word-break:break-all;}
  /* 只读地址框：看起来是"展示"，不是"待填" */
  #zgs-body .zgp-in[readonly]{opacity:.8;cursor:default;background:rgba(127,127,127,.08);}
  #zgs-body .zgp-in{padding-left:12px;padding-right:12px;height:34px;box-sizing:border-box;}
  #zgs-body .zgp-in:focus{outline:none;border-color:rgba(120,160,255,.55);
    box-shadow:0 0 0 2px rgba(120,160,255,.16);}
  #zgs-body .zgp-b{min-height:30px;}
  #zgs-body .zgp-sec{padding-top:16px;padding-bottom:16px;}
  #zgs-body .zgp-row{gap:8px;}
  `
  try { (doc.head || doc.body).appendChild(style) } catch (e0) { logBoot('appendStyle failed: ' + e0.message) }

  // ---------- 面板容器 ----------
  const root = doc.createElement('div')
  root.id = 'zgs-root'
  root.innerHTML = `
    <div class="zgs-head">
      <div class="zgs-title">${ICON.gear}<span>设置</span></div>
      <button class="zgp-close" id="zgs-close" title="关闭 (Esc)">${ICON.x}</button>
    </div>
    <div class="zgs-body" id="zgs-body"></div>
  `
  doc.body.appendChild(root)
  logBoot('panel mounted, sidebar-body=' + !!doc.querySelector('.sidebar-body'))

  const $ = (id) => doc.getElementById(id)

  // ---------- Toast（面板内既有 toast 在 git-panel 里，独立时自建一个轻提示） ----------
  let toastTimer = null
  function toast (text, kind) {
    let el = doc.getElementById('zgs-toast')
    if (!el) {
      el = doc.createElement('div')
      el.id = 'zgs-toast'
      el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);' +
        'padding:8px 16px;border-radius:8px;font-size:12.5px;z-index:99999;opacity:0;' +
        'pointer-events:none;transition:opacity .18s;background:rgba(30,30,34,.95);color:#eee;' +
        'border:1px solid rgba(255,255,255,.14)'
      doc.body.appendChild(el)
    }
    el.textContent = text || ''
    if (kind === 'err') { el.style.color = '#ff8a80'; el.style.borderColor = 'rgba(255,120,110,.45)' } else { el.style.color = '#eee'; el.style.borderColor = 'rgba(255,255,255,.14)' }
    el.style.opacity = '1'
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { el.style.opacity = '0' }, 2600)
  }

  // ---------- 二次确认（破坏性操作用） ----------
  function zgsConfirm (message, okText) {
    return new Promise(function (resolve) {
      const mask = doc.createElement('div')
      mask.className = 'zgs-mask'
      mask.innerHTML = '<div class="zgs-dlg">' +
        '<div class="zgs-dlg-msg">' + esc(String(message || '')).replace(/\n/g, '<br>') + '</div>' +
        '<div class="zgs-dlg-row">' +
        '<button class="zgp-b" data-r="0">取消</button>' +
        '<button class="zgp-b primary" data-r="1">' + esc(okText || '确定') + '</button>' +
        '</div></div>'
      ;(root || doc.body).appendChild(mask)
      mask.onclick = function (ev) {
        const btn = ev.target && ev.target.closest ? ev.target.closest('[data-r]') : null
        if (!btn) return
        const ok = btn.getAttribute('data-r') === '1'
        try { mask.remove() } catch (e) {}
        resolve(ok)
      }
    })
  }

  // 带输入框的弹窗。传了 onConfirm 就是"异步校验"模式：
  // 点确定后不关窗，先跑 onConfirm(value)，成功才关；失败把原因显示在弹窗里，用户可以直接改地址重试。
  function zgsPrompt (title, placeholder, initial, onConfirm) {
    return new Promise(function (resolve) {
      const hasCheck = typeof onConfirm === 'function'
      const mask = doc.createElement('div')
      mask.className = 'zgs-mask'
      mask.innerHTML = '<div class="zgs-dlg">' +
        '<div class="zgs-dlg-msg">' + esc(String(title || '')).replace(/\n/g, '<br>') + '</div>' +
        '<input class="zgp-in zgs-dlg-in" type="text" placeholder="' + esc(placeholder || '') +
        '" value="' + esc(initial || '') + '" spellcheck="false">' +
        '<div class="zgs-dlg-err"></div>' +
        '<div class="zgs-dlg-row">' +
        '<button class="zgp-b" data-r="0">取消</button>' +
        '<button class="zgp-b primary zgs-dlg-ok" type="button">' + (hasCheck ? '检测并继续' : '保存') + '</button>' +
        '</div></div>'
      ;(root || doc.body).appendChild(mask)
      const inp = mask.querySelector('.zgs-dlg-in')
      const errEl = mask.querySelector('.zgs-dlg-err')
      const okBtn = mask.querySelector('.zgs-dlg-ok')
      let settled = false
      let busy = false
      const showErr = function (t) {
        if (!errEl) return
        errEl.textContent = t || ''
        errEl.style.display = t ? 'block' : 'none'
      }
      const done = function (val) {
        if (settled) return
        settled = true
        try { mask.remove() } catch (e) {}
        resolve(val)
      }
      const submit = async function () {
        if (busy || settled) return
        const v = ((inp && inp.value) || '').trim()
        if (!v) { showErr('请填写仓库地址'); return }
        if (!hasCheck) { done(v); return }
        busy = true
        showErr('')
        const label = okBtn.textContent
        okBtn.disabled = true
        okBtn.textContent = '检测中…'
        let res = null
        try { res = await onConfirm(v) } catch (e) { res = { ok: false, message: (e && e.message) || String(e) } }
        okBtn.disabled = false
        okBtn.textContent = label
        busy = false
        if (res && res.ok) done(v)
        else showErr((res && res.message) || '校验失败，请检查地址')
      }
      if (okBtn) okBtn.onclick = function (ev) { if (ev) ev.stopPropagation(); submit() }
      mask.onclick = function (ev) {
        const btn = ev.target && ev.target.closest ? ev.target.closest('[data-r="0"]') : null
        if (btn) { done(null); return }
        if (ev.target === mask) done(null)
      }
      mask.onkeydown = function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); submit() }
        else if (ev.key === 'Escape') { ev.preventDefault(); done(null) }
      }
      setTimeout(function () { try { inp.focus(); inp.select() } catch (e) {} }, 30)
    })
  }

  // ---------- 渲染 ----------
  async function render () {
    if (!G) {
      $('zgs-body').innerHTML = '<div class="zgp-sec"><h5>不可用</h5><div class="zgp-desc">Git 服务未加载</div></div>'
      return
    }
    const cfg = (G.config() || {}).data || {}
    const ivOpts = [[60000, '1 分钟'], [300000, '5 分钟'], [900000, '15 分钟'], [1800000, '30 分钟'], [3600000, '1 小时']]
    const mode = cfg.autoMode || 'interval'
    const ivHtml = ivOpts.map(function (p) {
      return '<option value="' + p[0] + '"' + (cfg.intervalMs === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'
    }).join('')
    const stopOpts = [[0, '关闭'], [1, '1 分钟'], [3, '3 分钟'], [5, '5 分钟'], [10, '10 分钟']]
    const stopHtml = stopOpts.map(function (p) {
      return '<option value="' + p[0] + '"' + (cfg.onStopEditMinutes === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'
    }).join('')

    $('zgs-body').innerHTML = `
      <div class="zgp-sec">
        <h5>笔记目录</h5>
        <dl class="zgs-kv"><dt>当前目录</dt><dd class="mono" id="s-ws">${esc(win.__ZNOTES_WS || '-')}</dd></dl>
        <div class="zgp-row" style="margin-top:8px">
          <button class="zgp-b" id="s-ws-pick">更换目录</button>
          <button class="zgp-b" id="s-ws-open">在资源管理器打开</button>
        </div>
        <div class="zgp-desc">更换后重新扫描该目录下的 Markdown 文件；文件本身不会被移动或修改。</div>
      </div>
      <div class="zgp-sec">
        <h5>版本控制</h5>
        <dl class="zgs-kv" id="s-vc-kv">
          <dt>状态</dt><dd><span class="zgs-dot off"></span>读取中…</dd>
        </dl>

        <div id="s-vc-init" style="display:none">
          <div class="zgp-row" style="margin-top:14px">
            <button class="zgp-b primary" id="s-vc-init-btn">初始化本地仓库</button>
            <button class="zgp-b" id="s-vc-adopt-btn">从远程仓库加载</button>
          </div>
          <div class="zgp-desc">
            初始化：在本地建立版本历史，之后可再关联远端。<br>
            从远程加载：把远端已有的笔记拉到本地，要求工作区为空。
          </div>
        </div>

        <div id="s-vc-ready" style="display:none">
          <!-- 只有本机仓库、还没绑定远端时，只露一个入口，不先摆一个空地址框 -->
          <div id="s-vc-link-row" style="display:none">
            <div class="zgp-row" style="margin-top:14px">
              <button class="zgp-b primary" id="s-vc-link-btn">将本地仓库关联到远程</button>
            </div>
          </div>
          <!-- 已关联远端（或点了上面的按钮）才展开地址框 -->
          <div id="s-vc-remote-box" style="display:none">
            <div class="zgp-row" style="margin-top:12px">
              <button class="zgp-b danger" id="s-vc-remote-clear">移除远端</button>
            </div>
          </div>
        </div>
      </div>
      <div class="zgp-sec">
        <h5>提交</h5>
        <div class="zgp-field">
          <div class="zgp-lab"><span>自定义模板</span>
            <label class="zgp-sw"><input type="checkbox" id="s-msg-custom"><i></i></label>
          </div>
          <div class="zgp-desc">关闭时使用默认模板与全局 git 身份；打开后可以分别自定义。</div>
        </div>
        <div class="zgp-drawer" id="s-msg-drawer">
          <div class="zgp-field">
            <label class="zgs-lab" for="s-msg">提交信息模板</label>
            <input class="zgp-in" id="s-msg" value="${esc(cfg.commitMessage)}">
            <div class="zgp-desc">可用变量：{{date}} {{time}} {{datetime}} {{count}}</div>
          </div>
          <div class="zgp-field">
            <label class="zgs-lab" for="s-vc-name2">提交者姓名</label>
            <input class="zgp-in" id="s-vc-name2" placeholder="留空则使用全局 git 配置">
            <label class="zgs-lab" for="s-vc-email2" style="margin-top:10px">提交者邮箱</label>
            <input class="zgp-in" id="s-vc-email2" placeholder="留空则使用全局 git 配置">
            <div class="zgp-row" style="margin-top:10px">
              <button class="zgp-b" id="s-vc-id-save">保存提交者身份</button>
            </div>
            <div class="zgp-desc" id="s-vc-id-hint2"></div>
          </div>
        </div>
      </div>
      <div class="zgp-sec">
        <h5>自动同步</h5>
        <div class="zgp-field">
          <div class="zgp-lab"><span>定时提交并推送</span>
            <label class="zgp-sw"><input type="checkbox" id="s-auto" ${cfg.autoSync ? 'checked' : ''}><i></i></label>
          </div>
          <div class="zgp-desc">按下方策略执行；只在有改动时才产生提交。</div>
        </div>
        <div class="zgp-drawer${cfg.autoSync ? ' open' : ''}" id="s-auto-drawer">
          <div class="zgp-field">
            <div class="zgp-lab"><span>触发方式</span></div>
            <select class="zgp-sel" id="s-mode">
              <option value="interval"${mode === 'interval' ? ' selected' : ''}>固定间隔</option>
              <option value="stop-edit"${mode === 'stop-edit' ? ' selected' : ''}>停止编辑后</option>
            </select>
            <div class="zgp-desc">两种方式互斥，只能选一种。</div>
          </div>
          <div class="zgp-field" id="s-interval-row"${mode === 'interval' ? '' : ' style="display:none"'}>
            <div class="zgp-lab"><span>间隔时长</span></div>
            <select class="zgp-sel" id="s-interval">${ivHtml}</select>
            <div class="zgp-desc">跨会话生效：即使插件没开够一个间隔，下次启动会补一次。</div>
          </div>
          <div class="zgp-field" id="s-stop-row"${mode === 'stop-edit' ? '' : ' style="display:none"'}>
            <div class="zgp-lab"><span>静默时长</span></div>
            <select class="zgp-sel" id="s-stop">${stopHtml}</select>
            <div class="zgp-desc">停止输入 N 分钟后触发一次，适合边写边自动保存。</div>
          </div>
        </div>
      </div>
      <div class="zgp-sec">
        <h5>运行状态</h5>
        <div class="zgp-desc" id="s-repo">读取中…</div>
        <div class="zgp-desc" id="s-info"></div>
        <div class="zgp-desc" id="s-attach" style="margin-top:8px">附件：统计中…</div>
        <div style="margin-top:8px">
          <button class="zgp-b" id="s-attach-clean" title="直接删除没有任何笔记引用的附件（不做回收站，误删可从 git 历史取回）">清理未引用附件</button>
        </div>
      </div>
    `

    // 附件统计 + 清理未引用附件。之前这个按钮根本没绑处理函数，点了没反应。
    // 清理是真删（不做回收站），所以必须先给用户看清楚会删几个、多大。
    const attachBox = $('s-attach')
    const attachBtn = $('s-attach-clean')
    const fmtSize = function (n) {
      const v = Number(n) || 0
      if (v >= 1048576) return (v / 1048576).toFixed(1) + ' MB'
      if (v >= 1024) return (v / 1024).toFixed(0) + ' KB'
      return v + ' B'
    }
    const refreshAttachStat = function () {
      if (!attachBox) return
      try {
        const api = win.__CMARK
        const s = api && api.scanAttachments ? api.scanAttachments() : null
        if (!s || !s.ok) {
          attachBox.textContent = '附件：读取失败' + (s && s.message ? '（' + s.message + '）' : '')
          return
        }
        const total = Number(s.total) || 0
        const unused = (s.unused || []).length
        attachBox.textContent =
          '附件：' + total + ' 个，共 ' + fmtSize(s.allBytes) +
          '；未引用 ' + unused + ' 个（' + fmtSize(s.unusedBytes) + '）'
      } catch (e) {}
    }
    refreshAttachStat()
    if (attachBtn) {
      attachBtn.onclick = function () {
        try {
          const api = win.__CMARK
          if (!api || !api.cleanAttachments) return toast('清理功能不可用', 'err')
          const s = api.scanAttachments ? api.scanAttachments() : null
          const n = s && s.ok ? (s.unused || []).length : 0
          if (!n) return toast('没有未被引用的附件')
          const msg =
            '直接删除 ' + n + ' 个未被引用的附件（' + fmtSize(s.unusedBytes) + '）？\n' +
            '删除后不可撤销；这些附件如果已经提交过，可以从 git 历史里找回。'
          zgsConfirm(msg, '删除').then(function (ok) {
            if (!ok) return
            const r = api.cleanAttachments()
            if (!r || !r.ok) return toast('清理失败：' + ((r && r.message) || '未知错误'), 'err')
            toast('已删除 ' + (r.deleted || 0) + ' 个附件')
            refreshAttachStat()
          })
        } catch (e) {
          toast('清理失败：' + (e && e.message), 'err')
        }
      }
    }

    const pickBtn = $('s-ws-pick')
    if (pickBtn) {
      pickBtn.onclick = function () {
        try {
          if (win.__znotesPickDir) win.__znotesPickDir()
          else toast('更换目录功能不可用', 'err')
        } catch (e) {
          toast('打开目录选择失败：' + (e && e.message), 'err')
        }
      }
    }

    const openWsBtn = $('s-ws-open')
    if (openWsBtn) {
      openWsBtn.onclick = function () {
        try {
          const p = win.__ZNOTES_WS
          if (!p) return
          if (win.ztools && typeof win.ztools.shellOpenPath === 'function') win.ztools.shellOpenPath(p)
          else if (win.ztools && typeof win.ztools.shellOpenExternal === 'function') win.ztools.shellOpenExternal('file://' + p)
        } catch (e) { toast('打开失败：' + (e && e.message), 'err') }
      }
    }

    // ---- 版本控制（按仓库状态渲染两种形态）----
    async function refreshVc () {
      let st = {}
      try {
        // inspect() 不含分支，用 state() 才能拿到 branch
        const r = await Promise.resolve(G && typeof G.state === 'function' ? G.state() : null)
        st = (r && r.ok && r.data) ? r.data : ((G && typeof G.inspect === 'function') ? G.inspect() : {})
      } catch (e) {}
      const isRepo = !!(st && st.isRepo)
      const initBox = $('s-vc-init')
      const readyBox = $('s-vc-ready')
      const kvEl = $('s-vc-kv')
      const autoSw = $('s-auto')
      if (autoSw) {
        autoSw.disabled = !isRepo
        if (!isRepo) autoSw.checked = false
      }
      // 这一段只回答"配置成什么样"：启用没有、绑没绑远端。
      // 仓库根 / 分支 / 改动数属于运行诊断，统一放在面板底部的「运行状态」里，避免两处重复。
      let rdKv = {}
      try {
        const ri = await Promise.resolve(G && typeof G.remoteInfo === 'function' ? G.remoteInfo() : null)
        rdKv = (ri && ri.ok && ri.data) || {}
      } catch (e) {}
      if (kvEl) {
        // 状态卡就是这一块的完整现状：状态 / 本地仓库路径 / 远程仓库地址
        kvEl.innerHTML = isRepo
          ? '<dt>状态</dt><dd><span class="zgs-dot"></span>已启用</dd>' +
            '<dt>本地仓库</dt><dd class="mono zgs-kv-url">' + esc(st.repoRoot || '-') + '</dd>' +
            '<dt>远程仓库</dt><dd' + (rdKv.hasRemote ? ' class="mono zgs-kv-url"' : '') + '>' +
              (rdKv.hasRemote ? esc(rdKv.url || '-') : '未绑定') + '</dd>'
          : '<dt>状态</dt><dd><span class="zgs-dot off"></span>未启用</dd>'
      }
      if (initBox) initBox.style.display = isRepo ? 'none' : ''
      if (readyBox) readyBox.style.display = isRepo ? '' : 'none'

      if (!isRepo) {
        // 预填全局身份：否则新机器首次提交会失败，initRepo 会回滚刚建的 .git
        let d = {}
        try {
          const id = await Promise.resolve(G && typeof G.identity === 'function' ? G.identity() : null)
          d = (id && id.ok && id.data) || {}
        } catch (e) {}
        // 提交者身份沿用全局 git 配置，未启用时不再单独给输入框（要改去「提交」分区）
        return
      }

      // 已初始化：只在本机 → 露「关联到远程」入口；已绑定 → 露「移除远端」
      const rd = rdKv
      const linkRow = $('s-vc-link-row')
      const remoteBox = $('s-vc-remote-box')
      if (linkRow) linkRow.style.display = rd.hasRemote ? 'none' : 'block'
      if (remoteBox) remoteBox.style.display = rd.hasRemote ? 'block' : 'none'

      // 「提交」分区抽屉里的身份回填：收起状态也先填好，展开就能看到当前值
      const n2 = $('s-vc-name2')
      const e2 = $('s-vc-email2')
      if (n2 || e2) {
        let d = {}
        try {
          const id = await Promise.resolve(G && typeof G.identity === 'function' ? G.identity() : null)
          d = (id && id.ok && id.data) || {}
        } catch (e) {}
        if (n2 && !n2.value) n2.value = d.localName || ''
        if (e2 && !e2.value) e2.value = d.localEmail || ''
        const hint = $('s-vc-id-hint2')
        if (hint) {
          hint.textContent = (d.localName || d.localEmail)
            ? '当前使用仓库内的身份，覆盖全局配置。'
            : '当前沿用全局 git 配置：' + ([d.globalName, d.globalEmail].filter(Boolean).join(' / ') || '未配置')
        }
      }
    }

    // 渲染完成后拉一次版本控制状态，填充状态卡并按仓库状态切换两块形态
    // （这行之前被误删，导致面板一直停在"读取中…"）
    refreshVc().catch(function () {})

    const initBtn = $('s-vc-init-btn')
    if (initBtn) {
      initBtn.onclick = async function () {
        const branch = 'main'   // 分支固定 main
        const ok = await zgsConfirm(
          '在\n' + (win.__ZNOTES_WS || '-') + '\n初始化本地 git 仓库？\n\n' +
          '现有笔记会被提交一次，内容不会被修改。\n' +
          '之后可以在下面把本地仓库关联到远端。', '初始化')
        if (!ok) return
        initBtn.disabled = true
        try { if (win.__znotesFlushSave) win.__znotesFlushSave() } catch (e) {}
        let r = null
        try {
          r = await G.initRepo({
            mode: 'local',
            branch: branch
          })
        } catch (e) { r = { ok: false, message: (e && e.message) || String(e) } }
        initBtn.disabled = false
        if (r && r.ok) {
          toast('仓库已初始化', 'ok')
          try { if (G.rediscover) G.rediscover() } catch (e) {}
          try { if (win.__zgpRefresh) win.__zgpRefresh() } catch (e) {}
          render()
        } else {
          toast('初始化失败：' + ((r && r.message) || '未知原因'), 'err')
        }
      }
    }

    // 从远程仓库加载：弹窗填地址 → 校验连通性 + 空目录 → 通过才拉取
    const adoptBtn = $('s-vc-adopt-btn')
    if (adoptBtn) {
      adoptBtn.onclick = async function () {
        const url = await zgsPrompt(
          '从远程仓库加载\n\n输入远端仓库地址。点「检测并继续」会先确认仓库可访问、当前工作区为空，通过后才开始拉取。',
          'https://gitee.com/账号/仓库.git', '',
          async function (v) {
            const chk = await Promise.resolve(
              G && typeof G.checkRemote === 'function' ? G.checkRemote(v) : { ok: true })
            if (!chk || !chk.ok) {
              return { ok: false, message: '仓库地址不可用：' + ((chk && chk.message) || '无法连接') }
            }
            const pre = G && typeof G.adoptPrecheck === 'function' ? G.adoptPrecheck() : null
            if (pre && !pre.ok) {
              const items = (pre.blocking && pre.blocking.length)
                ? '：' + pre.blocking.slice(0, 3).join('、') + (pre.blocking.length > 3 ? ' 等' : '')
                : ''
              return { ok: false, message: '加载需要空工作区。' + (pre.reason || '') + items }
            }
            return { ok: true }
          })
        if (!url) return
        toast('正在从远端拉取…', 'info')
        let r = null
        try {
          r = await Promise.resolve(G.adoptRepo({ remoteUrl: url, branch: 'main' }))
        } catch (e) {
          r = { ok: false, message: (e && e.message) || String(e) }
        }
        if (r && r.ok) {
          toast('已从远端加载完成', 'ok')
          try { if (G.rediscover) G.rediscover() } catch (e) {}
          try { if (win.__zgpRefresh) win.__zgpRefresh() } catch (e) {}
          render()
          setTimeout(function () {
            try { if (win.__ZNOTES_REFRESH) win.__ZNOTES_REFRESH() } catch (e) {}
          }, 600)
        } else {
          toast('加载失败：' + ((r && r.message) || '未知原因'), 'err')
        }
      }
    }

    // 「将本地仓库关联到远程」：弹窗填地址 → 校验通过才关窗并写入 remote
    const linkBtn = $('s-vc-link-btn')
    if (linkBtn) {
      linkBtn.onclick = async function () {
        let remoteBranches = null
        const url = await zgsPrompt(
          '将本地仓库关联到远程\n\n输入远端仓库地址。点「检测并继续」会先确认仓库可访问，通过后才写入配置。',
          'https://gitee.com/账号/仓库.git', '',
          async function (v) {
            const chk = await Promise.resolve(
              G && typeof G.checkRemote === 'function' ? G.checkRemote(v) : { ok: true })
            if (!chk || !chk.ok) {
              return { ok: false, message: '仓库地址不可用：' + ((chk && chk.message) || '无法连接') }
            }
            remoteBranches = (chk.branches || [])
            return { ok: true }
          })
        if (!url) return
        let r = null
        try { r = await Promise.resolve(G.setRemote(url)) } catch (e) { r = { ok: false, message: (e && e.message) || '' } }
        if (!r || !r.ok) {
          toast('关联失败：' + ((r && r.message) || '未知原因'), 'err')
          return
        }
        try { if (win.__zgpRefresh) win.__zgpRefresh() } catch (e) {}
        // 远端是空仓库：光写 remote 等于什么也没同步，顺手把本地历史推上去，
        // 否则用户会以为"关联成功"但远端正本还是空的。
        if (remoteBranches && remoteBranches.length === 0) {
          toast('远端是空仓库，正在推送本地历史…', 'info')
          let pr = null
          try { pr = await Promise.resolve(G.push()) } catch (e) { pr = { ok: false, message: (e && e.message) || '' } }
          if (pr && pr.ok) toast('已关联到远程并推送完成', 'ok')
          else toast('已关联，但推送失败：' + ((pr && pr.message) || '未知原因'), 'err')
        } else {
          toast('已关联到远程', 'ok')
        }
        render()
      }
    }

    const saveRemote = async function (url, btn) {
      if (!G || typeof G.setRemote !== 'function') { toast('git 服务不可用', 'err'); return }
      let old = ''
      try {
        const ri = await Promise.resolve(G.remoteInfo())
        if (ri && ri.ok && ri.data && ri.data.hasRemote) old = ri.data.url
      } catch (e) {}
      if (url && old && url !== old) {
        const ok = await zgsConfirm('把远端地址\n\n' + old + '\n\n改为\n\n' + url + '\n\n之后推送会进入新仓库。', '修改')
        if (!ok) return
      }
      if (!url) {
        const ok = await zgsConfirm('移除远端后，笔记只在本机提交，不再上传。', '移除')
        if (!ok) return
      }
      if (btn) btn.disabled = true
      let r = null
      try { r = await G.setRemote(url) } catch (e) { r = { ok: false, message: (e && e.message) || '' } }
      if (btn) btn.disabled = false
      if (r && r.ok) {
        toast(url ? '远程地址已保存' : '已移除远端', 'ok')
        // 状态卡要跟着变（已绑定 ↔ 未绑定），否则界面上还是旧地址
        render()
        refreshVc().catch(function () {})   // 局部刷新，避免整块重渲染冲掉其它输入
      } else {
        toast('操作失败：' + ((r && r.message) || '未知原因'), 'err')
      }
    }

    const remoteClearBtn = $('s-vc-remote-clear')
    if (remoteClearBtn) {
      remoteClearBtn.onclick = function () { saveRemote('', remoteClearBtn) }
    }

    const idSaveBtn = $('s-vc-id-save')
    if (idSaveBtn) {
      idSaveBtn.onclick = async function () {
        const n = (($('s-vc-name2') || {}).value || '').trim()
        const e = (($('s-vc-email2') || {}).value || '').trim()
        idSaveBtn.disabled = true
        let r = null
        try { r = await G.setIdentity(n, e) } catch (err) { r = { ok: false, message: (err && err.message) || '' } }
        idSaveBtn.disabled = false
        if (r && r.ok) toast('身份已保存', 'ok')
        else toast('保存失败：' + ((r && r.message) || '未知原因'), 'err')
      }
    }

    const save = function () {
      G.setConfig({
        autoSync: $('s-auto').checked,
        autoMode: $('s-mode') ? $('s-mode').value : 'interval',
        intervalMs: parseInt($('s-interval').value, 10),
        onStopEditMinutes: parseInt($('s-stop').value, 10),
        commitMessage: $('s-msg').value
      })
      toast('设置已保存', 'ok')
    }

    // 自定义提交信息：开关控制抽屉展开，并决定用默认模板还是自定义模板
    const DEFAULT_MSG = 'notes: 同步 {{datetime}}'
    const msgCustom = $('s-msg-custom')
    const msgDrawer = $('s-msg-drawer')
    const msgInput = $('s-msg')
    if (msgCustom && msgDrawer) {
      const isCustom = !!(cfg.commitMessage && cfg.commitMessage !== DEFAULT_MSG)
      msgCustom.checked = isCustom
      msgDrawer.classList.toggle('open', isCustom)
      if (!isCustom && msgInput && !msgInput.value) msgInput.value = DEFAULT_MSG
      msgCustom.onchange = function () {
        const on = msgCustom.checked
        msgDrawer.classList.toggle('open', on)
        if (!on && msgInput) msgInput.value = DEFAULT_MSG
        save()
      }
    }

    const autoSw = $('s-auto')
    if (autoSw) {
      autoSw.onchange = function () {
        const dr = $('s-auto-drawer')
        if (dr) dr.classList.toggle('open', autoSw.checked)
        save()
      }
    }
    const modeSel = $('s-mode')
    if (modeSel) {
      modeSel.onchange = function () {
        const isIv = modeSel.value === 'interval'
        const ivRow = $('s-interval-row')
        const stRow = $('s-stop-row')
        if (ivRow) ivRow.style.display = isIv ? '' : 'none'
        if (stRow) stRow.style.display = isIv ? 'none' : ''
        save()
      }
    }
    ;['s-interval', 's-stop'].forEach(function (id) {
      const el = $(id)
      if (el) el.onchange = save
    })
    if ($('s-msg')) $('s-msg').onblur = save

    // 仓库 / 状态信息（异步）
    let st = {}
    try {
      const r = await G.state()
      if (r && r.ok && r.data) st = r.data
    } catch (e) {}
    const repoEl = $('s-repo')
    if (repoEl) {
      // 状态也用键值对齐，与上方版本控制保持一致
      let rows = ''
      if (G.scopeRel) rows += '<dt>笔记子目录</dt><dd class="mono">' + esc(G.scopeRel) + '</dd>'
      if (st.branch) rows += '<dt>当前分支</dt><dd class="mono">' + esc(st.branch) + '</dd>'
      if (typeof st.dirty === 'number') rows += '<dt>未提交改动</dt><dd>' + st.dirty + ' 个文件</dd>'
      repoEl.innerHTML = '<dl class="zgs-kv">' + rows + '</dl>'
    }
    const c2 = (G.config() || {}).data || {}
    let irows = '<dt>上次同步</dt><dd>' + (c2.lastRunAt ? new Date(c2.lastRunAt).toLocaleString('zh-CN') : '从未执行') + '</dd>'
    if (c2.lastAutoResult) {
      const ar = c2.lastAutoResult
      irows += '<dt>最近结果</dt><dd>' + (ar.ok ? '成功' : '失败') + (ar.message ? ' · ' + esc(ar.message) : '') + '</dd>'
      if (ar.error) irows += '<dt>错误</dt><dd>' + esc(ar.error) + '</dd>'
      if (ar.at) irows += '<dt>发生时间</dt><dd>' + new Date(ar.at).toLocaleString('zh-CN') + '</dd>'
    }
    const infoEl = $('s-info')
    if (infoEl) infoEl.innerHTML = '<dl class="zgs-kv">' + irows + '</dl>'
  }

  // ---------- 开关 ----------
  function open () {
    if (root.classList.contains('open')) return
    root.classList.add('open')
    render()
  }
  function close () {
    root.classList.remove('open')
  }
  function toggle () {
    if (root.classList.contains('open')) close()
    else open()
  }

  $('zgs-close').onclick = close
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('open')) close()
  })

  // 点击设置面板以外的地方（编辑器 / 空状态）自动收起，和 Git 面板行为一致
  function maybeHide (target) {
    if (!root.classList.contains('open')) return
    const el = target && target.nodeType === 1 ? target : (target && target.parentElement) || null
    if (!el) return
    if (el.closest('#zgs-root') || el.closest('#zgp-root') || el.closest('#zgp-view') || el.closest('#znotes-sbtn')) return
    if (el.closest('.editor-body') || el.closest('[contenteditable="true"]') || el.closest('.worknote-empty')) close()
  }
  doc.addEventListener('mousedown', function (e) { maybeHide(e.target) }, true)

  // ---------- 侧边栏底部按钮 ----------
  function mountSidebarButton () {
    const body = doc.querySelector('.sidebar-body')
    if (!body) return false
    if (doc.getElementById('znotes-sbtn-wrap')) return true
    const wrap = doc.createElement('div')
    wrap.id = 'znotes-sbtn-wrap'
    wrap.className = 'znotes-footer'
    wrap.innerHTML = '<button id="znotes-sbtn" class="znotes-sbtn" title="设置：笔记目录、自动同步、提交选项">' +
      ICON.gear + '<span>设置</span></button>'
    body.appendChild(wrap)
    const btn = wrap.querySelector('#znotes-sbtn')
    btn.onclick = function (ev) {
      ev.stopPropagation()
      toggle()
    }
    // 让树所在的那个（无 class 的）容器成为可收缩的 flex 项，
    // 否则树的高度会把侧边栏撑破、盖住底部按钮栏
    const treeEl = doc.querySelector('.sidebar-tree')
    if (treeEl && treeEl.parentElement && treeEl.parentElement !== body) {
      const holder = treeEl.parentElement
      holder.style.flex = '1 1 auto'
      holder.style.minHeight = '0'
      holder.style.overflow = 'hidden'
      treeEl.style.height = '100%'
      treeEl.style.boxSizing = 'border-box'
    }
    return true
  }
  // 侧边栏可能是异步渲染的，重试几次
  if (!mountSidebarButton()) {
    let tries = 0
    const t = setInterval(function () {
      tries++
      if (mountSidebarButton() || tries > 40) clearInterval(t)
    }, 500)
  }

  // 暴露给 bundle（Git 面板标题栏不需要，留接口给后续）
  win.__zgsToggle = toggle
  win.__zgsOpen = open
  win.__zgsClose = close
  win.__zgsIsOpen = function () { return root.classList.contains('open') }
  win.__zgsRender = render
  logBoot('done, btn=' + !!doc.getElementById('znotes-sbtn'))
}