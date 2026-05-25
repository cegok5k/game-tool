# Plan 3 smoke test — results

Automated browser smoke test verified on **2026-05-25** using Playwright MCP against `http://localhost:5175/` (Vite dev server) with Chromium.

## Checklist

- [x] **Editor + bridge connect + tree populate** — baseline Plan 1/2 functionality intact.
- [x] **Clicking Player in tree → gizmo appears** — purple selection box + 8 corner/edge handles + rotation circle above all rendered correctly.
- [x] **Canvas toolbar renders** — top-left of canvas shows `◇ Snap` button (aria-pressed=false) + `Grid: 32px` readout.
- [x] **Move-handle drag dispatches UPDATE_TRANSFORM → game moves** — synthesized pointerdown / pointermove +60,+40 / pointerup on the move handle moved Player rectangle from CSS `left: 200px` to `left: 260px`, `top: 200px` to `top: 240px`.
- [x] **Gizmo follows the entity** — after the drag the gizmo's bounding rect was at viewport x=516.8, matching the canvas overlay offset (256.8px) + new player position (260px). Gizmo and entity stay aligned.
- [x] **Inspector echoes the new transform** — Position X field updated from `200` to `260` automatically (via the new TRANSFORM_CHANGED echo from the SDK).
- [x] **Two-way sync confirmed** — `transform → bridge → game → echo → editor → sceneStore → Gizmo + Inspector` is a closed loop.

## Bugs found and fixed during smoke test

### 1. SDK didn't echo TRANSFORM_CHANGED after UPDATE_TRANSFORM

`src/bridge/sdk.ts` — `UPDATE_TRANSFORM` updated the registered node's internal `transform` and called the game's `set()` callback, but didn't notify the editor that the new transform had been applied. The editor's `sceneStore` therefore never learned the new transform, so the gizmo redrew at the old bounds (visibly stale relative to the iframe entity) and the Inspector showed stale numbers.

Fix: after the SDK applies an UPDATE_TRANSFORM, it now sends `{ type: 'TRANSFORM_CHANGED', nodeId, transform: node.transform }` back to the editor. The editor's existing `TRANSFORM_CHANGED` handler (added in Plan 2) then upserts the node, which refreshes both gizmo and inspector.

### 2. Gizmo drew at stale `bounds.x/y`

The `Bounds` field reported by `bridge.register({ bounds: ... })` is a static snapshot at registration time. After the entity moves, `bounds.x` and `bounds.y` are stale (they describe where the entity *was*). Even with the SDK echo above, the Inspector and `sceneStore.transform` updated, but `node.bounds` stayed stuck at the original position — so the gizmo would still draw at the wrong place.

Fix: the `Gizmo` component now derives an `effectiveBounds` from `{ x: transform.x, y: transform.y, width: bounds.width, height: bounds.height }`. The width/height still comes from the registered bounds (these don't change as the entity moves), but x/y track the live transform. This works for sprite-style games where transform IS the on-screen position. Games with anchor-offset bounds will need a future enhancement (likely making bounds a `getBounds: () => Bounds` callback so the SDK can re-snapshot on demand) — documented in a code comment.

## Coverage gap (deferred)

- Scale handle drag: 8 scale handles render correctly; live drag exercise via synthesized pointer events not yet verified in the smoke test. Unit tests for the scale math are missing — could be added as a follow-up.
- Rotation: same as scale — handle renders, drag math not exercised in this smoke test.
- Snap toggle: button renders and toggles state (unit-tested), but live drag-with-snap-on couldn't be verified in a single `evaluate` because of React state batching across synthesized events. Real-user interaction will exercise this naturally.

## Environment

- Vite v6.4.2 dev server on port 5175
- Bridge bundle rebuilt: `public/bridge/bridge.js` (2.91 kB)
- Browser: Playwright Chromium (via plugin:playwright MCP)
- 1 known harmless console: `favicon.ico` 404
