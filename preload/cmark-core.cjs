"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// adapters/node/src/bundle.ts
var bundle_exports = {};
__export(bundle_exports, {
  IGNORED_DIR_NAMES: () => IGNORED_DIR_NAMES,
  IMG_MD: () => IMG_MD,
  MAX_DIRS: () => MAX_DIRS,
  MAX_FILES: () => MAX_FILES,
  MemoryFs: () => MemoryFs,
  NOTE_EXT: () => NOTE_EXT,
  ROOT_LABEL: () => ROOT_LABEL,
  baseName: () => baseName,
  buildTree: () => buildTree,
  buildTreeIndex: () => buildTreeIndex,
  diffOrder: () => diffOrder,
  dirId: () => dirId,
  dirOf: () => dirOf,
  flattenTree: () => flattenTree,
  isNoteFile: () => isNoteFile,
  isTruncated: () => isTruncated,
  joinRelPath: () => joinRelPath,
  nodeConfig: () => nodeConfig,
  nodeFs: () => nodeFs,
  nodeGit: () => nodeGit,
  normalizeRelPath: () => normalizeRelPath,
  noteId: () => noteId,
  noteTitleFromName: () => noteTitleFromName,
  parseOrder: () => parseOrder,
  relativeRelPath: () => relativeRelPath,
  retargetMarkdownImageRefs: () => retargetMarkdownImageRefs,
  scanSync: () => scanSync,
  scanWorkspace: () => scanWorkspace,
  serializeOrder: () => serializeOrder,
  shouldSkipEntry: () => shouldSkipEntry,
  sortKids: () => sortKids,
  stripNoteExt: () => stripNoteExt
});
module.exports = __toCommonJS(bundle_exports);

// packages/core/src/domain/rules.ts
var MAX_DIRS = 5e3;
var MAX_FILES = 2e4;
var IGNORED_DIR_NAMES = ["assets"];
var NOTE_EXT = /\.(md|markdown)$/i;
function shouldSkipEntry(name, isDir, opts = {}) {
  if (!name || name.startsWith(".")) return true;
  if (isDir && (opts.ignoredDirNames ?? IGNORED_DIR_NAMES).includes(name)) return true;
  return false;
}
function isNoteFile(name, opts = {}) {
  return (opts.noteExt ?? NOTE_EXT).test(name);
}
function noteTitleFromName(name, opts = {}) {
  return name.replace(opts.noteExt ?? NOTE_EXT, "");
}
function isTruncated(dirCount, fileCount, maxDirs = MAX_DIRS, maxFiles = MAX_FILES) {
  return dirCount > maxDirs || fileCount > maxFiles;
}

// packages/core/src/useCases/scanWorkspace.ts
function stripNoteExt(name, noteExt = NOTE_EXT) {
  return name.replace(noteExt, "");
}
async function scanWorkspace(fs2, rootAbs, options = {}) {
  const maxDirs = options.maxDirs ?? MAX_DIRS;
  const maxFiles = options.maxFiles ?? MAX_FILES;
  const rules = { ignoredDirNames: options.ignoredDirNames ?? IGNORED_DIR_NAMES, noteExt: options.noteExt ?? NOTE_EXT };
  const join = options.join ?? ((rel) => `${rootAbs}/${rel}`);
  const dirs = [];
  const notes = [];
  let truncated = false;
  async function walk(abs, rel) {
    if (truncated) return;
    if (isTruncated(dirs.length, notes.length, maxDirs, maxFiles)) {
      truncated = true;
      return;
    }
    const entries = await fs2.list(abs);
    for (const e of entries) {
      if (shouldSkipEntry(e.name, e.isDir, rules)) continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDir) {
        dirs.push(childRel);
        await walk(join(childRel), childRel);
      } else if (isNoteFile(e.name, rules)) {
        notes.push({ rel: childRel, title: noteTitleFromName(e.name, rules), abs: join(childRel) });
      }
    }
  }
  await walk(rootAbs, "");
  return { dirs, notes, truncated };
}

// packages/core/src/useCases/buildTree.ts
function dirOf(rel) {
  const i = rel.lastIndexOf("/");
  return i < 0 ? "" : rel.slice(0, i);
}
function baseName(rel) {
  const i = rel.lastIndexOf("/");
  return i < 0 ? rel : rel.slice(i + 1);
}
var noteId = (rel) => `note/${rel}`;
var dirId = (rel) => rel;
function sortKids(kids, seq) {
  if (!seq || seq.length === 0 || kids.length === 0) return kids;
  const idx = /* @__PURE__ */ new Map();
  seq.forEach((id, i) => idx.set(id, i));
  const at = (k) => idx.has(k.id) ? idx.get(k.id) : 1e9;
  return kids.slice().sort((a, b) => at(a) - at(b));
}
function buildTreeIndex(input, options = {}) {
  const { dirs, notes, order = {} } = input;
  const dirIdStyle = options.dirIdStyle ?? "rel";
  const notesByDir = /* @__PURE__ */ new Map();
  for (const n of notes) {
    const d = dirOf(n.rel);
    const arr = notesByDir.get(d) ?? [];
    arr.push(n);
    notesByDir.set(d, arr);
  }
  const dirsByParent = /* @__PURE__ */ new Map();
  for (const d of dirs) {
    const p = dirOf(d);
    const arr = dirsByParent.get(p) ?? [];
    arr.push(d);
    dirsByParent.set(p, arr);
  }
  const byDir = /* @__PURE__ */ new Map();
  const build = (dirRel) => {
    const cached = byDir.get(dirRel);
    if (cached) return cached;
    const kids = [];
    for (const n of notesByDir.get(dirRel) ?? []) {
      kids.push({ id: noteId(n.rel), name: n.title, kind: "note" });
    }
    for (const sub of dirsByParent.get(dirRel) ?? []) {
      kids.push({
        id: dirIdStyle === "basename" ? baseName(sub) : dirId(sub),
        name: baseName(sub),
        kind: "dir",
        children: build(sub)
      });
    }
    const sorted = sortKids(kids, order[dirRel]);
    byDir.set(dirRel, sorted);
    return sorted;
  };
  const root = build("");
  return { root, byDir };
}
function buildTree(input, options = {}) {
  return buildTreeIndex(input, options).root;
}
function flattenTree(tree, out = /* @__PURE__ */ new Map()) {
  for (const n of tree) {
    out.set(n.id, n);
    if (n.children?.length) flattenTree(n.children, out);
  }
  return out;
}

// packages/core/src/useCases/orderFile.ts
var ROOT_LABEL = "\u6839\u76EE\u5F55";
function parseOrder(text) {
  const out = {};
  let cur = "";
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#")) {
      const name = t.slice(1).trim();
      cur = name === ROOT_LABEL || name === "\u6839" ? "" : name.replace(/\/+$/, "");
      if (!out[cur]) out[cur] = [];
      continue;
    }
    if (!out[cur]) out[cur] = [];
    out[cur].push(t);
  }
  return out;
}
function serializeOrder(order) {
  const keys = Object.keys(order).filter((k) => Array.isArray(order[k]) && order[k].length > 0).sort((a, b) => {
    if (a === b) return 0;
    if (a === "") return -1;
    if (b === "") return 1;
    return a < b ? -1 : 1;
  });
  const lines = [];
  keys.forEach((k, i) => {
    if (i) lines.push("");
    lines.push(`# ${k === "" ? ROOT_LABEL : k}`);
    for (const id of order[k]) lines.push(String(id));
  });
  return lines.join("\n") + "\n";
}
function diffOrder(prev, next) {
  return prev === next ? null : next;
}

// packages/core/src/testing/memoryFs.ts
var MemoryFs = class {
  files = /* @__PURE__ */ new Map();
  constructor(init) {
    for (const [path3, v] of Object.entries(init ?? {})) {
      this.files.set(normalize(path3), v === true ? { dir: true } : { text: v });
    }
  }
  async exists(abs) {
    return this.files.has(normalize(abs));
  }
  async readText(abs) {
    const f = this.files.get(normalize(abs));
    if (!f || f.dir) throw new Error(`ENOENT: ${abs}`);
    return f.text ?? "";
  }
  async writeText(abs, data) {
    this.files.set(normalize(abs), { text: data });
  }
  async list(abs) {
    const dir = normalize(abs).replace(/\/$/, "");
    const prefix = dir === "" ? "" : dir + "/";
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const [path3, v] of this.files) {
      if (!path3.startsWith(prefix)) continue;
      const rest = path3.slice(prefix.length);
      if (!rest) continue;
      const name = rest.split("/")[0];
      if (seen.has(name)) continue;
      seen.add(name);
      const isDir = rest.includes("/") || !!v.dir;
      out.push({ name, path: prefix + name, isDir, mtimeMs: 0 });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }
  async mkdirp(abs) {
    this.files.set(normalize(abs), { dir: true });
  }
  async rename(fromAbs, toAbs) {
    const from = normalize(fromAbs), to = normalize(toAbs);
    const f = this.files.get(from);
    if (!f) throw new Error(`ENOENT: ${fromAbs}`);
    this.files.delete(from);
    this.files.set(to, f);
  }
  async remove(abs) {
    const target = normalize(abs);
    for (const path3 of [...this.files.keys()]) {
      if (path3 === target || path3.startsWith(target + "/")) this.files.delete(path3);
    }
  }
  async pickDirectory() {
    return "/ws";
  }
  /** 测试辅助：读出所有路径，便于断言「没有留下空壳目录」 */
  snapshot() {
    return [...this.files.keys()].sort();
  }
};
function normalize(p) {
  return p.replace(/\/+/g, "/").replace(/\/+$/, "");
}

// packages/core/src/useCases/rewriteRefs.ts
var IMG_MD = /(!\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g;
var CODE_SEG = /(```[\s\S]*?```|~~~[\s\S]*?~~~|\$\$[\s\S]*?\$\$|`+[^`]*`+)/g;
var EXTERNAL = /^(https?:|data:|file:|attachment:|#|mailto:)/i;
function normalizeRelPath(p) {
  const out = [];
  for (const seg of String(p).split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (out.length === 0) return "..";
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return out.join("/");
}
function joinRelPath(dirRel, rel) {
  if (!rel) return normalizeRelPath(dirRel);
  if (rel.startsWith("/")) return normalizeRelPath(rel);
  return normalizeRelPath(`${dirRel}/${rel}`);
}
function relativeRelPath(fromDirRel, toRel) {
  const from = fromDirRel ? fromDirRel.split("/").filter(Boolean) : [];
  const to = toRel ? toRel.split("/").filter(Boolean) : [];
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i++;
  const up = from.slice(i).map(() => "..");
  const rest = to.slice(i);
  if (up.length === 0 && rest.length === 0) return "";
  return [...up, ...rest].join("/");
}
function rewriteSegment(seg, opts) {
  return seg.replace(IMG_MD, (whole, pre, url, post) => {
    if (EXTERNAL.test(url)) return whole;
    const absRel = joinRelPath(opts.oldDirRel, url);
    if (absRel.startsWith("..")) return whole;
    if (opts.exists && !opts.exists(absRel)) return whole;
    let rel = relativeRelPath(opts.newDirRel, absRel);
    if (rel && !rel.startsWith(".")) rel = `./${rel}`;
    return pre + rel + post;
  });
}
function retargetMarkdownImageRefs(text, opts) {
  if (!text || opts.oldDirRel === opts.newDirRel) return text;
  const segs = String(text).split(CODE_SEG);
  return segs.map((seg, i) => i % 2 === 1 ? seg : rewriteSegment(seg, opts)).join("");
}

// adapters/node/src/scanSync.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
function scanSync(rootAbs, options = {}) {
  const maxDirs = options.maxDirs ?? MAX_DIRS;
  const maxFiles = options.maxFiles ?? MAX_FILES;
  const rules = {
    ignoredDirNames: options.ignoredDirNames ?? IGNORED_DIR_NAMES,
    noteExt: options.noteExt ?? NOTE_EXT
  };
  const dirs = [];
  const files = [];
  let truncated = false;
  function walk(abs, rel) {
    if (truncated) return;
    if (isTruncated(dirs.length, files.length, maxDirs, maxFiles)) {
      truncated = true;
      return;
    }
    let ents;
    try {
      ents = import_node_fs.default.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      if (shouldSkipEntry(e.name, e.isDirectory(), rules)) continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      const full = import_node_path.default.join(abs, e.name);
      if (e.isDirectory()) {
        dirs.push(childRel);
        walk(full, childRel);
      } else if (isNoteFile(e.name, rules)) {
        let st;
        try {
          st = import_node_fs.default.statSync(full);
        } catch {
          continue;
        }
        files.push({
          rel: childRel,
          full,
          title: noteTitleFromName(e.name, rules),
          mtimeMs: st.mtimeMs,
          birthtimeMs: st.birthtimeMs || st.mtimeMs
        });
      }
    }
  }
  walk(rootAbs, "");
  return { dirs, files, truncated };
}

// adapters/node/src/fs.ts
var import_node_fs2 = require("node:fs");
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var nodeFs = {
  async exists(abs) {
    try {
      await import_node_fs2.promises.access(abs);
      return true;
    } catch {
      return false;
    }
  },
  readText: (abs) => import_node_fs2.promises.readFile(abs, "utf8"),
  writeText: async (abs, data) => {
    await import_node_fs2.promises.mkdir(import_node_path2.default.dirname(abs), { recursive: true });
    await import_node_fs2.promises.writeFile(abs, data, "utf8");
  },
  async list(abs) {
    try {
      return (await import_node_fs2.promises.readdir(abs, { withFileTypes: true })).map((d) => ({
        name: d.name,
        path: import_node_path2.default.join(abs, d.name),
        isDir: d.isDirectory(),
        mtimeMs: 0
      }));
    } catch {
      return [];
    }
  },
  mkdirp: async (abs) => {
    await import_node_fs2.promises.mkdir(abs, { recursive: true });
  },
  rename: (from, to) => import_node_fs2.promises.rename(from, to),
  remove: (abs) => import_node_fs2.promises.rm(abs, { recursive: true, force: true }),
  watch(abs, onChange) {
    try {
      const w = import_node_fs3.default.watch(abs, { recursive: true }, () => onChange());
      return () => w.close();
    } catch {
      return () => {
      };
    }
  },
  async pickDirectory(title) {
    const z = globalThis.ztools ?? globalThis.utools;
    const picked = z?.showOpenDialog?.({ title, properties: ["openDirectory"] });
    return picked?.[0] ?? null;
  }
};
var homeConfigPath = () => import_node_path2.default.join(import_node_os.default.homedir(), ".cmark-config.json");

// adapters/node/src/git.ts
var import_node_child_process = require("node:child_process");
function git(cwd, args) {
  return new Promise((resolve, reject) => {
    (0, import_node_child_process.execFile)("git", args, { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}
var nodeGit = {
  async isRepo(dir) {
    try {
      await git(dir, ["rev-parse", "--is-inside-work-tree"]);
      return true;
    } catch {
      return false;
    }
  },
  async init(dir) {
    await git(dir, ["init"]);
  },
  async status(dir) {
    const out = await git(dir, ["status", "--porcelain"]);
    const res = { staged: [], unstaged: [], untracked: [] };
    for (const line of out.split("\n")) {
      if (!line.trim()) continue;
      const x = line[0], y = line[1], file = line.slice(3).trim();
      if (x === "?" && y === "?") res.untracked.push(file);
      else {
        if (x !== " " && x !== "?") res.staged.push(file);
        if (y !== " ") res.unstaged.push(file);
      }
    }
    return res;
  },
  async commit(dir, message, paths) {
    await git(dir, ["add", ...paths?.length ? paths : ["-A"]]);
    await git(dir, ["commit", "-m", message]);
    return (await git(dir, ["rev-parse", "HEAD"])).trim();
  },
  async push(dir) {
    await git(dir, ["push"]);
  },
  async pull(dir) {
    const out = await git(dir, ["pull"]);
    const conflicts = out.split("\n").filter((l) => l.startsWith("CONFLICT")).map((l) => l.split(" ").pop());
    return { conflicts };
  },
  async log(dir, limit) {
    const out = await git(dir, ["log", `-${limit}`, "--pretty=format:%H%x1f%s%x1f%an%x1f%at"]);
    return out.split("\n").filter(Boolean).map((l) => {
      const [sha, message, author, at] = l.split("");
      return { sha, message, author, at: Number(at) };
    });
  },
  diff: (dir, sha, file) => git(dir, ["diff", `${sha}^`, sha, "--", file])
};

// adapters/node/src/config.ts
var import_node_fs4 = require("node:fs");
function nodeConfig() {
  const file = homeConfigPath();
  return {
    path: () => file,
    async read() {
      try {
        return JSON.parse(await import_node_fs4.promises.readFile(file, "utf8"));
      } catch {
        return null;
      }
    },
    async write(cfg) {
      await import_node_fs4.promises.writeFile(file, JSON.stringify(cfg, null, 2), "utf8");
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  IGNORED_DIR_NAMES,
  IMG_MD,
  MAX_DIRS,
  MAX_FILES,
  MemoryFs,
  NOTE_EXT,
  ROOT_LABEL,
  baseName,
  buildTree,
  buildTreeIndex,
  diffOrder,
  dirId,
  dirOf,
  flattenTree,
  isNoteFile,
  isTruncated,
  joinRelPath,
  nodeConfig,
  nodeFs,
  nodeGit,
  normalizeRelPath,
  noteId,
  noteTitleFromName,
  parseOrder,
  relativeRelPath,
  retargetMarkdownImageRefs,
  scanSync,
  scanWorkspace,
  serializeOrder,
  shouldSkipEntry,
  sortKids,
  stripNoteExt
});
