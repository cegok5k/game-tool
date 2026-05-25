# Plan 6 — Asset Browser

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Replace the Assets placeholder tab with a real file tree that reads from the open project's folder. Lazy-loads subdirectories on expand. Shows file size + modified time for the selected entry. Filters out `node_modules`, `.git`, and other noise by default.

**Architecture:** `FsAdapter.listDir` is extended to return both files **and** subdirectories, each tagged with `kind: 'file' | 'directory'`. A new `assetBrowserStore` tracks which directory paths are expanded and which file path is selected. The `AssetTreePanel` component walks the tree lazily — when the user expands a folder, it calls `listDir` for that subpath and caches the result in the store. The Asset tab in `BottomTabs` renders this panel.

**Tech Stack:** Unchanged.

**Reference:** Spec §8.3 (Asset Browser was always a tab placeholder), Plan 5 (project opening builds on FsAdapter).

**Out of scope:**
- Drag-from-tree-to-canvas-to-place — later plan
- File preview (image thumbnails, spine animation playback) — later plan
- Search / filter by name — easy follow-up
- File watcher (auto-refresh on disk change) — Plan 7+ depending on JSON write-back
- AI generate from asset right-click — Plan 9 (AI Studio)

---

## Conventions

- TDD for pure logic (filtering, sorting); smoke test for UI components
- Commit per task

---

### Task 1: Extend FsAdapter.listDir to include directories

**Files:**
- Modify: `src/types/platform.ts`
- Modify: `src/platform/browser.ts`
- Modify: `src/platform/browser.test.ts`

Currently `listDir` only returns files. We need it to return entries with a `kind` field so the tree can distinguish folders from leaves.

- [ ] **Step 1: Update the type in `src/types/platform.ts`**

Read it. Replace the `FileInfo` type with:

```ts
export type DirEntryKind = 'file' | 'directory'

export type DirEntry = {
  kind: DirEntryKind
  /** Path relative to the FolderHandle root */
  path: string
  /** Base name (no parent path) */
  name: string
  /** File size in bytes (only meaningful for files) */
  size: number
  /** Last modified time (epoch ms); 0 if unknown */
  modifiedAt: number
}

/** @deprecated alias for DirEntry kept for the one Plan 1 store test that imports it */
export type FileInfo = DirEntry
```

Update `FsAdapter`'s `listDir` signature: `listDir(handle, relativePath): Promise<DirEntry[]>`.

- [ ] **Step 2: Update `src/platform/browser.ts`**

Read it. In the `listDir` function, change the loop to include both files AND subdirectories. Final:

```ts
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
  // Stable sort: directories first, then files; alphabetical within each
  result.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return result
}
```

Make sure `DirEntry` is imported alongside the other types at the top.

- [ ] **Step 3: Update `src/platform/browser.test.ts`** if it tests listDir (it doesn't currently — leave alone)

- [ ] **Step 4: Verify**

- `npm run test:run` PASS overall
- `npm run typecheck` PASS
- `npm run lint` PASS

- [ ] **Step 5: Commit**

```
git add src/types/platform.ts src/platform/browser.ts
git commit -m "platform: listDir now includes directories with kind discriminator"
```

Co-Authored-By: `Co-Authored-By: Claude <noreply@anthropic.com>`

---

### Task 2: assetBrowserStore

Tracks expanded paths, cached entries per path, and selected entry.

**Files:**
- Create: `src/stores/assetBrowserStore.ts`
- Create: `src/stores/assetBrowserStore.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test, beforeEach } from 'vitest'
import type { DirEntry } from '../types/platform'
import { useAssetBrowserStore } from './assetBrowserStore'

const dirA: DirEntry = { kind: 'directory', path: 'media', name: 'media', size: 0, modifiedAt: 0 }
const fileA: DirEntry = { kind: 'file', path: 'media/hero.png', name: 'hero.png', size: 1234, modifiedAt: 0 }

describe('assetBrowserStore', () => {
  beforeEach(() => { useAssetBrowserStore.getState().reset() })

  test('initial state: nothing expanded, nothing selected, no caches', () => {
    const s = useAssetBrowserStore.getState()
    expect(s.expanded.size).toBe(0)
    expect(s.selectedPath).toBeNull()
    expect(s.entriesByPath.size).toBe(0)
  })

  test('toggleExpanded flips a path', () => {
    useAssetBrowserStore.getState().toggleExpanded('media')
    expect(useAssetBrowserStore.getState().expanded.has('media')).toBe(true)
    useAssetBrowserStore.getState().toggleExpanded('media')
    expect(useAssetBrowserStore.getState().expanded.has('media')).toBe(false)
  })

  test('setEntries caches entries for a path', () => {
    useAssetBrowserStore.getState().setEntries('media', [dirA, fileA])
    const cached = useAssetBrowserStore.getState().entriesByPath.get('media')
    expect(cached).toEqual([dirA, fileA])
  })

  test('select sets the selectedPath', () => {
    useAssetBrowserStore.getState().select('media/hero.png')
    expect(useAssetBrowserStore.getState().selectedPath).toBe('media/hero.png')
    useAssetBrowserStore.getState().select(null)
    expect(useAssetBrowserStore.getState().selectedPath).toBeNull()
  })

  test('reset clears everything', () => {
    const s = useAssetBrowserStore.getState()
    s.toggleExpanded('media')
    s.setEntries('media', [fileA])
    s.select('media/hero.png')
    s.reset()
    const after = useAssetBrowserStore.getState()
    expect(after.expanded.size).toBe(0)
    expect(after.entriesByPath.size).toBe(0)
    expect(after.selectedPath).toBeNull()
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `src/stores/assetBrowserStore.ts`**

```ts
import { create } from 'zustand'
import type { DirEntry } from '../types/platform'

type State = {
  expanded: ReadonlySet<string>
  entriesByPath: ReadonlyMap<string, readonly DirEntry[]>
  selectedPath: string | null
  toggleExpanded: (path: string) => void
  setEntries: (path: string, entries: readonly DirEntry[]) => void
  select: (path: string | null) => void
  reset: () => void
}

export const useAssetBrowserStore = create<State>((set, get) => ({
  expanded: new Set(),
  entriesByPath: new Map(),
  selectedPath: null,
  toggleExpanded: (path) => {
    const next = new Set(get().expanded)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    set({ expanded: next })
  },
  setEntries: (path, entries) => {
    const next = new Map(get().entriesByPath)
    next.set(path, entries)
    set({ entriesByPath: next })
  },
  select: (selectedPath) => set({ selectedPath }),
  reset: () => set({ expanded: new Set(), entriesByPath: new Map(), selectedPath: null }),
}))
```

- [ ] **Step 4: Verify**

- 5 tests pass, no regressions
- typecheck + lint clean

- [ ] **Step 5: Commit**

```
git add src/stores/assetBrowserStore.ts src/stores/assetBrowserStore.test.ts
git commit -m "stores: assetBrowserStore tracks expanded paths + selection"
```

---

### Task 3: AssetTreePanel component

**Files:**
- Create: `src/ui/panels/AssetTreePanel.tsx`
- Create: `src/ui/panels/AssetTreePanel.module.css`
- Create: `src/ui/panels/AssetTreePanel.test.tsx`

Lazy-loads each directory on expand. Hides `node_modules`, `.git`, `dist`, and dotfiles by default.

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, test, beforeEach, vi } from 'vitest'
import type { DirEntry, PlatformAdapter, FolderHandle } from '../../types/platform'
import { useProjectStore } from '../../stores/projectStore'
import { useAssetBrowserStore } from '../../stores/assetBrowserStore'
import { __setPlatformForTests } from '../../platform'
import { AssetTreePanel } from './AssetTreePanel'

const folder: FolderHandle = { name: 'demo', rootPath: 'demo', fsHandle: null }

function mockPlatform(listings: Record<string, DirEntry[]>): PlatformAdapter {
  return {
    kind: 'browser',
    fs: {
      openFolder: vi.fn(),
      readFile: vi.fn(),
      readText: vi.fn(),
      writeFile: vi.fn(),
      listDir: vi.fn(async (_h, p) => listings[p] ?? []),
      watch: vi.fn(() => () => {}),
    },
    env: { get: () => undefined, has: () => false },
    shell: { openExternal: vi.fn() },
    dialog: { openFile: vi.fn(), saveFile: vi.fn() },
  }
}

describe('AssetTreePanel', () => {
  beforeEach(() => {
    useProjectStore.getState().close()
    useAssetBrowserStore.getState().reset()
    __setPlatformForTests(null)
  })

  test('shows empty hint when no project is open', () => {
    render(<AssetTreePanel />)
    expect(screen.getByText(/no project open/i)).toBeInTheDocument()
  })

  test('lists root entries when a project is open', async () => {
    __setPlatformForTests(mockPlatform({
      '': [
        { kind: 'directory', path: 'media',  name: 'media',  size: 0, modifiedAt: 0 },
        { kind: 'file',      path: 'README.md', name: 'README.md', size: 100, modifiedAt: 0 },
      ],
    }))
    useProjectStore.getState().setFolder(folder)
    render(<AssetTreePanel />)
    await waitFor(() => expect(screen.getByText('media')).toBeInTheDocument())
    expect(screen.getByText('README.md')).toBeInTheDocument()
  })

  test('clicking a directory expands and lazily loads its entries', async () => {
    __setPlatformForTests(mockPlatform({
      '': [{ kind: 'directory', path: 'media', name: 'media', size: 0, modifiedAt: 0 }],
      'media': [{ kind: 'file', path: 'media/hero.png', name: 'hero.png', size: 100, modifiedAt: 0 }],
    }))
    useProjectStore.getState().setFolder(folder)
    render(<AssetTreePanel />)
    await waitFor(() => expect(screen.getByText('media')).toBeInTheDocument())
    fireEvent.click(screen.getByText('media'))
    await waitFor(() => expect(screen.getByText('hero.png')).toBeInTheDocument())
  })

  test('hides node_modules + .git + dotfiles by default', async () => {
    __setPlatformForTests(mockPlatform({
      '': [
        { kind: 'directory', path: 'node_modules', name: 'node_modules', size: 0, modifiedAt: 0 },
        { kind: 'directory', path: '.git', name: '.git', size: 0, modifiedAt: 0 },
        { kind: 'file', path: '.env', name: '.env', size: 0, modifiedAt: 0 },
        { kind: 'file', path: 'package.json', name: 'package.json', size: 0, modifiedAt: 0 },
      ],
    }))
    useProjectStore.getState().setFolder(folder)
    render(<AssetTreePanel />)
    await waitFor(() => expect(screen.getByText('package.json')).toBeInTheDocument())
    expect(screen.queryByText('node_modules')).not.toBeInTheDocument()
    expect(screen.queryByText('.git')).not.toBeInTheDocument()
    expect(screen.queryByText('.env')).not.toBeInTheDocument()
  })

  test('clicking a file selects it', async () => {
    __setPlatformForTests(mockPlatform({
      '': [{ kind: 'file', path: 'README.md', name: 'README.md', size: 100, modifiedAt: 0 }],
    }))
    useProjectStore.getState().setFolder(folder)
    render(<AssetTreePanel />)
    await waitFor(() => expect(screen.getByText('README.md')).toBeInTheDocument())
    fireEvent.click(screen.getByText('README.md'))
    expect(useAssetBrowserStore.getState().selectedPath).toBe('README.md')
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `src/ui/panels/AssetTreePanel.module.css`**

```css
.wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 12px;
}
.empty {
  padding: var(--sp-3);
  color: var(--text-tertiary);
  font-size: var(--fs-chrome);
}
.tree {
  flex: 1;
  overflow: auto;
  padding: var(--sp-1) 0;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 2px var(--sp-2);
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: var(--r-sm);
  user-select: none;
}
.row:hover { background: var(--glass-2); color: var(--text-primary); }
.row[data-selected="true"] {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
.icon {
  width: 14px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 10px;
}
.row.dir .icon { color: var(--info); }
.row.file .icon { color: var(--text-tertiary); }
.size {
  margin-left: auto;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  font-size: 10px;
}
.children { /* indented via inline style per depth */ }
```

- [ ] **Step 4: Write `src/ui/panels/AssetTreePanel.tsx`**

```tsx
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
```

- [ ] **Step 5: Verify**

- `npm run test:run -- src/ui/panels/AssetTreePanel.test.tsx` PASS (5 tests)
- `npm run test:run` overall PASS
- `npm run typecheck` PASS
- `npm run lint` PASS

- [ ] **Step 6: Commit**

```
git add src/ui/panels/AssetTreePanel.tsx src/ui/panels/AssetTreePanel.module.css src/ui/panels/AssetTreePanel.test.tsx
git commit -m "ui: AssetTreePanel — lazy-loaded recursive file tree with sensible defaults"
```

---

### Task 4: Wire AssetTreePanel into BottomTabs

**Files:**
- Modify: `src/ui/panels/BottomTabs.tsx`

- [ ] **Step 1: Update BottomTabs to render AssetTreePanel when Assets is active**

Read it. The current pattern renders `<ConsolePanel />` when active is 'console'. Extend to render `<AssetTreePanel />` when active is 'assets'. Update the placeholder fallthrough so 'assets' is no longer in the placeholder string list.

Add import:

```ts
import { AssetTreePanel } from './AssetTreePanel'
```

Replace the content rendering with:

```tsx
const isConsole = active === 'console'
const isAssets = active === 'assets'
return (
  <>
    <div className={styles.tabs} role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={styles.tab}
          onClick={() => setActive(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
    <div className={`${styles.content} ${(isConsole || isAssets) ? styles['content-pass'] : ''}`}>
      {isConsole ? <ConsolePanel />
       : isAssets ? <AssetTreePanel />
       : <span>{placeholderFor(active)}</span>}
    </div>
  </>
)
```

Update placeholderFor:

```ts
function placeholderFor(tab: BottomTab): string {
  switch (tab) {
    case 'assets':   return ''
    case 'config':   return 'Config editor — coming in a later plan.'
    case 'ai':       return 'AI Studio — coming in a later plan.'
    case 'console':  return ''
    case 'settings': return 'Settings — coming in a later plan.'
  }
}
```

- [ ] **Step 2: Verify**

- `npm run test:run` PASS (no regressions in BottomTabs tests)
- `npm run typecheck` PASS
- `npm run lint` PASS

- [ ] **Step 3: Commit**

```
git add src/ui/panels/BottomTabs.tsx
git commit -m "tabs: render AssetTreePanel for Assets tab"
```

---

### Task 5: Smoke test

Controller drives Playwright:
1. Build bridge bundle
2. Start dev server
3. Open editor
4. Click Assets tab → see "No project open" hint (since File System Access API can't be triggered programmatically without a user gesture)
5. Optionally: use platform `__setPlatformForTests` to inject a mock folder via page.evaluate to verify the tree renders

Document results in `docs/superpowers/plans/2026-05-25-plan-6-smoke-test-results.md`.

For the smoke test, the most important verification is: Assets tab no longer shows the placeholder string, and instead shows the "No project open" empty state. Real file tree verification requires a real folder pick, which needs user gesture.

- [ ] **Step 1: Drive Playwright smoke**

- [ ] **Step 2: Write results doc**

- [ ] **Step 3: Commit**

---

### Task 6: Final checks + merge

- [ ] Lint, typecheck, tests, build all PASS
- [ ] Merge to main with finishing-a-development-branch

---

## Not in Plan 6

- File preview (image thumbs, spine animation playback) — later
- Search by name — easy follow-up
- Drag-from-tree-to-canvas — significant additional plan
- File watcher / auto-refresh — needs polling layer; later
- Asset categorization sidebar (Images / Audio / Spine sections) — could be Plan 6.5

## Self-review

- **Spec coverage:** §8.3 Asset Browser (was a placeholder).
- **Type consistency:** `DirEntry` used across FsAdapter, store, and panel.
- **No placeholders:** every step has code.
- **Scope:** 6 tasks, tight focus on "show me the files in the open project".
