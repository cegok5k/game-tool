import type {
  DialogAdapter,
  DirEntry,
  EnvAdapter,
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
      const result: DirEntry[] = []
      for await (const [name, entry] of (dirHandle as FileSystemDirectoryHandle & {
        entries: () => AsyncIterableIterator<[string, FileSystemHandle]>
      }).entries()) {
        const path = `${relativePath ? relativePath + '/' : ''}${name}`
        if (entry.kind === 'file') {
          const file = await (entry as FileSystemFileHandle).getFile()
          result.push({ kind: 'file', path, name, size: file.size, modifiedAt: file.lastModified })
        } else if (entry.kind === 'directory') {
          result.push({ kind: 'directory', path, name, size: 0, modifiedAt: 0 })
        }
      }
      result.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
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

/**
 * Strip VITE_ prefix from any keys in `source` and drop non-string/empty values.
 * Pure function, easily testable. Exported for test use only.
 *
 * SECURITY: any VITE_-prefixed value in `import.meta.env` is inlined into the
 * production bundle and visible to anyone who downloads the built JS. Only use
 * this for local-dev keys or keys you intentionally want to ship. For an
 * Electron/Tauri build, the desktop platform adapter should read from
 * `process.env` instead.
 */
export function stripVitePrefix(source: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(source)) {
    if (!k.startsWith('VITE_')) continue
    if (typeof v !== 'string' || v === '') continue
    out[k.slice('VITE_'.length)] = v
  }
  return out
}

function readViteEnv(): Record<string, string> {
  const meta = (import.meta as { env?: Record<string, unknown> }).env
  if (meta === undefined) return {}
  return stripVitePrefix(meta)
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
  // If the caller passes an `env`, use it as-is (handy for tests). Otherwise
  // default to Vite's import.meta.env with VITE_ prefixes stripped so a
  // `.env.local` file with `VITE_GOOGLE_GENAI_API_KEY=...` becomes
  // `GOOGLE_GENAI_API_KEY` to the rest of the app.
  const env = opts.env ?? readViteEnv()
  return {
    kind: 'browser',
    fs: createFsAdapter(),
    env: createEnvAdapter(env),
    shell: createShellAdapter(),
    dialog: createDialogAdapter(),
  }
}
