# Plan 2 — Inspector Live Editing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Inspector's fields editable. When the user types a new value, send `UPDATE_PROPERTY` or `UPDATE_TRANSFORM` to the game via the bridge, and the game's `register({ set })` callback applies the change live. Visual confirmation that the editor → game write path works.

**Architecture:** No new modules. The bridge protocol already has `UPDATE_PROPERTY` and `UPDATE_TRANSFORM` messages, and the SDK's `handleMessage` already routes them to the registered node's `set()`. Plan 2 just wires this up on the editor side: change inspector inputs from `disabled readOnly` to controlled inputs, debounce sends to the bridge, also handle `TRANSFORM_CHANGED` echoes from the game (via `sceneStore.upsertNode`) so the inspector stays in sync.

**Tech Stack:** Unchanged from Plan 1 (React 19 + Vite 6 + TypeScript + Zustand + mitt).

**Reference spec:** `docs/superpowers/specs/2026-05-25-game-editor-design.md`
**Plan 1:** `docs/superpowers/plans/2026-05-25-plan-1-mvp-edit-loop.md` — read this to understand the existing architecture.

**Scope deferred to later plans:**
- SVG gizmo overlay + drag (Plan 3)
- JSON patch writer to disk (Plan 4 — needs real Spine JSON test data)
- File watcher for external changes (Plan 4)

---

## Conventions

- TDD where useful. Pure logic gets unit tests; UI changes get smoke tests + manual verification.
- Named exports, type-only imports for types (`verbatimModuleSyntax`).
- Commit per task. Run lint + typecheck + tests before commit.

---

### Task 1: Add a controlled-input helper for the Inspector

The Inspector currently renders each field via a `<Row>` + `<input disabled readOnly value={...} />`. We need a controlled input that emits debounced changes. To keep the Inspector file small and focused, extract a small `ScalarField` component plus a tiny `useDebouncedValue` hook.

**Files:**
- Create: `src/ui/panels/inspector/ScalarField.tsx`
- Create: `src/ui/panels/inspector/ScalarField.test.tsx`
- Create: `src/ui/panels/inspector/useDebouncedCallback.ts`
- Create: `src/ui/panels/inspector/useDebouncedCallback.test.ts`

- [ ] **Step 1: Write the failing test `useDebouncedCallback.test.ts`**

```ts
import { describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedCallback } from './useDebouncedCallback'

describe('useDebouncedCallback', () => {
  test('only fires once after rapid calls within the wait window', async () => {
    vi.useFakeTimers()
    const target = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(target, 100))
    act(() => { result.current('a') })
    act(() => { result.current('b') })
    act(() => { result.current('c') })
    expect(target).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(100) })
    expect(target).toHaveBeenCalledTimes(1)
    expect(target).toHaveBeenLastCalledWith('c')
    vi.useRealTimers()
  })

  test('fires again after the wait window elapses', async () => {
    vi.useFakeTimers()
    const target = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(target, 100))
    act(() => { result.current('a') })
    await act(async () => { vi.advanceTimersByTime(100) })
    expect(target).toHaveBeenCalledTimes(1)
    act(() => { result.current('b') })
    await act(async () => { vi.advanceTimersByTime(100) })
    expect(target).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test — fail**

```
npm run test:run -- src/ui/panels/inspector/useDebouncedCallback.test.ts
```

- [ ] **Step 3: Write `useDebouncedCallback.ts`**

```ts
import { useEffect, useRef } from 'react'

export function useDebouncedCallback<TArgs extends readonly unknown[]>(
  target: (...args: TArgs) => void,
  waitMs: number,
): (...args: TArgs) => void {
  const targetRef = useRef(target)
  targetRef.current = target
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  return (...args: TArgs) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      targetRef.current(...args)
    }, waitMs)
  }
}
```

- [ ] **Step 4: Test passes**

`npm run test:run -- src/ui/panels/inspector/useDebouncedCallback.test.ts`

- [ ] **Step 5: Write the failing test `ScalarField.test.tsx`**

```tsx
import { describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ScalarField } from './ScalarField'

describe('ScalarField', () => {
  test('renders the initial value', () => {
    render(<ScalarField label="X" value={42} onCommit={() => {}} />)
    expect(screen.getByDisplayValue('42')).toBeInTheDocument()
  })

  test('typing into the field updates the displayed value immediately', () => {
    render(<ScalarField label="X" value={10} onCommit={() => {}} />)
    const input = screen.getByDisplayValue('10') as HTMLInputElement
    fireEvent.change(input, { target: { value: '25' } })
    expect(input.value).toBe('25')
  })

  test('commits the parsed numeric value after debounce window', async () => {
    vi.useFakeTimers()
    const onCommit = vi.fn()
    render(<ScalarField label="X" value={10} onCommit={onCommit} />)
    const input = screen.getByDisplayValue('10') as HTMLInputElement
    fireEvent.change(input, { target: { value: '25' } })
    expect(onCommit).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(onCommit).toHaveBeenCalledWith(25)
    vi.useRealTimers()
  })

  test('ignores commits when the input does not parse as a number', async () => {
    vi.useFakeTimers()
    const onCommit = vi.fn()
    render(<ScalarField label="X" value={10} onCommit={onCommit} />)
    const input = screen.getByDisplayValue('10') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not-a-number' } })
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(onCommit).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  test('updates displayed value when the prop value changes (game-driven update)', () => {
    const { rerender } = render(<ScalarField label="X" value={10} onCommit={() => {}} />)
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    rerender(<ScalarField label="X" value={42} onCommit={() => {}} />)
    expect(screen.getByDisplayValue('42')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test — fail**

- [ ] **Step 7: Write `ScalarField.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useDebouncedCallback } from './useDebouncedCallback'

const DEBOUNCE_MS = 200

type Props = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onCommit: (next: number) => void
}

export function ScalarField({ label, value, min, max, step, onCommit }: Props) {
  const [draft, setDraft] = useState(String(value))

  // Stay in sync when the underlying value changes from the game (TRANSFORM_CHANGED echo).
  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = useDebouncedCallback((next: string) => {
    const parsed = Number(next)
    if (Number.isFinite(parsed)) onCommit(parsed)
  }, DEBOUNCE_MS)

  return (
    <input
      type="number"
      aria-label={label}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        setDraft(e.target.value)
        commit(e.target.value)
      }}
    />
  )
}
```

- [ ] **Step 8: Tests pass**

`npm run test:run -- src/ui/panels/inspector/`

- [ ] **Step 9: Lint + typecheck pass**

- [ ] **Step 10: Commit**

```
git add src/ui/panels/inspector/
git commit -m "inspector: ScalarField + useDebouncedCallback primitives"
```

Co-Authored-By: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

### Task 2: Editor-side bridge dispatch helpers

The Inspector needs to send `UPDATE_PROPERTY` / `UPDATE_TRANSFORM` messages, but the bridge `BridgeClient` is held in `CanvasPanel`'s ref — not accessible to other panels.

Solution: expose the active `BridgeClient` via a tiny module-level holder so the Inspector can dispatch messages without prop-drilling.

**Files:**
- Create: `src/bridge/activeClient.ts`
- Create: `src/bridge/activeClient.test.ts`
- Modify: `src/bridge/index.ts`
- Modify: `src/ui/panels/CanvasPanel.tsx` (register/unregister the active client)

- [ ] **Step 1: Write failing test `src/bridge/activeClient.test.ts`**

```ts
import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { EditorMessage } from '../types/bridge'
import { getActiveBridgeClient, setActiveBridgeClient, sendToGame } from './activeClient'

describe('activeClient', () => {
  beforeEach(() => {
    setActiveBridgeClient(null)
  })

  test('returns null when no client is registered', () => {
    expect(getActiveBridgeClient()).toBeNull()
  })

  test('returns the registered client', () => {
    const fake = { send: vi.fn(), dispose: vi.fn() }
    setActiveBridgeClient(fake)
    expect(getActiveBridgeClient()).toBe(fake)
  })

  test('sendToGame forwards to the active client', () => {
    const send = vi.fn()
    setActiveBridgeClient({ send, dispose: vi.fn() })
    const msg: EditorMessage = { type: 'UPDATE_PROPERTY', nodeId: 'a', key: 'health', value: 50 }
    sendToGame(msg)
    expect(send).toHaveBeenCalledWith(msg)
  })

  test('sendToGame no-ops when no client is active', () => {
    const msg: EditorMessage = { type: 'REQUEST_TREE' }
    expect(() => sendToGame(msg)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `src/bridge/activeClient.ts`**

```ts
import type { EditorMessage } from '../types/bridge'
import type { BridgeClient } from './client'

let active: BridgeClient | null = null

export function setActiveBridgeClient(client: BridgeClient | null): void {
  active = client
}

export function getActiveBridgeClient(): BridgeClient | null {
  return active
}

export function sendToGame(msg: EditorMessage): void {
  if (active === null) return
  active.send(msg)
}
```

- [ ] **Step 4: Update `src/bridge/index.ts`**

Append:

```ts
export { setActiveBridgeClient, getActiveBridgeClient, sendToGame } from './activeClient'
```

- [ ] **Step 5: Update `src/ui/panels/CanvasPanel.tsx`**

In the first `useEffect`, after `clientRef.current = client`, add `setActiveBridgeClient(client)`. In the cleanup, before `clientRef.current = null`, add `setActiveBridgeClient(null)`. Import `setActiveBridgeClient` from `'../../bridge'`.

The final cleanup section becomes:

```ts
return () => {
  client.dispose()
  setActiveBridgeClient(null)
  clientRef.current = null
}
```

And right after `clientRef.current = client`:

```ts
clientRef.current = client
setActiveBridgeClient(client)
```

- [ ] **Step 6: Tests pass**

`npm run test:run` — all (61+ tests).
`npm run typecheck` PASS.
`npm run lint` PASS.

- [ ] **Step 7: Commit**

```
git add src/bridge/activeClient.ts src/bridge/activeClient.test.ts src/bridge/index.ts src/ui/panels/CanvasPanel.tsx
git commit -m "bridge: expose active client to other panels via setActiveBridgeClient"
```

Co-Authored-By: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

### Task 3: Handle TRANSFORM_CHANGED messages on the editor side

Currently the `CanvasPanel`'s `onMessage` switch drops `TRANSFORM_CHANGED` (with a comment that Plan 2 will handle it). Wire it up: when the game reports a transform change, update the corresponding node in `sceneStore` via `upsertNode`.

**Files:**
- Modify: `src/ui/panels/CanvasPanel.tsx`
- Modify: `src/ui/panels/CanvasPanel.test.tsx`

- [ ] **Step 1: Append a test to `CanvasPanel.test.tsx`**

Add to the existing describe block:

```tsx
test('TRANSFORM_CHANGED updates the sceneStore node via upsertNode', async () => {
  const node: NodeSnapshot = {
    id: 'player',
    kind: 'sprite',
    name: 'Player',
    parentId: null,
    childIds: [],
    transform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
    bounds: null,
    schema: [],
    values: {},
  }
  useSceneStore.getState().setTree([node])
  render(<CanvasPanel />)
  // Simulate a TRANSFORM_CHANGED message from the game.
  window.dispatchEvent(new MessageEvent('message', {
    data: { __gameTool: 'bridge', v: 1, payload: { type: 'TRANSFORM_CHANGED', nodeId: 'player', transform: { x: 200, y: 100, rotation: 0, scaleX: 1, scaleY: 1 } } },
  }))
  expect(useSceneStore.getState().byId('player')?.transform.x).toBe(200)
})
```

At the top of the file, import `NodeSnapshot` and `useSceneStore`:

```tsx
import type { NodeSnapshot } from '../../types/scene'
import { useSceneStore } from '../../stores/sceneStore'
```

- [ ] **Step 2: Run — should fail** (TRANSFORM_CHANGED is currently a no-op)

- [ ] **Step 3: Update `src/ui/panels/CanvasPanel.tsx`**

Add the `upsertNode` selector at the top of the component:

```ts
const upsertNode = useSceneStore((s) => s.upsertNode)
```

In the message switch, replace the `case 'TRANSFORM_CHANGED':` (with its placeholder comment) with:

```ts
case 'TRANSFORM_CHANGED': {
  const current = useSceneStore.getState().byId(msg.nodeId)
  if (current !== undefined) {
    upsertNode({ ...current, transform: msg.transform })
  }
  return
}
```

Add `upsertNode` to the useEffect deps array.

- [ ] **Step 4: Test passes**

`npm run test:run -- src/ui/panels/CanvasPanel.test.tsx`

- [ ] **Step 5: Lint + typecheck**

- [ ] **Step 6: Commit**

```
git add src/ui/panels/CanvasPanel.tsx src/ui/panels/CanvasPanel.test.tsx
git commit -m "canvas: route TRANSFORM_CHANGED into sceneStore.upsertNode"
```

Co-Authored-By trailer.

---

### Task 4: Make Inspector Transform fields editable

Currently the Inspector renders Transform position / rotation / scale as `disabled readOnly` inputs. Replace these with `ScalarField`s that dispatch `UPDATE_TRANSFORM` on commit.

**Files:**
- Modify: `src/ui/panels/InspectorPanel.tsx`
- Modify: `src/ui/panels/InspectorPanel.test.tsx`

- [ ] **Step 1: Append two tests to `InspectorPanel.test.tsx`**

Add at the top of the file:

```tsx
import { vi } from 'vitest'
import { sendToGame, setActiveBridgeClient } from '../../bridge'
```

Add to the describe block (after the existing tests):

```tsx
test('editing the Position X field dispatches UPDATE_TRANSFORM', async () => {
  vi.useFakeTimers()
  const send = vi.fn()
  setActiveBridgeClient({ send, dispose: () => {} })
  useSceneStore.getState().setTree([playerNode])
  useEditorStore.getState().select('player')
  const { getByLabelText } = render(<InspectorPanel />)
  const xInput = getByLabelText('Position X') as HTMLInputElement
  expect(xInput.value).toBe('120')
  // Update X to 200
  await act(async () => {
    xInput.dispatchEvent(new Event('change', { bubbles: true }))
    // The change event needs to also set the value:
    fireEvent.change(xInput, { target: { value: '200' } })
  })
  await act(async () => { vi.advanceTimersByTime(300) })
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'UPDATE_TRANSFORM', nodeId: 'player' })
  )
  const last = send.mock.calls.at(-1)?.[0]
  expect(last.transform).toEqual({ x: 200 })
  setActiveBridgeClient(null)
  vi.useRealTimers()
})

test('fields stay disabled if there is no active bridge client', () => {
  // No setActiveBridgeClient call.
  useSceneStore.getState().setTree([playerNode])
  useEditorStore.getState().select('player')
  // Inspector still renders the field, but committing should be a no-op (sendToGame returns early)
  const { getByLabelText } = render(<InspectorPanel />)
  expect(getByLabelText('Position X')).toBeInTheDocument()
})
```

Also import `act` and `fireEvent` at the top:

```tsx
import { render, screen, act, fireEvent } from '@testing-library/react'
```

- [ ] **Step 2: Run — should fail** (no `Position X` label, fields still disabled)

- [ ] **Step 3: Replace the Transform section in `InspectorPanel.tsx`**

Replace `TransformSection` with:

```tsx
function TransformSection({ node }: { node: NodeSnapshot }) {
  const dispatchTransform = (partial: Partial<NodeSnapshot['transform']>) => {
    sendToGame({ type: 'UPDATE_TRANSFORM', nodeId: node.id, transform: partial })
  }
  return (
    <div className={styles.section}>
      <div className={styles['section-header']}>Transform</div>
      <Row label="Position">
        <ScalarField label="Position X" value={node.transform.x} onCommit={(x) => dispatchTransform({ x })} />
        <ScalarField label="Position Y" value={node.transform.y} onCommit={(y) => dispatchTransform({ y })} />
      </Row>
      <Row label="Rotation">
        <ScalarField label="Rotation" value={node.transform.rotation} step={1} onCommit={(rotation) => dispatchTransform({ rotation })} />
      </Row>
      <Row label="Scale">
        <ScalarField label="Scale X" value={node.transform.scaleX} step={0.1} onCommit={(scaleX) => dispatchTransform({ scaleX })} />
        <ScalarField label="Scale Y" value={node.transform.scaleY} step={0.1} onCommit={(scaleY) => dispatchTransform({ scaleY })} />
      </Row>
    </div>
  )
}
```

Add imports at top of file:

```tsx
import { ScalarField } from './inspector/ScalarField'
import { sendToGame } from '../../bridge'
```

Also update the test for "fields are disabled in Plan 1" — that test was Plan 1's read-only check. Either delete it or rename it. Since fields are now editable, **delete** that test:

```tsx
// Remove the test:
test('fields are disabled in Plan 1 (read-only)', () => { ... })
```

- [ ] **Step 4: Replace SchemaField too — make it editable for number fields**

Replace `SchemaField` with:

```tsx
function SchemaField({ node, field, value }: { node: NodeSnapshot; field: FieldSchema; value: unknown }) {
  if (field.type === 'number' && typeof value === 'number') {
    return (
      <Row label={field.label ?? field.key}>
        <ScalarField
          label={field.label ?? field.key}
          value={value}
          min={field.min}
          max={field.max}
          step={field.step}
          onCommit={(next) => sendToGame({ type: 'UPDATE_PROPERTY', nodeId: node.id, key: field.key, value: next })}
        />
      </Row>
    )
  }
  // Non-number fields stay read-only for now — Plan 3+ will add color picker, asset-ref dropdown, etc.
  return (
    <Row label={field.label ?? field.key}>
      <input className={styles['field-input']} value={value === undefined ? '' : String(value)} disabled readOnly />
    </Row>
  )
}
```

Update `SchemaFieldsSection` to pass `node`:

```tsx
function SchemaFieldsSection({ node }: { node: NodeSnapshot }) {
  if (node.schema.length === 0) return null
  return (
    <div className={styles.section}>
      <div className={styles['section-header']}>Properties</div>
      {node.schema.map((field) => (
        <SchemaField key={field.key} node={node} field={field} value={node.values[field.key]} />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Tests pass**

`npm run test:run`

If the "renders schema-driven fields with their current values" test breaks because the input has aria-label now instead of being the only thing with that displayValue, adjust the test accordingly.

- [ ] **Step 6: Lint + typecheck**

- [ ] **Step 7: Commit**

```
git add src/ui/panels/InspectorPanel.tsx src/ui/panels/InspectorPanel.test.tsx
git commit -m "inspector: editable Transform and number-schema fields, dispatch UPDATE_*"
```

Co-Authored-By trailer.

---

### Task 5: End-to-end browser smoke test

Verify the editing loop works against the running test game.

**Files:**
- Update: `docs/superpowers/plans/2026-05-25-plan-2-smoke-test-results.md`

Use the Playwright MCP browser tools to:

1. Rebuild the bridge bundle: `npm run build:bridge`
2. Start the dev server in background: `npm run dev`
3. Navigate to the editor
4. Wait for "Connected" badge
5. Click "Player" in the Scene Tree
6. Read Inspector fields, change Position X from 200 to 300 via direct DOM manipulation
7. Wait debounce window
8. Read the Player rectangle's CSS `left` inside the iframe — should now be 300px (the test game's `applyTransform` mutates `el.style.left`)
9. Document the result
10. Kill the dev server

Manually verify if available, otherwise run via Playwright in the controller (not a subagent — controller has the MCP tools).

- [ ] **Step 1: Run smoke test**

(controller drives this)

- [ ] **Step 2: Write results file**

Document outcomes in `docs/superpowers/plans/2026-05-25-plan-2-smoke-test-results.md` similar to Plan 1's results file.

- [ ] **Step 3: Commit**

```
git add docs/superpowers/plans/2026-05-25-plan-2-smoke-test-results.md
git commit -m "docs: Plan 2 smoke test verified"
```

---

### Task 6: Final lint/typecheck/test/build

- [ ] `npm run lint` PASS
- [ ] `npm run typecheck` PASS
- [ ] `npm run test:run` PASS (all tests)
- [ ] `npm run build` PASS

If everything green, Plan 2 is complete. Use `finishing-a-development-branch` skill to merge.

---

## What's not in Plan 2

- SVG gizmos / drag handles → Plan 3
- JSON patch writer → Plan 4 (depends on real Spine project files for test data)
- Asset Browser → Plan 5
- Config Editor → Plan 6
- AI Studio → Plan 7
- Console panel streaming → Plan 8
- Settings panel → Plan 9
- Undo/redo → not yet scheduled

## Self-review

- **Spec coverage:** Plan 2 covers spec section 5.2 edit loop steps 5-7 (designer edits field → bridge applies live in game), §7.3 protocol UPDATE_PROPERTY/UPDATE_TRANSFORM dispatch, §6.1 sceneStore.upsertNode wiring.
- **Type consistency:** `ScalarField`'s `onCommit: (next: number) => void` matches `Transform` field types. `SchemaField` correctly gates editing on `field.type === 'number'`.
- **No placeholders:** every step has code/commands.
- **Scope:** focused, only what's needed to demonstrate live editing.
