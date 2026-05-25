import { useEffect } from 'react'
import styles from './AssetTreePanel.module.css'
import { useProjectStore } from '../../stores/projectStore'
import { useAssetBrowserStore } from '../../stores/assetBrowserStore'
import { getPlatform } from '../../platform'
import type { DirEntry, FolderHandle } from '../../types/platform'

const HIDDEN_NAMES: ReadonlySet<string> = new Set([
  'node_modules', 'dist', 'dist-ssr', 'coverage', '.git', '.vscode', '.idea', '.superpowers', '.playwright-mcp',
])

function isVisible(entry: DirEntry): boolean {
  if (entry.name.startsWith('.')) return false
  if (HIDDEN_NAMES.has(entry.name)) return false
  return true
}

function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AssetTreePanel() {
  const folder = useProjectStore((s) => s.folder)

  if (folder === null) {
    return <div className={styles.wrap}><div className={styles.empty}>No project open. Use "Open Project" in the menu bar.</div></div>
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tree}>
        <Children folder={folder} parentPath="" depth={0} />
      </div>
    </div>
  )
}

function Children({ folder, parentPath, depth }: { folder: FolderHandle; parentPath: string; depth: number }) {
  const entries = useAssetBrowserStore((s) => s.entriesByPath.get(parentPath))
  const setEntries = useAssetBrowserStore((s) => s.setEntries)

  useEffect(() => {
    if (entries !== undefined) return
    let cancelled = false
    void (async () => {
      try {
        const list = await getPlatform().fs.listDir(folder, parentPath)
        if (!cancelled) setEntries(parentPath, list)
      } catch {
        if (!cancelled) setEntries(parentPath, [])
      }
    })()
    return () => { cancelled = true }
  }, [folder, parentPath, entries, setEntries])

  if (entries === undefined) {
    return <div className={styles.row} style={{ paddingLeft: 8 + depth * 14 }}>Loading…</div>
  }

  const visible = entries.filter(isVisible)
  if (visible.length === 0) {
    return null
  }
  return (
    <>
      {visible.map((e) => (e.kind === 'directory'
        ? <DirNode key={e.path} folder={folder} entry={e} depth={depth} />
        : <FileNode key={e.path} entry={e} depth={depth} />
      ))}
    </>
  )
}

function DirNode({ folder, entry, depth }: { folder: FolderHandle; entry: DirEntry; depth: number }) {
  const expanded = useAssetBrowserStore((s) => s.expanded.has(entry.path))
  const toggleExpanded = useAssetBrowserStore((s) => s.toggleExpanded)
  const selectedPath = useAssetBrowserStore((s) => s.selectedPath)
  const select = useAssetBrowserStore((s) => s.select)

  return (
    <>
      <div
        className={`${styles.row} ${styles.dir}`}
        data-selected={selectedPath === entry.path}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => { toggleExpanded(entry.path); select(entry.path) }}
      >
        <span className={styles.icon}>{expanded ? '▾' : '▸'}</span>
        <span>{entry.name}</span>
      </div>
      {expanded && <Children folder={folder} parentPath={entry.path} depth={depth + 1} />}
    </>
  )
}

function FileNode({ entry, depth }: { entry: DirEntry; depth: number }) {
  const selectedPath = useAssetBrowserStore((s) => s.selectedPath)
  const select = useAssetBrowserStore((s) => s.select)

  return (
    <div
      className={`${styles.row} ${styles.file}`}
      data-selected={selectedPath === entry.path}
      style={{ paddingLeft: 8 + depth * 14 + 14 }}
      onClick={() => select(entry.path)}
    >
      <span className={styles.icon}>·</span>
      <span>{entry.name}</span>
      <span className={styles.size}>{formatSize(entry.size)}</span>
    </div>
  )
}
