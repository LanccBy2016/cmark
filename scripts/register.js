/**
 * 把 dist 打成 asar 并注册到 ZTools（不执行安装，只准备好脚本）
 * 用法：powershell -c "$env:ELECTRON_RUN_AS_NODE=1; & 'D:/Program Files/ZTools/ZTools.exe' scripts/register.js"
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
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

  const entry = {
    name: pkg.name,
    title: pkg.pluginName || pkg.title || pkg.name,
    version: pkg.version,
    description: pkg.description || '',
    author: pkg.author || '',
    homepage: pkg.homepage || '',
    path: asarPath,
    logo: '',
    features: (pkg.features || []).map((f) => f.code),
    sourceType: 'local',
    disabled: false,
    pinned: false,
  }

  const idx = list.findIndex((x) => x && x.name === pkg.name)
  if (idx >= 0) list[idx] = Object.assign({}, list[idx], entry)
  else list.push(entry)

  doc.data = list
  db.put('ZTOOLS/plugins', Buffer.from(JSON.stringify(doc)))
  env.close()
  console.log('已注册 ' + pkg.name + '@' + pkg.version + ' → ' + asarPath)
}

main()
