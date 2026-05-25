# Plan 7 — Settings panel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Replace the Settings tab placeholder with a real panel that surfaces useful editor state — open project info, current platform kind (browser/electron/tauri), and the presence/absence of the AI provider API keys (`GOOGLE_GENAI_API_KEY`, `GOOGLE_VEO_API_KEY`, `GOOGLE_SEEDANCE_API_KEY`). Each key shows a green/red indicator so users know which AI features they have access to before Plan 8 builds them.

**Architecture:** Pure read-only panel. No new stores; reads from `projectStore` + `getPlatform().env`. The AI keys come from system environment variables (specified by the spec; never written to disk). In browser mode the env adapter returns empty by default — there's a future story for letting users paste keys into the editor for testing, but that's deferred.

**Tech Stack:** Unchanged.

**Reference:** Spec §9.1 (AI Studio configuration — keys from environment).

**Out of scope:**
- Letting users paste AI keys into the editor — deferred (security concern)
- Configurable grid size — could be added here as a follow-up
- Theme / accent customization — later

---

### Task 1: SettingsPanel component

**Files:**
- Create: `src/ui/panels/SettingsPanel.tsx`
- Create: `src/ui/panels/SettingsPanel.module.css`
- Create: `src/ui/panels/SettingsPanel.test.tsx`

The panel has three sections:
1. **Project** — name, folder path, balance types, spine version (or "No project open")
2. **Platform** — browser/electron/tauri kind
3. **AI providers** — each key with a green/red indicator + short description

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import type { PlatformAdapter } from '../../types/platform'
import { useProjectStore } from '../../stores/projectStore'
import { __setPlatformForTests } from '../../platform'
import { SettingsPanel } from './SettingsPanel'

function mockPlatform(env: Record<string, string>): PlatformAdapter {
  return {
    kind: 'browser',
    fs: { openFolder: async () => null, readFile: async () => new Uint8Array(), readText: async () => '', writeFile: async () => {}, listDir: async () => [], watch: () => () => {} },
    env: { get: (k) => env[k], has: (k) => Object.hasOwn(env, k) },
    shell: { openExternal: async () => {} },
    dialog: { openFile: async () => null, saveFile: async () => null },
  }
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    useProjectStore.getState().close()
    __setPlatformForTests(null)
  })

  test('shows "no project open" when no folder loaded', () => {
    render(<SettingsPanel />)
    expect(screen.getByText(/no project open/i)).toBeInTheDocument()
  })

  test('shows project info when a project is open', () => {
    useProjectStore.getState().setFolder({ name: 'big-bait', rootPath: 'big-bait', fsHandle: null })
    useProjectStore.getState().loadProjectConfig({
      projectName: 'BigBait',
      devPortOffset: 100,
      spineVersion: '4.2.37',
      balanceTypes: ['rhodium', 'natrium'],
    })
    render(<SettingsPanel />)
    expect(screen.getByText('BigBait')).toBeInTheDocument()
    expect(screen.getByText(/4\.2\.37/)).toBeInTheDocument()
    expect(screen.getByText(/rhodium/)).toBeInTheDocument()
    expect(screen.getByText(/natrium/)).toBeInTheDocument()
  })

  test('shows platform kind', () => {
    render(<SettingsPanel />)
    expect(screen.getByText(/browser/i)).toBeInTheDocument()
  })

  test('shows AI keys as missing when env is empty', () => {
    __setPlatformForTests(mockPlatform({}))
    render(<SettingsPanel />)
    const genaiRow = screen.getByText('GOOGLE_GENAI_API_KEY').closest('[data-key-row]')
    expect(genaiRow?.getAttribute('data-present')).toBe('false')
  })

  test('shows AI keys as present when env has them', () => {
    __setPlatformForTests(mockPlatform({ GOOGLE_GENAI_API_KEY: 'abc', GOOGLE_VEO_API_KEY: 'def' }))
    render(<SettingsPanel />)
    expect(screen.getByText('GOOGLE_GENAI_API_KEY').closest('[data-key-row]')?.getAttribute('data-present')).toBe('true')
    expect(screen.getByText('GOOGLE_VEO_API_KEY').closest('[data-key-row]')?.getAttribute('data-present')).toBe('true')
    expect(screen.getByText('GOOGLE_SEEDANCE_API_KEY').closest('[data-key-row]')?.getAttribute('data-present')).toBe('false')
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `src/ui/panels/SettingsPanel.module.css`**

```css
.wrap {
  padding: var(--sp-3);
  height: 100%;
  overflow: auto;
}
.section {
  margin-bottom: var(--sp-4);
}
.section-header {
  font-size: var(--fs-chrome);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: var(--sp-2);
}
.row {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: var(--sp-3);
  padding: 4px 0;
  font-size: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.label { color: var(--text-secondary); }
.value { color: var(--text-primary); font-family: var(--font-mono); font-size: 11px; word-break: break-all; }
.empty { color: var(--text-tertiary); font-style: italic; }
.key-row {
  display: grid;
  grid-template-columns: 16px 200px 1fr;
  gap: var(--sp-2);
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.key-row[data-present="true"] .dot { background: var(--success); }
.key-row[data-present="false"] .dot { background: var(--error); opacity: 0.5; }
.key-name { font-family: var(--font-mono); font-size: 11px; color: var(--text-primary); }
.key-desc { color: var(--text-tertiary); font-size: 11px; }
```

- [ ] **Step 4: Write `src/ui/panels/SettingsPanel.tsx`**

```tsx
import styles from './SettingsPanel.module.css'
import { useProjectStore } from '../../stores/projectStore'
import { getPlatform } from '../../platform'

type AiKey = { name: string; description: string }

const AI_KEYS: readonly AiKey[] = [
  { name: 'GOOGLE_GENAI_API_KEY',     description: 'Imagen 2 image generation' },
  { name: 'GOOGLE_VEO_API_KEY',       description: 'Veo 3 video generation' },
  { name: 'GOOGLE_SEEDANCE_API_KEY',  description: 'Seedance animation' },
]

export function SettingsPanel() {
  const folder = useProjectStore((s) => s.folder)
  const projectName = useProjectStore((s) => s.projectName)
  const balanceTypes = useProjectStore((s) => s.balanceTypes)
  const spineVersion = useProjectStore((s) => s.spineVersion)
  const devPortOffset = useProjectStore((s) => s.devPortOffset)
  const platform = getPlatform()

  return (
    <div className={styles.wrap}>
      <Section title="Project">
        {folder === null ? (
          <div className={styles.empty}>No project open. Use "Open Project" in the menu bar.</div>
        ) : (
          <>
            <Row label="Name">{projectName ?? folder.name}</Row>
            <Row label="Folder">{folder.rootPath}</Row>
            {spineVersion !== null && <Row label="Spine version">{spineVersion}</Row>}
            {devPortOffset !== null && <Row label="Dev port">{3000 + devPortOffset}</Row>}
            {balanceTypes.length > 0 && <Row label="Balance types">{balanceTypes.join(', ')}</Row>}
          </>
        )}
      </Section>

      <Section title="Platform">
        <Row label="Kind">{platform.kind}</Row>
      </Section>

      <Section title="AI providers">
        {AI_KEYS.map((k) => {
          const present = platform.env.has(k.name)
          return (
            <div key={k.name} data-key-row data-present={present} className={styles['key-row']}>
              <span className={styles.dot} />
              <span className={styles['key-name']}>{k.name}</span>
              <span className={styles['key-desc']}>{present ? k.description : `${k.description} — env var not set`}</span>
            </div>
          )
        })}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles['section-header']}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{children}</span>
    </div>
  )
}
```

- [ ] **Step 5: Verify tests + lint + typecheck**

- [ ] **Step 6: Commit**

```
git add src/ui/panels/SettingsPanel.tsx src/ui/panels/SettingsPanel.module.css src/ui/panels/SettingsPanel.test.tsx
git commit -m "ui: SettingsPanel — project info + platform + AI key presence"
```

Co-Authored-By: `Co-Authored-By: Claude <noreply@anthropic.com>`

---

### Task 2: Wire SettingsPanel into BottomTabs

**Files:**
- Modify: `src/ui/panels/BottomTabs.tsx`

- [ ] **Step 1: Read and update**

Add import:
```ts
import { SettingsPanel } from './SettingsPanel'
```

Extend the content area pattern to handle settings. Following the same pattern as Assets and Console:

```tsx
const isConsole  = active === 'console'
const isAssets   = active === 'assets'
const isSettings = active === 'settings'
const passThrough = isConsole || isAssets || isSettings
```

Then:
```tsx
<div className={`${styles.content} ${passThrough ? styles['content-pass'] : ''}`}>
  {isConsole ? <ConsolePanel />
   : isAssets ? <AssetTreePanel />
   : isSettings ? <SettingsPanel />
   : <span>{placeholderFor(active)}</span>}
</div>
```

Update `placeholderFor` to return empty string for `settings`.

- [ ] **Step 2: Verify**

- `npm run test:run` PASS
- `npm run typecheck` PASS
- `npm run lint` PASS

- [ ] **Step 3: Commit**

```
git add src/ui/panels/BottomTabs.tsx
git commit -m "tabs: render SettingsPanel for Settings tab"
```

---

### Task 3: Final checks + merge

- [ ] Lint, typecheck, tests, build all PASS
- [ ] Merge to main with finishing-a-development-branch

---

## Not in Plan 7

- Letting users paste keys into the editor (security: never persist) — deferred
- Configurable grid size for snap — easy follow-up
- Theme customization — later
- Bridge protocol version diagnostics — later
