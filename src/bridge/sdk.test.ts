import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import type { BridgeEnvelope, EditorMessage, GameMessage } from '../types/bridge'
import { wrap } from './protocol'
import { createBridge } from './sdk'

type CapturedPost = { data: unknown; target: string }

describe('bridge SDK', () => {
  let captured: CapturedPost[]
  let postSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    captured = []
    postSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(((
      data: unknown,
      target: string,
    ) => {
      captured.push({ data, target })
    }) as typeof window.parent.postMessage)
  })

  afterEach(() => {
    postSpy.mockRestore()
  })

  test('connect() emits GAME_READY with declared capabilities', () => {
    const bridge = createBridge()
    bridge.connect({
      gameName: 'TestGame',
      capabilities: ['canvas2d'],
    })
    expect(captured).toHaveLength(1)
    const env = captured[0].data as BridgeEnvelope
    expect(env.__gameTool).toBe('bridge')
    expect(env.payload).toEqual({
      type: 'GAME_READY',
      gameName: 'TestGame',
      capabilities: ['canvas2d'],
      metadata: undefined,
    })
  })

  test('register() exposes a node that REQUEST_TREE then returns', () => {
    const bridge = createBridge()
    bridge.connect({ gameName: 'TestGame', capabilities: ['canvas2d'] })
    captured.length = 0

    bridge.register({
      id: 'box-1',
      kind: 'sprite',
      name: 'Player',
      transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: { x: 0, y: 0, width: 40, height: 40 },
      schema: [
        { key: 'health', type: 'number', label: 'Health' },
      ],
      get: () => ({ health: 100 }),
      set: () => {},
    })

    deliver(window, { type: 'REQUEST_TREE' })

    const treeMsg = lastSentOfType(captured, 'NODE_TREE')
    expect(treeMsg).toBeDefined()
    expect(treeMsg!.nodes).toHaveLength(1)
    expect(treeMsg!.nodes[0]).toMatchObject({
      id: 'box-1',
      name: 'Player',
      transform: { x: 10, y: 20 },
    })
    expect(treeMsg!.nodes[0].values).toEqual({ health: 100 })
  })

  test('SELECT_NODE causes NODE_SELECTED to be sent with the snapshot', () => {
    const bridge = createBridge()
    bridge.connect({ gameName: 'TestGame', capabilities: ['canvas2d'] })
    bridge.register({
      id: 'box-1',
      kind: 'sprite',
      name: 'Player',
      transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: null,
      schema: [],
      get: () => ({}),
      set: () => {},
    })
    captured.length = 0

    deliver(window, { type: 'SELECT_NODE', nodeId: 'box-1' })

    const sel = lastSentOfType(captured, 'NODE_SELECTED')
    expect(sel).toBeDefined()
    expect(sel!.node).not.toBeNull()
    expect(sel!.node!.id).toBe('box-1')
  })

  test('PICK_AT returns NODE_SELECTED for the topmost hit by bounds, null if no hit', () => {
    const bridge = createBridge()
    bridge.connect({ gameName: 'TestGame', capabilities: ['canvas2d'] })
    bridge.register({
      id: 'box-1',
      kind: 'sprite',
      name: 'Box1',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: { x: 0, y: 0, width: 50, height: 50 },
      schema: [],
      get: () => ({}),
      set: () => {},
    })
    bridge.register({
      id: 'box-2',
      kind: 'sprite',
      name: 'Box2',
      transform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: { x: 100, y: 100, width: 50, height: 50 },
      schema: [],
      get: () => ({}),
      set: () => {},
    })
    captured.length = 0

    deliver(window, { type: 'PICK_AT', x: 25, y: 25 })
    expect(lastSentOfType(captured, 'NODE_SELECTED')?.node?.id).toBe('box-1')

    captured.length = 0
    deliver(window, { type: 'PICK_AT', x: 500, y: 500 })
    expect(lastSentOfType(captured, 'NODE_SELECTED')?.node).toBeNull()
  })

  test('disconnect() removes the message listener', () => {
    const bridge = createBridge()
    bridge.connect({ gameName: 'TestGame', capabilities: ['canvas2d'] })
    bridge.register({
      id: 'x',
      kind: 'sprite',
      name: 'X',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: null,
      schema: [],
      get: () => ({}),
      set: () => {},
    })
    bridge.disconnect()
    captured.length = 0

    deliver(window, { type: 'REQUEST_TREE' })
    expect(captured).toHaveLength(0)
  })
})

// helpers -------------------------------------------------------------

function deliver(target: Window, payload: EditorMessage) {
  const event = new MessageEvent('message', {
    data: wrap(payload),
    source: window.parent,
  })
  target.dispatchEvent(event)
}

function lastSentOfType<T extends (EditorMessage | GameMessage)['type']>(
  captured: CapturedPost[],
  type: T,
): Extract<EditorMessage | GameMessage, { type: T }> | undefined {
  for (let i = captured.length - 1; i >= 0; i--) {
    const p = getPayload(captured[i].data)
    if (p && p.type === type) return p as Extract<EditorMessage | GameMessage, { type: T }>
  }
  return undefined
}

function getPayload(data: unknown): EditorMessage | GameMessage | null {
  if (typeof data !== 'object' || data === null) return null
  const e = data as { __gameTool?: unknown; payload?: { type?: unknown } }
  if (e.__gameTool !== 'bridge' || !e.payload || typeof e.payload.type !== 'string') return null
  return e.payload as EditorMessage | GameMessage
}
