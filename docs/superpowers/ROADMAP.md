# game-tool — Roadmap

This file is the live to-do list for the editor. Each plan listed here will get its own detailed implementation plan in `docs/superpowers/plans/` when picked up.

**Status as of 2026-05-25:** **Plans 1–10 merged.** 200/200 tests pass. The editor is a fully working live-editing demo for the test game (Asset Browser, Config Editor with disk write-back, Console, Settings, AI Studio with Imagen 3, AND now Spine JSON bone-level write-back). **What's still missing for real-game usage**: the bridge SDK is only baked into the test game — big-bait and other real studio games have no `bridge.connect()` call, so the live-editing loop doesn't reach them.

---

## Plan 10 — Spine JSON write-back  ✅ MERGED 2026-05-25

Shipped: types, `patchBone`, `resolveSkeletonFile`, `NodeSnapshot.owner`, `spinePatchStore`, `applyPatchBatch`, `CanvasPanel` wiring with race-safe debounced flush. End-to-end UAT confirmed via Playwright. Bone-level patches flow from gizmo → `media/skeletons_json/<...>/Skeleton.json` on disk. See `docs/superpowers/plans/2026-05-25-plan-10-spine-json-writeback.md` + `…-smoke-test-results.md`.

A small follow-up commit (`f421287`) also corrected `deriveGameUrl` to produce the GLaDOS-style path (`/games/<gamename>_<8000+offset>/client/debug/testfullscreen.html?balance_type=...`) instead of the wrong `localhost:3100/?balanceType=...` past-me had assumed.

---

## Plan 11 — Bridge integration with the real game (jst-spine)  ⭐ next big item

**Why:** Plan 10 shipped the disk-write machinery and Plan 11 makes it actually reachable from big-bait (and the rest of the studio's games). Right now the bridge SDK is only loaded by the bundled test game (`public/test-game/game.js`). The real games (e.g. big-bait running on GLaDOS at `http://localhost/games/BigBait_8100/client/debug/testfullscreen.html`) use `jst` / `jst-spine` / `knoxjs` and have no bridge — so the editor's iframe loads the game but nothing connects.

**What it needs to do:**
1. **Inject the bridge SDK** into the studio's debug HTML. Either:
   - Modify big-bait's `client/debug/testfullscreen.html` to optionally `<script src="...bridge.js">` (gulp would need to know about the file).
   - OR have GLaDOS inject it for any game running under it (clean but cross-project).
   - OR build a userscript / browser extension (simplest but least integrated).
2. **Walk the jst scene graph** at game-start time and call `bridge.register({...})` for each node. The studio's `BlazingDragonNodeFactory` (`big-bait/client/src/gui/nodefactory/blazingdragonnodefactory.js`) builds the node tree from `media/client-config/*.json`. The bridge integration would hook in there or after to enumerate.
3. **Map jst-spine bones to bridge nodes** so the gizmo can grab a single bone and Plan 10's write-back fires against the right `Skeleton.json`. Each spine node knows its `skeleton_id` (e.g. `"main_scene.main_scene.Skeleton"` — `resolveSkeletonFile` from Plan 10 maps this to the file path).
4. **Bounds reporting** — the bridge needs to surface world-space bounding boxes so the gizmo can position itself on the canvas overlay. jst's render pass has matrix info; need a `NodeDebugInterface.getBounds(nodeId)`.
5. **Update propagation** — when the editor sends `UPDATE_TRANSFORM`, jst-spine needs to apply it to the bone's runtime data (so the user sees the move live in the iframe before the disk write).

**What it needs from the user:**
1. Write access to either big-bait's `client/debug/testfullscreen.html` (for inline `<script>` injection) or to GLaDOS's serving layer (for a cross-cutting injection).
2. Cooperation from the jst-spine maintainer — adding a `NodeDebugInterface` is a real change to a shared studio library. Or scope this to a fork / debug-only build.

**Scope (estimated 6–10 tasks):** TBD. First step is a brainstorming session to pick the injection strategy.

**Open question:** does jst-spine expose anything like a `NodeDebugInterface` already, or does this require new code in the studio's libraries? Check `client/node_modules/jst-spine/debug/` first — there's already a `gamecontrol.js` and `mousekeyboardcontrol.js` in there, suggesting some debug surface exists.

---

## Plan 12 — Veo 3 video generation

**Why:** Second AI provider. Designers can generate animated cutscenes / promotional footage / background videos.

**Same shape as Plan 9.** ImagenProvider is the template.

**Scope (estimated 3–4 tasks):**
1. `src/ai/veoProvider.ts` — extend `AiProvider` interface with `generateVideo` (or add a sibling `AiVideoProvider`). Calls `models/veo-001:predictLongRunning` or whatever the current endpoint is — verify the API at Google AI docs.
2. Add a "Video" mode toggle to `AIStudioPanel` (or split into `AIStudioImagePanel` + `AIStudioVideoPanel` and a tab inside the tab).
3. Handle long-running ops — Veo returns an operation ID and polls. `aiStudioStore.status` already has `running`; just extend to support polling progress.
4. Save result to `media/ai-generated/<timestamp>.mp4`.

**Key candidates:** `CEGO_VEO_API_KEY`, `GOOGLE_VEO_API_KEY` (placeholder env names already shown in Settings panel).

---

## Plan 13 — Seedance animation

**Why:** Third AI provider. Generates animated content — looks suited to short loops / character animations.

**Same shape as Plan 12.** Endpoint and parameter set differs.

**Key candidates:** `CEGO_SEEDANCE_API_KEY`, `GOOGLE_SEEDANCE_API_KEY`.

---

## Polish & follow-ups (smaller, mostly independent)

### Drop generated AI image onto an Inspector asset slot
- Currently AI Studio's "Save to project" writes a new file. The other half of the workflow is: select an entity in the canvas → its Inspector has an `asset-ref` field → click "Generate" inline → Imagen produces an image → the image replaces the entity's existing texture.
- This is the most compelling demo of the AI workflow. ~3-4 tasks.

### Stale-tree fix on URL change
- When the user changes the game URL in MenuBar, the iframe reloads but the previous Scene Tree, selection, and console history linger until the new bridge connects.
- Fix: reset `sceneStore` + `editorStore.selectedId` when `bridgeStore.status` transitions from `connected` to anything else.
- Small (1 task).

### File watcher for external file changes
- When code outside the editor changes a config JSON (e.g. an artist saves over a file with another tool), the Config Editor should detect this and offer to reload.
- Browser doesn't have a native file watch; use polling at 1-2 second intervals.
- Small-medium (2-3 tasks).

### Monaco editor for Config tab
- Replace the textarea with Monaco for real JSON syntax highlighting + IntelliSense.
- Adds ~2 MB to the bundle. Probably acceptable. Lazy-load only when the Config tab opens.
- Medium (3-4 tasks).

### Per-axis lock during drag (Shift constrains)
- Hold Shift while dragging the move handle to constrain to X or Y only based on initial movement direction.
- Hold Shift on a corner handle to preserve aspect ratio.
- Small, lives entirely in `src/ui/canvas/gizmo/`.

### Visible grid overlay
- When snap is on, draw a 32px grid under the gizmo so designers can see what they'll snap to.
- Small.

### Undo / redo
- The CQRS-lite "command" architecture was discussed during brainstorming but deferred. Now would be a natural time: wrap each `UPDATE_TRANSFORM`/`UPDATE_PROPERTY`/`PLACE_ASSET` dispatch in a Command, push to an undo stack, Ctrl-Z replays inverses.
- Medium (5-6 tasks).

### Multi-select / box-select
- Drag-rectangle on empty canvas selects multiple entities. Gizmo operates on the group.
- Significant (8-10 tasks).

---

## Infrastructure (later)

### Desktop wrapper (Electron or Tauri)
- The `PlatformAdapter` interface was designed for this. Browser implementation is `src/platform/browser.ts`; add `electron.ts` or `tauri.ts` alongside.
- Benefits in desktop mode:
  - `env.get` reads real `process.env` (no need for `.env.local` / VITE_ prefixes)
  - `fs.watch` returns real file events instead of polling
  - `shell.spawn` can actually run `gulp` directly with output streaming to the Console panel
  - Native OS file picker for `dialog.openFile`
- Significant (separate multi-plan project).

### Cloud sync / collaboration
- Multi-user real-time editing on shared projects.
- Significantly out of current scope. The bridge SDK + Zustand stores would need to add server replication.

### Git integration
- Show modified files (vs HEAD) in the Asset Browser. Diff view for config JSON edits. Stage / commit from inside the editor.

---

## How to pick what's next

When you (or a future Claude session) ask "what should I work on?", consult this file. Roughly in priority order:

1. **Plan 11 next** — bridge integration with the real game. Plan 10's machinery is unreachable from big-bait without it.
2. **Stale-tree fix** — small, blocks nothing but is annoying every time URL changes.
3. **Drop-AI-into-Inspector-slot** — best demo of the existing AI feature, ~3-4 tasks.
4. **Plan 12 (Veo) + Plan 13 (Seedance)** — round out the AI suite.
5. **Polish items in any order.**
6. **Desktop wrapper** — last, since it's significant scope and the browser mode is already production-quality.

---

## How a new session should start

1. Read this file and `docs/superpowers/specs/2026-05-25-game-editor-design.md`.
2. Run `npm install && npm run build:bridge && npm run dev` and confirm the editor loads.
3. Ask the user which item to tackle.
4. Use `superpowers:writing-plans` to draft the implementation plan in `docs/superpowers/plans/YYYY-MM-DD-plan-N-<name>.md`.
5. Use `superpowers:subagent-driven-development` to execute.
6. `superpowers:finishing-a-development-branch` to merge.

Established convention is one plan per branch (`plan-N-<name>`), `--no-ff` merge, branch deleted after merge.

---

## What's already in the repo for reference

Don't re-derive things — there are existing artifacts:

- **Spec:** `docs/superpowers/specs/2026-05-25-game-editor-design.md` — definitive design.
- **Plan files:** `docs/superpowers/plans/2026-05-25-plan-1-*.md` through `plan-10-*.md` — detailed implementation breakdowns. Use these as templates.
- **Smoke test results:** `docs/superpowers/plans/2026-05-25-plan-N-smoke-test-results.md` for plans 1–4, 6, and 10.
- **Screenshots:** the Plan N smoke test PNG files show what the editor looked like at each milestone.
- **OVERNIGHT-PROGRESS.md** at `docs/superpowers/OVERNIGHT-PROGRESS.md` — interim status snapshot from the first overnight execution.
- **CLAUDE.md** — quick architecture overview for any future Claude instance.
- **Memory:** `C:\Users\kimok\.claude\projects\D--work-game-tool\memory\MEMORY.md` — durable notes about file format conventions in big-bait, environment quirks, user preferences (no-pause, no-PowerShell, merge-to-main, push scoping).
