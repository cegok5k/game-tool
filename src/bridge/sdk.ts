import type { Capability, GameMetadata } from '../types/capabilities'
import type { GameMessage } from '../types/bridge'
import type { Bounds, FieldSchema, NodeKind, NodeSnapshot, Transform } from '../types/scene'
import { unwrap, wrap } from './protocol'

// Module-level active bridge — only one bridge may be connected at a time.
// This prevents stale listeners from accumulating (important in tests and in
// the common case where a game creates a single bridge instance).
let _activeBridge: { deactivate(): void } | null = null

export type RegisteredNode = {
  id: string
  kind: NodeKind
  name: string
  parentId?: string | null
  childIds?: readonly string[]
  transform: Transform
  bounds: Bounds | null
  schema: readonly FieldSchema[]
  get: () => Record<string, unknown>
  set: (props: Record<string, unknown>) => void
}

export type ConnectOptions = {
  gameName: string
  capabilities: readonly Capability[]
  metadata?: GameMetadata
}

export type Bridge = {
  connect(opts: ConnectOptions): void
  disconnect(): void
  register(node: RegisteredNode): void
  unregister(id: string): void
  notifyTransformChanged(nodeId: string): void
  notifyLog(level: 'info' | 'warn' | 'error', message: string): void
}

export function createBridge(): Bridge {
  const nodes = new Map<string, RegisteredNode>()
  let connected = false
  let listener: ((e: MessageEvent) => void) | null = null

  function send(msg: GameMessage): void {
    if (typeof window === 'undefined') return
    window.parent.postMessage(wrap(msg), '*')
  }

  function snapshotOf(node: RegisteredNode): NodeSnapshot {
    return {
      id: node.id,
      kind: node.kind,
      name: node.name,
      parentId: node.parentId ?? null,
      childIds: node.childIds ?? [],
      transform: node.transform,
      bounds: node.bounds,
      schema: node.schema,
      values: node.get(),
    }
  }

  function sendTree(): void {
    const snapshots: NodeSnapshot[] = []
    for (const n of nodes.values()) snapshots.push(snapshotOf(n))
    send({ type: 'NODE_TREE', nodes: snapshots })
  }

  function sendSelected(nodeId: string | null): void {
    if (nodeId === null) {
      send({ type: 'NODE_SELECTED', node: null })
      return
    }
    const node = nodes.get(nodeId)
    send({ type: 'NODE_SELECTED', node: node ? snapshotOf(node) : null })
  }

  function pickAt(x: number, y: number): string | null {
    const all = Array.from(nodes.values())
    for (let i = all.length - 1; i >= 0; i--) {
      const n = all[i]
      if (n.bounds === null) continue
      const b = n.bounds
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return n.id
      }
    }
    return null
  }

  function handleMessage(e: MessageEvent): void {
    if (!connected) return
    const msg = unwrap(e.data)
    if (msg === null) return
    switch (msg.type) {
      case 'REQUEST_TREE':
        sendTree()
        return
      case 'SELECT_NODE':
        sendSelected(msg.nodeId)
        return
      case 'PICK_AT':
        sendSelected(pickAt(msg.x, msg.y))
        return
      case 'UPDATE_PROPERTY': {
        const node = nodes.get(msg.nodeId)
        if (node) node.set({ [msg.key]: msg.value })
        return
      }
      case 'UPDATE_TRANSFORM': {
        const node = nodes.get(msg.nodeId)
        if (node) {
          node.transform = { ...node.transform, ...msg.transform }
          // Notify the game so it can apply the transform visually.
          // The transform fields (x, y, rotation, scaleX, scaleY) flow into set() as a prop bag.
          node.set(msg.transform as Record<string, unknown>)
          // Echo the resolved transform back to the editor so its sceneStore stays in sync
          // (the gizmo redraws at the new bounds, the Inspector reflects the new values).
          send({ type: 'TRANSFORM_CHANGED', nodeId: msg.nodeId, transform: node.transform })
        }
        return
      }
      case 'EDITOR_CONNECT':
      case 'REQUEST_RELOAD':
      case 'PLACE_ASSET':
        return
      // GameMessage types that arrive in the game context are silently ignored.
      case 'GAME_READY':
      case 'NODE_TREE':
      case 'NODE_SELECTED':
      case 'TRANSFORM_CHANGED':
      case 'LOG':
      case 'BRIDGE_ERROR':
        return
    }
    // exhaustiveness check — msg should be `never` here
    msg satisfies never
  }

  return {
    connect(opts) {
      if (connected) return
      // Deactivate any previously connected bridge before registering this one.
      if (_activeBridge !== null) {
        _activeBridge.deactivate()
      }
      connected = true
      listener = (e: MessageEvent) => handleMessage(e)
      window.addEventListener('message', listener)
      _activeBridge = {
        deactivate() {
          if (listener !== null) {
            window.removeEventListener('message', listener)
            listener = null
          }
          connected = false
          nodes.clear()
          _activeBridge = null
        },
      }
      send({
        type: 'GAME_READY',
        gameName: opts.gameName,
        capabilities: opts.capabilities,
        metadata: opts.metadata,
      })
    },
    disconnect() {
      _activeBridge?.deactivate()
    },
    register(node) {
      nodes.set(node.id, node)
    },
    unregister(id) {
      nodes.delete(id)
    },
    notifyTransformChanged(nodeId) {
      const node = nodes.get(nodeId)
      if (node) send({ type: 'TRANSFORM_CHANGED', nodeId, transform: node.transform })
    },
    notifyLog(level, message) {
      send({ type: 'LOG', level, message })
    },
  }
}
