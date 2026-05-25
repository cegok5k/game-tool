# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A drag-and-drop 2D game editor for the studio's in-house `jst`/`knox`/`knoxslot` framework (slot games). The editor uses the **live running game** (loaded in an `<iframe>`) as its canvas — designers click elements in the live game, drag them with gizmos, and changes are written back to Spine JSON on disk. The existing `gulp`+`jsbuild` pipeline picks up the JSON unchanged.

**Spec:** `docs/superpowers/specs/2026-05-25-game-editor-design.md`
**Plans:** `docs/superpowers/plans/` (Plan 1 = MVP read-only edit loop, merged; Plans 2-6 cover write-back, assets, config+launcher, AI Studio, polish)

## Stack

TypeScript + React 19 + Vite 6 + Zustand 5 + mitt 3. Vitest + Testing Library for tests. ESLint 9 flat config + typescript-eslint.

## Commands

| | |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b && vite build` — build **fails on type errors** because the build runs the project-references typecheck first |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Single-run Vitest (use this in CI / when you just want a pass/fail) |
| `npm run test:run -- src/App.test.tsx` | Run a single test file |
| `npm run test:run -- -t "renders heading"` | Run tests matching a name |
| `npm run lint` | ESLint over the whole project |
| `npm run typecheck` | `tsc -b --noEmit` — typecheck without building, respects project references |
| `npm run build:bridge` | Bundle `src/bridge/index.ts` to `public/bridge/bridge.js` as an IIFE (`window.GameToolBridge`) for `<script>`-tag inclusion in test/legacy games |

## Architecture notes worth knowing up-front

- **TypeScript is split into project references** (`tsconfig.app.json` for `src/`, `tsconfig.node.json` for `vite.config.ts`). The root `tsconfig.json` only references them — don't add `compilerOptions` there. Editing options for app code goes in `tsconfig.app.json`.
- **Strict TS config**: `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `noUncheckedSideEffectImports` are all on. Because of `verbatimModuleSyntax`, type-only imports must use `import type { Foo } from '...'` — a plain `import { Foo }` of a type-only symbol will fail to build.
- **Vitest config is split out into `vitest.config.ts`** (not the `test` block in `vite.config.ts`). The split exists because `vitest/config` ships its own bundled `vite` types — colocating them with the app's `vite` plugins causes a duplicate-types conflict at typecheck time. **Do not put `@vitejs/plugin-react` (or any other top-level Vite plugin) inside `vitest.config.ts`** for the same reason — Vitest already handles JSX/TS transforms internally. Test setup is `src/test/setup.ts` and registers `@testing-library/jest-dom/vitest` matchers. Tests run in `jsdom`. `globals: true` means `test` / `expect` are ambient — types for them come from the `vitest/globals` and `@testing-library/jest-dom` entries in `tsconfig.app.json#compilerOptions.types`. If you add another globals package, add it there too or editors will red-squiggle valid code.
- **ESLint is flat config** (`eslint.config.js`, ESM). React Hooks and React Refresh plugins are wired in; if you add new lint plugins, they go in the same `tseslint.config(...)` call.
- **React 19 + StrictMode** in `src/main.tsx` — effects will double-fire in dev, which is intentional. Don't "fix" that by removing StrictMode; fix the effect.

## Architecture (after Plan 1)

**Layering** (strict one-way deps):
```
types  →  platform / bus / bridge protocol  →  bridge sdk + client  →  stores  →  ui
```

**Key modules:**

- `src/types/` — pure type definitions (`platform`, `capabilities`, `scene`, `bridge`). No runtime code.
- `src/platform/` — `PlatformAdapter` interface (`fs`, `env`, `shell`, `dialog`) and a browser implementation using File System Access API. Designed as a single seam so an Electron/Tauri wrapper can be added later without touching UI code. Import via `getPlatform()`.
- `src/bus/` — typed `EditorEvent` union and a `createEventBus()` factory (wraps `mitt`). Used for cross-store side-effects that shouldn't couple stores directly. Currently scaffolded but unused (wired up in later plans).
- `src/bridge/`
  - `protocol.ts` — `wrap`/`unwrap` helpers and the `__gameTool: 'bridge', v: 1, payload: ...` envelope shape
  - `sdk.ts` — **game side** of the bridge. Imported by games via `<script src="/bridge/bridge.js">` → `GameToolBridge.createBridge()`. The game calls `bridge.connect({...})` and `bridge.register({...})` to expose entities. Uses a module-level `_activeBridge` singleton so jsdom (shared window across tests) doesn't accumulate listeners.
  - `client.ts` — **editor side**. `createBridgeClient({ iframe, onMessage })` sends `EditorMessage`s and routes incoming `GameMessage`s. Used by `CanvasPanel`.
- `src/stores/` — Zustand stores, one per domain. **They never import each other.** Cross-domain effects go through the event bus.
  - `projectStore` — open folder + game URL
  - `bridgeStore` — connection status (disconnected/connecting/connected/error), capabilities, `hasCapability(...)`
  - `sceneStore` — live node tree + O(1) index by id. `setTree` / `upsertNode` / `byId`.
  - `editorStore` — UI state (`selectedId`, `activeBottomTab`)
- `src/ui/` — React components organized by panel. `Shell.tsx` is the four-zone grid; each panel is a directory with `*.tsx`, `*.module.css`, `*.test.tsx`. Theme tokens live in `src/ui/theme.css`.
- `public/test-game/` — a minimal HTML+JS game that consumes the bundled bridge SDK. Useful for smoke-testing the editor without spinning up a real game.

**The edit loop (Plan 1 = read-only):**
1. CanvasPanel mounts iframe at `projectStore.gameUrl` → calls `markConnecting()`
2. Game's `bridge.connect()` posts `GAME_READY` → CanvasPanel's `BridgeClient` routes it → `markConnected()` → sends `REQUEST_TREE`
3. Bridge SDK responds with `NODE_TREE` → `sceneStore.setTree(...)` → SceneTreePanel renders
4. User clicks tree row → `editorStore.select(id)` → second `useEffect` sends `SELECT_NODE` to game → bridge responds with `NODE_SELECTED` (game-side confirmation)
5. User clicks the canvas overlay (transparent div on top of iframe) → `PICK_AT(x, y)` → bridge hit-tests against registered bounds → returns `NODE_SELECTED` → editor updates selection
6. The `skipNextSelectionPush` ref in `CanvasPanel` prevents echo loops when selection arrives FROM the bridge

**The bridge SDK is published as both ES module (for the editor) and IIFE bundle (for `<script>` inclusion).** `vite.bridge.config.ts` builds the IIFE bundle to `public/bridge/bridge.js`. The bundle is gitignored — run `npm run build:bridge` before running the test game.

## Environment variables (AI keys, etc.)

The AI Studio (`src/ui/panels/AIStudioPanel.tsx`) checks `getPlatform().env.has('GOOGLE_GENAI_API_KEY')` to decide if Imagen generation is available. The Settings tab shows green/red indicators for each AI provider key.

**To wire a key for local dev:**
1. Copy `.env.local.example` to `.env.local` (already gitignored as `*.local`).
2. Add `VITE_GOOGLE_GENAI_API_KEY=your-key-here`.
3. Restart `npm run dev`.

The browser platform's `createBrowserPlatform()` reads `import.meta.env` and **strips the `VITE_` prefix** so the rest of the app uses canonical names. See `stripVitePrefix` in `src/platform/browser.ts`.

**SECURITY:** `VITE_`-prefixed values are inlined into the production bundle and visible to anyone who downloads the JS. Only use this for local-dev keys or keys you intentionally want to ship. For an Electron/Tauri build, the desktop platform adapter should read from `process.env` instead.

## Conventions

- Named exports for components (`export function App()` in `src/App.tsx`) rather than default exports — keeps refactors and grep'ing straightforward. Stick to this unless a library forces a default export.
- Co-locate tests next to source (`App.tsx` + `App.test.tsx`), not a parallel `__tests__` tree.
- CSS Modules per component (`Component.module.css`). Theme tokens (`--accent`, `--glass-1`, etc.) live in `src/ui/theme.css` — use them, don't hardcode hex values.
- Strict TypeScript: `verbatimModuleSyntax` means **type-only imports must use `import type`**. Forgetting this is the most common build break in the project.
