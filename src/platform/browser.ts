import type {
  DialogAdapter,
  EnvAdapter,
  FileInfo,
  FolderHandle,
  FsAdapter,
  PlatformAdapter,
  ShellAdapter,
} from '../types/platform'

type Options = {
  env?: Record<string, string>
}

function createFsAdapter(): FsAdapter {
  return {
    async openFolder(): Promise<FolderHandle | null> {
      if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
        return null
      }
      const picker = (window as unknown as {
        showDirectoryPicker: (opts?: { mode: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
      }).showDirectoryPicker
      try {
        const handle = await picker({ mode: 'readwrite' })
        return { name: handle.name, rootPath: handle.name, fsHandle: handle }
      } catch {
        return null
      }
    },

    async readFile(handle, relativePath) {
      const fileHandle = await resolveFileHandle(handle, relativePath)
      const file = await fileHandle.getFile()
      const buf = await file.arrayBuffer()
      return new Uint8Array(buf)
    },

    async readText(handle, relativePath) {
      const fileHandle = await resolveFileHandle(handle, relativePath)
      const file = await fileHandle.getFile()
      return file.text()
    },

    async writeFile(handle, relativePath, data) {
      const fileHandle = await resolveFileHandle(handle, relativePath, { create: true })
      const writable = await (fileHandle as FileSystemFileHandle & {
        createWritable: () => Promise<FileSystemWritableFileStream>
      }).createWritable()
      await writable.write(data)
      await writable.close()
    },

    async listDir(handle, relativePath) {
      const dirHandle = await resolveDirHandle(handle, relativePath)
      const result: FileInfo[] = []
      for await (const [name, entry] of (dirHandle as FileSystemDirectoryHandle & {
        entries: () => AsyncIterableIterator<[string, FileSystemHandle]>
      }).entries()) {
        if (entry.kind === 'file') {
          const file = await (entry as FileSystemFileHandle).getFile()
          result.push({
            path: `${relativePath ? relativePath + '/' : ''}${name}`,
            size: file.size,
            modifiedAt: file.lastModified,
          })
        }
      }
      return result
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    watch(_handle, _relativePath, _onChange) {
      // Browser file system access API has no native watch.
      // For Plan 1 we no-op; Plan 3 will add polling-based watching.
      return () => {}
    },
  }
}

async function resolveDirHandle(
  handle: FolderHandle,
  relativePath: string,
): Promise<FileSystemDirectoryHandle> {
  if (handle.fsHandle === null) throw new Error('No filesystem handle on folder')
  if (!relativePath) return handle.fsHandle
  const parts = relativePath.split('/').filter(Boolean)
  let current: FileSystemDirectoryHandle = handle.fsHandle
  for (const part of parts) {
    current = await current.getDirectoryHandle(part)
  }
  return current
}

async function resolveFileHandle(
  handle: FolderHandle,
  relativePath: string,
  opts: { create?: boolean } = {},
): Promise<FileSystemFileHandle> {
  if (handle.fsHandle === null) throw new Error('No filesystem handle on folder')
  const parts = relativePath.split('/').filter(Boolean)
  const fileName = parts.pop()
  if (fileName === undefined) throw new Error('Empty relative path')
  let dir: FileSystemDirectoryHandle = handle.fsHandle
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: opts.create })
  }
  return dir.getFileHandle(fileName, { create: opts.create })
}

function createEnvAdapter(env: Record<string, string>): EnvAdapter {
  return {
    get(key) {
      return env[key]
    },
    has(key) {
      return Object.hasOwn(env, key)
    },
  }
}

function createShellAdapter(): ShellAdapter {
  return {
    async openExternal(url) {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener')
      }
    },
  }
}

function createDialogAdapter(): DialogAdapter {
  return {
    async openFile() {
      return null  // Not used in Plan 1
    },
    async saveFile() {
      return null  // Not used in Plan 1
    },
  }
}

export function createBrowserPlatform(opts: Options = {}): PlatformAdapter {
  return {
    kind: 'browser',
    fs: createFsAdapter(),
    env: createEnvAdapter(opts.env ?? {}),
    shell: createShellAdapter(),
    dialog: createDialogAdapter(),
  }
}
