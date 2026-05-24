# Game Editor — Design Spec

**Date:** 2026-05-25
**Status:** Approved design, ready for implementation planning
**Project:** game-tool

---

## 1. Purpose

Build a drag-and-drop 2D game editor (web app first, desktop app later) for a studio that builds 2D slot games on an in-house `jst` / `knox` / `knoxslot` framework. The editor uses the **live running game as its canvas** — designers click on elements in the running game, drag them to reposition, and changes flow back into Spine JSON files on disk.

The existing build pipeline (gulp + jsbuild + Spine binary compilation) is untouched. The editor sits *next to* the existing toolchain, not inside it.

## 2. Goals

- **One editor for every studio game.** Capability-driven so new game variants plug in without forking the editor.
- **No new authoring format.** The editor reads and writes the files the build already understands (Spine JSON, config JSON).
- **Live preview is the default.** What you see in the iframe is what you're editing.
- **AI-first asset workflow.** Imagen 2, Veo 3, Seedance integration for generating and replacing assets in place.
- **Future-proof for desktop.** Platform abstraction layer means Electron/Tauri wrapping later is a swap, not a rewrite.

## 3. Non-goals

- A general-purpose 2D engine. The editor doesn't render the scene itself.
- A 3D editor. 2D only.
- A scripting environment. Game code stays in the existing repos.
- A cloud-first product. Local-first; cloud sync is explicitly deferred.
- A drop-in replacement for the Spine editor. The Spine editor remains the source of truth for skeletal animation authoring; this editor lays out and tweaks scenes built from existing skeletons.

## 4. Users and primary scenarios

- **Game designer** opens a project, hits Run, sees the game live in the canvas, clicks the spinner to nudge its position by 4 pixels, saves. The Spine JSON updates on disk and the next gulp build picks it up.
- **Artist** generates a new background sprite via AI Studio (Imagen 2 prompt), drops the result onto the existing background attachment in the inspector. The new image replaces the old in the project's `media/graphics/` folder.
- **Game producer** opens the project, switches balance type from rhodium to natrium via the launcher dropdown, plays through the variant. No URL editing.
- **Developer** adds `bridge.connect()` to a new game's entry point. The editor immediately knows the game's node tree without any other configuration.

## 5. Architecture

### 5.1 Component map

```
┌──────────────────┐      ┌─────────────────┐      ┌──────────────────┐
│ Editor (React)   │ ⇄    │ Bridge SDK      │ ⇄    │ Game (jst/etc)   │
│ - Panels         │ post │ @game-tool/     │ post │ - WebGL/WebGPU   │
│ - Domain stores  │ Msg  │ bridge          │ Msg  │ - Spine          │
│ - Event bus      │      │ - Wraps         │      │ - NodeDebug      │
│ - SVG gizmos     │      │   NodeDebug     │      │   Interface      │
│                  │      │ - postMessage   │      │ - Runs in iframe │
└────────┬─────────┘      └─────────────────┘      └──────────────────┘
         │
         │ via PlatformAdapter
         ▼
┌──────────────────┐
│ Disk             │
│ - Spine JSONs    │
│ - Config JSONs   │
│ - Spritesheets   │
│ - Audio          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Existing gulp /  │
│ jsbuild pipeline │
│ (untouched)      │
└──────────────────┘
```

### 5.2 The edit loop

1. Designer clicks element in game iframe
2. Editor intercepts overlay click → sends `PICK_AT(x, y)` via postMessage
3. Bridge hit-tests via `NodeDebugInterface.getNodeAt(x, y)` → resolves Spine skeleton + bone if relevant
4. Bridge reports `NODE_SELECTED { nodeId, capabilities, transform, bounds, schema }` to editor
5. Editor draws SVG gizmo handles over iframe using reported worldX/Y + bounds
6. Designer drags handle / edits inspector field → editor sends `UPDATE_TRANSFORM` or `UPDATE_PROPERTY`
7. Bridge applies change live in game (instant visual feedback in iframe)
8. Editor writes diff to relevant Spine JSON on disk via `PlatformAdapter.fs.patchJson(...)`
9. Existing pipeline compiles JSON → Spine binary on next build

### 5.3 Capability declaration

The bridge's `GAME_READY` message declares what the game supports. The editor enables/disables panels and inspector sections per capability.

```ts
type Capability =
  | 'spine'              // Spine skeletons; enables bone-level editing
  | 'jst-nodes'          // jst node tree; enables Scene Tree
  | 'node-debug'         // NodeDebugInterface present; enables live inspection
  | 'config-files'       // Game has JSON config files at declared paths
  | 'hot-reload'         // Game supports live property updates
  | 'balance-types'      // Game declares balance type variants
  | 'webgl' | 'webgpu' | 'canvas2d'  // Render API (informational)

interface GameReady {
  type: 'GAME_READY'
  gameName: string
  capabilities: Capability[]
  metadata?: {
    balanceTypes?: string[]
    configFiles?: string[]
    spineSkeletons?: string[]
  }
}
```

Spine and jst are not assumed by the editor — they're capabilities like any other. A future game on a different stack just declares different capabilities.

## 6. Domain model

### 6.1 Stores (Zustand, one per domain)

| Store | Owns |
|---|---|
| `projectStore` | Open project root, `jsbuildconfig.json`, `supports.json`, file watcher state |
| `bridgeStore` | postMessage channel, connection state, last `GAME_READY` capabilities |
| `sceneStore` | Live node tree snapshot from bridge, selection ID(s) |
| `assetStore` | Asset file index, previews, AI-generated drafts |
| `configStore` | Loaded game JSON configs, dirty/saved state |
| `editorStore` | UI state — panel sizes, active bottom tab, tool mode (select/move/rotate) |
| `settingsStore` | Editor-level preferences (theme variant, hotkeys, AI key presence) |

### 6.2 Event bus

Typed event bus for cross-domain side-effects. Stores never import each other; they communicate through events.

```ts
type Event =
  | { type: 'asset:deleted', path: string }       // → sceneStore removes refs, configStore validates
  | { type: 'asset:generated', path: string }     // → assetStore re-indexes, AI panel notifies
  | { type: 'bridge:connected' }                  // → sceneStore requests tree, configStore loads
  | { type: 'bridge:node-selected', nodeId }      // → editorStore updates selection, inspector shows
  | { type: 'spine-json:patched', path }          // → bridge sends reload signal
  | { type: 'config:saved', path }                // → bridge requests reload
```

### 6.3 PlatformAdapter

Abstracts native operations behind interfaces. Browser implementations ship first; desktop implementations later.

```ts
interface PlatformAdapter {
  fs: {
    openFolder(): Promise<FolderHandle>
    readFile(path: string): Promise<Uint8Array>
    writeFile(path: string, data: Uint8Array): Promise<void>
    patchJson(path: string, patch: JsonPatch): Promise<void>
    watch(path: string, onChange: (e: ChangeEvent) => void): () => void
  }
  env: {
    get(key: string): string | undefined
    has(key: string): boolean
  }
  shell: {
    spawn?(cmd: string, args: string[]): Promise<ProcessHandle>   // optional; browser stub
    openExternal(url: string): Promise<void>
  }
  dialog: {
    openFile(filters?: FileFilter[]): Promise<string | null>
    saveFile(suggestion?: string): Promise<string | null>
  }
}
```

Browser implementation uses File System Access API for `fs`, settings panel for `env`, no-op stub for `shell.spawn`. Desktop implementation (later) uses Node.js or Tauri equivalents.

## 7. Bridge SDK (`@game-tool/bridge`)

### 7.1 What it is

A ~300-line zero-dep TypeScript module game developers install as a **dev dependency**. They call `bridge.connect()` once in their game's entry point. Everything else is automatic via the existing `NodeDebugInterface` (where present).

### 7.2 API (game-facing)

```ts
import { bridge } from '@game-tool/bridge'

bridge.connect({
  gameName: 'BigBait',
  capabilities: ['spine', 'jst-nodes', 'node-debug', 'balance-types'],
  nodeDebugInterface: game.getNodeDebugInterface(),  // hand it the existing interface
  metadata: {
    balanceTypes: ['rhodium', 'natrium', 'magnesium']
  }
})
```

For games without `NodeDebugInterface` (other stacks), the SDK offers a manual registration path:

```ts
bridge.register({
  id: 'player',
  type: 'sprite',
  schema: { x: 'number', y: 'number', texture: 'asset-ref' },
  get: () => ({ x: player.x, y: player.y, texture: player.texture }),
  set: (props) => { Object.assign(player, props) }
})
```

### 7.3 Wire protocol (postMessage)

Editor → Game:

```ts
{ type: 'EDITOR_CONNECT' }
{ type: 'PICK_AT', x: number, y: number, modifier?: 'shift' | 'alt' }
{ type: 'SELECT_NODE', nodeId: string }
{ type: 'UPDATE_TRANSFORM', nodeId: string, transform: Partial<Transform> }
{ type: 'UPDATE_PROPERTY', nodeId: string, key: string, value: unknown }
{ type: 'PLACE_ASSET', assetPath: string, x: number, y: number }
{ type: 'REQUEST_TREE' }
{ type: 'REQUEST_RELOAD' }
```

Game → Editor:

```ts
{ type: 'GAME_READY', gameName, capabilities, metadata }
{ type: 'NODE_TREE', nodes: NodeSnapshot[] }
{ type: 'NODE_SELECTED', node: NodeSnapshot }
{ type: 'TRANSFORM_CHANGED', nodeId, transform }
{ type: 'LOG', level: 'info' | 'warn' | 'error', message: string }
{ type: 'BRIDGE_ERROR', code: string, message: string }
```

`NodeSnapshot` includes worldX, worldY, bounds, type (`spine-skeleton` | `spine-bone` | `sprite` | `node`), and a `schema` describing inspectable fields.

## 8. UI

### 8.1 Layout

Godot-style four-zone layout:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Menu bar · Run/Stop · Balance type ▾ · Game URL (auto-filled)        │
├─────────────┬───────────────────────────────────────────┬────────────┤
│ Scene Tree  │                                           │ Inspector  │
│             │            Game iframe + SVG              │            │
│ (live node  │            gizmo overlay                  │ (schema-   │
│  tree from  │                                           │  driven)   │
│  bridge)    │                                           │            │
│             │                                           │            │
├─────────────┴───────────────────────────────────────────┴────────────┤
│ Assets | Config Editor | AI Studio | Console | Settings              │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Visual style — Glass / Aurora

A deep gradient backdrop with translucent panels floating over it. The center canvas (game iframe) is opaque; surrounding panels are frosted glass that let the gradient bleed through, giving the editor depth without competing with the game.

- **Body backdrop:** `linear-gradient(135deg, #0d0d1a 0%, #0a0a14 60%, #100c1f 100%)`
- **Background blooms (decorative, fixed):** soft radial gradients — purple `rgba(124, 106, 247, 0.18)` upper-left, blue `rgba(96, 165, 250, 0.10)` lower-right
- **Panels:** `background: rgba(255, 255, 255, 0.04); backdrop-filter: blur(14px) saturate(140%); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 8px`
- **Elevated surfaces** (cards, hovers): `rgba(255, 255, 255, 0.06)` with `border: 1px solid rgba(255, 255, 255, 0.10)`
- **Inputs:** `background: rgba(0, 0, 0, 0.30); border: 1px solid rgba(255, 255, 255, 0.08)`
- **Center canvas (opaque):** `background: #0a0a14` so the game renders crisply, no blur underneath
- **Accent (primary):** `#a78bfa` (lighter purple — reads better on glass)
- **Accent gradient** (brand, hover bands): `linear-gradient(90deg, #a78bfa, #60a5fa)`
- **Status colours:** `#4ade80` connected, `#fbbf24` warning, `#f87171` error, `#60a5fa` info
- **Text:** `rgba(255, 255, 255, 0.92)` primary, `rgba(255, 255, 255, 0.55)` secondary, `rgba(255, 255, 255, 0.30)` tertiary, `rgba(255, 255, 255, 0.18)` disabled
- **Typography:** Inter / system-ui, 13px base, 11px chrome. Brand `game-tool` and section headings use the accent gradient via `background-clip: text`

### 8.3 Panels

| Panel | Purpose | Capability gate |
|---|---|---|
| **Canvas** (center) | Game iframe + SVG gizmos · drop target for assets | always |
| **Scene Tree** (left) | Live node hierarchy · click to select · drag to reparent (if supported) | `jst-nodes` or `entities` |
| **Inspector** (right) | Transform, schema-driven game properties, Spine slot/attachment | always |
| **Asset Browser** (bottom tab) | Project files grouped by type · drag onto canvas · right-click → AI generate | always |
| **Config Editor** (bottom tab) | JSON config files with schema-aware fields, syntax highlighting | `config-files` |
| **AI Studio** (bottom tab) | Imagen 2 / Veo 3 / Seedance generation pipeline | `GOOGLE_GENAI_API_KEY` env present |
| **Console** (bottom tab) | Game logs streamed via bridge · errors highlighted | always |
| **Settings** (bottom tab) | Editor preferences, env var status check, project paths | always |

### 8.4 Game Launcher

The "Run" button is a dropdown. The launcher reads the project's `jsbuildconfig.json` (for `devportoffset`) and `supports.json` (for `balanceTypes`) and generates a one-click launch button per balance type. URL is assembled as:

```
http://localhost:{3000 + devportoffset}/?balanceType={balanceType}
```

(Final URL pattern confirmed against the existing dev server during implementation.)

### 8.5 Interaction model

- **Click in canvas** → bridge picks node → select whole skeleton (single click) or bone (double click)
- **Drag handle in canvas** → live transform update
- **Edit inspector field** → live property update
- **Drag asset from browser to canvas** → place new skeleton (Spine) or sprite (image asset)
- **Right-click asset → Generate variant with AI** → opens AI Studio prefilled with that asset's context
- **Drop AI-generated image onto inspector attachment slot** → swaps the attachment in Spine JSON

## 9. AI Studio

### 9.1 Configuration

API keys read from system environment variables only:

- `GOOGLE_GENAI_API_KEY` (text + Imagen 2)
- `GOOGLE_VEO_API_KEY` (Veo 3 video generation; if separate from above)
- `GOOGLE_SEEDANCE_API_KEY` (Seedance animation)

The AI Studio tab and right-click "Generate with AI" actions are hidden entirely if no relevant key is present. Settings panel shows green/red indicator per key so users know which features they have access to.

### 9.2 Generation pipeline

1. User opens AI Studio (or right-clicks an asset → Generate variant)
2. Prompt + optional reference image
3. Generated result preview-only at first (not saved to disk)
4. User clicks "Use this" → editor writes to project assets folder + notifies via `asset:generated` event
5. If invoked from an attachment slot, the editor also patches the Spine JSON's attachment reference

### 9.3 Provider abstraction

```ts
interface AiProvider {
  name: string
  isAvailable(): boolean   // checks env keys
  generateImage(req: ImageRequest): AsyncIterable<GenerationFrame>
  generateVideo?(req: VideoRequest): AsyncIterable<GenerationFrame>
}
```

Concrete providers: `GoogleGenAiImagen2Provider`, `GoogleVeo3Provider`, `GoogleSeedanceProvider`. New providers slot in without touching panel code.

## 10. Storage and files

### 10.1 Project shape (read from the game folder)

The editor expects to find:

- `jsbuildconfig.json` — for `gamename`, `devportoffset`, `spineversion`
- `supports.json` (or `server/settings.json`) — for `balanceTypes`
- `media/skeletons/**/*.spine` — Spine source skeletons
- `media/skeletons/**/*.json` (compiled) — Spine JSON for runtime
- `media/graphics/**` — images, spritesheets, atlases
- `media/particlesystems/**/*.json` — particle configs
- `media/sdf_font/**` — fonts
- `src/configs/**/*.json` (or wherever the configurations list points) — game configs

Anything not found is treated as "this game doesn't have that feature" — no errors.

### 10.2 What the editor writes

Only patches files the build pipeline already understands:

- **Spine JSON** — bone positions, slot attachments, region positions
- **Config JSON** — values inside the existing config files
- **New assets** — placed in `media/graphics/` (or wherever the project's asset roots are declared)
- **Editor metadata** (optional) — `.gametool/project.json` for editor-only state (panel layouts, last-opened scene). Always gitignored.

### 10.3 Local-first

All file I/O via `PlatformAdapter.fs`. Browser mode uses File System Access API (open folder → handle → read/write). Cloud sync is explicitly out of scope.

## 11. Future desktop wrapping

The `PlatformAdapter` interface is the only seam needed to ship a desktop version (Electron or Tauri).

What the desktop wrapper adds:

- `fs.watch` returns real file events instead of polling
- `env.get` reads real `process.env` (so `GOOGLE_GENAI_API_KEY` is automatic, no settings panel needed)
- `shell.spawn` can run `gulp` directly, surfaces output in the Console panel
- `dialog.openFile` shows native OS file picker
- The launcher can start the game's dev server itself rather than expecting the user to start it

The React app, Zustand stores, event bus, panels, and bridge SDK are **identical** in both modes.

## 12. Open questions to resolve during implementation

- Exact URL pattern for the dev server (`devportoffset` semantics) — to be verified against the running game when wiring the launcher
- Whether `NodeDebugInterface` exposes a `getNodeAt(x, y)` method or needs a hit-test polyfill from the bridge
- Spine JSON patch granularity — bone position writes need to round-trip cleanly through the Spine compile step (verify with a throwaway test before locking the schema)
- Whether the editor should also write `.spine` source files or only `.json` runtime files — initial assumption is JSON only, source files untouched

## 13. Out of scope (explicit)

- Code editing (Monaco / VS Code integration) — open scripts in the user's external editor
- Asset import/cropping/resizing tools — handled by external tools or AI Studio
- Multi-user collaboration / real-time editing
- Version control integration
- Built-in playtesting / analytics
- Game logic visual scripting

These can be added later; none of them require architectural changes.

---

## Appendix A — Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Layout | Godot-style (scene tree · canvas · inspector · tabbed bottom) | Familiar to designers, fits the iframe-as-canvas model |
| State architecture | Domain stores + event bus (Zustand) | Extensible; new panels plug into bus without touching existing stores |
| Visual style | Glass / Aurora — deep gradient backdrop, frosted-glass panels, purple→blue accent gradient | Adds depth around the opaque game canvas; feels closer to a game than a developer tool |
| Game loading | Dev server URL in iframe | Simplest; works for browser-only mode |
| Bridge | Minimal importable SDK + capability declaration | Universal across game variants; nothing assumes Spine or jst |
| Renderer | WebGL or WebGPU (game's choice) | Renderer is invisible to editor — gizmos drawn as SVG overlay |
| Storage | Local-first via File System Access API | No backend needed; cloud sync deferred |
| AI keys | System environment variables only | Never written to disk; team members without access just don't see AI panels |
| Compile target | Spine JSON files patched in place | Existing pipeline handles JSON → binary; zero changes to build system |
| Edit granularity | Single-click whole skeleton, double-click bone | Matches how Spine itself works; simple default, opt into detail |
| Adding to scene | Drag `.spine` from browser onto canvas | Full scene composition without leaving the editor |
| Desktop future | PlatformAdapter abstraction from day one | Single seam to swap when wrapping in Electron/Tauri later |

## Appendix B — Out-of-band reads / verification done

- Read `package.json`, `client/package.json`, `client/jsbuildconfig.json`, `supports.json`, `server/settings.json` for both `big-bait` and `casino-strike`
- Read `client/src/bigbait.js`, `client/src/bigbaitgamefactory.js`, `client/src/game.js`, `client/src/configurationslistjs/bigbaitconfigurationslist__magnesium.js`, `client/src/gui/scene/mainscene.js`, `client/src/gui/bigbaitguicontext.js`
- Grepped both projects for `WEBGPU` / `WebGPU` / `webgpu` — zero matches in game source (framework code lives in separate gitlab repos not examined here)
- Confirmed Spine skeletons inventory under `media/skeletons/` for big-bait
- Confirmed config JSON inventory under `compiled/game/media/graphics/maps/default/`
