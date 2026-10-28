export * from './domain/types'
export type { FileSystemPort } from './ports/fs'
export type { GitPort, StatusResult, CommitInfo } from './ports/git'
export type { SystemPort } from './ports/system'
export type { ConfigPort, AppConfig } from './ports/config'
export { scanWorkspace, stripNoteExt } from './useCases/scanWorkspace'
export type { ScanOptions } from './useCases/scanWorkspace'
export { buildTree, buildTreeIndex, sortKids, flattenTree, dirOf, baseName, noteId, dirId } from './useCases/buildTree'
export type { BuildTreeInput, BuildTreeOptions, TreeIndex } from './useCases/buildTree'
export { parseOrder, serializeOrder, diffOrder, ROOT_LABEL } from './useCases/orderFile'
export { MemoryFs } from './testing/memoryFs'
export {
  MAX_DIRS, MAX_FILES, IGNORED_DIR_NAMES, NOTE_EXT,
  shouldSkipEntry, isNoteFile, noteTitleFromName, isTruncated,
} from './domain/rules'
export type { RuleOptions } from './domain/rules'
export {
  retargetMarkdownImageRefs, normalizeRelPath, joinRelPath, relativeRelPath, IMG_MD,
} from './useCases/rewriteRefs'
export type { RetargetOptions } from './useCases/rewriteRefs'
