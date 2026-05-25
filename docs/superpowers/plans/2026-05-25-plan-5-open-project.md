# Plan 5 — Open Project flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Wire the menu bar's "Open Project" action to the File System Access API. When the user picks a folder, the editor reads optional `jsbuildconfig.json` and `supports.json`, stores their parsed contents in `projectStore`, shows the project name in the menu bar, and populates a balance-type dropdown next to the URL field. Selecting a balance type updates `gameUrl` automatically using `3000 + devportoffset` + `?balanceType=<name>`.

**Architecture:** A new `src/project/projectConfig.ts` module owns the file-reading and parsing logic (decoupled from React). `projectStore` gains `projectName`, `balanceTypes`, `devPortOffset`, `selectedBalanceType` fields. `MenuBar` gets an "Open Project" button + project name display + balance-type selector. No new React libraries.

**Tech Stack:** Unchanged.

**Reference:** Spec §10 (storage), §8.4 (launcher). Plan 5 is the foundation step that later plans (Asset Browser, JSON write-back) build on.

**Out of scope:**
- Asset Browser (file tree view) — Plan 6
- JSON write-back to disk — Plan 7+
- Reading the full `configurationsList` chain to determine all loadable JSON files — Plan 8+
- Auto-detecting render API or capabilities from project config — later

---

## Conventions

- TDD for the pure config-reading module
- Smoke test for the UI flow uses a mock `FsAdapter` since real `showDirectoryPicker` needs a user gesture

---

### Task 1: projectConfig parser

A pure-ish module that takes an `FsAdapter` + `FolderHandle` and returns parsed config + balance type list.

**Files:**
- Create: `src/project/projectConfig.ts`
- Create: `src/project/projectConfig.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test, vi } from 'vitest'
import type { FolderHandle, FsAdapter } from '../types/platform'
import { readProjectConfig, deriveGameUrl } from './projectConfig'

function makeFs(files: Record<string, string>): FsAdapter {
  return {
    openFolder: vi.fn(),
    readFile: vi.fn(),
    readText: vi.fn(async (_h, p) => {
      if (p in files) return files[p]
      throw new Error('ENOENT')
    }),
    writeFile: vi.fn(),
    listDir: vi.fn(),
    watch: vi.fn(() => () => {}),
  }
}

const folder: FolderHandle = { name: 'big-bait', rootPath: 'big-bait', fsHandle: null }

describe('readProjectConfig', () => {
  test('returns null fields when no config files exist', async () => {
    const fs = makeFs({})
    const cfg = await readProjectConfig(fs, folder)
    expect(cfg.projectName).toBe('big-bait')   // falls back to folder name
    expect(cfg.devPortOffset).toBeNull()
    expect(cfg.balanceTypes).toEqual([])
    expect(cfg.spineVersion).toBeNull()
  })

  test('reads gamename + devportoffset + spineversion from client/jsbuildconfig.json', async () => {
    const fs = makeFs({
      'client/jsbuildconfig.json': JSON.stringify({
        gamename: 'BigBait',
        devportoffset: 100,
        spineversion: '4.2.37',
      }),
    })
    const cfg = await readProjectConfig(fs, folder)
    expect(cfg.projectName).toBe('BigBait')
    expect(cfg.devPortOffset).toBe(100)
    expect(cfg.spineVersion).toBe('4.2.37')
  })

  test('reads balance types from supports.json', async () => {
    const fs = makeFs({
      'supports.json': JSON.stringify({
        gameName: 'BigBait',
        balanceTypes: { rhodium: {}, natrium: {}, magnesium: {} },
      }),
    })
    const cfg = await readProjectConfig(fs, folder)
    expect(cfg.balanceTypes).toEqual(['rhodium', 'natrium', 'magnesium'])
  })

  test('merges jsbuildconfig + supports.json into one project config', async () => {
    const fs = makeFs({
      'client/jsbuildconfig.json': JSON.stringify({ gamename: 'BigBait', devportoffset: 100 }),
      'supports.json': JSON.stringify({ balanceTypes: { rhodium: {} } }),
    })
    const cfg = await readProjectConfig(fs, folder)
    expect(cfg.projectName).toBe('BigBait')
    expect(cfg.devPortOffset).toBe(100)
    expect(cfg.balanceTypes).toEqual(['rhodium'])
  })

  test('tolerates malformed JSON without throwing', async () => {
    const fs = makeFs({
      'client/jsbuildconfig.json': '{ not valid json',
    })
    const cfg = await readProjectConfig(fs, folder)
    expect(cfg.projectName).toBe('big-bait')  // falls back to folder name
    expect(cfg.devPortOffset).toBeNull()
  })
})

describe('deriveGameUrl', () => {
  test('returns null when devPortOffset is null', () => {
    expect(deriveGameUrl({ devPortOffset: null, balanceType: 'rhodium' })).toBeNull()
  })

  test('returns null when no balance type selected', () => {
    expect(deriveGameUrl({ devPortOffset: 100, balanceType: null })).toBeNull()
  })

  test('assembles URL from port + balance type', () => {
    expect(deriveGameUrl({ devPortOffset: 100, balanceType: 'rhodium' }))
      .toBe('http://localhost:3100/?balanceType=rhodium')
    expect(deriveGameUrl({ devPortOffset: 4, balanceType: 'argon' }))
      .toBe('http://localhost:3004/?balanceType=argon')
  })

  test('honors a custom host', () => {
    expect(deriveGameUrl({ devPortOffset: 100, balanceType: 'rhodium', host: '127.0.0.1' }))
      .toBe('http://127.0.0.1:3100/?balanceType=rhodium')
  })
})
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Write `src/project/projectConfig.ts`**

```ts
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
        return null  // malformed JSON — treat as missing
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
```

- [ ] **Step 4: Tests pass + lint + typecheck**

- [ ] **Step 5: Commit**

```
git add src/project/projectConfig.ts src/project/projectConfig.test.ts
git commit -m "project: read jsbuildconfig + supports.json and derive game URL"
```

Co-Authored-By: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

### Task 2: Extend projectStore

**Files:**
- Modify: `src/stores/projectStore.ts`
- Modify: `src/stores/projectStore.test.ts`

- [ ] **Step 1: Append tests to projectStore.test.ts**

```ts
test('loadProjectConfig stores parsed config', () => {
  useProjectStore.getState().loadProjectConfig({
    projectName: 'BigBait',
    devPortOffset: 100,
    spineVersion: '4.2.37',
    balanceTypes: ['rhodium', 'natrium'],
  })
  const s = useProjectStore.getState()
  expect(s.projectName).toBe('BigBait')
  expect(s.devPortOffset).toBe(100)
  expect(s.balanceTypes).toEqual(['rhodium', 'natrium'])
  expect(s.selectedBalanceType).toBe('rhodium')  // auto-selects first
})

test('selectBalanceType picks one of the available types', () => {
  useProjectStore.getState().loadProjectConfig({
    projectName: 'X', devPortOffset: 100, spineVersion: null, balanceTypes: ['rhodium', 'natrium'],
  })
  useProjectStore.getState().selectBalanceType('natrium')
  expect(useProjectStore.getState().selectedBalanceType).toBe('natrium')
})

test('close() resets project config fields', () => {
  useProjectStore.getState().loadProjectConfig({
    projectName: 'X', devPortOffset: 100, spineVersion: null, balanceTypes: ['rhodium'],
  })
  useProjectStore.getState().close()
  const s = useProjectStore.getState()
  expect(s.projectName).toBeNull()
  expect(s.devPortOffset).toBeNull()
  expect(s.balanceTypes).toEqual([])
  expect(s.selectedBalanceType).toBeNull()
})
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Update `src/stores/projectStore.ts`**

Read it. Add the new state and methods:

```ts
import { create } from 'zustand'
import type { FolderHandle } from '../types/platform'
import type { ProjectConfig } from '../project/projectConfig'

type State = {
  folder: FolderHandle | null
  gameUrl: string
  isOpen: boolean
  projectName: string | null
  devPortOffset: number | null
  spineVersion: string | null
  balanceTypes: readonly string[]
  selectedBalanceType: string | null
  setFolder: (folder: FolderHandle) => void
  setGameUrl: (url: string) => void
  loadProjectConfig: (cfg: ProjectConfig) => void
  selectBalanceType: (name: string) => void
  close: () => void
}

const DEFAULT_GAME_URL = '/test-game/index.html'

export const useProjectStore = create<State>((set) => ({
  folder: null,
  gameUrl: DEFAULT_GAME_URL,
  isOpen: false,
  projectName: null,
  devPortOffset: null,
  spineVersion: null,
  balanceTypes: [],
  selectedBalanceType: null,
  setFolder: (folder) => set({ folder, isOpen: true }),
  setGameUrl: (gameUrl) => set({ gameUrl }),
  loadProjectConfig: (cfg) => set({
    projectName: cfg.projectName,
    devPortOffset: cfg.devPortOffset,
    spineVersion: cfg.spineVersion,
    balanceTypes: cfg.balanceTypes,
    selectedBalanceType: cfg.balanceTypes.length > 0 ? cfg.balanceTypes[0] : null,
  }),
  selectBalanceType: (selectedBalanceType) => set({ selectedBalanceType }),
  close: () => set({
    folder: null,
    isOpen: false,
    projectName: null,
    devPortOffset: null,
    spineVersion: null,
    balanceTypes: [],
    selectedBalanceType: null,
  }),
}))
```

- [ ] **Step 4: Tests pass + lint + typecheck**

- [ ] **Step 5: Commit**

```
git add src/stores/projectStore.ts src/stores/projectStore.test.ts
git commit -m "stores: projectStore tracks project config + selected balance type"
```

---

### Task 3: Open Project action

Wire the "Open Project" flow: a menu-bar button calls `platform.fs.openFolder()`, then `readProjectConfig(...)`, then dispatches `setFolder` + `loadProjectConfig`. URL auto-updates from `deriveGameUrl`.

**Files:**
- Create: `src/project/openProject.ts`
- Create: `src/project/openProject.test.ts`

The `openProject` function takes a platform + projectStore-like dispatch and orchestrates the work.

- [ ] **Step 1: Write failing test `src/project/openProject.test.ts`**

```ts
import { describe, expect, test, vi } from 'vitest'
import type { FolderHandle, PlatformAdapter } from '../types/platform'
import { useProjectStore } from '../stores/projectStore'
import { openProject } from './openProject'

function mockPlatform(folder: FolderHandle | null, files: Record<string, string>): PlatformAdapter {
  return {
    kind: 'browser',
    fs: {
      openFolder: vi.fn(async () => folder),
      readFile: vi.fn(),
      readText: vi.fn(async (_h, p) => {
        if (p in files) return files[p]
        throw new Error('ENOENT')
      }),
      writeFile: vi.fn(),
      listDir: vi.fn(),
      watch: vi.fn(() => () => {}),
    },
    env: { get: () => undefined, has: () => false },
    shell: { openExternal: vi.fn() },
    dialog: { openFile: vi.fn(), saveFile: vi.fn() },
  }
}

describe('openProject', () => {
  test('returns false if user cancels picker', async () => {
    useProjectStore.getState().close()
    const platform = mockPlatform(null, {})
    const result = await openProject(platform)
    expect(result).toBe(false)
    expect(useProjectStore.getState().isOpen).toBe(false)
  })

  test('opens folder, reads config, populates store, updates gameUrl', async () => {
    useProjectStore.getState().close()
    const folder: FolderHandle = { name: 'big-bait', rootPath: 'big-bait', fsHandle: null }
    const platform = mockPlatform(folder, {
      'client/jsbuildconfig.json': JSON.stringify({ gamename: 'BigBait', devportoffset: 100 }),
      'supports.json': JSON.stringify({ balanceTypes: { rhodium: {}, natrium: {} } }),
    })
    const result = await openProject(platform)
    expect(result).toBe(true)
    const s = useProjectStore.getState()
    expect(s.isOpen).toBe(true)
    expect(s.projectName).toBe('BigBait')
    expect(s.balanceTypes).toEqual(['rhodium', 'natrium'])
    expect(s.selectedBalanceType).toBe('rhodium')
    expect(s.gameUrl).toBe('http://localhost:3100/?balanceType=rhodium')
  })

  test('leaves gameUrl unchanged when project has no balance types or port offset', async () => {
    useProjectStore.getState().close()
    useProjectStore.getState().setGameUrl('/custom-url')
    const folder: FolderHandle = { name: 'plain', rootPath: 'plain', fsHandle: null }
    const platform = mockPlatform(folder, {})
    await openProject(platform)
    expect(useProjectStore.getState().gameUrl).toBe('/custom-url')
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `src/project/openProject.ts`**

```ts
import type { PlatformAdapter } from '../types/platform'
import { useProjectStore } from '../stores/projectStore'
import { deriveGameUrl, readProjectConfig } from './projectConfig'

export async function openProject(platform: PlatformAdapter): Promise<boolean> {
  const folder = await platform.fs.openFolder()
  if (folder === null) return false
  const cfg = await readProjectConfig(platform.fs, folder)
  const store = useProjectStore.getState()
  store.setFolder(folder)
  store.loadProjectConfig(cfg)
  const url = deriveGameUrl({
    devPortOffset: cfg.devPortOffset,
    balanceType: cfg.balanceTypes.length > 0 ? cfg.balanceTypes[0] : null,
  })
  if (url !== null) store.setGameUrl(url)
  return true
}
```

- [ ] **Step 4: Tests pass + lint + typecheck**

- [ ] **Step 5: Commit**

```
git add src/project/openProject.ts src/project/openProject.test.ts
git commit -m "project: openProject orchestrates folder pick + config load + URL"
```

---

### Task 4: MenuBar shows project + balance dropdown + Open button

**Files:**
- Modify: `src/ui/MenuBar.tsx`
- Modify: `src/ui/MenuBar.module.css`
- Modify: `src/ui/MenuBar.test.tsx`

The new layout: `◈ project-name (or game-tool) | (existing brand color) | Open Project button | balance type dropdown (if any) | Game URL input`

- [ ] **Step 1: Update `MenuBar.tsx`** (full rewrite for clarity)

```tsx
import styles from './MenuBar.module.css'
import { useProjectStore } from '../stores/projectStore'
import { openProject } from '../project/openProject'
import { deriveGameUrl } from '../project/projectConfig'
import { getPlatform } from '../platform'

export function MenuBar() {
  const projectName = useProjectStore((s) => s.projectName)
  const balanceTypes = useProjectStore((s) => s.balanceTypes)
  const selectedBalanceType = useProjectStore((s) => s.selectedBalanceType)
  const devPortOffset = useProjectStore((s) => s.devPortOffset)
  const gameUrl = useProjectStore((s) => s.gameUrl)
  const setGameUrl = useProjectStore((s) => s.setGameUrl)
  const selectBalanceType = useProjectStore((s) => s.selectBalanceType)

  async function handleOpen() {
    await openProject(getPlatform())
  }

  function handleBalanceChange(name: string) {
    selectBalanceType(name)
    const url = deriveGameUrl({ devPortOffset, balanceType: name })
    if (url !== null) setGameUrl(url)
  }

  return (
    <div className={styles.bar}>
      <span className={styles.brand}>◈ {projectName ?? 'game-tool'}</span>
      <button type="button" className={styles['open-btn']} onClick={handleOpen}>
        Open Project
      </button>
      {balanceTypes.length > 0 && (
        <select
          aria-label="Balance type"
          value={selectedBalanceType ?? ''}
          onChange={(e) => handleBalanceChange(e.target.value)}
          className={styles.select}
        >
          {balanceTypes.map((bt) => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
      )}
      <span className={styles.spacer} />
      <span style={{ color: 'var(--text-tertiary)' }}>Game URL</span>
      <input
        className={styles['url-field']}
        value={gameUrl}
        onChange={(e) => setGameUrl(e.target.value)}
        aria-label="Game URL"
      />
    </div>
  )
}
```

- [ ] **Step 2: Update `MenuBar.module.css`** — append:

```css
.open-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 2px var(--sp-2);
  font-size: var(--fs-chrome);
  color: var(--text-secondary);
  cursor: pointer;
}
.open-btn:hover { background: var(--glass-2); color: var(--text-primary); }
.select {
  background: var(--glass-input);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 2px var(--sp-2);
  font-size: var(--fs-chrome);
  color: var(--text-primary);
  font-family: var(--font-mono);
}
```

- [ ] **Step 3: Update `MenuBar.test.tsx`**

Read it. The existing two tests cover URL field render + edit. Add new tests for the project flow. Add this beforeEach to reset store between tests if not already:

```tsx
beforeEach(() => {
  useProjectStore.getState().close()
  useProjectStore.getState().setGameUrl('/test-game/index.html')
})
```

Then new tests:

```tsx
test('shows fallback brand when no project open', () => {
  render(<MenuBar />)
  expect(screen.getByText(/game-tool/i)).toBeInTheDocument()
})

test('shows project name when one is open', () => {
  useProjectStore.getState().loadProjectConfig({
    projectName: 'BigBait', devPortOffset: 100, spineVersion: null, balanceTypes: ['rhodium'],
  })
  render(<MenuBar />)
  expect(screen.getByText(/BigBait/)).toBeInTheDocument()
})

test('renders balance type dropdown when balance types exist', () => {
  useProjectStore.getState().loadProjectConfig({
    projectName: 'X', devPortOffset: 100, spineVersion: null, balanceTypes: ['rhodium', 'natrium'],
  })
  render(<MenuBar />)
  expect(screen.getByLabelText('Balance type')).toBeInTheDocument()
})

test('changing balance type updates gameUrl', () => {
  useProjectStore.getState().loadProjectConfig({
    projectName: 'X', devPortOffset: 100, spineVersion: null, balanceTypes: ['rhodium', 'natrium'],
  })
  render(<MenuBar />)
  const select = screen.getByLabelText('Balance type') as HTMLSelectElement
  fireEvent.change(select, { target: { value: 'natrium' } })
  expect(useProjectStore.getState().selectedBalanceType).toBe('natrium')
  expect(useProjectStore.getState().gameUrl).toBe('http://localhost:3100/?balanceType=natrium')
})
```

- [ ] **Step 4: Verify**

- `npm run test:run -- src/ui/MenuBar.test.tsx` — 6 tests pass (2 existing + 4 new)
- `npm run test:run` overall PASS
- `npm run typecheck` PASS
- `npm run lint` PASS

- [ ] **Step 5: Commit**

```
git add src/ui/MenuBar.tsx src/ui/MenuBar.module.css src/ui/MenuBar.test.tsx
git commit -m "ui: MenuBar with Open Project button + balance type selector"
```

---

### Task 5: Final checks + merge

- [ ] `npm run lint` PASS
- [ ] `npm run typecheck` PASS
- [ ] `npm run test:run` PASS
- [ ] `npm run build` PASS
- [ ] Merge to main with finishing-a-development-branch

---

## Not in Plan 5

- Asset Browser (file tree of project) → Plan 6
- JSON write-back → Plan 7
- Reading `configurationsList` to enumerate config JSONs → later
- Remembering last-opened project across sessions → later
- Drag-to-drop folder → later

## Self-review

- **Spec coverage:** §8.4 launcher (auto-derived from jsbuildconfig + supports), §10.1 project shape recognition.
- **Type consistency:** ProjectConfig used across module + store.
- **No placeholders:** every step has code.
- **Scope:** 5 tasks, tight focus on the foundational "I opened a project, the editor knows about it" experience.
