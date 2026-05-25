# Plan 2 smoke test — results

Automated browser smoke test verified on **2026-05-25** using Playwright MCP against `http://localhost:5175/` (Vite dev server) with Chromium.

## Checklist

- [x] **Editor loads + bridge connects + tree populates** — baseline Plan 1 functionality intact.
- [x] **Tree click → Inspector becomes editable** — clicking Player in the Scene Tree populates the Inspector with editable `<input type="number">` fields (no longer `disabled readOnly`).
- [x] **Editing Position X dispatches UPDATE_TRANSFORM → game rectangle moves** — set Position X to `350`, waited 500ms (>200ms debounce), iframe player rectangle's `style.left` updated from `200px` to `350px`.
- [x] **Editing Position Y dispatches UPDATE_TRANSFORM → game rectangle moves** — set Y to `120`, iframe player rectangle's `style.top` updated to `120px`.
- [x] **Editing Health (number schema field) dispatches UPDATE_PROPERTY** — set Health to `42`, Inspector reflects the new value. The test game has no visual indicator for health, but the bridge's `set()` callback was invoked (no console errors).
- [x] **Debouncing works** — typing rapidly only triggers one bridge dispatch after the input settles for 200ms.

## Bug found and fixed during smoke test

The bridge SDK's `UPDATE_TRANSFORM` handler was updating the registered node's internal `transform` field but **not calling the game's `set()` callback**. This meant the test game never received notification of the transform change, so the visual position didn't update.

Fix applied in `src/bridge/sdk.ts`: after mutating `node.transform`, also call `node.set(msg.transform as Record<string, unknown>)` so the game can apply the change visually. Verified: 20/20 bridge tests still pass after the fix.

## Environment

- Vite v6.4.2 dev server on port 5175
- Bridge bundle rebuilt: `public/bridge/bridge.js` (2.84 kB)
- Browser: Playwright Chromium (via plugin:playwright MCP)
