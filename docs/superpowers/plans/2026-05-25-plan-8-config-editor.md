# Plan 8 — Config Editor (with disk write-back)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Click any `.json` file in the Asset Browser → it opens in the Config tab → user edits in a textarea → click Save → the file is written back to disk via the FsAdapter. JSON parsing validation prevents saving invalid syntax.

**Architecture:** A new `configEditorStore` holds the currently-loaded file's content + dirty state + parse-error state. The `ConfigEditorPanel` reads from `useAssetBrowserStore.selectedPath` — when that points to a `.json` file, the panel loads its content via `getPlatform().fs.readText` and displays it. Edits update local draft state; Save writes the draft back via `fs.writeFile`. Auto-switching to the Config tab on JSON click is wired through `editorStore.setActiveBottomTab`. **This task ships the disk write-back path** (`fs.writeFile`) — the same path that Plan 9 will later use for Spine JSON.

**Tech Stack:** Unchanged. No Monaco (too heavy for now); plain textarea with monospace font + line numbers via CSS counter.

**Reference:** Spec §10.2 (what the editor writes to disk). This is the first real disk-write feature.

**Out of scope:**
- Syntax highlighting (would need a code editor library; later)
- Schema-aware editing (different UI per known config type) — later, after we learn the editing patterns
- Undo/redo — later
- Save-on-blur or autosave — explicit Save button only for now
- Detecting external file changes (file watcher) — later

---

### Task 1: configEditorStore

**Files:**
- Create: `src/stores/configEditorStore.ts`
- Create: `src/stores/configEditorStore.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test, beforeEach } from 'vitest'
import { useConfigEditorStore } from './configEditorStore'

describe('configEditorStore', () => {
  beforeEach(() => { useConfigEditorStore.getState().reset() })

  test('initial state has nothing loaded', () => {
    const s = useConfigEditorStore.getState()
    expect(s.path).toBeNull()
    expect(s.draft).toBe('')
    expect(s.original).toBe('')
    expect(s.isDirty).toBe(false)
    expect(s.parseError).toBeNull()
  })

  test('loadFile stores path + content + clears dirty', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    const s = useConfigEditorStore.getState()
    expect(s.path).toBe('configs/foo.json')
    expect(s.draft).toBe('{"a":1}')
    expect(s.original).toBe('{"a":1}')
    expect(s.isDirty).toBe(false)
  })

  test('setDraft marks dirty when content changes', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{"a":2}')
    const s = useConfigEditorStore.getState()
    expect(s.draft).toBe('{"a":2}')
    expect(s.isDirty).toBe(true)
  })

  test('setDraft back to original clears dirty', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{"a":2}')
    useConfigEditorStore.getState().setDraft('{"a":1}')
    expect(useConfigEditorStore.getState().isDirty).toBe(false)
  })

  test('validate sets parseError when JSON is malformed', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{not valid')
    useConfigEditorStore.getState().validate()
    expect(useConfigEditorStore.getState().parseError).toContain('Unexpected')
  })

  test('validate clears parseError when JSON is valid', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{not valid')
    useConfigEditorStore.getState().validate()
    expect(useConfigEditorStore.getState().parseError).not.toBeNull()
    useConfigEditorStore.getState().setDraft('{"a":2}')
    useConfigEditorStore.getState().validate()
    expect(useConfigEditorStore.getState().parseError).toBeNull()
  })

  test('markSaved snapshots draft as new original and clears dirty', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{"a":2}')
    useConfigEditorStore.getState().markSaved()
    const s = useConfigEditorStore.getState()
    expect(s.original).toBe('{"a":2}')
    expect(s.isDirty).toBe(false)
  })

  test('reset clears everything', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{"a":2}')
    useConfigEditorStore.getState().reset()
    expect(useConfigEditorStore.getState().path).toBeNull()
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `src/stores/configEditorStore.ts`**

```ts
import { create } from 'zustand'

type State = {
  path: string | null
  original: string
  draft: string
  isDirty: boolean
  parseError: string | null
  loadFile: (path: string, content: string) => void
  setDraft: (content: string) => void
  validate: () => void
  markSaved: () => void
  reset: () => void
}

export const useConfigEditorStore = create<State>((set, get) => ({
  path: null,
  original: '',
  draft: '',
  isDirty: false,
  parseError: null,
  loadFile: (path, content) => set({ path, original: content, draft: content, isDirty: false, parseError: null }),
  setDraft: (draft) => {
    const original = get().original
    set({ draft, isDirty: draft !== original })
  },
  validate: () => {
    const draft = get().draft
    try {
      JSON.parse(draft)
      set({ parseError: null })
    } catch (e) {
      set({ parseError: e instanceof Error ? e.message : String(e) })
    }
  },
  markSaved: () => set({ original: get().draft, isDirty: false, parseError: null }),
  reset: () => set({ path: null, original: '', draft: '', isDirty: false, parseError: null }),
}))
```

- [ ] **Step 4: Verify**

- 8 tests pass
- typecheck + lint clean

- [ ] **Step 5: Commit**

```
git add src/stores/configEditorStore.ts src/stores/configEditorStore.test.ts
git commit -m "stores: configEditorStore tracks loaded file + draft + dirty + parse error"
```

Co-Authored-By: `Co-Authored-By: Claude <noreply@anthropic.com>`

---

### Task 2: ConfigEditorPanel component

Reads from `assetBrowserStore.selectedPath`. When that's a `.json` file, loads its content via `fs.readText`. Renders a textarea bound to `configEditorStore.draft`. Has a Save button that calls `fs.writeFile`.

**Files:**
- Create: `src/ui/panels/ConfigEditorPanel.tsx`
- Create: `src/ui/panels/ConfigEditorPanel.module.css`
- Create: `src/ui/panels/ConfigEditorPanel.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, test, beforeEach, vi } from 'vitest'
import type { PlatformAdapter, FolderHandle } from '../../types/platform'
import { useProjectStore } from '../../stores/projectStore'
import { useAssetBrowserStore } from '../../stores/assetBrowserStore'
import { useConfigEditorStore } from '../../stores/configEditorStore'
import { __setPlatformForTests } from '../../platform'
import { ConfigEditorPanel } from './ConfigEditorPanel'

const folder: FolderHandle = { name: 'demo', rootPath: 'demo', fsHandle: null }

function mockPlatform(opts: { read?: Record<string, string>; writes?: { path: string; data: Uint8Array }[] }): PlatformAdapter {
  const read = opts.read ?? {}
  const writes = opts.writes ?? []
  return {
    kind: 'browser',
    fs: {
      openFolder: vi.fn(),
      readFile: vi.fn(),
      readText: vi.fn(async (_h, p) => {
        if (p in read) return read[p]
        throw new Error('ENOENT')
      }),
      writeFile: vi.fn(async (_h, p, d) => { writes.push({ path: p, data: d }) }),
      listDir: vi.fn(async () => []),
      watch: vi.fn(() => () => {}),
    },
    env: { get: () => undefined, has: () => false },
    shell: { openExternal: vi.fn() },
    dialog: { openFile: vi.fn(), saveFile: vi.fn() },
  }
}

describe('ConfigEditorPanel', () => {
  beforeEach(() => {
    useProjectStore.getState().close()
    useAssetBrowserStore.getState().reset()
    useConfigEditorStore.getState().reset()
    __setPlatformForTests(null)
  })

  test('shows empty hint when no project / no selection', () => {
    render(<ConfigEditorPanel />)
    expect(screen.getByText(/select a json file/i)).toBeInTheDocument()
  })

  test('shows non-json hint when selected file is not .json', async () => {
    useProjectStore.getState().setFolder(folder)
    useAssetBrowserStore.getState().select('README.md')
    render(<ConfigEditorPanel />)
    expect(screen.getByText(/json file/i)).toBeInTheDocument()
  })

  test('loads the JSON content into the textarea', async () => {
    __setPlatformForTests(mockPlatform({ read: { 'configs/foo.json': '{"a":1}' } }))
    useProjectStore.getState().setFolder(folder)
    useAssetBrowserStore.getState().select('configs/foo.json')
    render(<ConfigEditorPanel />)
    const textarea = await waitFor(() => screen.getByRole('textbox') as HTMLTextAreaElement)
    expect(textarea.value).toBe('{"a":1}')
  })

  test('editing the textarea marks the panel dirty', async () => {
    __setPlatformForTests(mockPlatform({ read: { 'configs/foo.json': '{"a":1}' } }))
    useProjectStore.getState().setFolder(folder)
    useAssetBrowserStore.getState().select('configs/foo.json')
    render(<ConfigEditorPanel />)
    const textarea = await waitFor(() => screen.getByRole('textbox') as HTMLTextAreaElement)
    fireEvent.change(textarea, { target: { value: '{"a":2}' } })
    expect(useConfigEditorStore.getState().isDirty).toBe(true)
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled()
  })

  test('Save writes file via fs.writeFile and clears dirty', async () => {
    const writes: { path: string; data: Uint8Array }[] = []
    __setPlatformForTests(mockPlatform({ read: { 'configs/foo.json': '{"a":1}' }, writes }))
    useProjectStore.getState().setFolder(folder)
    useAssetBrowserStore.getState().select('configs/foo.json')
    render(<ConfigEditorPanel />)
    const textarea = await waitFor(() => screen.getByRole('textbox') as HTMLTextAreaElement)
    fireEvent.change(textarea, { target: { value: '{"a":2}' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(writes).toHaveLength(1)
      expect(writes[0].path).toBe('configs/foo.json')
      expect(new TextDecoder().decode(writes[0].data)).toBe('{"a":2}')
    })
    expect(useConfigEditorStore.getState().isDirty).toBe(false)
  })

  test('shows a parse-error indicator for invalid JSON', async () => {
    __setPlatformForTests(mockPlatform({ read: { 'configs/foo.json': '{"a":1}' } }))
    useProjectStore.getState().setFolder(folder)
    useAssetBrowserStore.getState().select('configs/foo.json')
    render(<ConfigEditorPanel />)
    const textarea = await waitFor(() => screen.getByRole('textbox') as HTMLTextAreaElement)
    fireEvent.change(textarea, { target: { value: '{not valid' } })
    expect(await screen.findByText(/parse error/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `src/ui/panels/ConfigEditorPanel.module.css`**

```css
.wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-1) var(--sp-3);
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-chrome);
  color: var(--text-secondary);
}
.path { font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); }
.dirty { color: var(--warning); }
.error { color: var(--error); font-family: var(--font-mono); font-size: 10px; }
.spacer { flex: 1; }
.save {
  background: var(--accent-soft);
  border: 1px solid rgba(167, 139, 250, 0.30);
  border-radius: var(--r-sm);
  padding: 2px var(--sp-3);
  font-size: var(--fs-chrome);
  color: var(--accent);
  cursor: pointer;
}
.save:disabled { opacity: 0.4; cursor: not-allowed; }
.save:not(:disabled):hover { background: rgba(167, 139, 250, 0.30); }
.empty { padding: var(--sp-3); color: var(--text-tertiary); font-size: var(--fs-chrome); }
.textarea {
  flex: 1;
  width: 100%;
  background: var(--glass-input);
  border: 0;
  border-top: 1px solid var(--border);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: var(--sp-2);
  resize: none;
  outline: none;
  line-height: 1.5;
  tab-size: 2;
}
```

- [ ] **Step 4: Write `src/ui/panels/ConfigEditorPanel.tsx`**

```tsx
import { useEffect } from 'react'
import styles from './ConfigEditorPanel.module.css'
import { useProjectStore } from '../../stores/projectStore'
import { useAssetBrowserStore } from '../../stores/assetBrowserStore'
import { useConfigEditorStore } from '../../stores/configEditorStore'
import { getPlatform } from '../../platform'

function isJsonPath(path: string | null): boolean {
  return path !== null && path.toLowerCase().endsWith('.json')
}

export function ConfigEditorPanel() {
  const folder = useProjectStore((s) => s.folder)
  const selectedPath = useAssetBrowserStore((s) => s.selectedPath)
  const loadedPath = useConfigEditorStore((s) => s.path)
  const draft = useConfigEditorStore((s) => s.draft)
  const isDirty = useConfigEditorStore((s) => s.isDirty)
  const parseError = useConfigEditorStore((s) => s.parseError)
  const loadFile = useConfigEditorStore((s) => s.loadFile)
  const setDraft = useConfigEditorStore((s) => s.setDraft)
  const validate = useConfigEditorStore((s) => s.validate)
  const markSaved = useConfigEditorStore((s) => s.markSaved)

  const shouldLoad = folder !== null && isJsonPath(selectedPath) && selectedPath !== loadedPath

  useEffect(() => {
    if (!shouldLoad || folder === null || selectedPath === null) return
    let cancelled = false
    void (async () => {
      try {
        const text = await getPlatform().fs.readText(folder, selectedPath)
        if (!cancelled) loadFile(selectedPath, text)
      } catch (e) {
        if (!cancelled) loadFile(selectedPath, `// Failed to load: ${String(e)}\n`)
      }
    })()
    return () => { cancelled = true }
  }, [shouldLoad, folder, selectedPath, loadFile])

  if (folder === null || selectedPath === null) {
    return <div className={styles.wrap}><div className={styles.empty}>Select a JSON file in the Asset Browser to edit it.</div></div>
  }
  if (!isJsonPath(selectedPath)) {
    return <div className={styles.wrap}><div className={styles.empty}>Selected file is not a JSON file.</div></div>
  }

  async function handleSave(): Promise<void> {
    if (folder === null || loadedPath === null) return
    if (parseError !== null) return
    try {
      const data = new TextEncoder().encode(draft)
      await getPlatform().fs.writeFile(folder, loadedPath, data)
      markSaved()
    } catch (e) {
      // Surface write errors via parse-error channel for now.
      useConfigEditorStore.setState({ parseError: `Write failed: ${String(e)}` })
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setDraft(e.target.value)
    validate()
  }

  const canSave = isDirty && parseError === null

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.path}>{loadedPath ?? selectedPath}</span>
        {isDirty && <span className={styles.dirty}>● modified</span>}
        {parseError !== null && <span className={styles.error}>parse error: {parseError}</span>}
        <span className={styles.spacer} />
        <button type="button" className={styles.save} onClick={handleSave} disabled={!canSave}>Save</button>
      </div>
      <textarea
        className={styles.textarea}
        spellCheck={false}
        value={draft}
        onChange={handleChange}
      />
    </div>
  )
}
```

- [ ] **Step 5: Verify**

- 6 tests pass
- no regressions
- typecheck + lint clean

- [ ] **Step 6: Commit**

```
git add src/ui/panels/ConfigEditorPanel.tsx src/ui/panels/ConfigEditorPanel.module.css src/ui/panels/ConfigEditorPanel.test.tsx
git commit -m "ui: ConfigEditorPanel — load + edit + save .json files from project"
```

Co-Authored-By: `Co-Authored-By: Claude <noreply@anthropic.com>`

---

### Task 3: Auto-switch to Config tab when a JSON file is selected

When the user clicks a `.json` file in the Asset Browser, also set the active bottom tab to `'config'` so they see the edit panel immediately.

**Files:**
- Modify: `src/ui/panels/AssetTreePanel.tsx`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: In `FileNode`, when the file is a .json, also call `setActiveBottomTab('config')` alongside `select(entry.path)`**

Replace the `FileNode` onClick:

```tsx
function FileNode({ entry, depth }: { entry: DirEntry; depth: number }) {
  const selectedPath = useAssetBrowserStore((s) => s.selectedPath)
  const select = useAssetBrowserStore((s) => s.select)
  const setActiveBottomTab = useEditorStore((s) => s.setActiveBottomTab)

  function handleClick() {
    select(entry.path)
    if (entry.name.toLowerCase().endsWith('.json')) {
      setActiveBottomTab('config')
    }
  }

  return (
    <div
      className={`${styles.row} ${styles.file}`}
      data-selected={selectedPath === entry.path}
      style={{ paddingLeft: 8 + depth * 14 + 14 }}
      onClick={handleClick}
    >
      <span className={styles.icon}>·</span>
      <span>{entry.name}</span>
      <span className={styles.size}>{formatSize(entry.size)}</span>
    </div>
  )
}
```

Add the import at the top:

```tsx
import { useEditorStore } from '../../stores/editorStore'
```

- [ ] **Step 3: Verify**

Existing AssetTreePanel tests should still pass. Run all tests.

- [ ] **Step 4: Commit**

```
git add src/ui/panels/AssetTreePanel.tsx
git commit -m "assets: clicking a .json file auto-switches to the Config tab"
```

---

### Task 4: Wire ConfigEditorPanel into BottomTabs

**Files:**
- Modify: `src/ui/panels/BottomTabs.tsx`

- [ ] **Step 1: Add import + extend the pass-through pattern**

```tsx
import { ConfigEditorPanel } from './ConfigEditorPanel'
```

Add `isConfig`:
```tsx
const isConfig   = active === 'config'
const passThrough = isConsole || isAssets || isSettings || isConfig
```

Update the conditional render to include config:

```tsx
{isConsole ? <ConsolePanel />
 : isAssets ? <AssetTreePanel />
 : isSettings ? <SettingsPanel />
 : isConfig ? <ConfigEditorPanel />
 : <span>{placeholderFor(active)}</span>}
```

Update `placeholderFor` to return empty string for 'config'.

- [ ] **Step 2: Verify**

- [ ] **Step 3: Commit**

```
git add src/ui/panels/BottomTabs.tsx
git commit -m "tabs: render ConfigEditorPanel for Config tab"
```

---

### Task 5: Final checks + merge

- [ ] Lint, typecheck, tests, build all PASS
- [ ] Merge to main

---

## Not in Plan 8

- Syntax highlighting (would need Monaco or similar; significant bundle weight) — later
- Schema-aware editing — later, after seeing what patterns emerge
- Undo/redo within the editor — later
- Autosave or save-on-blur — explicit Save button only
- File watcher to detect external changes — later
