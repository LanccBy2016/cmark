export interface SystemPort {
  /** 打开外部链接（浏览器） */
  openExternal(url: string): Promise<void>
  /** 在文件管理器中定位文件 */
  revealPath(abs: string): Promise<void>
  copyText(text: string): Promise<void>
  notify(title: string, body?: string): Promise<void>
  /** 平台标识，UI 用来做输入层分叉（桌面快捷键 / 移动工具栏） */
  platform(): 'node' | 'tauri' | 'capacitor' | 'browser'
}
