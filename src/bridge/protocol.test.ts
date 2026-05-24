import { describe, expect, test } from 'vitest'
import type { EditorMessage, GameMessage } from '../types/bridge'
import { isBridgeEnvelope } from '../types/bridge'
import { wrap, unwrap } from './protocol'

describe('bridge protocol', () => {
  test('wrap creates envelope with v=1 and __gameTool marker', () => {
    const env = wrap({ type: 'PICK_AT', x: 10, y: 20 })
    expect(env.__gameTool).toBe('bridge')
    expect(env.v).toBe(1)
    expect(env.payload).toEqual({ type: 'PICK_AT', x: 10, y: 20 })
  })

  test('unwrap returns payload from envelope', () => {
    const env = wrap({ type: 'REQUEST_TREE' })
    const payload = unwrap(env)
    expect(payload).toEqual({ type: 'REQUEST_TREE' })
  })

  test('unwrap returns null for non-bridge messages', () => {
    expect(unwrap({ foo: 'bar' })).toBeNull()
    expect(unwrap(null)).toBeNull()
    expect(unwrap(undefined)).toBeNull()
    expect(unwrap('string')).toBeNull()
  })

  test('isBridgeEnvelope rejects different version', () => {
    expect(isBridgeEnvelope({ __gameTool: 'bridge', v: 999, payload: {} })).toBe(false)
  })

  test('roundtrip preserves a GAME_READY message', () => {
    const msg: GameMessage = {
      type: 'GAME_READY',
      gameName: 'TestGame',
      capabilities: ['canvas2d', 'hot-reload'],
      metadata: { balanceTypes: ['rhodium'] },
    }
    const env = wrap(msg)
    const restored = unwrap(env)
    expect(restored).toEqual(msg)
  })

  test('roundtrip preserves an UPDATE_TRANSFORM message', () => {
    const msg: EditorMessage = {
      type: 'UPDATE_TRANSFORM',
      nodeId: 'node-1',
      transform: { x: 100, y: 50 },
    }
    const env = wrap(msg)
    const restored = unwrap(env)
    expect(restored).toEqual(msg)
  })
})
