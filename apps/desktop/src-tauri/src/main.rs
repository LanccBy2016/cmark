// CMark 桌面版主进程骨架。
//
// 设计约束（详见仓库根 MIGRATION.md）：
//  1. 前端是现成的 React 产物（app/），这里只负责窗口 + 平台能力；
//  2. 每个 #[tauri::command] 对应 adapters/tauri 里的一个 invoke，命名 fs_* / sys_*；
//  3. 业务逻辑不写在这里 —— 核心在 packages/core（TS），Rust 只做「宿主能力」；
//     大仓库性能不够时，才通过 fast-git feature 把 Git 下沉到 git2。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FsEntry {
    name: String,
    path: String,
    is_dir: bool,
    mtime_ms: u64,
}

#[tauri::command]
fn fs_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn fs_read_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn fs_write_text(path: String, data: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn fs_list(path: String) -> Result<Vec<FsEntry>, String> {
    let dir = PathBuf::from(&path);
    let rd = match std::fs::read_dir(&dir) {
        Ok(rd) => rd,
        Err(_) => return Ok(vec![]),   // 目录不存在 → 空列表（与 TS 端口约定一致）
    };
    let mut out = Vec::new();
    for entry in rd.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let p = entry.path();
        let meta = entry.metadata().ok();
        out.push(FsEntry {
            name,
            path: p.to_string_lossy().to_string(),
            is_dir: meta.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            mtime_ms: meta
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        });
    }
    Ok(out)
}

#[tauri::command]
fn fs_mkdirp(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn fs_rename(from: String, to: String) -> Result<(), String> {
    std::fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
fn fs_remove(path: String) -> Result<(), String> {
    // TODO: 接 trash crate 做「进回收站」，当前先删（与 TS 端口注释一致）
    let p = Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // 第二次启动 → 聚焦已有窗口（替代宿主插件的 onPluginEnter 语义）
            use tauri::Manager;
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            fs_exists,
            fs_read_text,
            fs_write_text,
            fs_list,
            fs_mkdirp,
            fs_rename,
            fs_remove
        ])
        .run(tauri::generate_context!())
        .expect("error while running CMark");
}
