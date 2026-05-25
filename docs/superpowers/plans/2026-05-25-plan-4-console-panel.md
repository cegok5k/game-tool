# Plan 4 — Console Panel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Turn the Console placeholder tab into a real log viewer that streams `LOG` messages from the bridge. Auto-scrolls to bottom on new entries, supports filtering by level (info/warn/error), and has a clear button.

**Architecture:** A new `consoleStore` holds a circular buffer of log entries. `CanvasPanel`'s existing message handler — currently dropping `LOG` messages with a "Plan 6" comment — routes them into the store. The `BottomTabs` Console placeholder is replaced with a real `ConsolePanel` component that subscribes to the store and renders entries. Cap the buffer at 1000 entries to bound memory.

**Tech Stack:** Unchanged.

**Reference:** `docs/superpowers/specs/2026-05-25-game-editor-design.md` — covers §8.3 Console panel (placeholder until now).

**Out of scope:**
- Search box for filtering by text — easy follow-up
- Persisting log history across page reloads — out of scope
- Clickable stack traces — out of scope

---

## Conventions

- TDD for pure logic (store), smoke tests for UI components
- Commit per task; run lint+typecheck+test before each commit

---

### Task 1: consoleStore

**Files:**
- Create: `src/stores/consoleStore.ts`
- Create: `src/stores/consoleStore.test.ts`

- [ ] **Step 1: Write failing test `src/stores/consoleStore.test.ts`**

```ts
import { describe, expect, test, beforeEach } from 'vitest'
import { useConsoleStore, MAX_ENTRIES } from './consoleStore'

describe('consoleStore', () => {
  beforeEach(() => { useConsoleStore.getState().clear() })

  test('initial state has no entries', () => {
    expect(useConsoleStore.getState().entries).toEqual([])
  })

  test('addEntry appends with a timestamp', () => {
    const before = Date.now()
    useConsoleStore.getState().addEntry({ level: 'info', message: 'hello' })
    const e = useConsoleStore.getState().entries[0]
    expect(e.level).toBe('info')
    expect(e.message).toBe('hello')
    expect(e.timestamp).toBeGreaterThanOrEqual(before)
  })

  test('addEntry preserves order across multiple adds', () => {
    const s = useConsoleStore.getState()
    s.addEntry({ level: 'info', message: 'a' })
    s.addEntry({ level: 'warn', message: 'b' })
    s.addEntry({ level: 'error', message: 'c' })
    expect(useConsoleStore.getState().entries.map((e) => e.message)).toEqual(['a', 'b', 'c'])
  })

  test('clear empties the buffer', () => {
    useConsoleStore.getState().addEntry({ level: 'info', message: 'a' })
    useConsoleStore.getState().clear()
    expect(useConsoleStore.getState().entries).toEqual([])
  })

  test('buffer is capped at MAX_ENTRIES (oldest dropped first)', () => {
    const s = useConsoleStore.getState()
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      s.addEntry({ level: 'info', message: `m${i}` })
    }
    const entries = useConsoleStore.getState().entries
    expect(entries).toHaveLength(MAX_ENTRIES)
    // Oldest 10 should be dropped, newest preserved
    expect(entries[0].message).toBe('m10')
    expect(entries[entries.length - 1].message).toBe(`m${MAX_ENTRIES + 9}`)
  })
})
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Write `src/stores/consoleStore.ts`**

```ts
import { create } from 'zustand'

export type LogLevel = 'info' | 'warn' | 'error'

export type LogEntry = {
  id: number
  level: LogLevel
  message: string
  timestamp: number
}

export const MAX_ENTRIES = 1000

type State = {
  entries: readonly LogEntry[]
  nextId: number
  addEntry: (entry: { level: LogLevel; message: string }) => void
  clear: () => void
}

export const useConsoleStore = create<State>((set, get) => ({
  entries: [],
  nextId: 1,
  addEntry: (entry) => {
    const { entries, nextId } = get()
    const next: LogEntry = {
      id: nextId,
      level: entry.level,
      message: entry.message,
      timestamp: Date.now(),
    }
    const combined = entries.length >= MAX_ENTRIES
      ? [...entries.slice(entries.length - MAX_ENTRIES + 1), next]
      : [...entries, next]
    set({ entries: combined, nextId: nextId + 1 })
  },
  clear: () => set({ entries: [], nextId: 1 }),
}))
```

- [ ] **Step 4: Tests pass + lint + typecheck**

- [ ] **Step 5: Commit**

```
git add src/stores/consoleStore.ts src/stores/consoleStore.test.ts
git commit -m "stores: consoleStore with capped log buffer"
```

Co-Authored-By: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

### Task 2: Route LOG messages into consoleStore

**Files:**
- Modify: `src/ui/panels/CanvasPanel.tsx`
- Modify: `src/ui/panels/CanvasPanel.test.tsx`

- [ ] **Step 1: Append test to `CanvasPanel.test.tsx`**

Add this test at the end of the describe block. Make sure `useConsoleStore` is imported:

```tsx
import { useConsoleStore } from '../../stores/consoleStore'

test('LOG messages from the bridge are appended to consoleStore', () => {
  useConsoleStore.getState().clear()
  render(<CanvasPanel />)
  window.dispatchEvent(new MessageEvent('message', {
    data: {
      __gameTool: 'bridge',
      v: 1,
      payload: { type: 'LOG', level: 'info', message: 'hello from game' },
    },
  }))
  const entries = useConsoleStore.getState().entries
  expect(entries).toHaveLength(1)
  expect(entries[0]).toMatchObject({ level: 'info', message: 'hello from game' })
})
```

- [ ] **Step 2: Run — should fail** (LOG is currently dropped)

- [ ] **Step 3: Update `src/ui/panels/CanvasPanel.tsx`**

Read it. At the top of the component, add the consoleStore selector:

```ts
const addLogEntry = useConsoleStore((s) => s.addEntry)
```

Add the import at the top:

```ts
import { useConsoleStore } from '../../stores/consoleStore'
```

In the message switch, replace the `case 'LOG':` (currently `// Plan 6: stream into Console panel`) with:

```ts
case 'LOG':
  addLogEntry({ level: msg.level, message: msg.message })
  return
```

Add `addLogEntry` to the useEffect deps array.

- [ ] **Step 4: Verify**

- `npm run test:run -- src/ui/panels/CanvasPanel.test.tsx` PASS
- `npm run test:run` PASS overall
- `npm run typecheck` PASS
- `npm run lint` PASS

- [ ] **Step 5: Commit**

```
git add src/ui/panels/CanvasPanel.tsx src/ui/panels/CanvasPanel.test.tsx
git commit -m "canvas: route bridge LOG messages into consoleStore"
```

Co-Authored-By: same trailer as before.

---

### Task 3: ConsolePanel component

**Files:**
- Create: `src/ui/panels/ConsolePanel.tsx`
- Create: `src/ui/panels/ConsolePanel.module.css`
- Create: `src/ui/panels/ConsolePanel.test.tsx`

- [ ] **Step 1: Write failing test `ConsolePanel.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import { useConsoleStore } from '../../stores/consoleStore'
import { ConsolePanel } from './ConsolePanel'

describe('ConsolePanel', () => {
  beforeEach(() => { useConsoleStore.getState().clear() })

  test('renders empty hint when no entries', () => {
    render(<ConsolePanel />)
    expect(screen.getByText(/no logs yet/i)).toBeInTheDocument()
  })

  test('renders log entries with level + message', () => {
    useConsoleStore.getState().addEntry({ level: 'info', message: 'hello' })
    useConsoleStore.getState().addEntry({ level: 'warn', message: 'careful' })
    useConsoleStore.getState().addEntry({ level: 'error', message: 'boom' })
    render(<ConsolePanel />)
    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByText('careful')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  test('Clear button empties the store', () => {
    useConsoleStore.getState().addEntry({ level: 'info', message: 'm' })
    render(<ConsolePanel />)
    expect(screen.getByText('m')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(useConsoleStore.getState().entries).toEqual([])
  })

  test('level filter toggles hide info entries when info is off', () => {
    useConsoleStore.getState().addEntry({ level: 'info', message: 'i1' })
    useConsoleStore.getState().addEntry({ level: 'warn', message: 'w1' })
    render(<ConsolePanel />)
    // Both visible by default
    expect(screen.getByText('i1')).toBeInTheDocument()
    expect(screen.getByText('w1')).toBeInTheDocument()
    // Toggle info off
    fireEvent.click(screen.getByRole('button', { name: /info/i }))
    expect(screen.queryByText('i1')).not.toBeInTheDocument()
    expect(screen.getByText('w1')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Write `ConsolePanel.module.css`**

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
  color: var(--text-tertiary);
}
.spacer { flex: 1; }
.filter {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  padding: 2px var(--sp-2);
  font-size: var(--fs-chrome);
  color: var(--text-tertiary);
  cursor: pointer;
}
.filter[aria-pressed="true"] {
  background: var(--glass-3);
  color: var(--text-primary);
  border-color: var(--border);
}
.filter.info[aria-pressed="true"]  { color: var(--info); border-color: rgba(96, 165, 250, 0.30); }
.filter.warn[aria-pressed="true"]  { color: var(--warning); border-color: rgba(251, 191, 36, 0.30); }
.filter.error[aria-pressed="true"] { color: var(--error); border-color: rgba(248, 113, 113, 0.30); }
.clear {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 2px var(--sp-3);
  font-size: var(--fs-chrome);
  color: var(--text-secondary);
  cursor: pointer;
}
.clear:hover { background: var(--glass-2); }

.list {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-1) 0;
  font-family: var(--font-mono);
  font-size: 11px;
}
.empty {
  padding: var(--sp-3);
  color: var(--text-tertiary);
  font-size: var(--fs-chrome);
}
.entry {
  display: grid;
  grid-template-columns: 70px 50px 1fr;
  gap: var(--sp-2);
  padding: 2px var(--sp-3);
  border-bottom: 1px solid rgba(255,255,255,0.03);
  color: var(--text-secondary);
}
.entry[data-level="info"]  .level { color: var(--info); }
.entry[data-level="warn"]  .level { color: var(--warning); }
.entry[data-level="error"] .level { color: var(--error); }
.entry[data-level="error"] .message { color: var(--text-primary); }
.timestamp { color: var(--text-tertiary); }
.level { font-weight: 700; text-transform: uppercase; font-size: 10px; }
.message { white-space: pre-wrap; word-break: break-word; }
```

- [ ] **Step 4: Write `ConsolePanel.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import styles from './ConsolePanel.module.css'
import { useConsoleStore, type LogLevel } from '../../stores/consoleStore'

const ALL_LEVELS: readonly LogLevel[] = ['info', 'warn', 'error']

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function ConsolePanel() {
  const entries = useConsoleStore((s) => s.entries)
  const clear = useConsoleStore((s) => s.clear)
  const [enabled, setEnabled] = useState<Record<LogLevel, boolean>>({ info: true, warn: true, error: true })
  const listRef = useRef<HTMLDivElement | null>(null)

  const visible = entries.filter((e) => enabled[e.level])

  // Auto-scroll to bottom when new entries arrive AND we're already at/near the bottom.
  useEffect(() => {
    const el = listRef.current
    if (el === null) return
    const atBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 50
    if (atBottom) el.scrollTop = el.scrollHeight
  }, [visible.length])

  function toggle(level: LogLevel): void {
    setEnabled((prev) => ({ ...prev, [level]: !prev[level] }))
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {ALL_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={`${styles.filter} ${styles[level]}`}
            aria-pressed={enabled[level]}
            onClick={() => toggle(level)}
          >
            {level}
          </button>
        ))}
        <span className={styles.spacer} />
        <span>{visible.length} / {entries.length}</span>
        <button type="button" className={styles.clear} onClick={clear}>Clear</button>
      </div>
      <div ref={listRef} className={styles.list}>
        {visible.length === 0 ? (
          <div className={styles.empty}>No logs yet. Game LOG messages will stream here.</div>
        ) : (
          visible.map((e) => (
            <div key={e.id} className={styles.entry} data-level={e.level}>
              <span className={styles.timestamp}>{formatTime(e.timestamp)}</span>
              <span className={styles.level}>{e.level}</span>
              <span className={styles.message}>{e.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Tests pass + lint + typecheck**

- [ ] **Step 6: Commit**

```
git add src/ui/panels/ConsolePanel.tsx src/ui/panels/ConsolePanel.module.css src/ui/panels/ConsolePanel.test.tsx
git commit -m "ui: ConsolePanel renders consoleStore with filters + clear"
```

---

### Task 4: Wire ConsolePanel into BottomTabs

**Files:**
- Modify: `src/ui/panels/BottomTabs.tsx`
- Modify: `src/ui/panels/BottomTabs.test.tsx`

- [ ] **Step 1: Update BottomTabs to render ConsolePanel when active tab is 'console'**

Read it. The current `BottomTabs` renders placeholder strings for each tab. Update it to render the real `ConsolePanel` when `active === 'console'`, otherwise keep showing placeholder strings.

```tsx
import styles from './BottomTabs.module.css'
import { useEditorStore, type BottomTab } from '../../stores/editorStore'
import { ConsolePanel } from './ConsolePanel'

const TABS: readonly { id: BottomTab; label: string }[] = [
  { id: 'assets',   label: 'Assets' },
  { id: 'config',   label: 'Config' },
  { id: 'ai',       label: 'AI Studio' },
  { id: 'console',  label: 'Console' },
  { id: 'settings', label: 'Settings' },
]

export function BottomTabs() {
  const active = useEditorStore((s) => s.activeBottomTab)
  const setActive = useEditorStore((s) => s.setActiveBottomTab)

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
      <div className={styles.content}>
        {active === 'console' ? <ConsolePanel /> : <span>{placeholderFor(active)}</span>}
      </div>
    </>
  )
}

function placeholderFor(tab: BottomTab): string {
  switch (tab) {
    case 'assets':   return 'Asset browser — coming in a later plan.'
    case 'config':   return 'Config editor — coming in a later plan.'
    case 'ai':       return 'AI Studio — coming in a later plan.'
    case 'console':  return ''   // Never shown; ConsolePanel renders instead
    case 'settings': return 'Settings — coming in a later plan.'
  }
}
```

- [ ] **Step 2: Verify**

The existing BottomTabs tests should still pass (they don't test the content text — they test tabs render and toggle). If any do test placeholder text for console, update them.

- `npm run test:run` PASS overall
- `npm run typecheck` PASS
- `npm run lint` PASS

- [ ] **Step 3: Also update the `.content` CSS to take full height**

In `src/ui/panels/BottomTabs.module.css`, `.content` currently has `padding: var(--sp-3)`. The ConsolePanel's `.wrap` needs to fill the available space without inheriting the tab's padding. Easiest fix: remove padding from `.content` and let ConsolePanel handle its own padding. But this changes the placeholder tabs' layout slightly.

Cleanest: keep padding for placeholder tabs but pass through for ConsolePanel. Conditional class:

```tsx
<div className={`${styles.content} ${active === 'console' ? styles['content-pass'] : ''}`}>
```

And in CSS:

```css
.content-pass {
  padding: 0;
}
```

Update accordingly.

- [ ] **Step 4: Commit**

```
git add src/ui/panels/BottomTabs.tsx src/ui/panels/BottomTabs.module.css
git commit -m "tabs: render ConsolePanel for Console tab"
```

---

### Task 5: Smoke test

Verify the console actually shows logs from the test game. The test game's bridge SDK can be made to emit a log via `bridge.notifyLog(level, message)`. The test game currently doesn't emit any logs, so for the smoke test:

1. Update `public/test-game/game.js` to emit a LOG when bridge connects: `bridge.notifyLog('info', 'TestGame connected with ' + Object.keys(state).length + ' entities')`
2. Rebuild bridge bundle
3. Start dev server + Playwright
4. Verify the Console tab shows the log

- [ ] **Step 1: Update `public/test-game/game.js`**

Read it. After `bridge.connect({...})`, add:

```js
bridge.notifyLog('info', 'TestGame connected with ' + Object.keys(state).length + ' entities')
```

- [ ] **Step 2: Build bridge bundle + start dev server**

`npm run build:bridge && npm run dev` (controller handles this with Playwright)

- [ ] **Step 3: Verify in browser**

Open editor → wait for Connected → click Console tab → see the "TestGame connected with 3 entities" log entry.

- [ ] **Step 4: Document results**

Create `docs/superpowers/plans/2026-05-25-plan-4-smoke-test-results.md` with the verification checklist.

- [ ] **Step 5: Commit**

---

### Task 6: Final checks + merge

- [ ] `npm run lint` PASS
- [ ] `npm run typecheck` PASS
- [ ] `npm run test:run` PASS (expect ~100 tests)
- [ ] `npm run build` PASS

Then use `finishing-a-development-branch` skill to merge.

---

## Not in Plan 4

- Search/filter by text content — easy follow-up
- Persisting logs across page reload — out of scope
- Pretty-printing JSON in log messages — out of scope

## Self-review

- **Spec coverage:** Implements §8.3 Console panel (was a placeholder).
- **Type consistency:** `LogLevel`, `LogEntry` consistent across store/UI.
- **No placeholders:** Every step has concrete code.
- **Scope:** 6 tasks, tight focus on logging surface.
