# game-tool — Roadmap

This file is the live to-do list for the editor after Plans 1–9 shipped. Each plan listed here will get its own detailed implementation plan in `docs/superpowers/plans/` when picked up.

**Status as of 2026-05-25:** 9 plans merged. 176/176 tests pass. The editor is a fully working live-editing demo for the test game, with Asset Browser, Config Editor (with disk write-back), Console, Settings, and AI Studio (Imagen 3) all functional. **What's missing** is the big "Gizmo edit → Spine JSON on disk" loop that the original spec was built around.

---

## Plan 10 — Spine JSON write-back  ⭐ next big item

**Why:** Closes the "uber editor" loop. Right now Inspector edits and gizmo drags update the **running game** via postMessage, but those changes don't persist — reload the iframe and they're gone. Plan 10 wires the disk write-back so changes survive reloads and feed the existing gulp pipeline.

**What it needs from the user:**
1. Access to a real Spine JSON file from one of the studio's games. The candidate locations on a developer machine:
   - `<game-repo>/client/compiled/game/media/skeletons/<name>.json` (compiled)
   - `<game-repo>/client/media/skeletons/<name>.json` (source, may not exist — Spine source files are `.spine` binary, not JSON)
2. Confirmation on the patch granularity decision the spec called out (skeleton level / slot level / bone level). Recommend bone level since the gizmo edits a single entity at a time.
3. One round-trip verification on a test asset: edit it with the editor, confirm gulp builds successfully with the new JSON, confirm the game renders the edit.

**Scope (estimated 5–7 tasks):**
1. `src/spine/spineJsonTypes.ts` — types for `SpineJson`, `Bone`, `Slot`, `Attachment` based on actual sample.
2. `src/spine/patchBone.ts` — pure function `patchBone(json, boneName, partial): SpineJson` with TDD against a real sample as fixture.
3. `src/spine/findOwner.ts` — given a node ID from the bridge, figure out which `.json` file owns it (likely a map maintained by the bridge or a convention like `nodeId.startsWith('main_scene.')` → `main_scene.json`).
4. `src/stores/spinePatchStore.ts` — track pending patches per file (so multiple edits batch into one write).
5. Wire `CanvasPanel` to call `applyAndWrite(patch)` after `UPDATE_TRANSFORM` commits.
6. Add a "Saved" toast / Console log entry when a write completes.
7. Browser smoke test against a real game.

**Open architectural question:** Does the bridge SDK report enough info for the editor to know *which Spine JSON file* an entity comes from? Likely needs a `spineFile` field added to `NodeSnapshot`. Game-side change: the `jst-spine` integration would need to surface this.

---

## Plan 11 — Veo 3 video generation

**Why:** Second AI provider. Designers can generate animated cutscenes / promotional footage / background videos.

**Same shape as Plan 9.** ImagenProvider is the template.

**Scope (estimated 3–4 tasks):**
1. `src/ai/veoProvider.ts` — extend `AiProvider` interface with `generateVideo` (or add a sibling `AiVideoProvider`). Calls `models/veo-001:predictLongRunning` or whatever the current endpoint is — verify the API at Google AI docs.
2. Add a "Video" mode toggle to `AIStudioPanel` (or split into `AIStudioImagePanel` + `AIStudioVideoPanel` and a tab inside the tab).
3. Handle long-running ops — Veo returns an operation ID and polls. `aiStudioStore.status` already has `running`; just extend to support polling progress.
4. Save result to `media/ai-generated/<timestamp>.mp4`.

**Key candidates:** `CEGO_VEO_API_KEY`, `GOOGLE_VEO_API_KEY` (placeholder env names already shown in Settings panel).

---

## Plan 12 — Seedance animation

**Why:** Third AI provider. Generates animated content — looks suited to short loops / character animations.

**Same shape as Plan 11.** Endpoint and parameter set differs.

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

1. **Plan 10 first** — it's the centerpiece of the original spec.
2. **Stale-tree fix** — small, blocks nothing but is annoying every time URL changes.
3. **Drop-AI-into-Inspector-slot** — best demo of the existing AI feature, ~3-4 tasks.
4. **Plan 11 (Veo) + Plan 12 (Seedance)** — round out the AI suite.
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
- **Plan files:** `docs/superpowers/plans/2026-05-25-plan-1-*.md` through `plan-9-*.md` — detailed implementation breakdowns. Use these as templates.
- **Smoke test results:** `docs/superpowers/plans/2026-05-25-plan-N-smoke-test-results.md` for each of plans 1–4, 6.
- **Screenshots:** the Plan N smoke test PNG files show what the editor looked like at each milestone.
- **OVERNIGHT-PROGRESS.md** at `docs/superpowers/OVERNIGHT-PROGRESS.md` — interim status snapshot from the first overnight execution.
- **CLAUDE.md** — quick architecture overview for any future Claude instance.
