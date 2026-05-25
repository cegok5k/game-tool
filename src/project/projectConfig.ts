import type { FolderHandle, FsAdapter } from '../types/platform'

export type ProjectConfig = {
  projectName: string
  devPortOffset: number | null
  spineVersion: string | null
  balanceTypes: readonly string[]
}

const JSBUILD_PATHS = ['client/jsbuildconfig.json', 'jsbuildconfig.json'] as const
const SUPPORTS_PATHS = ['supports.json'] as const

async function tryReadJson(fs: FsAdapter, folder: FolderHandle, paths: readonly string[]): Promise<unknown | null> {
  for (const path of paths) {
    try {
      const text = await fs.readText(folder, path)
      try {
        return JSON.parse(text) as unknown
      } catch {
        return null
      }
    } catch {
      // file doesn't exist; try next candidate
    }
  }
  return null
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(obj: Record<string, unknown> | null, key: string): string | null {
  if (obj === null) return null
  const v = obj[key]
  return typeof v === 'string' ? v : null
}

function readNumber(obj: Record<string, unknown> | null, key: string): number | null {
  if (obj === null) return null
  const v = obj[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export async function readProjectConfig(fs: FsAdapter, folder: FolderHandle): Promise<ProjectConfig> {
  const [jsbuild, supports] = await Promise.all([
    tryReadJson(fs, folder, JSBUILD_PATHS),
    tryReadJson(fs, folder, SUPPORTS_PATHS),
  ])
  const jsbuildObj = asObject(jsbuild)
  const supportsObj = asObject(supports)

  const projectName = readString(jsbuildObj, 'gamename')
    ?? readString(supportsObj, 'gameName')
    ?? folder.name

  const devPortOffset = readNumber(jsbuildObj, 'devportoffset')
  const spineVersion  = readString(jsbuildObj, 'spineversion')

  let balanceTypes: readonly string[] = []
  if (supportsObj !== null && 'balanceTypes' in supportsObj) {
    const bt = supportsObj['balanceTypes']
    if (bt !== null && typeof bt === 'object' && !Array.isArray(bt)) {
      balanceTypes = Object.keys(bt)
    }
  }

  return { projectName, devPortOffset, spineVersion, balanceTypes }
}

export type DeriveGameUrlOptions = {
  devPortOffset: number | null
  balanceType: string | null
  host?: string
}

export function deriveGameUrl(opts: DeriveGameUrlOptions): string | null {
  if (opts.devPortOffset === null) return null
  if (opts.balanceType === null) return null
  const host = opts.host ?? 'localhost'
  const port = 3000 + opts.devPortOffset
  return `http://${host}:${port}/?balanceType=${encodeURIComponent(opts.balanceType)}`
}
