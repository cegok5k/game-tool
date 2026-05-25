# Plan 3 — SVG Gizmos + Drag

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render an SVG gizmo overlay on top of the iframe for the selected entity. Body-drag moves; 8 corner/edge handles scale; a rotation handle above the top edge rotates. Pointer events are throttled to ~30fps during drag and a final commit fires on mouseup. An optional grid-snap toggle in the canvas toolbar locks moves to a 32px grid and rotations to 15° steps.

**Architecture:** A new `src/ui/canvas/gizmo/` directory houses the gizmo components and a small drag-session hook. The gizmo reads the selected node's `bounds` + `transform` from `sceneStore`, computes handle positions in SVG coords, captures pointer events on the overlay (sharing the same overlay that already exists for `PICK_AT`), and dispatches `UPDATE_TRANSFORM` via `sendToGame`. Snap state lives in `editorStore` so the toggle is persistent across selections. No new dependencies.

**Tech Stack:** Unchanged. React 19 + TypeScript + Zustand + SVG.

**Reference:** `docs/superpowers/specs/2026-05-25-game-editor-design.md`. Builds directly on Plan 1 and Plan 2.

**Out of scope (deferred):**
- JSON patch write-back to disk (Plan 4)
- Asset Browser drag-to-place (Plan 5)
- Multi-select / box-select (later)
- Per-axis lock (hold X to constrain to horizontal — later)

---

## Conventions

- TDD where useful — pure logic (snap math, drag-session state machine) gets unit tests; visual components get a smoke test plus the integration check in Task 8.
- Named exports, `import type` for type-only imports.
- Commit per task. Run lint + typecheck + tests before commit.

---

## File structure

```
src/
  stores/
    editorStore.ts                  - add: snapEnabled, gridSize, setSnapEnabled
  ui/
    canvas/
      gizmo/
        snap.ts                     - pure snap math (snap to grid, snap angle)
        snap.test.ts
        coords.ts                   - bounds + transform → SVG coords for handles
        coords.test.ts
        useDragSession.ts           - pointer-drag state machine with throttle
        useDragSession.test.ts
        SelectionBox.tsx            - rectangular outline
        ScaleHandles.tsx            - 8 corner/edge handles
        RotateHandle.tsx            - circle above the top edge
        Gizmo.tsx                   - composes the above
        Gizmo.module.css
        Gizmo.test.tsx              - smoke test that gizmo renders for selected node
      CanvasToolbar.tsx             - new toolbar with snap toggle
      CanvasToolbar.module.css
      CanvasToolbar.test.tsx
    panels/
      CanvasPanel.tsx               - mount <Gizmo /> in the overlay, render <CanvasToolbar />
      CanvasPanel.module.css        - tweak overlay z-index so gizmos sit above
```

---

### Task 1: Add snap state to editorStore

**Files:**
- Modify: `src/stores/editorStore.ts`
- Modify: `src/stores/editorStore.test.ts`

- [ ] **Step 1: Append test to `editorStore.test.ts`**

```ts
test('initial snap state', () => {
  expect(useEditorStore.getState().snapEnabled).toBe(false)
  expect(useEditorStore.getState().gridSize).toBe(32)
})

test('setSnapEnabled toggles', () => {
  useEditorStore.getState().setSnapEnabled(true)
  expect(useEditorStore.getState().snapEnabled).toBe(true)
  useEditorStore.getState().setSnapEnabled(false)
  expect(useEditorStore.getState().snapEnabled).toBe(false)
})
```

- [ ] **Step 2: Run test — fail**

- [ ] **Step 3: Update `src/stores/editorStore.ts`**

Read it first. Add `snapEnabled` and `gridSize` to the State type, default values, `setSnapEnabled`, and include them in `reset()`. Also export `DEFAULT_GRID_SIZE = 32` so other files don't hardcode it.

```ts
export const DEFAULT_GRID_SIZE = 32

type State = {
  selectedId: string | null
  activeBottomTab: BottomTab
  snapEnabled: boolean
  gridSize: number
  select: (id: string | null) => void
  setActiveBottomTab: (tab: BottomTab) => void
  setSnapEnabled: (on: boolean) => void
  reset: () => void
}

export const useEditorStore = create<State>((set) => ({
  selectedId: null,
  activeBottomTab: 'console',
  snapEnabled: false,
  gridSize: DEFAULT_GRID_SIZE,
  select: (selectedId) => set({ selectedId }),
  setActiveBottomTab: (activeBottomTab) => set({ activeBottomTab }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  reset: () => set({ selectedId: null, activeBottomTab: 'console', snapEnabled: false, gridSize: DEFAULT_GRID_SIZE }),
}))
```

- [ ] **Step 4: Tests pass**

`npm run test:run -- src/stores/editorStore.test.ts`

- [ ] **Step 5: Lint + typecheck**

- [ ] **Step 6: Commit**

```
git add src/stores/editorStore.ts src/stores/editorStore.test.ts
git commit -m "stores: editorStore tracks snap + grid size"
```

Co-Authored-By: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

### Task 2: Pure snap math

**Files:**
- Create: `src/ui/canvas/gizmo/snap.ts`
- Create: `src/ui/canvas/gizmo/snap.test.ts`

- [ ] **Step 1: Write failing test `snap.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { snapToGrid, snapAngle, snapPoint } from './snap'

describe('snapToGrid', () => {
  test('returns input unchanged when grid <= 0', () => {
    expect(snapToGrid(17, 0)).toBe(17)
    expect(snapToGrid(17, -1)).toBe(17)
  })
  test('snaps to nearest multiple', () => {
    expect(snapToGrid(15, 32)).toBe(0)
    expect(snapToGrid(16, 32)).toBe(32)
    expect(snapToGrid(31, 32)).toBe(32)
    expect(snapToGrid(48, 32)).toBe(32)
    expect(snapToGrid(49, 32)).toBe(64)
  })
  test('handles negatives symmetrically', () => {
    expect(snapToGrid(-15, 32)).toBe(0)
    expect(snapToGrid(-17, 32)).toBe(-32)
    expect(snapToGrid(-31, 32)).toBe(-32)
  })
})

describe('snapAngle', () => {
  test('snaps degrees to nearest step', () => {
    expect(snapAngle(7, 15)).toBe(0)
    expect(snapAngle(8, 15)).toBe(15)
    expect(snapAngle(22, 15)).toBe(15)
    expect(snapAngle(23, 15)).toBe(30)
    expect(snapAngle(-7, 15)).toBe(0)
    expect(snapAngle(-8, 15)).toBe(-15)
  })
  test('returns input unchanged when step <= 0', () => {
    expect(snapAngle(7, 0)).toBe(7)
  })
})

describe('snapPoint', () => {
  test('snaps x and y independently', () => {
    expect(snapPoint({ x: 15, y: 17 }, 32)).toEqual({ x: 0, y: 32 })
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `snap.ts`**

```ts
export function snapToGrid(value: number, grid: number): number {
  if (grid <= 0) return value
  return Math.round(value / grid) * grid
}

export function snapAngle(deg: number, stepDeg: number): number {
  if (stepDeg <= 0) return deg
  return Math.round(deg / stepDeg) * stepDeg
}

export function snapPoint(p: { x: number; y: number }, grid: number): { x: number; y: number } {
  return { x: snapToGrid(p.x, grid), y: snapToGrid(p.y, grid) }
}
```

- [ ] **Step 4: Tests pass**

`npm run test:run -- src/ui/canvas/gizmo/snap.test.ts`

- [ ] **Step 5: Commit**

```
git add src/ui/canvas/gizmo/snap.ts src/ui/canvas/gizmo/snap.test.ts
git commit -m "gizmo: pure snap math (grid + angle)"
```

---

### Task 3: Bounds → handle coords

The gizmo needs handle positions derived from a node's bounds + transform. Pure function, easy to test.

**Files:**
- Create: `src/ui/canvas/gizmo/coords.ts`
- Create: `src/ui/canvas/gizmo/coords.test.ts`

- [ ] **Step 1: Write failing test `coords.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { handlePositions, ROTATE_HANDLE_OFFSET, type HandleId } from './coords'

const box = { x: 100, y: 200, width: 80, height: 40 }

describe('handlePositions', () => {
  test('returns 8 scale handles + 1 rotate handle = 9 entries', () => {
    const handles = handlePositions(box)
    expect(handles).toHaveLength(9)
    const ids: HandleId[] = handles.map((h) => h.id)
    expect(ids).toEqual([
      'nw', 'n', 'ne',
      'w',        'e',
      'sw', 's', 'se',
      'rotate',
    ])
  })

  test('places corner handles exactly at box corners', () => {
    const handles = handlePositions(box)
    const map = Object.fromEntries(handles.map((h) => [h.id, h]))
    expect(map.nw).toMatchObject({ x: 100, y: 200 })
    expect(map.ne).toMatchObject({ x: 180, y: 200 })
    expect(map.sw).toMatchObject({ x: 100, y: 240 })
    expect(map.se).toMatchObject({ x: 180, y: 240 })
  })

  test('places edge handles at midpoints', () => {
    const handles = handlePositions(box)
    const map = Object.fromEntries(handles.map((h) => [h.id, h]))
    expect(map.n).toMatchObject({ x: 140, y: 200 })
    expect(map.s).toMatchObject({ x: 140, y: 240 })
    expect(map.w).toMatchObject({ x: 100, y: 220 })
    expect(map.e).toMatchObject({ x: 180, y: 220 })
  })

  test('places rotate handle above top-center at ROTATE_HANDLE_OFFSET above', () => {
    const handles = handlePositions(box)
    const r = handles.find((h) => h.id === 'rotate')!
    expect(r.x).toBe(140)
    expect(r.y).toBe(200 - ROTATE_HANDLE_OFFSET)
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `coords.ts`**

```ts
import type { Bounds } from '../../../types/scene'

export type HandleId =
  | 'nw' | 'n' | 'ne'
  | 'w'        | 'e'
  | 'sw' | 's' | 'se'
  | 'rotate'

export type HandlePosition = { id: HandleId; x: number; y: number }

export const ROTATE_HANDLE_OFFSET = 24  // px above the top edge

export function handlePositions(b: Bounds): HandlePosition[] {
  const left = b.x
  const right = b.x + b.width
  const top = b.y
  const bottom = b.y + b.height
  const midX = b.x + b.width / 2
  const midY = b.y + b.height / 2
  return [
    { id: 'nw', x: left,  y: top },
    { id: 'n',  x: midX,  y: top },
    { id: 'ne', x: right, y: top },
    { id: 'w',  x: left,  y: midY },
    { id: 'e',  x: right, y: midY },
    { id: 'sw', x: left,  y: bottom },
    { id: 's',  x: midX,  y: bottom },
    { id: 'se', x: right, y: bottom },
    { id: 'rotate', x: midX, y: top - ROTATE_HANDLE_OFFSET },
  ]
}
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**

```
git add src/ui/canvas/gizmo/coords.ts src/ui/canvas/gizmo/coords.test.ts
git commit -m "gizmo: handle position math for selection box"
```

---

### Task 4: Drag session hook

A small state machine that tracks pointer-down → pointer-move (throttled) → pointer-up, and emits callbacks.

**Files:**
- Create: `src/ui/canvas/gizmo/useDragSession.ts`
- Create: `src/ui/canvas/gizmo/useDragSession.test.ts`

- [ ] **Step 1: Write failing test `useDragSession.test.ts`**

```ts
import { describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDragSession } from './useDragSession'

describe('useDragSession', () => {
  test('begin() starts a session, throttledMove queues, commit flushes', async () => {
    vi.useFakeTimers()
    const onMove = vi.fn()
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDragSession({ throttleMs: 33, onMove, onCommit }))
    act(() => result.current.begin({ x: 10, y: 20 }))
    act(() => result.current.move({ x: 12, y: 20 }))
    act(() => result.current.move({ x: 14, y: 20 }))
    act(() => result.current.move({ x: 16, y: 20 }))
    expect(onMove).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(33) })
    // After the throttle window the most recent move fires once.
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove).toHaveBeenLastCalledWith({ from: { x: 10, y: 20 }, to: { x: 16, y: 20 }, dx: 6, dy: 0 })
    act(() => result.current.commit({ x: 20, y: 25 }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenLastCalledWith({ from: { x: 10, y: 20 }, to: { x: 20, y: 25 }, dx: 10, dy: 5 })
    vi.useRealTimers()
  })

  test('cancel() ends without firing commit', () => {
    vi.useFakeTimers()
    const onMove = vi.fn()
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDragSession({ throttleMs: 33, onMove, onCommit }))
    act(() => result.current.begin({ x: 0, y: 0 }))
    act(() => result.current.move({ x: 10, y: 10 }))
    act(() => result.current.cancel())
    expect(onCommit).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  test('move/commit are ignored when no session is active', () => {
    vi.useFakeTimers()
    const onMove = vi.fn()
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDragSession({ throttleMs: 33, onMove, onCommit }))
    act(() => result.current.move({ x: 10, y: 10 }))
    act(() => result.current.commit({ x: 20, y: 20 }))
    expect(onMove).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `useDragSession.ts`**

```ts
import { useEffect, useRef } from 'react'

export type Point = { x: number; y: number }
export type DragInfo = { from: Point; to: Point; dx: number; dy: number }

type Options = {
  throttleMs: number
  onMove: (info: DragInfo) => void
  onCommit: (info: DragInfo) => void
}

export type DragSession = {
  begin: (at: Point) => void
  move: (at: Point) => void
  commit: (at: Point) => void
  cancel: () => void
}

export function useDragSession(opts: Options): DragSession {
  const from = useRef<Point | null>(null)
  const pending = useRef<Point | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  function clearTimer(): void {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  function flush(): void {
    const start = from.current
    const at = pending.current
    if (start === null || at === null) return
    optsRef.current.onMove({ from: start, to: at, dx: at.x - start.x, dy: at.y - start.y })
    pending.current = null
  }

  useEffect(() => clearTimer, [])

  return {
    begin(at) {
      from.current = { ...at }
      pending.current = null
      clearTimer()
    },
    move(at) {
      if (from.current === null) return
      pending.current = { ...at }
      if (timer.current !== null) return
      timer.current = setTimeout(() => {
        timer.current = null
        flush()
      }, optsRef.current.throttleMs)
    },
    commit(at) {
      const start = from.current
      if (start === null) return
      clearTimer()
      pending.current = null
      optsRef.current.onCommit({ from: start, to: at, dx: at.x - start.x, dy: at.y - start.y })
      from.current = null
    },
    cancel() {
      clearTimer()
      from.current = null
      pending.current = null
    },
  }
}
```

- [ ] **Step 4: Tests pass**

`npm run test:run -- src/ui/canvas/gizmo/useDragSession.test.ts`

- [ ] **Step 5: Commit**

```
git add src/ui/canvas/gizmo/useDragSession.ts src/ui/canvas/gizmo/useDragSession.test.ts
git commit -m "gizmo: drag session hook with throttled move + commit"
```

---

### Task 5: Gizmo component (move + scale + rotate)

The actual visual gizmo. Uses the snap, coords, and drag session pieces.

**Files:**
- Create: `src/ui/canvas/gizmo/Gizmo.module.css`
- Create: `src/ui/canvas/gizmo/Gizmo.tsx`
- Create: `src/ui/canvas/gizmo/Gizmo.test.tsx`

- [ ] **Step 1: Write `Gizmo.module.css`**

```css
.svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;       /* defer to children that opt in */
  overflow: visible;
}
.box {
  fill: rgba(167, 139, 250, 0.05);
  stroke: var(--accent);
  stroke-width: 1.5;
  shape-rendering: crispEdges;
  pointer-events: auto;
  cursor: move;
}
.handle {
  fill: var(--bg-canvas);
  stroke: var(--accent);
  stroke-width: 1.5;
  pointer-events: auto;
}
.handle-corner { cursor: nwse-resize; }
.handle-edge   { cursor: ns-resize; }
.handle-edge.h-horiz { cursor: ew-resize; }
.handle-corner.h-flip { cursor: nesw-resize; }
.rotate-line { stroke: var(--accent); stroke-width: 1; }
.rotate-handle {
  fill: var(--accent);
  stroke: rgba(255,255,255,0.4);
  stroke-width: 1;
  pointer-events: auto;
  cursor: grab;
}
.rotate-handle:active { cursor: grabbing; }
```

- [ ] **Step 2: Write `Gizmo.tsx`**

```tsx
import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import styles from './Gizmo.module.css'
import { handlePositions, type HandleId } from './coords'
import { useDragSession, type DragInfo, type Point } from './useDragSession'
import { snapPoint, snapAngle } from './snap'
import { sendToGame } from '../../../bridge'
import { useEditorStore } from '../../../stores/editorStore'
import { useSceneStore } from '../../../stores/sceneStore'
import type { NodeSnapshot, Transform } from '../../../types/scene'

const THROTTLE_MS = 33   // ~30fps
const ANGLE_STEP_DEG = 15

const CORNER_HANDLES: ReadonlySet<HandleId> = new Set(['nw', 'ne', 'sw', 'se'])
const EDGE_HANDLES:   ReadonlySet<HandleId> = new Set(['n', 's', 'e', 'w'])

const CORNER_FLIP: ReadonlySet<HandleId> = new Set(['ne', 'sw'])
const EDGE_HORIZ:  ReadonlySet<HandleId> = new Set(['e', 'w'])

function dispatchTransform(nodeId: string, partial: Partial<Transform>): void {
  sendToGame({ type: 'UPDATE_TRANSFORM', nodeId, transform: partial })
}

export function Gizmo() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const node = useSceneStore((s) => (selectedId === null ? undefined : s.byId(selectedId)))
  const svgRef = useRef<SVGSVGElement | null>(null)

  if (node === undefined || node.bounds === null) return null

  return (
    <svg ref={svgRef} className={styles.svg}>
      <MoveBox node={node} />
      <ScaleHandles node={node} />
      <RotateHandle node={node} />
    </svg>
  )
}

function MoveBox({ node }: { node: NodeSnapshot }) {
  const snapEnabled = useEditorStore((s) => s.snapEnabled)
  const gridSize = useEditorStore((s) => s.gridSize)
  const startRef = useRef<Transform | null>(null)
  const session = useDragSession({
    throttleMs: THROTTLE_MS,
    onMove: ({ dx, dy }) => apply(dx, dy, false),
    onCommit: ({ dx, dy }) => apply(dx, dy, true),
  })

  function apply(dx: number, dy: number, _final: boolean) {
    const start = startRef.current
    if (start === null) return
    let nx = start.x + dx
    let ny = start.y + dy
    if (snapEnabled) {
      const p = snapPoint({ x: nx, y: ny }, gridSize)
      nx = p.x
      ny = p.y
    }
    dispatchTransform(node.id, { x: nx, y: ny })
  }

  function onPointerDown(e: ReactPointerEvent<SVGRectElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = node.transform
    session.begin({ x: e.clientX, y: e.clientY })
  }

  function onPointerMove(e: ReactPointerEvent<SVGRectElement>) {
    session.move({ x: e.clientX, y: e.clientY })
  }

  function onPointerUp(e: ReactPointerEvent<SVGRectElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    session.commit({ x: e.clientX, y: e.clientY })
    startRef.current = null
  }

  if (node.bounds === null) return null
  const b = node.bounds
  return (
    <rect
      className={styles.box}
      x={b.x}
      y={b.y}
      width={b.width}
      height={b.height}
      aria-label="Move handle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { session.cancel(); startRef.current = null }}
    />
  )
}

function ScaleHandles({ node }: { node: NodeSnapshot }) {
  if (node.bounds === null) return null
  const handles = handlePositions(node.bounds).filter((h) => h.id !== 'rotate')
  const startRef = useRef<{ transform: Transform; bounds: NonNullable<NodeSnapshot['bounds']>; handleId: HandleId } | null>(null)

  function dispatchScaleFromHandle(info: DragInfo) {
    const start = startRef.current
    if (start === null) return
    const { transform, bounds, handleId } = start
    const isLeft = handleId === 'nw' || handleId === 'w' || handleId === 'sw'
    const isTop  = handleId === 'nw' || handleId === 'n' || handleId === 'ne'
    const isHorizOnly = handleId === 'e' || handleId === 'w'
    const isVertOnly  = handleId === 'n' || handleId === 's'
    const dx = info.dx * (isLeft ? -1 : 1)
    const dy = info.dy * (isTop  ? -1 : 1)
    const newW = isVertOnly  ? bounds.width  : Math.max(1, bounds.width  + dx)
    const newH = isHorizOnly ? bounds.height : Math.max(1, bounds.height + dy)
    const scaleX = transform.scaleX * (newW / bounds.width)
    const scaleY = transform.scaleY * (newH / bounds.height)
    dispatchTransform(node.id, { scaleX, scaleY })
  }

  return (
    <>
      {handles.map((h) => (
        <ScaleHandleRect
          key={h.id}
          x={h.x}
          y={h.y}
          handleId={h.id}
          onBegin={(p) => {
            startRef.current = { transform: node.transform, bounds: node.bounds!, handleId: h.id }
            return p
          }}
          onMove={dispatchScaleFromHandle}
          onCommit={dispatchScaleFromHandle}
          onClear={() => { startRef.current = null }}
        />
      ))}
    </>
  )
}

function ScaleHandleRect({
  x, y, handleId,
  onBegin, onMove, onCommit, onClear,
}: {
  x: number
  y: number
  handleId: HandleId
  onBegin: (p: Point) => Point
  onMove: (info: DragInfo) => void
  onCommit: (info: DragInfo) => void
  onClear: () => void
}) {
  const session = useDragSession({
    throttleMs: THROTTLE_MS,
    onMove,
    onCommit,
  })
  const SIZE = 8
  const cornerClass = CORNER_HANDLES.has(handleId) ? styles['handle-corner'] : styles['handle-edge']
  const horiz = EDGE_HORIZ.has(handleId) ? styles['h-horiz'] : ''
  const flip  = CORNER_FLIP.has(handleId) ? styles['h-flip'] : ''
  return (
    <rect
      className={`${styles.handle} ${cornerClass} ${horiz} ${flip}`}
      x={x - SIZE / 2}
      y={y - SIZE / 2}
      width={SIZE}
      height={SIZE}
      aria-label={`Scale handle ${handleId}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        session.begin(onBegin({ x: e.clientX, y: e.clientY }))
      }}
      onPointerMove={(e) => session.move({ x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        session.commit({ x: e.clientX, y: e.clientY })
        onClear()
      }}
      onPointerCancel={() => { session.cancel(); onClear() }}
    />
  )
}

function RotateHandle({ node }: { node: NodeSnapshot }) {
  const snapEnabled = useEditorStore((s) => s.snapEnabled)
  const startRef = useRef<{ transform: Transform; centerX: number; centerY: number; startAngle: number } | null>(null)

  function apply(at: Point) {
    const start = startRef.current
    if (start === null) return
    const angle = Math.atan2(at.y - start.centerY, at.x - start.centerX) * (180 / Math.PI)
    let delta = angle - start.startAngle
    let next = start.transform.rotation + delta
    if (snapEnabled) next = snapAngle(next, ANGLE_STEP_DEG)
    dispatchTransform(node.id, { rotation: next })
  }

  const session = useDragSession({
    throttleMs: THROTTLE_MS,
    onMove: ({ to }) => apply(to),
    onCommit: ({ to }) => apply(to),
  })

  if (node.bounds === null) return null
  const handles = handlePositions(node.bounds)
  const rotate = handles.find((h) => h.id === 'rotate')!
  const top = handles.find((h) => h.id === 'n')!
  const centerX = node.bounds.x + node.bounds.width / 2
  const centerY = node.bounds.y + node.bounds.height / 2

  function onPointerDown(e: ReactPointerEvent<SVGCircleElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI)
    startRef.current = { transform: node.transform, centerX, centerY, startAngle }
    session.begin({ x: e.clientX, y: e.clientY })
  }

  return (
    <g aria-label="Rotate handle group">
      <line className={styles['rotate-line']} x1={top.x} y1={top.y} x2={rotate.x} y2={rotate.y} />
      <circle
        className={styles['rotate-handle']}
        cx={rotate.x}
        cy={rotate.y}
        r={5}
        aria-label="Rotate handle"
        onPointerDown={onPointerDown}
        onPointerMove={(e) => session.move({ x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          session.commit({ x: e.clientX, y: e.clientY })
          startRef.current = null
        }}
        onPointerCancel={() => { session.cancel(); startRef.current = null }}
      />
    </g>
  )
}
```

NOTE: `_final: boolean` parameter on `apply` inside `MoveBox` is named with underscore prefix to satisfy `noUnusedParameters`. The unused parameter is kept so the signature documents the intent (could be useful for final-only behavior like history entries later).

- [ ] **Step 3: Write `Gizmo.test.tsx`**

```tsx
import { describe, expect, test, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { NodeSnapshot } from '../../../types/scene'
import { useSceneStore } from '../../../stores/sceneStore'
import { useEditorStore } from '../../../stores/editorStore'
import { setActiveBridgeClient } from '../../../bridge'
import { Gizmo } from './Gizmo'

const sample: NodeSnapshot = {
  id: 'p',
  kind: 'sprite',
  name: 'P',
  parentId: null,
  childIds: [],
  transform: { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 },
  bounds: { x: 100, y: 200, width: 80, height: 40 },
  schema: [],
  values: {},
}

describe('Gizmo', () => {
  beforeEach(() => {
    useSceneStore.getState().reset()
    useEditorStore.getState().reset()
    setActiveBridgeClient(null)
  })

  test('renders nothing when no selection', () => {
    const { container } = render(<Gizmo />)
    expect(container.querySelector('svg')).toBeNull()
  })

  test('renders nothing when selected node has null bounds', () => {
    useSceneStore.getState().setTree([{ ...sample, bounds: null }])
    useEditorStore.getState().select('p')
    const { container } = render(<Gizmo />)
    expect(container.querySelector('svg')).toBeNull()
  })

  test('renders selection box + 8 scale handles + rotate handle when bounds are present', () => {
    useSceneStore.getState().setTree([sample])
    useEditorStore.getState().select('p')
    const { container } = render(<Gizmo />)
    expect(container.querySelector('rect[aria-label="Move handle"]')).toBeTruthy()
    const scaleHandles = container.querySelectorAll('rect[aria-label^="Scale handle"]')
    expect(scaleHandles).toHaveLength(8)
    expect(container.querySelector('circle[aria-label="Rotate handle"]')).toBeTruthy()
  })
})
```

- [ ] **Step 4: Tests pass**

`npm run test:run -- src/ui/canvas/gizmo/`

- [ ] **Step 5: Lint + typecheck**

If typecheck complains about `_final`, prefix it with underscore so the noUnusedParameters check accepts it.

- [ ] **Step 6: Commit**

```
git add src/ui/canvas/gizmo/Gizmo.tsx src/ui/canvas/gizmo/Gizmo.module.css src/ui/canvas/gizmo/Gizmo.test.tsx
git commit -m "gizmo: SVG selection box + scale + rotate handles wired to bridge"
```

---

### Task 6: Canvas toolbar with snap toggle

A small toolbar that lives at the top of the canvas area with a snap on/off toggle and the grid size readout.

**Files:**
- Create: `src/ui/canvas/CanvasToolbar.tsx`
- Create: `src/ui/canvas/CanvasToolbar.module.css`
- Create: `src/ui/canvas/CanvasToolbar.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import { useEditorStore } from '../../stores/editorStore'
import { CanvasToolbar } from './CanvasToolbar'

describe('CanvasToolbar', () => {
  beforeEach(() => { useEditorStore.getState().reset() })

  test('renders snap toggle (off by default)', () => {
    render(<CanvasToolbar />)
    const btn = screen.getByRole('button', { name: /snap/i })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  test('toggling updates editorStore', () => {
    render(<CanvasToolbar />)
    const btn = screen.getByRole('button', { name: /snap/i })
    fireEvent.click(btn)
    expect(useEditorStore.getState().snapEnabled).toBe(true)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(btn)
    expect(useEditorStore.getState().snapEnabled).toBe(false)
  })

  test('shows the current grid size', () => {
    render(<CanvasToolbar />)
    expect(screen.getByText(/grid: 32/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `CanvasToolbar.module.css`**

```css
.bar {
  position: absolute;
  top: var(--sp-2);
  left: var(--sp-2);
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  z-index: 2;
  padding: 4px var(--sp-2);
  background: var(--glass-2);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  font-size: var(--fs-chrome);
  color: var(--text-secondary);
}
.toggle {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  padding: 2px var(--sp-2);
  font-size: var(--fs-chrome);
  color: var(--text-secondary);
  cursor: pointer;
}
.toggle[aria-pressed="true"] {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: rgba(167, 139, 250, 0.30);
}
.grid-label {
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}
```

- [ ] **Step 4: Write `CanvasToolbar.tsx`**

```tsx
import styles from './CanvasToolbar.module.css'
import { useEditorStore } from '../../stores/editorStore'

export function CanvasToolbar() {
  const snapEnabled = useEditorStore((s) => s.snapEnabled)
  const gridSize = useEditorStore((s) => s.gridSize)
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled)

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.toggle}
        aria-pressed={snapEnabled}
        onClick={() => setSnapEnabled(!snapEnabled)}
      >
        ◇ Snap
      </button>
      <span className={styles['grid-label']}>Grid: {gridSize}px</span>
    </div>
  )
}
```

- [ ] **Step 5: Tests pass + lint + typecheck**

- [ ] **Step 6: Commit**

```
git add src/ui/canvas/CanvasToolbar.tsx src/ui/canvas/CanvasToolbar.module.css src/ui/canvas/CanvasToolbar.test.tsx
git commit -m "canvas: toolbar with snap toggle"
```

---

### Task 7: Mount gizmo and toolbar inside CanvasPanel

**Files:**
- Modify: `src/ui/panels/CanvasPanel.tsx`
- Modify: `src/ui/panels/CanvasPanel.module.css`

- [ ] **Step 1: Read existing `CanvasPanel.tsx` and `CanvasPanel.module.css`**

- [ ] **Step 2: Update `CanvasPanel.tsx`**

Add imports at top:

```tsx
import { CanvasToolbar } from '../canvas/CanvasToolbar'
import { Gizmo } from '../canvas/gizmo/Gizmo'
```

In the JSX, inside the `<div className={styles.wrap}>`, render `<CanvasToolbar />` near the top and render `<Gizmo />` inside the overlay or as its own absolutely-positioned layer on top of the iframe but BELOW the overlay's click handler — actually, the gizmo needs `pointer-events: auto` on its own elements so it can capture pointer events.

The challenge: the existing transparent overlay (`<div className={styles.overlay}>` with `onClick={handleOverlayClick}`) intercepts clicks for PICK_AT. The gizmo needs to sit ABOVE that overlay AND capture pointer-down on its handles. We solve this by:
- Keeping the click-capture overlay at z-index 1
- Putting gizmo at z-index 2
- Gizmo SVG has `pointer-events: none` by default, with `pointer-events: auto` only on the handle elements

This way clicks that miss the gizmo handles fall through (the overlay still captures them for PICK_AT), and clicks on handles drive the drag.

Final return JSX:

```tsx
return (
  <div className={styles.wrap}>
    <iframe ref={iframeRef} className={styles.iframe} src={gameUrl} title="Game" />
    <div
      ref={overlayRef}
      className={styles.overlay}
      data-tool="select"
      onClick={handleOverlayClick}
      aria-label="Canvas overlay"
    />
    <Gizmo />
    <CanvasToolbar />
    <div className={styles.badge} data-status={status}>
      {status === 'connected' ? '● Connected' :
       status === 'connecting' ? '○ Connecting' :
       status === 'error' ? '● Error' : '○ Disconnected'}
    </div>
  </div>
)
```

- [ ] **Step 3: Update `CanvasPanel.module.css`**

Make sure the gizmo SVG can grow above the overlay. Add at the bottom of the file (Gizmo.module.css already sets position:absolute inset:0 + z-index isn't set, so we want it above .overlay). Set z-index on overlay so gizmo (z-index auto in stacking context) sits above:

Modify the `.overlay` rule to ensure it's z-index 1 (already is per Plan 1). Then add wrap stacking context:

Add to `.wrap`:
```css
.wrap { isolation: isolate; }
```

This creates a stacking context so the gizmo SVG can be positioned absolutely on top.

Actually the existing `.overlay { z-index: 1 }` and a new rule for the gizmo SVG explicitly:

The Gizmo's own CSS (`Gizmo.module.css`) sets `.svg { position: absolute; inset: 0; }` but no z-index. Add `z-index: 2` to the existing `.svg` rule in `Gizmo.module.css` so it sits above the overlay.

If you've already written Gizmo.module.css in Task 5, edit it to add `z-index: 2` to the `.svg` rule.

- [ ] **Step 4: Run all tests**

`npm run test:run`

- [ ] **Step 5: Lint + typecheck**

- [ ] **Step 6: Commit**

```
git add src/ui/panels/CanvasPanel.tsx src/ui/panels/CanvasPanel.module.css src/ui/canvas/gizmo/Gizmo.module.css
git commit -m "canvas: mount Gizmo + CanvasToolbar inside CanvasPanel"
```

---

### Task 8: Browser smoke test

Verify the gizmo works in a real browser against the test game.

**Files:**
- Create: `docs/superpowers/plans/2026-05-25-plan-3-smoke-test-results.md`

This task is driven by the controller (Playwright MCP), not a subagent.

Steps the controller performs:
1. `npm run build:bridge`
2. `npm run dev` in background, capture port
3. Open the editor
4. Click "Player" in Scene Tree → verify gizmo appears around Player (purple outline + 8 squares + circle above)
5. Programmatically dispatch a pointer-drag sequence on the move box (mouse down at center, move +50,+30, mouse up) → verify the Player rectangle in the iframe moved
6. Programmatically drag the SE scale handle by +20,+20 → verify the Player rectangle's transform scale changed (or width, depending on game)
7. Programmatically drag the rotate handle by ~45° around center → verify rotation
8. Click the Snap toggle → drag → verify position quantizes to 32px multiples
9. Document results in the smoke-test file
10. Commit + kill dev server

The visual gizmo presence + selection-box outline is the minimum bar; full drag exercise is best-effort because synthesized pointer events on SVG in Playwright can be finicky.

- [ ] **Step 1: Run smoke test (controller drives)**

- [ ] **Step 2: Write `docs/superpowers/plans/2026-05-25-plan-3-smoke-test-results.md`**

- [ ] **Step 3: Commit**

```
git add docs/superpowers/plans/2026-05-25-plan-3-smoke-test-results.md
git commit -m "docs: Plan 3 smoke test results"
```

---

### Task 9: Final checks

- [ ] `npm run lint` PASS
- [ ] `npm run typecheck` PASS
- [ ] `npm run test:run` PASS (all tests; expect ~85+ now)
- [ ] `npm run build` PASS

Then use `finishing-a-development-branch` skill to merge to main.

---

## Not in Plan 3

- JSON patch write-back to disk → Plan 4 (still needs real Spine project + balance-type build for testing)
- Per-axis lock (Shift constrains to one axis) — easy follow-up
- Aspect-ratio preservation on corner drag (Shift) — easy follow-up
- Visible grid drawing — easy follow-up
- Multi-select / box-select → later

## Self-review

- **Spec coverage:** Plan 3 implements §5.2 step 5 (designer drags handle in canvas → live transform update) and §8.5 interaction model (gizmo handles + snap).
- **Type consistency:** `HandleId`, `Transform`, `Bounds`, `Point`, `DragInfo` consistent across files.
- **Placeholder scan:** No TODOs in code, every step has concrete code.
- **Scope:** Three operations (move, scale, rotate) + snap. Roughly 8-9 tasks. JSON write-back deliberately out.
