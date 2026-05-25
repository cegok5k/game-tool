# Plan 10 smoke test — results

Programmatic checks verified on **2026-05-25** from branch `worktree-plan-10-spine-json-writeback`. Manual browser UAT is **pending user run** — see script below.

## Checklist — programmatic (CI-equivalent)

- [x] **Typecheck** — `npm run typecheck` exits 0. Zero errors across both project references (`tsconfig.app.json`, `tsconfig.node.json`).
- [x] **Test suite** — `npm run test:run` 198 passed / 0 failed across 40 test files (5.03 s).
- [x] **Lint** — `npm run lint` exits 0. Zero errors, zero warnings.
- [x] **Bridge bundle** — `npm run build:bridge` produces `public/bridge/bridge.js` (2.92 kB raw / 1.30 kB gzip) in 85 ms.
- [x] **Production build** — `npm run build` exits 0. Emits `dist/index.html`, `dist/assets/index-*.css` (16.64 kB), `dist/assets/index-*.js` (230.78 kB) in 859 ms. Typecheck (via `tsc -b`) ran clean before the Vite step.

- [⏸] **Manual browser UAT** — PENDING. Script below. Not run by agent.

## What Plan 10 ships

| Deliverable | File(s) |
|---|---|
| Native Spine 4.2 JSON types | `src/spine/spineJsonTypes.ts` |
| Pure immutable `patchBone` (throws on unknown bone) | `src/spine/patchBone.ts` |
| `resolveSkeletonFile` — dotted-id → file path | `src/spine/resolveSkeletonFile.ts` |
| `NodeSnapshot.owner` field plumbed through bridge SDK + test game | `src/bridge/protocol.ts`, `public/game/game.js` |
| `spinePatchStore` — batches bone patches per skeleton file | `src/stores/spinePatchStore.ts` |
| `applyPatchBatch` — round-trips JSON text with indent preservation | `src/spine/applyPatchBatch.ts` |
| `CanvasPanel` writeback wiring — TRANSFORM_CHANGED → enqueue → 300 ms debounce → disk write + race-safe timer clear | `src/ui/panels/CanvasPanel.tsx` |

## Test growth

| Metric | Before Plan 10 | After Plan 10 |
|---|---|---|
| Test files | 33 | 40 |
| Tests | 176 | 198 |
| New tests added | — | +22 |

New test files: `src/spine/patchBone.test.ts`, `src/spine/resolveSkeletonFile.test.ts`, `src/spine/applyPatchBatch.test.ts`, `src/stores/spinePatchStore.test.ts`, `src/ui/panels/CanvasPanel.test.ts` (partial — 8 tests total in the file, several are new), plus `src/ui/canvas/gizmo/useDragSession.test.ts` and `src/ui/panels/inspector/useDebouncedCallback.test.ts` (added in supporting tasks).

## Manual UAT script — PENDING, TO BE RUN BY USER

The following steps require a browser and a locally running dev server. They have **not** been executed by the agent and the results are unknown.

> 1. Create a revert point:
>    ```
>    cp "D:\work\big-bait\client\media\skeletons_json\main_scene\main_scene\Skeleton.json" \
>       "D:\work\big-bait\client\media\skeletons_json\main_scene\main_scene\Skeleton.json.bak"
>    ```
> 2. Build the bridge and start the dev server from the worktree directory:
>    ```
>    npm run build:bridge && npm run dev
>    ```
> 3. Open the printed Vite URL in a browser.
> 4. Click **Open Project** in MenuBar. Pick `D:\work\big-bait\client`. Grant readwrite access.
> 5. The default game URL points at the test game — leave it as-is for Plan 10. Real big-bait bridge integration is Plan 11+.
> 6. Wait until the status badge reads **Connected**.
> 7. In the Scene Tree, click the `demo bone` entry (the spine-bone registered in Task 6).
> 8. Drag the gizmo a few pixels. Inspect the Console panel — expect an info entry like:
>    ```
>    Saved media/skeletons_json/main_scene/main_scene/Skeleton.json (1 bone)
>    ```
> 9. In a separate terminal, verify the file was mutated:
>    ```
>    grep -A1 '"spinner_container"' "D:\work\big-bait\client\media\skeletons_json\main_scene\main_scene\Skeleton.json"
>    ```
>    Expect the bone's `x` or `y` value to have changed from the original.
> 10. Restore the original file:
>     ```
>     mv "D:\work\big-bait\client\media\skeletons_json\main_scene\main_scene\Skeleton.json.bak" \
>        "D:\work\big-bait\client\media\skeletons_json\main_scene\main_scene\Skeleton.json"
>     ```

## Known limitations / follow-ups

- **Plan 11 — real big-bait bridge integration.** The bridge SDK is only baked into the test game (`public/game/game.js`). Live preview of the real big-bait game requires injecting the bridge into the jst/jst-spine runtime. This is deliberately deferred.
- **CRLF → LF normalization on write.** `applyPatchBatch` uses `JSON.stringify` + `JSON.parse` internally; the round-trip normalizes line endings to LF regardless of the original file encoding. Acceptable for JSON; noted as a known behavior.
- **Spine version not declared in the type file.** `spineJsonTypes.ts` models Spine 4.2 format but carries no `@spine-version` annotation. Future format upgrades should bump a version marker at the type-file level.
- **Module-scope `flushTimer` latent isolation risk.** `CanvasPanel.tsx` holds a module-scope debounce timer that is not reset between tests. Current tests work because they fake timers and control flush manually. If a future test requires cross-test timer cleanliness, consider exporting a `__resetFlushTimerForTests()` escape hatch.
- **`build:bridge` public-directory warning.** Vite emits a non-fatal warning that `outDir` and `publicDir` overlap (`public/bridge` inside `public/`). This is pre-existing and harmless — the bridge output is intentionally served as a static asset.

## Environment

- Vitest v2.1.9 — 40 test files, 198 tests
- Vite v6.4.2 — production build 859 ms
- TypeScript project references — strict mode, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`
- Branch: `worktree-plan-10-spine-json-writeback`
