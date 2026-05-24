# Plan 1 smoke test — results

Automated browser smoke test verified on **2026-05-25** using Playwright MCP against `http://localhost:5175/` (Vite dev server) with Chromium.

## Checklist

- [x] **Editor loads with 4-zone layout** — Menu Bar, Scene Tree, Canvas, Inspector, and Bottom Tabs all rendered with the Glass/Aurora theme.
- [x] **Bridge connects within ~1s** — Canvas badge transitioned from "● Disconnected" to "● Connected" (green) after the iframe game.js executed `bridge.connect()`.
- [x] **Scene Tree lists Player / Enemy / Pickup** — All three registered entities appear in the tree after `REQUEST_TREE` → `NODE_TREE` roundtrip.
- [x] **Tree click → Inspector populates** — Clicking "Player" in the tree highlights it (data-selected="true") and the Inspector shows: title "Player", Transform Position 200/200, Rotation 0, Scale 1×1, Properties Health 100, Speed 180, all inputs disabled (read-only).
- [x] **Game click (PICK_AT) → tree highlight + Inspector update** — Dispatching a click event on the canvas overlay at coordinates (240, 240) — Player's center in game space — caused the bridge to PICK_AT the player, return NODE_SELECTED, and the editor to update both the tree highlight and the Inspector.
- [x] **Empty-area click clears selection** — Clicking the overlay at (50, 50) where no entity exists triggered NODE_SELECTED with `node: null`, clearing the tree highlight and returning the Inspector to "No selection".

## Known minor cosmetic note (deferred to Plan 2)

The test game's `game.js` listens for `NODE_SELECTED` to draw a purple outline around the selected entity *inside the iframe*. The bridge SDK posts `NODE_SELECTED` to `window.parent` (the editor) rather than dispatching it locally inside the iframe, so the rectangles inside the test game don't currently get outlined when the editor selects them. The **editor-side flow is correct** — only the test game's in-iframe visual feedback is missing. The bridge SDK's `register(...)` callback could be used by the test game to track selection state in a future iteration. Not blocking Plan 1.

## Coverage gap (deferred)

A real browser drag interaction (clicking and dragging a gizmo handle to move an entity) is not exercised — gizmos and write-back are Plan 2.

## Environment

- Vite v6.4.2 dev server on port 5175 (5173 and 5174 were in use)
- Bridge bundle built fresh: `public/bridge/bridge.js` (2.74 kB)
- Browser: Playwright Chromium (via plugin:playwright MCP)
- One known harmless console error: `favicon.ico` 404 (no favicon shipped in Plan 1)
