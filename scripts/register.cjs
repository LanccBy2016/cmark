/**
 * 把 dist 打成 asar 并注册到 ZTools（不执行安装，只准备好脚本）
 * 用法：powershell -c "$env:ELECTRON_RUN_AS_NODE=1; & 'D:/Program Files/ZTools/ZTools.exe' scripts/register.js"
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
// vite 的 outDir 是 app（不是 dist）：ZTools 发布 CLI 的 COPY_IGNORE_DIRS 会跳过 dist，
// 产物放 dist 市场拿不上去。这里必须跟 vite.config.ts / scripts/pack.mjs 保持一致。
const DIST = path.join(ROOT, 'app')
const PLUGIN_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.ztools', 'plugins')

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin.json'), 'utf8'))
  const asarName = 'cmark-' + pkg.version + '.asar'
  const asarPath = path.join(PLUGIN_DIR, asarName)

  // 1. 打 asar（外部 asar 工具路径由环境变量或默认值提供）
  const asarCli = process.env.ASAR_CLI || 'E:/AI-Agent/utools8.0/unpack/asar/node_modules/@electron/asar/bin/asar.js'
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
    features: pkg.features || [],
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
