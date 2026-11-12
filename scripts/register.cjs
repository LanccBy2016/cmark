/**
 * 把 dist 打成 asar 并注册到 ZTools（不执行安装，只准备好脚本）
 * 用法：powershell -c "$env:ELECTRON_RUN_AS_NODE=1; & 'D:/Program Files/ZTools/ZTools.exe' scripts/register.js"
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const os = require('os')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
// vite 的 outDir 是 app（不是 dist）：ZTools 发布 CLI 的 COPY_IGNORE_DIRS 会跳过 dist，
// 产物放 dist 市场拿不上去。这里必须跟 vite.config.ts / scripts/pack.mjs 保持一致。
const DIST = path.join(ROOT, 'app')
const PLUGIN_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.ztools', 'plugins')

/**
 * 从 near.txt 反查「设为全局搜索」的笔记，生成 note/<rel> 指令。
 *
 * 为什么注册时要算：宿主 ztools.setFeature 只更新运行时索引，不写 LMDB，
 * 宿主一重启动态指令就没了。near.txt 才是唯一真相，注册时按它重建，
 * 这样「Alt+空格 搜笔记标题 → 直接打开那篇」在重启后依然可用。
 */
function collectNearFeatures () {
  try {
    const cfgPath = path.join(process.env.USERPROFILE || os.homedir(), '.cmark-config.json')
    if (!fs.existsSync(cfgPath)) return []
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    const workspace = cfg.workspace
    const repoDir = cfg.repoDir || workspace
    if (!workspace || !repoDir) return []
    const nearTxt = path.join(repoDir, '.cmark', 'near.txt')
    if (!fs.existsSync(nearTxt)) return []
    const hashes = new Set(
      fs.readFileSync(nearTxt, 'utf8').split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    )
    if (!hashes.size) return []
    const out = []
    const walk = (dir, rel) => {
      let entries = []
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch (e) {
        return
      }
      for (const ent of entries) {
        if (ent.name.startsWith('.') || ent.name === 'node_modules') continue
        const r = rel ? rel + '/' + ent.name : ent.name
        if (ent.isDirectory()) {
          walk(path.join(dir, ent.name), r)
        } else if (/\.(md|markdown)$/i.test(ent.name)) {
          const h = crypto.createHash('md5').update('cmark-lock:note/' + r).digest('hex').slice(0, 12)
          if (hashes.has(h)) {
            const title = ent.name.replace(/\.(md|markdown)$/i, '')
            out.push({ code: 'note/' + r, icon: 'logo.png', explain: '打开笔记「' + title + '」', cmds: [title] })
          }
        }
      }
    }
    if (fs.existsSync(workspace)) walk(workspace, '')
    return out
  } catch (e) {
    return []
  }
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin.json'), 'utf8'))
  const asarName = 'cmark-' + pkg.version + '.asar'
  const asarPath = path.join(PLUGIN_DIR, asarName)

  // 1. 打 asar。优先用项目内安装的 @electron/asar（npm i -D @electron/asar），
  //    不再依赖 E:/AI-Agent/utools8.0 下的临时解包目录 —— 那个目录会被清理，一删就打包失败。
  const asarCli = process.env.ASAR_CLI || (() => {
    try {
      return require.resolve('@electron/asar/bin/asar.mjs')
    } catch (e) {}
    const local = path.join(ROOT, 'node_modules', '@electron', 'asar', 'bin', 'asar.mjs')
    if (fs.existsSync(local)) return local
    const legacy = path.join(ROOT, 'node_modules', '@electron', 'asar', 'bin', 'asar.js')
    if (fs.existsSync(legacy)) return legacy
    return local
  })()
  if (!fs.existsSync(asarCli)) {
    console.error('找不到 @electron/asar，先在项目里执行：npm i -D @electron/asar')
    process.exit(1)
  }
  fs.mkdirSync(PLUGIN_DIR, { recursive: true })
  execFileSync(process.execPath, [asarCli, 'pack', DIST, asarPath], { stdio: 'inherit' })

  // 2. 写 LMDB
  const lmdb = require('D:/Program Files/ZTools/resources/app.asar/node_modules/lmdb')
  const env = lmdb.open({
    path: path.join(process.env.USERPROFILE || process.env.HOME, '.ztools', 'lmdb', 'device'),
    compression: false,
    encoding: 'binary',
    maxDbs: 8,
  })
  const db = env.openDB('main')
  const raw = db.get('ZTOOLS/plugins')
  const doc = JSON.parse(String(raw))
  const list = doc.data || []

  // 图标写成 file:///<asar>/logo.png；写成空串会让 ZTools 列表里只剩一个没有图标的灰块
  const toFileUrl = (p) => 'file:///' + String(p).replace(/\\/g, '/').replace(/^\//, '')
  const asarUrl = toFileUrl(asarPath)
  // asar 的根目录就是 app/ 本身，plugin.json 里写的 app/index.html 在这里要去掉前缀
  const mainRel = String(pkg.main || 'index.html').replace(/^\.?\/?app\//, '')

  // 保留用户自己注册的动态指令：「设为全局搜索」写进 ZTools 的 feature code 是 note/<rel>，
  // 而每次重新打包注册都会用 plugin.json 的 features 覆盖整条记录 —— 不合并就会把它们全抹掉，
  // 表现是「明明设过全局搜索，重新打包后 Alt+空格 搜不到那篇笔记」。
  const prevEntry = list.find((x) => x && x.name === pkg.name) || null
  const dynamicFeatures = ((prevEntry && prevEntry.features) || []).filter(
    (f) => f && typeof f.code === 'string' && f.code.startsWith('note/')
  )
  const nearFeatures = collectNearFeatures()
  const baseCodes = new Set((pkg.features || []).map((f) => f && f.code))
  // near.txt 是唯一真相：读得到就以它为准，库里残留的 note/ 指令一律丢弃
  // （笔记被删/改名/取消锁定后，那些 code 已经指向不存在的文件，留着就是死链）。
  // 只有 near.txt 读不到（工作区不可用）时才退回保留旧值，避免误删。
  const nearTxtExists = (() => {
    try {
      const cfgPath = path.join(process.env.USERPROFILE || os.homedir(), '.cmark-config.json')
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
      return fs.existsSync(path.join(cfg.repoDir || cfg.workspace || '', '.cmark', 'near.txt'))
    } catch (e) {
      return false
    }
  })()
  const dynamicMerged = nearTxtExists
    ? nearFeatures
    : nearFeatures.concat(dynamicFeatures.filter((f) => !nearFeatures.some((n) => n.code === f.code)))
  const mergedFeatures = (pkg.features || []).concat(
    dynamicMerged.filter((f) => !baseCodes.has(f.code))
  )

  const entry = {
    name: pkg.name,
    title: pkg.pluginName || pkg.title || pkg.name,
    version: pkg.version,
    description: pkg.description || '',
    author: pkg.author || '',
    homepage: pkg.homepage || '',
    logo: asarUrl + '/logo.png',
    main: mainRel,
    preload: pkg.preload || '',
    // features 必须原样写完整对象数组（含 cmds）。之前只写了 feature.code 字符串，
    // 结果 ZTools 认不出调用指令，markdown / cmark 这些词全都搜不到插件。
    features: mergedFeatures,
    path: asarPath,
    storageKind: 'local',
    sourceType: 'local',
    isDevelopment: false,
    installedAt: Date.now(),
    disabled: false,
    pinned: false,
  }

  const idx = list.findIndex((x) => x && x.name === pkg.name)
  if (idx >= 0) {
    // 保留原有的 storageKind / installedAt 之类由 ZTools 维护的字段
    const prev = list[idx]
    list[idx] = Object.assign({}, prev, entry, {
      storageKind: prev.storageKind || 'local',
      installedAt: prev.installedAt || entry.installedAt,
    })
  } else list.push(entry)

  doc.data = list
  db.put('ZTOOLS/plugins', Buffer.from(JSON.stringify(doc)))
  env.close()
  console.log('已注册 ' + pkg.name + '@' + pkg.version + ' → ' + asarPath)
}

main()
