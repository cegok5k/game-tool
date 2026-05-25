# Plan 11 — Bridge Real Game (jst/knox via wheatley)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make game-tool's existing live-edit + disk-write-back stack reachable from the studio's real games by joining the existing wheatley debug bus and adding one missing feature (bone editing).

**Architecture:** Game-tool opens a second WebSocket client to wheatley-server (the existing relay used by `wheatley-client`). The game's `wheatley-runtime` runs as today; a new opt-in extension module `wheatley-runtime-gametool` adds a `spine_bone_edit` feature that mutates live spine bones and reports bone world transforms. No changes to `wheatley-server`, `wheatley-runtime`, `jst`, or `jst-spine`. The existing iframe + postMessage bridge for the test game stays working in parallel; CanvasPanel chooses between bridges based on `projectStore.bridgeMode`.

**Tech Stack:** TypeScript + React 19 + Vite 6 + Zustand 5 + Vitest (game-tool side). Closure JS (game-name-spaced via `goog.provide`) + gulp (wheatley extension side). WebSocket subprotocol `jst-debug-protocol`.

**Reference spec:** `docs/superpowers/specs/2026-05-25-plan-11-bridge-real-game-design.md`.

**Repos touched:**
- `D:\work\game-tool` (this repo) — most changes.
- `D:\work\wheatley-runtime-gametool` (NEW local repo; eventually pushed to gitlab as `magnet-game-lib/wheatley-runtime-gametool`) — Closure JS extension.
- `D:\work\big-bait` — three-line integration commit.

---

## File structure

### `D:\work\game-tool`

Created:
- `src/wheatley/protocol.ts` — typed wire-format messages for the wheatley WS bus.
- `src/wheatley/client.ts` — `WheatleyClient` class: WS connect, runtime selection, request/response correlation.
- `src/wheatley/client.test.ts`
- `src/wheatley/boneAdapter.ts` — pure function: skeleton tree + bone-world transforms → `RegisteredNode[]`.
- `src/wheatley/boneAdapter.test.ts`
- `src/bridge/wheatleyBridge.ts` — adapter giving `WheatleyClient` the same outward shape as `BridgeClient`.
- `src/bridge/wheatleyBridge.test.ts`

Modified:
- `src/stores/projectStore.ts` — add `bridgeMode: 'iframe' | 'wheatley'` + setter.
- `src/stores/projectStore.test.ts`
- `src/bridge/index.ts` — re-export wheatleyBridge.
- `src/ui/panels/CanvasPanel.tsx` — dispatch between bridge variants based on `bridgeMode`.
- `src/ui/panels/CanvasPanel.test.tsx`
- `src/ui/panels/SettingsPanel.tsx` — add bridgeMode toggle.
- `src/ui/panels/SettingsPanel.test.tsx`
- `docs/superpowers/plans/2026-05-25-plan-11-smoke-test-results.md` (created at the end).
- `docs/superpowers/ROADMAP.md` (final task: mark Plan 11 merged).

### `D:\work\wheatley-runtime-gametool` (NEW repo)

Created:
- `package.json`
- `index.js` — entry that `wheatley.runtime.Module` consumers can `require()` from a gulpfile.
- `gulpfile.js`
- `jsbuild/defaultconfig.js` — extends host jsbuildconfig.
- `src/module.js` — `wheatley.runtime.gametool.Module.register`.
- `src/logic/spineboneeditlogic.js` — `wheatley.runtime.gametool.logic.SpineBoneEditLogic`.
- `README.md`

### `D:\work\big-bait`

Modified:
- `client/package.json` — add `wheatley-runtime-gametool` to devDependencies (via `yarn link`, local for now).
- `client/gulpfile.js` — `jsbuild.register(require('wheatley-runtime-gametool'))`.
- `client/debug/wheatley.js` — `goog.require` + add register callback to `Runtime.start(...)`.

---

## Conventions and reminders

- **TDD**: write the failing test first, run it (it MUST fail with a meaningful error before you write the implementation), implement minimally, run it (PASS), commit.
- **Frequent commits**: one logical change per commit. Commit messages use the existing repo style (lowercase imperative: `wheatley: add WheatleyClient with mocked WS test`).
- **Type-only imports**: `verbatimModuleSyntax` is on in `tsconfig.app.json` — type-only symbols MUST be imported with `import type { ... }` or the build fails.
- **Run commands via Bash tool** (POSIX). PowerShell is denied. The repo lives at `D:\work\game-tool`; pass it with `-C` to `git`, or `cd` once.
- **Verbatim assertions**: the editor still expects the existing `BridgeClient` surface from `src/bridge/client.ts`. New code must produce identical message shapes (`GameMessage` / `EditorMessage` from `src/types/bridge.ts`) so the CanvasPanel keeps working.
- **No script injection** into the game HTML. Anywhere this plan says "the game", it means the unmodified live-running game as served by GLaDOS, communicating exclusively via wheatley WS.

---

## Task 1: Add `bridgeMode` to projectStore

**Files:**
- Modify: `src/stores/projectStore.ts`
- Modify: `src/stores/projectStore.test.ts`

- [ ] **Step 1: Read the current store and test files to confirm shape.**

Open `src/stores/projectStore.ts` and `src/stores/projectStore.test.ts`. Note the state fields and the existing setter pattern.

- [ ] **Step 2: Add failing test for default bridgeMode and setter.**

Append to `src/stores/projectStore.test.ts`:

```ts
describe('bridgeMode', () => {
  beforeEach(() => {
    useProjectStore.setState({
      folder: null,
      gameUrl: '/test-game/index.html',
      isOpen: false,
      projectName: null,
      devPortOffset: null,
      spineVersion: null,
      balanceTypes: [],
      selectedBalanceType: null,
      bridgeMode: 'iframe',
    })
  })

  it('defaults to "iframe"', () => {
    expect(useProjectStore.getState().bridgeMode).toBe('iframe')
  })

  it('setBridgeMode updates the field', () => {
    useProjectStore.getState().setBridgeMode('wheatley')
    expect(useProjectStore.getState().bridgeMode).toBe('wheatley')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails.**

```
cd D:/work/game-tool && npm run test:run -- src/stores/projectStore.test.ts
```

Expected: FAIL with TypeScript errors about `bridgeMode` not existing on State or `setBridgeMode` not defined.

- [ ] **Step 4: Implement.**

In `src/stores/projectStore.ts`, edit the `State` type and the store body:

```ts
type BridgeMode = 'iframe' | 'wheatley'

type State = {
  folder: FolderHandle | null
  gameUrl: string
  isOpen: boolean
  projectName: string | null
  devPortOffset: number | null
  spineVersion: string | null
  balanceTypes: readonly string[]
  selectedBalanceType: string | null
  bridgeMode: BridgeMode
  setFolder: (folder: FolderHandle) => void
  setGameUrl: (url: string) => void
  setBridgeMode: (mode: BridgeMode) => void
  loadProjectConfig: (cfg: ProjectConfig) => void
  selectBalanceType: (name: string) => void
  close: () => void
}
```

Add `bridgeMode: 'iframe'` to the initial state, add `setBridgeMode: (bridgeMode) => set({ bridgeMode })`, and add `bridgeMode: 'iframe'` to the `close()` reset block.

Export the type as a value-bearing symbol so other modules can import it:

```ts
export type { BridgeMode }
```

(Use `export type` because `verbatimModuleSyntax` is on.)

- [ ] **Step 5: Re-run the test, then the full project store tests, then typecheck.**

```
cd D:/work/game-tool && npm run test:run -- src/stores/projectStore.test.ts && npm run typecheck
```

Expected: PASS, no type errors.

- [ ] **Step 6: Commit.**

```
git -C D:/work/game-tool add src/stores/projectStore.ts src/stores/projectStore.test.ts
git -C D:/work/game-tool commit -m "projectStore: add bridgeMode field (iframe|wheatley)"
```

---

## Task 2: Wheatley protocol message types

**Files:**
- Create: `src/wheatley/protocol.ts`
- Create: `src/wheatley/protocol.test.ts`

Reference: the live message format is observable in `D:\work\big-bait\client\node_modules\wheatley-common\src\net\debuggerconnection.js` (the `MessageDefines` enum) and `wheatley-server/index.js` (routing).

- [ ] **Step 1: Write failing protocol shape tests.**

Create `src/wheatley/protocol.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { encodeClientHello, parseServerMessage } from './protocol'

describe('wheatley protocol', () => {
  it('encodeClientHello includes type and version', () => {
    const msg = encodeClientHello({ version: '1.0.0' })
    expect(msg.type).toBe('client')
    expect(msg.version).toBe('1.0.0')
  })

  it('parseServerMessage returns null on garbage', () => {
    expect(parseServerMessage('not json')).toBeNull()
    expect(parseServerMessage('{}')).toBeNull()
  })

  it('parseServerMessage returns a typed envelope for known shapes', () => {
    const r = parseServerMessage(JSON.stringify({
      type: 'client',
      client_id: 'client_1',
    }))
    expect(r).not.toBeNull()
    if (r === null) throw new Error('null')
    expect(r.type).toBe('client')
  })
})
```

- [ ] **Step 2: Run the test to confirm fail.**

```
cd D:/work/game-tool && npm run test:run -- src/wheatley/protocol.test.ts
```

Expected: FAIL (file does not exist).

- [ ] **Step 3: Implement `src/wheatley/protocol.ts`.**

```ts
// Wire-format types for the wheatley debug bus.
// See big-bait/client/node_modules/wheatley-common/src/net/debuggerconnection.js
// for the server-side message defines.

export type WheatleyEnvelope = {
  type: string
  client_id?: string
  runtime_id?: string
  data?: unknown
}

// --- Outgoing (game-tool → server / runtime) ---
export type ClientHelloMessage = {
  type: 'client'
  version: string
  client_id?: string
}

export type GetSkeletonsMessage = {
  type: 'get_skeletons'
  runtime_id: string
}

export type GetBoneWorldTransformsMessage = {
  type: 'get_bone_world_transforms'
  runtime_id: string
  data: { skeleton_id: string }
}

export type UpdateBoneMessage = {
  type: 'update_bone'
  runtime_id: string
  data: {
    skeleton_id: string
    bone_name: string
    transform: Partial<{
      x: number
      y: number
      rotation: number
      scaleX: number
      scaleY: number
    }>
  }
}

export type SetSelectedNodesMessage = {
  type: 'set_selected_nodes'
  runtime_id: string
  data: { node_id_list: readonly number[] }
}

// --- Incoming (server / runtime → game-tool) ---
export type ClientAckMessage = {
  type: 'client'
  client_id: string
}

export type WheatleyRuntimeDescriptor = {
  id: string
  name: string
  version: string
  cwd?: string
}

export type RuntimesMessage = {
  type: 'runtimes'
  data: { runtimes: readonly WheatleyRuntimeDescriptor[] }
}

export type WheatleySkeletonNamespace = {
  id: string
  name: string
  children: readonly WheatleySkeletonNamespace[]
  skeletons: readonly {
    id: string
    name: string
    instances: readonly { id: string; nodeId: number; time: number; visible: boolean; updated: boolean }[]
  }[]
}

export type GetSkeletonsReplyMessage = {
  type: 'get_skeletons'
  runtime_id: string
  data: { root: WheatleySkeletonNamespace }
}

export type WheatleyBoneWorld = {
  name: string
  worldX: number
  worldY: number
  a: number
  b: number
  c: number
  d: number
}

export type GetBoneWorldTransformsReplyMessage = {
  type: 'get_bone_world_transforms'
  runtime_id: string
  data: { skeleton_id: string; bones: readonly WheatleyBoneWorld[] }
}

export type UpdateBoneAckMessage = {
  type: 'update_bone_ack'
  runtime_id: string
  data: {
    skeleton_id: string
    bone_name: string
    transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }
  }
}

export type LogMessage = {
  type: 'log_message'
  runtime_id: string
  data: { timestamp: number; level: string; message: string }
}

export type ServerMessage =
  | ClientAckMessage
  | RuntimesMessage
  | GetSkeletonsReplyMessage
  | GetBoneWorldTransformsReplyMessage
  | UpdateBoneAckMessage
  | LogMessage

// --- Helpers ---

export function encodeClientHello(opts: { version: string; clientId?: string }): ClientHelloMessage {
  const msg: ClientHelloMessage = { type: 'client', version: opts.version }
  if (opts.clientId !== undefined) msg.client_id = opts.clientId
  return msg
}

const KNOWN_INCOMING_TYPES: ReadonlySet<ServerMessage['type']> = new Set([
  'client',
  'runtimes',
  'get_skeletons',
  'get_bone_world_transforms',
  'update_bone_ack',
  'log_message',
])

export function parseServerMessage(raw: string): ServerMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  if (typeof obj.type !== 'string') return null
  if (!KNOWN_INCOMING_TYPES.has(obj.type as ServerMessage['type'])) return null
  return parsed as ServerMessage
}
```

- [ ] **Step 4: Re-run tests; typecheck.**

```
cd D:/work/game-tool && npm run test:run -- src/wheatley/protocol.test.ts && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```
git -C D:/work/game-tool add src/wheatley/protocol.ts src/wheatley/protocol.test.ts
git -C D:/work/game-tool commit -m "wheatley: typed message envelopes and parse helper"
```

---

## Task 3: WheatleyClient — WS connection, runtime selection, request/response

**Files:**
- Create: `src/wheatley/client.ts`
- Create: `src/wheatley/client.test.ts`

The client wraps a `WebSocket` and exposes promise-returning methods. Requests carry a `runtime_id`; the matching reply is correlated by `type`. We keep one in-flight request per type — wheatley protocol doesn't have request IDs, but our use is request/response per type, so per-type correlation is fine.

- [ ] **Step 1: Write failing test using a fake WebSocket.**

Create `src/wheatley/client.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createWheatleyClient, type WheatleyClient } from './client'

// Minimal fake WebSocket capturing sent payloads and exposing handlers.
class FakeWS {
  static OPEN = 1
  static CLOSED = 3
  readyState: number = 0
  sent: string[] = []
  url: string
  protocol: string
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: ((ev: { code: number; reason: string }) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  constructor(url: string, protocol: string) {
    this.url = url
    this.protocol = protocol
  }
  send(s: string) { this.sent.push(s) }
  close() { this.readyState = FakeWS.CLOSED; this.onclose?.({ code: 1000, reason: '' }) }
  // Test-only helpers
  open() { this.readyState = FakeWS.OPEN; this.onopen?.(new Event('open')) }
  push(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }) }
}

describe('WheatleyClient', () => {
  let factoryCalls = 0
  let lastWs: FakeWS | null = null

  beforeEach(() => {
    factoryCalls = 0
    lastWs = null
  })
  afterEach(() => { vi.restoreAllMocks() })

  function makeClient(): WheatleyClient {
    return createWheatleyClient({
      url: 'ws://localhost:9150/',
      gameName: 'BigBait [Linux]',
      version: '1.0.0',
      webSocketFactory: (url, protocol) => {
        factoryCalls++
        const ws = new FakeWS(url, protocol)
        lastWs = ws
        return ws as unknown as WebSocket
      },
    })
  }

  it('sends client hello on open', () => {
    const c = makeClient()
    c.connect()
    if (lastWs === null) throw new Error('no ws')
    lastWs.open()
    expect(lastWs.sent.length).toBe(1)
    const payload = JSON.parse(lastWs.sent[0])
    expect(payload).toEqual({ type: 'client', version: '1.0.0' })
    c.dispose()
  })

  it('resolves connect promise after runtime matching game name appears', async () => {
    const c = makeClient()
    const connected = c.connect()
    if (lastWs === null) throw new Error('no ws')
    lastWs.open()
    lastWs.push({ type: 'client', client_id: 'client_42' })
    lastWs.push({ type: 'runtimes', data: { runtimes: [
      { id: 'rt_a', name: 'OtherGame', version: '1.0.0' },
      { id: 'rt_b', name: 'BigBait [Linux]', version: '1.0.0' },
    ]}})
    await connected
    expect(c.runtimeId()).toBe('rt_b')
    expect(c.clientId()).toBe('client_42')
    c.dispose()
  })

  it('getSkeletons sends request and resolves on reply', async () => {
    const c = makeClient()
    const ready = c.connect()
    if (lastWs === null) throw new Error('no ws')
    lastWs.open()
    lastWs.push({ type: 'client', client_id: 'client_1' })
    lastWs.push({ type: 'runtimes', data: { runtimes: [{ id: 'rt_x', name: 'BigBait [Linux]', version: '1.0.0' }] }})
    await ready

    const promise = c.getSkeletons()
    const sent = JSON.parse(lastWs.sent[1])
    expect(sent).toEqual({ type: 'get_skeletons', runtime_id: 'rt_x' })

    lastWs.push({
      type: 'get_skeletons',
      runtime_id: 'rt_x',
      data: { root: { id: '', name: '', children: [], skeletons: [] } },
    })
    const reply = await promise
    expect(reply.root.skeletons).toEqual([])
    c.dispose()
  })

  it('rejects connect if no runtime matches within timeout', async () => {
    const c = makeClient()
    const promise = c.connect({ matchTimeoutMs: 50 })
    if (lastWs === null) throw new Error('no ws')
    lastWs.open()
    lastWs.push({ type: 'client', client_id: 'c' })
    lastWs.push({ type: 'runtimes', data: { runtimes: [{ id: 'rt_o', name: 'OtherGame', version: '1.0.0' }] }})
    await expect(promise).rejects.toThrow(/no runtime/i)
    c.dispose()
  })
})
```

- [ ] **Step 2: Verify it fails.**

```
cd D:/work/game-tool && npm run test:run -- src/wheatley/client.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/wheatley/client.ts`.**

```ts
import {
  encodeClientHello,
  parseServerMessage,
  type GetSkeletonsReplyMessage,
  type GetBoneWorldTransformsReplyMessage,
  type UpdateBoneAckMessage,
  type ServerMessage,
} from './protocol'

const DEFAULT_URL = 'ws://localhost:9150/'
const SUBPROTOCOL = 'jst-debug-protocol'
const DEFAULT_MATCH_TIMEOUT_MS = 5000

export type WheatleyClientOptions = {
  url?: string
  gameName: string
  version?: string
  /** Override WebSocket constructor for tests. */
  webSocketFactory?: (url: string, protocol: string) => WebSocket
}

export type WheatleyClient = {
  connect(opts?: { matchTimeoutMs?: number }): Promise<void>
  dispose(): void
  clientId(): string | null
  runtimeId(): string | null
  getSkeletons(): Promise<GetSkeletonsReplyMessage['data']>
  getBoneWorldTransforms(skeletonId: string): Promise<GetBoneWorldTransformsReplyMessage['data']>
  updateBone(skeletonId: string, boneName: string, transform: Partial<{ x: number; y: number; rotation: number; scaleX: number; scaleY: number }>): Promise<UpdateBoneAckMessage['data']>
  setSelectedNodes(nodeIds: readonly number[]): void
  onLog(handler: (level: string, message: string) => void): () => void
}

export function createWheatleyClient(opts: WheatleyClientOptions): WheatleyClient {
  const url = opts.url ?? DEFAULT_URL
  const version = opts.version ?? '1.0.0'
  const factory = opts.webSocketFactory ?? ((u, p) => new WebSocket(u, p))

  let ws: WebSocket | null = null
  let clientId: string | null = null
  let runtimeId: string | null = null
  let connectResolve: (() => void) | null = null
  let connectReject: ((err: Error) => void) | null = null
  let matchTimer: ReturnType<typeof setTimeout> | null = null
  const pending = new Map<string, { resolve: (data: unknown) => void; reject: (err: Error) => void }>()
  const logHandlers = new Set<(level: string, message: string) => void>()

  function send(payload: unknown): void {
    if (ws === null || ws.readyState !== 1) return
    ws.send(JSON.stringify(payload))
  }

  function awaitReply<T>(type: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      pending.set(type, {
        resolve: (data: unknown) => { resolve(data as T) },
        reject,
      })
    })
  }

  function dispatch(msg: ServerMessage): void {
    if (msg.type === 'client') {
      clientId = msg.client_id
      return
    }
    if (msg.type === 'runtimes') {
      const match = msg.data.runtimes.find((r) => r.name === opts.gameName)
      if (match !== undefined && runtimeId === null) {
        runtimeId = match.id
        if (matchTimer !== null) {
          clearTimeout(matchTimer)
          matchTimer = null
        }
        if (connectResolve !== null) {
          const r = connectResolve
          connectResolve = null
          connectReject = null
          r()
        }
      }
      return
    }
    if (msg.type === 'log_message') {
      for (const h of logHandlers) h(msg.data.level, msg.data.message)
      return
    }
    const handler = pending.get(msg.type)
    if (handler !== undefined) {
      pending.delete(msg.type)
      handler.resolve((msg as { data: unknown }).data)
    }
  }

  return {
    connect(connectOpts) {
      const timeout = connectOpts?.matchTimeoutMs ?? DEFAULT_MATCH_TIMEOUT_MS
      return new Promise<void>((resolve, reject) => {
        connectResolve = resolve
        connectReject = reject
        ws = factory(url, SUBPROTOCOL)
        ws.onopen = () => { send(encodeClientHello({ version })) }
        ws.onmessage = (ev: MessageEvent | { data: string }) => {
          const data = (ev as { data: unknown }).data
          if (typeof data !== 'string') return
          const msg = parseServerMessage(data)
          if (msg === null) return
          dispatch(msg)
        }
        ws.onerror = () => {
          if (connectReject !== null) {
            const r = connectReject
            connectResolve = null
            connectReject = null
            r(new Error('WebSocket error connecting to ' + url))
          }
        }
        ws.onclose = () => {
          for (const [, p] of pending) p.reject(new Error('WebSocket closed'))
          pending.clear()
        }
        matchTimer = setTimeout(() => {
          if (runtimeId === null && connectReject !== null) {
            const r = connectReject
            connectResolve = null
            connectReject = null
            r(new Error(`No runtime named "${opts.gameName}" registered with wheatley within ${timeout}ms`))
          }
        }, timeout)
      })
    },
    dispose() {
      if (matchTimer !== null) clearTimeout(matchTimer)
      for (const [, p] of pending) p.reject(new Error('Client disposed'))
      pending.clear()
      logHandlers.clear()
      if (ws !== null) {
        ws.onopen = null
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null
        try { ws.close() } catch { /* ignore */ }
        ws = null
      }
    },
    clientId() { return clientId },
    runtimeId() { return runtimeId },
    async getSkeletons() {
      if (runtimeId === null) throw new Error('Not connected to a runtime')
      send({ type: 'get_skeletons', runtime_id: runtimeId })
      return awaitReply<GetSkeletonsReplyMessage['data']>('get_skeletons')
    },
    async getBoneWorldTransforms(skeletonId) {
      if (runtimeId === null) throw new Error('Not connected to a runtime')
      send({ type: 'get_bone_world_transforms', runtime_id: runtimeId, data: { skeleton_id: skeletonId } })
      return awaitReply<GetBoneWorldTransformsReplyMessage['data']>('get_bone_world_transforms')
    },
    async updateBone(skeletonId, boneName, transform) {
      if (runtimeId === null) throw new Error('Not connected to a runtime')
      send({ type: 'update_bone', runtime_id: runtimeId, data: { skeleton_id: skeletonId, bone_name: boneName, transform } })
      return awaitReply<UpdateBoneAckMessage['data']>('update_bone_ack')
    },
    setSelectedNodes(nodeIds) {
      if (runtimeId === null) return
      send({ type: 'set_selected_nodes', runtime_id: runtimeId, data: { node_id_list: nodeIds } })
    },
    onLog(handler) {
      logHandlers.add(handler)
      return () => { logHandlers.delete(handler) }
    },
  }
}
```

- [ ] **Step 4: Run the test.**

```
cd D:/work/game-tool && npm run test:run -- src/wheatley/client.test.ts && npm run typecheck
```

Expected: PASS, no type errors.

- [ ] **Step 5: Commit.**

```
git -C D:/work/game-tool add src/wheatley/client.ts src/wheatley/client.test.ts
git -C D:/work/game-tool commit -m "wheatley: client with WS connect, runtime matching, request/response"
```

---

## Task 4: Bone adapter — wheatley reply → RegisteredNode[]

**Files:**
- Create: `src/wheatley/boneAdapter.ts`
- Create: `src/wheatley/boneAdapter.test.ts`

The adapter is a pure function: given wheatley's `get_skeletons` reply and one `get_bone_world_transforms` reply per skeleton, produce `NodeSnapshot[]` ready for `sceneStore.setTree(...)`.

- [ ] **Step 1: Write the failing test.**

Create `src/wheatley/boneAdapter.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildSceneTree } from './boneAdapter'
import type { GetSkeletonsReplyMessage, GetBoneWorldTransformsReplyMessage } from './protocol'

const skeletonsReply: GetSkeletonsReplyMessage['data'] = {
  root: {
    id: '',
    name: '',
    children: [
      {
        id: 'main_scene',
        name: 'main_scene',
        children: [],
        skeletons: [
          {
            id: 'main_scene.main_scene.Skeleton',
            name: 'Skeleton',
            instances: [{ id: 'inst_0', nodeId: 1, time: 0, visible: true, updated: true }],
          },
        ],
      },
    ],
    skeletons: [],
  },
}

const bonesReply: GetBoneWorldTransformsReplyMessage['data'] = {
  skeleton_id: 'main_scene.main_scene.Skeleton',
  bones: [
    { name: 'root', worldX: 0, worldY: 0, a: 1, b: 0, c: 0, d: 1 },
    { name: 'spinner_container', worldX: 100, worldY: 200, a: 1, b: 0, c: 0, d: 1 },
  ],
}

describe('buildSceneTree', () => {
  it('flattens skeletons into a tree of skeleton-group + bone children', () => {
    const tree = buildSceneTree(skeletonsReply, new Map([['main_scene.main_scene.Skeleton', bonesReply]]))
    const ids = tree.map((n) => n.id)
    expect(ids).toContain('main_scene.main_scene.Skeleton')
    expect(ids).toContain('main_scene.main_scene.Skeleton:root')
    expect(ids).toContain('main_scene.main_scene.Skeleton:spinner_container')
  })

  it('assigns owner to bone nodes for Plan 10 write-back', () => {
    const tree = buildSceneTree(skeletonsReply, new Map([['main_scene.main_scene.Skeleton', bonesReply]]))
    const bone = tree.find((n) => n.id === 'main_scene.main_scene.Skeleton:spinner_container')
    if (bone === undefined) throw new Error('bone missing')
    expect(bone.owner).toEqual({
      skeletonFile: 'media/skeletons_json/main_scene/main_scene/Skeleton.json',
      boneName: 'spinner_container',
    })
    expect(bone.kind).toBe('spine-bone')
  })

  it('positions bone bounds at worldX/worldY with a 48px box centred', () => {
    const tree = buildSceneTree(skeletonsReply, new Map([['main_scene.main_scene.Skeleton', bonesReply]]))
    const bone = tree.find((n) => n.id === 'main_scene.main_scene.Skeleton:spinner_container')
    if (bone === undefined || bone.bounds === null) throw new Error('bounds missing')
    expect(bone.bounds.x).toBe(100 - 24)
    expect(bone.bounds.y).toBe(200 - 24)
    expect(bone.bounds.width).toBe(48)
    expect(bone.bounds.height).toBe(48)
  })

  it('falls back to no owner when skeleton id cannot be resolved', () => {
    const malformedSkeletons: GetSkeletonsReplyMessage['data'] = {
      root: {
        id: '', name: '', children: [], skeletons: [{
          id: 'bareword',
          name: 'bareword',
          instances: [],
        }],
      },
    }
    const tree = buildSceneTree(malformedSkeletons, new Map([['bareword', { skeleton_id: 'bareword', bones: [{ name: 'root', worldX: 0, worldY: 0, a: 1, b: 0, c: 0, d: 1 }] }]]))
    const bone = tree.find((n) => n.id === 'bareword:root')
    expect(bone?.owner).toBeUndefined()
  })
})
```

- [ ] **Step 2: Verify it fails.**

```
cd D:/work/game-tool && npm run test:run -- src/wheatley/boneAdapter.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/wheatley/boneAdapter.ts`.**

```ts
import { resolveSkeletonFile } from '../spine/resolveSkeletonFile'
import type { NodeSnapshot } from '../types/scene'
import type {
  GetSkeletonsReplyMessage,
  GetBoneWorldTransformsReplyMessage,
  WheatleySkeletonNamespace,
} from './protocol'

const BONE_BOX_SIZE = 48

function tryResolve(id: string): string | null {
  try {
    return resolveSkeletonFile(id)
  } catch {
    return null
  }
}

function walkNamespace(ns: WheatleySkeletonNamespace, out: { id: string; name: string }[]): void {
  for (const skel of ns.skeletons) out.push({ id: skel.id, name: skel.name })
  for (const child of ns.children) walkNamespace(child, out)
}

export function buildSceneTree(
  skeletonsReply: GetSkeletonsReplyMessage['data'],
  bonesBySkeleton: ReadonlyMap<string, GetBoneWorldTransformsReplyMessage['data']>,
): NodeSnapshot[] {
  const flat: { id: string; name: string }[] = []
  walkNamespace(skeletonsReply.root, flat)

  const nodes: NodeSnapshot[] = []
  for (const skel of flat) {
    const bones = bonesBySkeleton.get(skel.id)
    const childIds: string[] = []
    if (bones !== undefined) {
      for (const b of bones.bones) childIds.push(`${skel.id}:${b.name}`)
    }
    nodes.push({
      id: skel.id,
      kind: 'spine-skeleton',
      name: skel.name,
      parentId: null,
      childIds,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: null,
      schema: [],
      values: {},
    })

    if (bones === undefined) continue
    const skeletonFile = tryResolve(skel.id)
    for (const b of bones.bones) {
      const id = `${skel.id}:${b.name}`
      const node: NodeSnapshot = {
        id,
        kind: 'spine-bone',
        name: b.name,
        parentId: skel.id,
        childIds: [],
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        bounds: {
          x: b.worldX - BONE_BOX_SIZE / 2,
          y: b.worldY - BONE_BOX_SIZE / 2,
          width: BONE_BOX_SIZE,
          height: BONE_BOX_SIZE,
        },
        schema: [],
        values: {},
      }
      if (skeletonFile !== null) {
        node.owner = { skeletonFile, boneName: b.name }
      }
      nodes.push(node)
    }
  }
  return nodes
}
```

- [ ] **Step 4: Run tests; typecheck.**

```
cd D:/work/game-tool && npm run test:run -- src/wheatley/boneAdapter.test.ts && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```
git -C D:/work/game-tool add src/wheatley/boneAdapter.ts src/wheatley/boneAdapter.test.ts
git -C D:/work/game-tool commit -m "wheatley: buildSceneTree adapter (skeletons + bones → NodeSnapshot[])"
```

---

## Task 5: Wheatley bridge adapter (BridgeClient-shaped facade)

**Files:**
- Create: `src/bridge/wheatleyBridge.ts`
- Create: `src/bridge/wheatleyBridge.test.ts`
- Modify: `src/bridge/index.ts`

`CanvasPanel` already consumes `BridgeClient` (its `send: (EditorMessage) => void` + `dispose()` + an `onMessage` callback supplied to `createBridgeClient`). The wheatley adapter exposes the same shape but is driven by `WheatleyClient`.

- [ ] **Step 1: Write a failing adapter test.**

Create `src/bridge/wheatleyBridge.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createWheatleyBridgeClient } from './wheatleyBridge'
import type { WheatleyClient } from '../wheatley/client'

function makeStubClient(): WheatleyClient & { _emitLog?: (l: string, m: string) => void } {
  return {
    connect: vi.fn(() => Promise.resolve()),
    dispose: vi.fn(),
    clientId: () => 'cid',
    runtimeId: () => 'rid',
    getSkeletons: vi.fn(() => Promise.resolve({ root: { id: '', name: '', children: [], skeletons: [] } })),
    getBoneWorldTransforms: vi.fn(() => Promise.resolve({ skeleton_id: 'x', bones: [] })),
    updateBone: vi.fn((sid, bname, t) => Promise.resolve({
      skeleton_id: sid, bone_name: bname,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, ...t },
    })),
    setSelectedNodes: vi.fn(),
    onLog: vi.fn(() => () => {}),
  } as unknown as WheatleyClient
}

describe('createWheatleyBridgeClient', () => {
  it('emits GAME_READY after connect resolves', async () => {
    const stub = makeStubClient()
    const messages: { type: string }[] = []
    const bridge = createWheatleyBridgeClient({
      client: stub,
      gameName: 'BigBait',
      onMessage: (m) => { messages.push(m) },
    })
    await bridge.start()
    expect(messages.find((m) => m.type === 'GAME_READY')).toBeDefined()
    bridge.dispose()
  })

  it('REQUEST_TREE → fetches skeletons + per-skeleton bones, emits NODE_TREE', async () => {
    const stub = makeStubClient()
    ;(stub.getSkeletons as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      root: { id: '', name: '', children: [], skeletons: [{
        id: 'main_scene.main_scene.Skeleton', name: 'Skeleton', instances: [],
      }]},
    })
    ;(stub.getBoneWorldTransforms as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      skeleton_id: 'main_scene.main_scene.Skeleton',
      bones: [{ name: 'root', worldX: 1, worldY: 2, a: 1, b: 0, c: 0, d: 1 }],
    })

    const messages: { type: string }[] = []
    const bridge = createWheatleyBridgeClient({
      client: stub,
      gameName: 'BigBait',
      onMessage: (m) => { messages.push(m) },
    })
    await bridge.start()
    bridge.send({ type: 'REQUEST_TREE' })
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    const tree = messages.find((m) => m.type === 'NODE_TREE')
    expect(tree).toBeDefined()
    bridge.dispose()
  })

  it('UPDATE_TRANSFORM → calls updateBone and emits TRANSFORM_CHANGED', async () => {
    const stub = makeStubClient()
    const messages: { type: string; nodeId?: string }[] = []
    const bridge = createWheatleyBridgeClient({
      client: stub,
      gameName: 'BigBait',
      onMessage: (m) => { messages.push(m) },
    })
    await bridge.start()
    bridge.send({
      type: 'UPDATE_TRANSFORM',
      nodeId: 'main_scene.main_scene.Skeleton:spinner_container',
      transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
    })
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(stub.updateBone).toHaveBeenCalledWith(
      'main_scene.main_scene.Skeleton',
      'spinner_container',
      { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
    )
    expect(messages.find((m) => m.type === 'TRANSFORM_CHANGED' && m.nodeId === 'main_scene.main_scene.Skeleton:spinner_container')).toBeDefined()
    bridge.dispose()
  })
})
```

- [ ] **Step 2: Run, expect fail.**

```
cd D:/work/game-tool && npm run test:run -- src/bridge/wheatleyBridge.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/bridge/wheatleyBridge.ts`.**

```ts
import type { EditorMessage, GameMessage } from '../types/bridge'
import { buildSceneTree } from '../wheatley/boneAdapter'
import type { WheatleyClient } from '../wheatley/client'

export type WheatleyBridgeClientOptions = {
  client: WheatleyClient
  gameName: string
  onMessage: (msg: GameMessage) => void
}

export type WheatleyBridgeClient = {
  start: () => Promise<void>
  send: (msg: EditorMessage) => void
  dispose: () => void
}

function splitBoneId(id: string): { skeletonId: string; boneName: string } | null {
  const idx = id.lastIndexOf(':')
  if (idx === -1) return null
  return { skeletonId: id.slice(0, idx), boneName: id.slice(idx + 1) }
}

export function createWheatleyBridgeClient(opts: WheatleyBridgeClientOptions): WheatleyBridgeClient {
  let disposed = false
  let logUnsub: (() => void) | null = null

  async function fetchTreeAndEmit(): Promise<void> {
    if (disposed) return
    try {
      const skeletons = await opts.client.getSkeletons()
      // Walk to collect skeleton ids, then fetch bone worlds in parallel.
      const ids: string[] = []
      ;(function walk(ns: { children: readonly { children: readonly unknown[]; skeletons: readonly { id: string }[] }[]; skeletons: readonly { id: string }[] }): void {
        for (const s of ns.skeletons) ids.push(s.id)
        for (const c of ns.children) walk(c as unknown as { children: readonly { children: readonly unknown[]; skeletons: readonly { id: string }[] }[]; skeletons: readonly { id: string }[] })
      })(skeletons.root)
      const replies = await Promise.all(ids.map((id) => opts.client.getBoneWorldTransforms(id)))
      const bonesMap = new Map(replies.map((r) => [r.skeleton_id, r]))
      if (disposed) return
      const nodes = buildSceneTree(skeletons, bonesMap)
      opts.onMessage({ type: 'NODE_TREE', nodes })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      opts.onMessage({ type: 'BRIDGE_ERROR', code: 'TREE_FETCH_FAILED', message })
    }
  }

  return {
    async start() {
      await opts.client.connect()
      if (disposed) return
      logUnsub = opts.client.onLog((level, message) => {
        const lvl: 'info' | 'warn' | 'error' =
          level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'
        opts.onMessage({ type: 'LOG', level: lvl, message })
      })
      opts.onMessage({
        type: 'GAME_READY',
        gameName: opts.gameName,
        capabilities: ['spine', 'jst-nodes', 'webgl'],
      })
    },
    send(msg) {
      if (disposed) return
      switch (msg.type) {
        case 'EDITOR_CONNECT':
          return
        case 'REQUEST_TREE':
          void fetchTreeAndEmit()
          return
        case 'REQUEST_RELOAD':
          // No equivalent yet; ignore for MVP.
          return
        case 'SELECT_NODE':
          // setSelectedNodes wants numeric jst node ids; bone ids are strings.
          // For MVP we just echo NODE_SELECTED back from the local sceneStore.
          return
        case 'PICK_AT':
          // Hit-test is done client-side in CanvasPanel via sceneStore bounds.
          return
        case 'UPDATE_PROPERTY':
          // Only bone transforms are editable in MVP.
          return
        case 'PLACE_ASSET':
          return
        case 'UPDATE_TRANSFORM': {
          const split = splitBoneId(msg.nodeId)
          if (split === null) return
          void (async () => {
            try {
              const ack = await opts.client.updateBone(split.skeletonId, split.boneName, msg.transform)
              if (disposed) return
              opts.onMessage({
                type: 'TRANSFORM_CHANGED',
                nodeId: msg.nodeId,
                transform: ack.transform,
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              opts.onMessage({ type: 'BRIDGE_ERROR', code: 'UPDATE_BONE_FAILED', message })
            }
          })()
          return
        }
      }
    },
    dispose() {
      disposed = true
      if (logUnsub !== null) {
        logUnsub()
        logUnsub = null
      }
      opts.client.dispose()
    },
  }
}
```

- [ ] **Step 4: Add re-export in `src/bridge/index.ts`.**

Edit `src/bridge/index.ts`, appending:

```ts
export { createWheatleyBridgeClient } from './wheatleyBridge'
export type { WheatleyBridgeClient, WheatleyBridgeClientOptions } from './wheatleyBridge'
```

- [ ] **Step 5: Run tests and typecheck.**

```
cd D:/work/game-tool && npm run test:run -- src/bridge/wheatleyBridge.test.ts && npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit.**

```
git -C D:/work/game-tool add src/bridge/wheatleyBridge.ts src/bridge/wheatleyBridge.test.ts src/bridge/index.ts
git -C D:/work/game-tool commit -m "bridge: wheatley adapter exposing BridgeClient shape"
```

---

## Task 6: CanvasPanel — dispatch between iframe and wheatley bridges

**Files:**
- Modify: `src/ui/panels/CanvasPanel.tsx`
- Modify: `src/ui/panels/CanvasPanel.test.tsx`

Behaviour:
- If `bridgeMode === 'iframe'` (default): current code path unchanged.
- If `bridgeMode === 'wheatley'`: iframe still mounts at `gameUrl` (visual context) BUT a `WheatleyBridgeClient` drives the data flow via WS. `setActiveBridgeClient` receives a minimal adapter that exposes `send` / `dispose`.

- [ ] **Step 1: Write a failing test.**

Add to `src/ui/panels/CanvasPanel.test.tsx` (or create the test if it doesn't yet cover this — peek with the Read tool first). The test should mount `<CanvasPanel />` with `bridgeMode === 'wheatley'` and verify that no iframe `postMessage` flows out — and that a WheatleyClient factory is invoked.

To make this testable without standing up a real WS, expose a factory injection in `CanvasPanel`. Recommended approach: pull the wheatley client + bridge construction into a tiny default export in `CanvasPanel.tsx` and let the test mock it via `vi.mock`.

```ts
// in CanvasPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useProjectStore } from '../../stores/projectStore'
import { CanvasPanel } from './CanvasPanel'

vi.mock('../../wheatley/client', () => ({
  createWheatleyClient: vi.fn(() => ({
    connect: vi.fn(() => Promise.resolve()),
    dispose: vi.fn(),
    clientId: () => 'cid',
    runtimeId: () => 'rid',
    getSkeletons: vi.fn(() => Promise.resolve({ root: { id: '', name: '', children: [], skeletons: [] } })),
    getBoneWorldTransforms: vi.fn(),
    updateBone: vi.fn(),
    setSelectedNodes: vi.fn(),
    onLog: vi.fn(() => () => {}),
  })),
}))

describe('CanvasPanel — wheatley mode', () => {
  beforeEach(() => {
    useProjectStore.setState({ bridgeMode: 'wheatley', gameUrl: 'http://localhost/games/BigBait_8100/...' })
  })

  it('mounts iframe and constructs WheatleyClient when bridgeMode === "wheatley"', async () => {
    const wheatleyModule = await import('../../wheatley/client')
    const created = vi.mocked(wheatleyModule.createWheatleyClient)
    await act(async () => {
      render(<CanvasPanel />)
    })
    expect(created).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run, expect fail.**

```
cd D:/work/game-tool && npm run test:run -- src/ui/panels/CanvasPanel.test.tsx
```

Expected: FAIL (createWheatleyClient not yet referenced from CanvasPanel).

- [ ] **Step 3: Modify `src/ui/panels/CanvasPanel.tsx`.**

Refactor the existing `useEffect` to branch on `bridgeMode`:

```tsx
import { useProjectStore } from '../../stores/projectStore'
// ... existing imports
import { createWheatleyClient } from '../../wheatley/client'
import { createWheatleyBridgeClient } from '../../bridge'

// ...inside CanvasPanel():
const bridgeMode = useProjectStore((s) => s.bridgeMode)
const projectName = useProjectStore((s) => s.projectName)

useEffect(() => {
  if (bridgeMode === 'iframe') {
    // ...existing iframe / createBridgeClient path
    // (keep unchanged)
    return
  }

  markConnecting()
  const wheatley = createWheatleyClient({
    gameName: (projectName ?? '') + ' [' + navigator.platform + ']',
    version: '1.0.0',
  })
  const bridge = createWheatleyBridgeClient({
    client: wheatley,
    gameName: projectName ?? 'Unknown',
    onMessage: (msg) => {
      // route msg into the same switch as the iframe path
      switch (msg.type) {
        case 'GAME_READY': /* ... */ break
        // ...
      }
    },
  })
  // Set active client for outbound editor commands.
  const adapter: BridgeClient = {
    send: bridge.send,
    dispose: bridge.dispose,
  }
  clientRef.current = adapter
  setActiveBridgeClient(adapter)
  bridge.start().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    markError(message)
  })

  return () => {
    bridge.dispose()
    setActiveBridgeClient(null)
    clientRef.current = null
  }
}, [bridgeMode, gameUrl, projectName, /* ...other deps unchanged */ ])
```

Reuse the existing `onMessage` switch by extracting it into a `function handleGameMessage(msg: GameMessage): void` defined inside the component. Pass that function as `onMessage` to both `createBridgeClient` (iframe path) and `createWheatleyBridgeClient` (wheatley path). This keeps NODE_TREE → setTree, TRANSFORM_CHANGED → spinePatchStore wiring intact.

Keep the iframe element rendering unchanged (it remains the visual surface in both modes).

- [ ] **Step 4: Run tests; typecheck.**

```
cd D:/work/game-tool && npm run test:run -- src/ui/panels/CanvasPanel.test.tsx && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run the full test suite to make sure existing CanvasPanel behaviours still pass.**

```
cd D:/work/game-tool && npm run test:run -- src/ui/panels/CanvasPanel.test.tsx && npm run test:run -- src/stores/projectStore.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit.**

```
git -C D:/work/game-tool add src/ui/panels/CanvasPanel.tsx src/ui/panels/CanvasPanel.test.tsx
git -C D:/work/game-tool commit -m "canvas: branch on bridgeMode (iframe vs wheatley) without changing render"
```

---

## Task 7: SettingsPanel — bridgeMode toggle

**Files:**
- Modify: `src/ui/panels/SettingsPanel.tsx`
- Modify: `src/ui/panels/SettingsPanel.test.tsx`

- [ ] **Step 1: Inspect current SettingsPanel.**

Read both files. Identify a sensible section ("Bridge" or "Connection") to host the toggle. Match the existing form pattern (the file already drives `selectedBalanceType` etc.).

- [ ] **Step 2: Write failing test.**

Add to `src/ui/panels/SettingsPanel.test.tsx`:

```ts
it('toggles bridgeMode between iframe and wheatley', async () => {
  useProjectStore.setState({ bridgeMode: 'iframe', isOpen: true })
  render(<SettingsPanel />)
  const radioWheatley = screen.getByLabelText(/wheatley/i) as HTMLInputElement
  await userEvent.click(radioWheatley)
  expect(useProjectStore.getState().bridgeMode).toBe('wheatley')
})
```

(Adjust imports — `userEvent`, `screen`, `render`, `useProjectStore` — to match existing patterns in the file.)

- [ ] **Step 3: Run, expect fail.**

```
cd D:/work/game-tool && npm run test:run -- src/ui/panels/SettingsPanel.test.tsx
```

Expected: FAIL.

- [ ] **Step 4: Implement.**

Add a section in `SettingsPanel.tsx`:

```tsx
const bridgeMode = useProjectStore((s) => s.bridgeMode)
const setBridgeMode = useProjectStore((s) => s.setBridgeMode)

// ... inside the JSX:
<fieldset className={styles.section}>
  <legend>Bridge</legend>
  <label>
    <input
      type="radio"
      name="bridgeMode"
      checked={bridgeMode === 'iframe'}
      onChange={() => setBridgeMode('iframe')}
    />
    Iframe (test game / bundled bridge SDK)
  </label>
  <label>
    <input
      type="radio"
      name="bridgeMode"
      checked={bridgeMode === 'wheatley'}
      onChange={() => setBridgeMode('wheatley')}
    />
    Wheatley (real studio games via WebSocket)
  </label>
</fieldset>
```

(Use existing CSS class names; create new ones in `SettingsPanel.module.css` if the section needs them.)

- [ ] **Step 5: Run tests; typecheck; full suite sanity.**

```
cd D:/work/game-tool && npm run test:run && npm run typecheck
```

Expected: All tests PASS, no type errors.

- [ ] **Step 6: Commit.**

```
git -C D:/work/game-tool add src/ui/panels/SettingsPanel.tsx src/ui/panels/SettingsPanel.test.tsx src/ui/panels/SettingsPanel.module.css
git -C D:/work/game-tool commit -m "settings: bridge mode toggle (iframe vs wheatley)"
```

---

## Task 8: Scaffold `wheatley-runtime-gametool` repo

**Files (new repo at `D:\work\wheatley-runtime-gametool\`):**
- Create: `package.json`
- Create: `index.js`
- Create: `gulpfile.js`
- Create: `README.md`
- Create: `.gitignore`

Mirror the layout from `D:\work\big-bait\client\node_modules\wheatley-runtime-knoxslotjs\` (which the engineer can re-read for reference). The package is local-only for MVP — big-bait will consume it via `yarn link`, not via gitlab, until we publish.

- [ ] **Step 1: Create the repo directory and initialise git.**

```
mkdir D:/work/wheatley-runtime-gametool
cd D:/work/wheatley-runtime-gametool
git init
```

- [ ] **Step 2: Create `package.json`.**

```json
{
  "name": "wheatley-runtime-gametool",
  "version": "0.1.0",
  "license": "UNLICENSED",
  "private": true,
  "main": "index.js",
  "scripts": {
    "lint": "echo skip"
  },
  "peerDependencies": {
    "wheatley-common": "*",
    "wheatley-runtime": "*"
  }
}
```

- [ ] **Step 3: Create `index.js` (mirrors `wheatley-runtime-knoxslotjs/index.js`).**

```js
module.exports = {
  packageJsonPath: __dirname + '/package.json',
};

module.exports.extendConfig = function(jsbuildConfig) {
    jsbuildConfig.wheatley = jsbuildConfig.wheatley || {};
    jsbuildConfig.wheatley.scripts = jsbuildConfig.wheatley.scripts || [];
    jsbuildConfig.wheatley.scripts.push('node_modules/wheatley-runtime-gametool/src/**/*.js');
    return jsbuildConfig;
};

module.exports.extendGulp = function(gulp /*, config */) {
    return gulp;
};
```

- [ ] **Step 4: Create `gulpfile.js` (minimal — we won't run gulp here for MVP; the host game's gulpfile picks up our files via `extendConfig`).**

```js
// Minimal gulpfile. Builds run via the consuming game's gulp pipeline.
var gulp = require('gulp');
gulp.task('default', function(done) { done(); });
```

- [ ] **Step 5: Create `README.md`.**

```markdown
# wheatley-runtime-gametool

A wheatley-runtime extension module that exposes a `spine_bone_edit` feature for
game-tool. Adds two message types:

- `update_bone {skeleton_id, bone_name, transform: {x?, y?, rotation?, scaleX?, scaleY?}}`
  → mutates the live spine bone (setup-pose and current value).
- `get_bone_world_transforms {skeleton_id}`
  → returns `{bones: [{name, worldX, worldY, a, b, c, d}, ...]}`.

## Installation

```
yarn add --dev git+ssh://git@gitlab.cego.dk:magnet-game-lib/wheatley-runtime-gametool.git
```

Add to your game's `debug/wheatley.js`:

```js
goog.require('wheatley.runtime.gametool.Module');

wheatley.start = function(gameInstance, config) {
    wheatley.runtime.Runtime.start(
        gameInstance, config,
        wheatley.runtime.Module.register,
        wheatley.runtime.knoxslot.Module.register,  // if applicable
        wheatley.runtime.gametool.Module.register
    );
};
```

And to your gulpfile:

```js
if (hasPackage('wheatley-runtime-gametool')) {
    jsbuild.register(require('wheatley-runtime-gametool'));
}
```
```

- [ ] **Step 6: Create `.gitignore`.**

```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 7: Initial commit.**

```
cd D:/work/wheatley-runtime-gametool
git add .
git commit -m "scaffold wheatley-runtime-gametool package"
```

---

## Task 9: Implement `SpineBoneEditLogic` and module registration

**Files:**
- Create: `D:\work\wheatley-runtime-gametool\src\module.js`
- Create: `D:\work\wheatley-runtime-gametool\src\logic\spineboneeditlogic.js`

This is Closure-style JS. Compare with `D:\work\big-bait\client\node_modules\wheatley-runtime\src\engine\logic\spinelogic.js` for the exact patterns (constructor, register, message subscription).

- [ ] **Step 1: Create `src/module.js`.**

```js
goog.provide('wheatley.runtime.gametool.Module');

goog.require('wheatley.runtime.gametool.logic.SpineBoneEditLogic');

goog.forwardDeclare('jst.spine.SpineDebugInterface');
goog.forwardDeclare('knox.DefaultKnoxGame');
goog.forwardDeclare('wheatley.runtime.DependencyManager');
goog.forwardDeclare('wheatley.runtime.Runtime');


/**
 * @param {!wheatley.runtime.Runtime} runtime
 * @param {!wheatley.runtime.DependencyManager} dependencyManager
 */
wheatley.runtime.gametool.Module.register = function(runtime, dependencyManager) {
    var gameInstance = runtime.getGameInstance(),
        defaultKnoxGame = /** @type {?knox.DefaultKnoxGame} */ (COMPILED ? null : gameInstance),
        spineDebugInterface = defaultKnoxGame === null ? null : defaultKnoxGame.getSpineDebugInterface(),
        sendMessage = goog.bind(runtime.sendMessage, runtime),
        messageSub = runtime.getMessageSub();

    wheatley.runtime.gametool.logic.SpineBoneEditLogic.register(
        dependencyManager, 'spine_bone_edit', messageSub, sendMessage, spineDebugInterface
    );
};
```

- [ ] **Step 2: Create `src/logic/spineboneeditlogic.js`.**

```js
goog.provide('wheatley.runtime.gametool.logic.SpineBoneEditLogic');

goog.require('goog.array');

goog.forwardDeclare('jst.core.Sub');
goog.forwardDeclare('jst.spine.SpineDebugInterface');
goog.forwardDeclare('wheatley.runtime.DependencyManager');


/**
 * @constructor
 * @struct
 * @param {!jst.core.Sub} messageSub
 * @param {function(string, !Object=)} sendMessage
 * @param {!jst.spine.SpineDebugInterface} spineDebugInterface
 */
wheatley.runtime.gametool.logic.SpineBoneEditLogic = function(messageSub, sendMessage, spineDebugInterface) {
    var MessageTypes = wheatley.runtime.gametool.logic.SpineBoneEditLogic.MessageTypes;

    /** @const @private */ this.sendMessage_ = sendMessage;
    /** @const @private */ this.spineDebugInterface_ = spineDebugInterface;

    messageSub.subscribe(MessageTypes.UPDATE_BONE, this.onUpdateBone_, this);
    messageSub.subscribe(MessageTypes.GET_BONE_WORLD_TRANSFORMS, this.onGetBoneWorldTransforms_, this);
};


/**
 * @param {!wheatley.runtime.DependencyManager} dependencyManager
 * @param {string} dependencyId
 * @param {!jst.core.Sub} messageSub
 * @param {function(string, !Object=)} sendMessage
 * @param {?jst.spine.SpineDebugInterface} spineDebugInterface
 */
wheatley.runtime.gametool.logic.SpineBoneEditLogic.register = function(dependencyManager, dependencyId, messageSub, sendMessage, spineDebugInterface) {
    if (goog.isNull(spineDebugInterface)) {
        return;
    }
    dependencyManager.registerDependency(dependencyId, function() {
        return new wheatley.runtime.gametool.logic.SpineBoneEditLogic(messageSub, sendMessage, /** @type {!jst.spine.SpineDebugInterface} */(spineDebugInterface));
    });
};


/** @enum {string} */
wheatley.runtime.gametool.logic.SpineBoneEditLogic.MessageTypes = {
    UPDATE_BONE: 'update_bone',
    UPDATE_BONE_ACK: 'update_bone_ack',
    GET_BONE_WORLD_TRANSFORMS: 'get_bone_world_transforms'
};


/**
 * @private
 * @param {string} skeletonId
 * @return {?Object}
 */
wheatley.runtime.gametool.logic.SpineBoneEditLogic.prototype.findFirstSkeleton_ = function(skeletonId) {
    var item, instances;

    if (goog.array.indexOf(this.spineDebugInterface_.getKeys(), skeletonId) < 0) {
        return null;
    }
    item = this.spineDebugInterface_.getItem(skeletonId);
    instances = goog.isFunction(item.getInstanceList) ? item.getInstanceList() : null;
    if (!instances || instances.length === 0) {
        return null;
    }
    return instances[0].getSkeleton();
};


/**
 * @private
 * @param {!Object} message
 */
wheatley.runtime.gametool.logic.SpineBoneEditLogic.prototype.onUpdateBone_ = function(message) {
    var MessageTypes = wheatley.runtime.gametool.logic.SpineBoneEditLogic.MessageTypes,
        skeletonId = message['skeleton_id'],
        boneName = message['bone_name'],
        transform = message['transform'] || {},
        nodeSkeleton = this.findFirstSkeleton_(skeletonId),
        runtimeSkeleton,
        bone,
        i;

    if (!nodeSkeleton) {
        this.sendMessage_('error', { 'message': 'Unknown skeleton: ' + skeletonId });
        return;
    }
    // jst.spine.engine.NodeSkeleton wraps a spine.Skeleton at .skeleton_ (see jst-spine sources).
    runtimeSkeleton = /** @type {!Object} */(nodeSkeleton)['skeleton_'];
    if (!runtimeSkeleton || !runtimeSkeleton.bones) {
        return;
    }

    bone = null;
    for (i = 0; i < runtimeSkeleton.bones.length; i++) {
        if (runtimeSkeleton.bones[i].data && runtimeSkeleton.bones[i].data.name === boneName) {
            bone = runtimeSkeleton.bones[i];
            break;
        }
    }

    if (!bone) {
        this.sendMessage_('error', { 'message': 'Unknown bone: ' + skeletonId + '/' + boneName });
        return;
    }

    // Mutate BOTH the setup-pose source (bone.data) and the live applied values (bone.*)
    // so the change persists across the runtime's per-frame reset AND shows on the
    // very next paint.
    goog.array.forEach(['x', 'y', 'rotation', 'scaleX', 'scaleY'], function(field) {
        if (goog.isDefAndNotNull(transform[field])) {
            bone.data[field] = transform[field];
            bone[field] = transform[field];
        }
    });

    this.sendMessage_(MessageTypes.UPDATE_BONE_ACK, {
        'skeleton_id': skeletonId,
        'bone_name': boneName,
        'transform': {
            'x': bone.x,
            'y': bone.y,
            'rotation': bone.rotation,
            'scaleX': bone.scaleX,
            'scaleY': bone.scaleY
        }
    });
};


/**
 * @private
 * @param {!Object} message
 */
wheatley.runtime.gametool.logic.SpineBoneEditLogic.prototype.onGetBoneWorldTransforms_ = function(message) {
    var MessageTypes = wheatley.runtime.gametool.logic.SpineBoneEditLogic.MessageTypes,
        skeletonId = message['skeleton_id'],
        nodeSkeleton = this.findFirstSkeleton_(skeletonId),
        runtimeSkeleton,
        out;

    if (!nodeSkeleton) {
        this.sendMessage_(MessageTypes.GET_BONE_WORLD_TRANSFORMS, {
            'skeleton_id': skeletonId, 'bones': []
        });
        return;
    }
    runtimeSkeleton = /** @type {!Object} */(nodeSkeleton)['skeleton_'];
    out = [];
    if (runtimeSkeleton && runtimeSkeleton.bones) {
        goog.array.forEach(runtimeSkeleton.bones, function(bone) {
            out.push({
                'name': bone.data ? bone.data.name : '<anon>',
                'worldX': bone.worldX,
                'worldY': bone.worldY,
                'a': bone.a, 'b': bone.b, 'c': bone.c, 'd': bone.d
            });
        });
    }
    this.sendMessage_(MessageTypes.GET_BONE_WORLD_TRANSFORMS, {
        'skeleton_id': skeletonId, 'bones': out
    });
};
```

- [ ] **Step 3: Commit.**

```
cd D:/work/wheatley-runtime-gametool
git add src/module.js src/logic/spineboneeditlogic.js
git commit -m "feat: spine_bone_edit logic (update_bone + get_bone_world_transforms)"
```

(Note: no Closure unit-test step here. Studio convention is `npm run test` = lint + gulp build. We validate by smoke test in Task 11 — wiring it into big-bait and editing a bone end-to-end.)

---

## Task 10: Integrate `wheatley-runtime-gametool` into big-bait

**Files (in `D:\work\big-bait\client\`):**
- Modify: `package.json`
- Modify: `gulpfile.js`
- Modify: `debug/wheatley.js`

- [ ] **Step 1: `yarn link` the local package.**

```
cd D:/work/wheatley-runtime-gametool && yarn link
cd D:/work/big-bait/client && yarn link wheatley-runtime-gametool
```

- [ ] **Step 2: Add the package to `client/package.json` devDependencies.**

Find the existing `wheatley-runtime` entry. Add right after it:

```json
"wheatley-runtime-gametool": "*",
```

(The `*` placeholder pairs with the `yarn link` so the local copy is used. When we publish to gitlab we'll switch to a `git+ssh://...#<tag>` URL.)

- [ ] **Step 3: Wire into `client/gulpfile.js`.**

Find the block where other `wheatley-runtime-*` packages are registered with `hasPackage`. Add:

```js
if (hasPackage('wheatley-runtime-gametool')) {
    jsbuild.register(require('wheatley-runtime-gametool'));
}
```

- [ ] **Step 4: Wire into `client/debug/wheatley.js`.**

Open the file. It currently looks like:

```js
goog.provide('wheatley');

goog.require('wheatley.runtime.Module');
goog.require('wheatley.runtime.Runtime');
goog.require('wheatley.runtime.knoxslot.Module');

wheatley.start = function(gameInstance, config) {
    wheatley.runtime.Runtime.start(gameInstance, config, wheatley.runtime.Module.register, wheatley.runtime.knoxslot.Module.register);
};

goog.exportSymbol('startWheatley', wheatley.start);
```

Change to:

```js
goog.provide('wheatley');

goog.require('wheatley.runtime.Module');
goog.require('wheatley.runtime.Runtime');
goog.require('wheatley.runtime.gametool.Module');
goog.require('wheatley.runtime.knoxslot.Module');

wheatley.start = function(gameInstance, config) {
    wheatley.runtime.Runtime.start(
        gameInstance, config,
        wheatley.runtime.Module.register,
        wheatley.runtime.knoxslot.Module.register,
        wheatley.runtime.gametool.Module.register
    );
};

goog.exportSymbol('startWheatley', wheatley.start);
```

- [ ] **Step 5: Run big-bait's gulp build to make sure the new module compiles into the bundle.**

```
cd D:/work/big-bait/client && yarn run gulp build_deps
```

Expected: no Closure errors. If `goog.require('wheatley.runtime.gametool.Module')` fails, double-check the `yarn link` step and that big-bait's `node_modules/wheatley-runtime-gametool` resolves to our local directory.

- [ ] **Step 6: Commit in big-bait.**

```
git -C D:/work/big-bait add client/package.json client/gulpfile.js client/debug/wheatley.js
git -C D:/work/big-bait commit -m "wheatley: register wheatley-runtime-gametool extension"
```

---

## Task 11: End-to-end smoke test against big-bait

**Files:**
- Create: `docs/superpowers/plans/2026-05-25-plan-11-smoke-test-results.md`
- Modify: `docs/superpowers/ROADMAP.md` (mark Plan 11 merged)

- [ ] **Step 1: Start the prerequisites.**

In three separate terminals:
- `wheatley-server`: `cd /c/Users/kimok/AppData/Local/Yarn/Data/global/node_modules/wheatley-server && yarn start` (or wherever the project's launch script lives — confirm port 9150).
- GLaDOS: `glados` (already on PATH as a yarn shim).
- big-bait: GLaDOS auto-runs its gulp. Confirm the game loads at `http://localhost/games/BigBait_8100/client/debug/testfullscreen.html?...`.

Take screenshot 1: big-bait running standalone, showing the existing Wheatley link popup in the upper right.

- [ ] **Step 2: Start game-tool.**

```
cd D:/work/game-tool && npm run dev
```

Open `http://localhost:5173`. Open a big-bait project folder via the Open Project menu (or load via `loadProjectConfig`).

- [ ] **Step 3: Toggle bridgeMode to "wheatley" in Settings.**

Settings panel → Bridge → Wheatley.

Take screenshot 2: Settings panel with Wheatley selected.

- [ ] **Step 4: Verify connection.**

The bridge status badge should transition `disconnected → connecting → connected`. Open the Console panel: confirm no `BRIDGE_ERROR` entries.

Scene tree should populate with skeletons + bones (one entry per skeleton, expanded to show bones).

Take screenshot 3: scene tree with big-bait's spine skeletons + bones.

- [ ] **Step 5: Edit a bone.**

Click a bone in the scene tree (e.g. `spinner_container` under `main_scene.main_scene.Skeleton`). The gizmo overlay appears at the bone's worldX/Y. Drag it ~30 px.

In the iframe: the bone position should visibly change. (If an idle animation is playing the change may snap back per the documented animation-freeze deferral.)

Take screenshot 4: gizmo dragged + bone shifted in the iframe.

- [ ] **Step 6: Verify disk write.**

In a terminal:

```
ls -la D:/work/big-bait/client/media/skeletons_json/main_scene/main_scene/Skeleton.json
```

Note mtime. Open the file: confirm the bone's `x` (or `y`) field reflects the dragged value.

- [ ] **Step 7: Write the results doc.**

Create `docs/superpowers/plans/2026-05-25-plan-11-smoke-test-results.md` with:
- Date/run identifier.
- Each screenshot, captioned.
- The before/after of `Skeleton.json` (use `git diff` snippet).
- A pass/fail line per the steps above.
- Any deferred issues observed (animation snap-back, bounds inaccuracy, etc.).

- [ ] **Step 8: Update ROADMAP.**

In `docs/superpowers/ROADMAP.md`, change the Plan 11 heading from `⭐ next big item` to `✅ MERGED 2026-MM-DD` and shorten the body to a one-line summary plus a pointer to the spec + smoke-test docs (follow the format used for Plan 10).

- [ ] **Step 9: Commit on game-tool.**

```
git -C D:/work/game-tool add docs/superpowers/plans/2026-05-25-plan-11-smoke-test-results.md docs/superpowers/ROADMAP.md
git -C D:/work/game-tool commit -m "docs: plan 11 smoke test results + roadmap update"
```

- [ ] **Step 10: Merge into main (per the worktree convention).**

Use the finishing-a-development-branch workflow. Memory note: `--no-ff` merge into main; ask before pushing.

---

## Self-review

**Spec coverage:**
- Architecture: WheatleyClient + WheatleyBridgeClient + wheatley-runtime-gametool. Tasks 3, 5, 9. ✓
- iframe + wheatley coexistence: projectStore.bridgeMode + CanvasPanel branch. Tasks 1, 6. ✓
- Disk write reuses Plan 10: boneAdapter sets `owner`, CanvasPanel's TRANSFORM_CHANGED handler already enqueues into `spinePatchStore`. Task 4. ✓
- No script injection: confirmed — only WS. Task 5 explicitly does NOT add anything to the iframe. ✓
- big-bait three-line opt-in: Task 10. ✓
- Error handling (WS fail, no matching runtime, missing feature): Task 3 timeout + Task 5 `BRIDGE_ERROR` emission. ✓
- Testing (Vitest units + manual smoke): Tasks 1-7 + Task 11. ✓
- Settings UI: Task 7. ✓
- Bone bounds = 48×48 around worldX/worldY: Task 4. ✓
- mutate bone.data + bone.* : Task 9. ✓
- Animation freeze deferred: documented in Task 11 results.

**Placeholder scan:** No TBDs, no "implement later", no "similar to Task N" references that omit code. ✓

**Type consistency:**
- `BridgeMode` defined in Task 1, consumed in Tasks 6 + 7. Same string union.
- `WheatleyClient` shape in Task 3 is consumed unchanged in Tasks 5 + 6. ✓
- Adapter `RegisteredNode`/`NodeSnapshot` produced by Task 4 lines up with `src/types/scene.ts` (no fields invented). ✓
- Bone id format `${skeletonId}:${boneName}` defined in Task 4, parsed back in Task 5 (`splitBoneId`). ✓
- wheatley message types in Task 2 match those subscribed/sent in Task 9 (`update_bone`, `update_bone_ack`, `get_bone_world_transforms`). ✓
