export type FolderHandle = {
  name: string
  rootPath: string
  fsHandle: FileSystemDirectoryHandle | null
}

export type FileInfo = {
  path: string
  size: number
  modifiedAt: number
}

export type ChangeEvent =
  | { type: 'added'; path: string }
  | { type: 'modified'; path: string }
  | { type: 'removed'; path: string }

export type ProcessHandle = {
  pid: number
  stdout: AsyncIterable<string>
  stderr: AsyncIterable<string>
  exit: Promise<number>
  kill(): void
}

export type FileFilter = { name: string; extensions: string[] }

export interface FsAdapter {
  openFolder(): Promise<FolderHandle | null>
  readFile(handle: FolderHandle, relativePath: string): Promise<Uint8Array>
  readText(handle: FolderHandle, relativePath: string): Promise<string>
  writeFile(handle: FolderHandle, relativePath: string, data: Uint8Array): Promise<void>
  listDir(handle: FolderHandle, relativePath: string): Promise<FileInfo[]>
  watch(handle: FolderHandle, relativePath: string, onChange: (e: ChangeEvent) => void): () => void
}

export interface EnvAdapter {
  get(key: string): string | undefined
  has(key: string): boolean
}

export interface ShellAdapter {
  spawn?(cmd: string, args: string[]): Promise<ProcessHandle>
  openExternal(url: string): Promise<void>
}

export interface DialogAdapter {
  openFile(filters?: FileFilter[]): Promise<string | null>
  saveFile(suggestion?: string): Promise<string | null>
}

export interface PlatformAdapter {
  readonly kind: 'browser' | 'electron' | 'tauri'
  readonly fs: FsAdapter
  readonly env: EnvAdapter
  readonly shell: ShellAdapter
  readonly dialog: DialogAdapter
}
