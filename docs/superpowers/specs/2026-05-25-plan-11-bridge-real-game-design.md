# Plan 11 — Bridge integration with the real game (jst/knox via wheatley)

**Status:** design approved 2026-05-25; ready for implementation plan.
**Predecessors:** Plan 1 (MVP edit loop), Plan 10 (Spine JSON write-back).
**Scope of this spec:** the design for connecting game-tool's existing scene-tree / inspector / gizmo / write-back stack to a real studio game (big-bait first) by joining the studio's existing wheatley debug bus.

## Background

Plans 1–10 built a full editor that talks to a bundled test game (`public/test-game/`) over postMessage. The bridge SDK is loaded by the test game with a single `<script src="…bridge.js">` tag and registers nodes by calling `bridge.register(...)`. Plan 10 added bone-level write-back: any node whose snapshot carries an `owner: { skeletonFile, boneName }` triggers a debounced JSON patch to `media/skeletons_json/<…>/Skeleton.json` on disk.

Real studio games (e.g. big-bait at `D:\work\big-bait`) do not load that bridge — they use `jst` / `jst-spine` / `knoxjs` / `knoxslotjs` and have their own debug architecture, **wheatley**. The editor reaches the iframe but receives no `GAME_READY`, so the entire live-editing loop is dark for any real game.

### Earlier rejected approach

A first design proposed injecting `bridge.js` + an adapter script into the game's HTML at the GLaDOS proxy layer. This was rejected: **GLaDOS is process orchestration only; it doesn't sit in the request/response path** for game HTML in a way that supports HTML rewriting, and adding logic to it would touch a shared studio tool game-tool's user doesn't own outright.

### Why wheatley

The studio already operates a complete debug bus that satisfies almost every requirement Plan 11 has:

- **`wheatley-server`** (`~/AppData/Local/Yarn/Data/global/node_modules/wheatley-server`): a Node.js WebSocket relay on `ws://localhost:9150/` (subprotocol `jst-debug-protocol`). Pure pass-through. Routes messages with `runtime_id` to the matching runtime, messages without to all clients. No business logic except client/runtime registration, log buffering, and one particle-system disk-write special case. **No changes needed.**
- **`wheatley-runtime`** (in big-bait at `client/node_modules/wheatley-runtime`): a Closure JS library the game loads. Started by `startWheatley(gameInstance, cego.config)` in the page's `onload`. Auto-discovers the server via `/gamecontrol/wheatley/port`, registers itself, and exposes features through a dependency manager: `node` (get_nodes, set_selected_nodes), `spine` (get_skeletons), `object` (read paths), `cheat`, `screen`, etc.
- **`wheatley-client`** (at `D:\work\wheatley-client`): the existing ImGui debugger UI. It is the only consumer of the bus today; game-tool will be the second.
- **Extension modules** are first-class. big-bait already passes two registration callbacks to `Runtime.start(...)`: `wheatley.runtime.Module.register` (core) and `wheatley.runtime.knoxslot.Module.register` (knoxslot extensions). A new sibling module is one line of opt-in.

**No existing feature edits bones.** `object` is read-only. To make Plan 10's write-back reachable from a real game we need one new feature: `spine_bone_edit`.

## Goals

- A designer points game-tool at big-bait, the scene tree populates with the live spine bones, dragging the gizmo over a bone moves it visibly in the iframe, and Plan 10 writes the change to `Skeleton.json` on disk — with no script injection into the page and no changes to wheatley-server / wheatley-runtime / jst / jst-spine.

## Non-goals

- Editing composite nodes, slots, attachments, particles, configs, animations, anything other than spine bone setup-pose transforms.
- Resolving the animation-vs-setup-pose tension. Editing `bone.x` while an animation is playing changes the setup-pose value, but the runtime overrides it per-frame. Documented; not fixed.
- Pixel-accurate bone bounds. MVP uses a fixed 48×48 box around `worldX/worldY`. Real bounds (slot → attachment AABB union) deferred to a polish item.
- Replacing the postMessage bridge for the test game. Both bridges coexist; selected per-project.

## Architecture

```
game-tool browser app  (Vite dev server on :5173)
├── existing UI                  (panels, gizmo, sceneStore, spinePatchStore, …)
├── postMessage bridge           ← unchanged; used by test-game
└── NEW: wheatley bridge          ← used by real games
        │
        │ WebSocket, subprotocol 'jst-debug-protocol'
        ▼
wheatley-server  (Node.js relay, localhost:9150)        ← UNCHANGED
        ▲
        │ pure pass-through routing by client_id / runtime_id
        ▼
Game runtime in iframe  (started by startWheatley)
├── wheatley-runtime + wheatley-runtime-knoxslotjs        ← UNCHANGED
└── NEW: wheatley-runtime-gametool extension module
    └── SpineBoneEditLogic — feature 'spine_bone_edit'
        ├── handles update_bone        → mutates bone.x/y/...
        └── handles get_bone_world_transforms → returns worldX/Y/a/b/c/d
```

The iframe loads the game URL unchanged. It exists for visual context — the gizmo overlay draws on top of it. No script is injected into it.

## Components

### `wheatley-runtime-gametool/` (NEW repo)

A Closure JS package, sibling to `wheatley-runtime-knoxslotjs`. Layout mirrors that package:

- `package.json`, `gulpfile.js`, `index.js`, `jsbuild/` — boilerplate.
- `src/module.js` — `wheatley.runtime.gametool.Module.register(runtime, dependencyManager)`. Registers the `spine_bone_edit` feature, pulling `spineDebugInterface` from the game instance the same way `wheatley.runtime.Module` does.
- `src/logic/spineboneeditlogic.js` — `wheatley.runtime.gametool.logic.SpineBoneEditLogic`.
  - Subscribes to two message types:
    - **`update_bone`** — payload `{skeleton_id, bone_name, transform: {x?, y?, rotation?, scaleX?, scaleY?}}`. Resolves the skeleton via `spineDebugInterface.getItem(skeleton_id)`, walks its first instance's `skeleton_.bones` to find `bone_name`, assigns the provided fields onto **both** `bone.data.<field>` (the setup-pose source the runtime resets from each frame) and `bone.<field>` (the currently-applied value, so the change shows on the very next frame). Responds with `update_bone_ack` containing the resolved current values.
    - **`get_bone_world_transforms`** — payload `{skeleton_id}`. Returns `{skeleton_id, bones: [{name, worldX, worldY, a, b, c, d}, ...]}` from the live skeleton instance. The editor uses this for hit-testing and gizmo placement.
  - All mutations target the bone's setup-pose data on the runtime spine `Skeleton` object. Plan 10's write-back is responsible for persisting to `Skeleton.json`.

### big-bait integration

Three small edits in `D:\work\big-bait\client`:

1. `package.json` — add `"wheatley-runtime-gametool": "git+ssh://…#1.0.0"` to devDependencies.
2. `gulpfile.js` — alongside the existing wheatley extension registrations, add `if (hasPackage('wheatley-runtime-gametool')) { jsbuild.register(require('wheatley-runtime-gametool')); }`.
3. `debug/wheatley.js` — `goog.require('wheatley.runtime.gametool.Module')` plus add `wheatley.runtime.gametool.Module.register` as the next argument to `Runtime.start(...)`.

The same three-line opt-in applies to any other game that wants editor support later.

### game-tool side

New directory `src/wheatley/`:

- `protocol.ts` — typed message envelopes. Outgoing: `ClientHelloMessage`, `GetSkeletonsMessage`, `GetBoneWorldTransformsMessage`, `UpdateBoneMessage`, `SetSelectedNodesMessage`. Incoming: `ClientAckMessage`, `RuntimesMessage`, `GetSkeletonsReplyMessage`, `GetBoneWorldTransformsReplyMessage`, `UpdateBoneAckMessage`. All envelopes carry `type`, `runtime_id?`, `client_id?`, `data?`.
- `client.ts` — `WheatleyClient` class. Opens a `WebSocket` to `ws://localhost:9150/` with subprotocol `'jst-debug-protocol'`. Sends `{type: 'client', version: '1.0.0'}`, listens for the `runtimes` snapshot, selects the first runtime whose `name` matches the configured game. After that runtimes are picked, exposes:
  - `getSkeletons(): Promise<NamespaceTree>`
  - `getBoneWorldTransforms(skeletonId): Promise<BoneTransforms>`
  - `updateBone(skeletonId, boneName, transform): Promise<ResolvedTransform>`
  - `setSelectedNodes(nodeIds: string[]): void`
  - Event emitter for incoming server-pushed messages (e.g. log messages).
- `boneAdapter.ts` — pure function. Given a `get_skeletons` reply + per-skeleton `get_bone_world_transforms` replies + the existing `resolveSkeletonFile()` helper from Plan 10, returns a `RegisteredNode[]` matching the bridge SDK's shape, complete with `owner: { skeletonFile, boneName }`. The existing `sceneStore` consumes it unchanged.

New file `src/bridge/wheatleyBridge.ts`:

- Same outward shape as today's `BridgeClient` (the postMessage one). Internally driven by `WheatleyClient`. Translates editor outputs (`UPDATE_TRANSFORM`, `SELECT_NODE`, `REQUEST_TREE`) into wheatley calls, and translates wheatley inputs (`get_skeletons` replies, `update_bone_ack`) into the bridge's existing `NODE_TREE` / `TRANSFORM_CHANGED` / `NODE_SELECTED` messages. **No store changes required.**

Project store update:

- `src/stores/projectStore.ts` gains a `bridgeMode: 'iframe' | 'wheatley'` field, defaulting to `'iframe'` (today's test-game behaviour). Per-project setting persisted alongside `gameUrl`.
- `CanvasPanel` instantiates one bridge or the other based on this field.
- Settings panel exposes a toggle / dropdown.

## Data flow

1. User opens a real-game project → `projectStore.bridgeMode === 'wheatley'`.
2. CanvasPanel mounts the iframe with the unchanged game URL **and** constructs a `WheatleyClient`.
3. The iframe loads big-bait → `startGame()` → `startWheatley(gameInstance, cego.config)` → wheatley-runtime registers with `wheatley-server`. The new gametool extension's `spine_bone_edit` feature is among the registered features.
4. `WheatleyClient` connects WS → sends `client` hello → receives `client_id` and `runtimes` snapshot → picks the runtime whose `name` matches the project's configured game name → `bridgeStore.status = 'connected'`.
5. Adapter calls `getSkeletons()` then, for each skeleton, `getBoneWorldTransforms(skelId)` in parallel → builds `RegisteredNode[]` → `sceneStore.setTree(...)` → SceneTreePanel renders.
6. User clicks a bone in the tree → `editorStore.select(id)` → `WheatleyClient.setSelectedNodes([nodeId])` → live game highlights it.
7. User drags the gizmo → `UPDATE_TRANSFORM` flows through `wheatleyBridge` → `WheatleyClient.updateBone(...)` → wheatley relays to runtime → `SpineBoneEditLogic.onUpdateBone_` mutates `bone.x/y/...` → iframe paints next frame with new position.
8. Runtime sends `update_bone_ack` with resolved values → wheatley relays back → `wheatleyBridge` emits `TRANSFORM_CHANGED` with the original `owner` → Plan 10's `spinePatchStore` debounces and writes the JSON.

## Error handling

- **WS fails to connect.** `bridgeStore.status = 'error'`. UI: "Wheatley server not reachable at ws://localhost:9150. Start wheatley-server (`yarn start` in the wheatley-server package)."
- **No runtime matches game name.** Status error: "Game loaded but didn't register with wheatley. Ensure `startWheatley(gameInstance, cego.config)` is called in the page's `onload`."
- **Runtime missing `spine_bone_edit` feature.** Connected, scene tree populates from the existing `spine` feature (read-only), but drag operations show a toast: "Install `wheatley-runtime-gametool` in this game to enable bone editing."
- **Edit during animation.** Setup-pose change applied; runtime overrides it per frame. Document; not surfaced in UI for MVP.
- **Skeleton ID doesn't resolve to a file path.** Adapter still registers the bone without `owner`. Bone is selectable and editable in the iframe; no disk write. Plan 10's existing graceful-degradation path covers this.
- **WS drops mid-edit.** Pending `updateBone` promises reject; gizmo snaps to last acknowledged transform.

## Testing

### Unit (game-tool, Vitest)

- `src/wheatley/client.test.ts` — fake `WebSocket` (server stub), assert client hello, runtimes selection, request/response correlation, reconnection behaviour.
- `src/wheatley/boneAdapter.test.ts` — fixtures for a 2-skeleton, 5-bones-each wheatley reply; assert produced `RegisteredNode[]` shape, ids, owners, bounds, schema.
- `src/bridge/wheatleyBridge.test.ts` — with a mocked `WheatleyClient`, assert bridge surface contract (NODE_TREE on connect, TRANSFORM_CHANGED on updateBone ack, NODE_SELECTED on setSelected).

### Unit (wheatley-runtime-gametool, Closure JS)

- `src/logic/spineboneeditlogic_test.html` + `…_test.js` — mirror `jst-spine/src/skeletonanimator_test.*`. Mock `spineDebugInterface` + a fake skeleton with bones; assert that `update_bone` mutates the right fields, `get_bone_world_transforms` returns the right shape, unknown bones cause a structured error reply.

### Manual smoke test

`docs/superpowers/plans/2026-05-25-plan-11-smoke-test-results.md` (created during execution). Steps:

1. Start `wheatley-server` locally.
2. Start GLaDOS; confirm big-bait is served at `localhost/games/BigBait_8100/...`.
3. Install `wheatley-runtime-gametool` into big-bait; rebuild big-bait.
4. Run game-tool; open the big-bait project; verify `bridgeStore.status` reaches `connected`.
5. Confirm the scene tree shows bones grouped by skeleton.
6. Click a bone; confirm in-iframe highlight.
7. Drag the gizmo on a bone; confirm visual movement in the iframe.
8. Stop drag; confirm `media/skeletons_json/main_scene/main_scene/Skeleton.json` mtime updates and contains the new `x/y` value for the bone.
9. Screenshot each step; commit to the smoke-test results doc.

## Open issues / explicit deferrals

- Animation freeze. While an animation is playing the runtime overrides setup-pose values per frame. Editing still writes correctly to JSON, but the user sees their change snap back visually until the animation idles. A "pause animation" toggle is the natural follow-up but is not in this plan.
- Bone bounds. MVP uses 48×48 around `worldX/worldY`. Slot/attachment AABB union is a polish item.
- Read-only fallback. If the gametool extension is not installed, the scene tree still populates (via the existing `spine` feature) but drag is rejected. This is intentional — the editor remains useful as a read-only browser.
- Hosting `wheatley-runtime-gametool`. The plan assumes a new gitlab repo in `magnet-game-lib/`. If the user prefers a fork of `wheatley-runtime`, the same code lives there — pure host swap, no design change.
- Multiple runtimes. wheatley-server can have many runtimes connected. MVP picks the first one matching the game name. UI for choosing among multiple is a follow-up.

## Plan structure (handed to writing-plans)

Approximate task list (~10 tasks across two repos):

**`wheatley-runtime-gametool/` (NEW repo):**
1. Scaffold the package — `package.json`, `gulpfile.js`, `index.js`, `jsbuild/` mirroring `wheatley-runtime-knoxslotjs`.
2. `module.js` + `SpineBoneEditLogic` with `update_bone` handler + Closure tests.
3. Add `get_bone_world_transforms` handler + tests.

**big-bait:**
4. Add package, wire into gulpfile + `debug/wheatley.js`. One commit in big-bait.

**game-tool:**
5. `src/wheatley/protocol.ts` — typed messages.
6. `src/wheatley/client.ts` — WS connection, request/response, runtime selection + tests.
7. `src/wheatley/boneAdapter.ts` — wheatley reply → `RegisteredNode[]` + tests.
8. `src/bridge/wheatleyBridge.ts` — bridge-shape adapter + tests.
9. `projectStore.bridgeMode` field + Settings UI + CanvasPanel branching.
10. End-to-end smoke test, screenshots, write `…-plan-11-smoke-test-results.md`.

writing-plans will refine these into commit-sized steps.
