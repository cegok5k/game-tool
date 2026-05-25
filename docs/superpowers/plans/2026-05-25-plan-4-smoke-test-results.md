# Plan 4 smoke test — results

Automated browser smoke test verified on **2026-05-25** using Playwright MCP against `http://localhost:5175/` (Vite dev server) with Chromium.

## Checklist

- [x] **Editor loads + Console tab is default-active** — baseline functionality intact.
- [x] **Test game emits a LOG on connect** — `public/test-game/game.js` now calls `bridge.notifyLog('info', 'TestGame connected with 3 entities')` right after `bridge.connect(...)`.
- [x] **Bridge LOG → CanvasPanel → consoleStore → ConsolePanel** — verified end-to-end.
- [x] **Log entry rendered** — DOM contains a `[data-level="info"]` row with text `10:20:50infoTestGame connected with 3 entities` (timestamp + level + message).
- [x] **Visual layout** — Glass/Aurora theme intact. Toolbar shows info/warn/error filter pills + entry counter + Clear button.

## Environment

- Vite v6.4.2 dev server on port 5175
- Bridge bundle rebuilt: `public/bridge/bridge.js` (2.96 kB)
- Browser: Playwright Chromium (via plugin:playwright MCP)
- 1 known harmless console: `favicon.ico` 404
