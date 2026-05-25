import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { EditorMessage } from '../types/bridge'
import { getActiveBridgeClient, setActiveBridgeClient, sendToGame } from './activeClient'

describe('activeClient', () => {
  beforeEach(() => {
    setActiveBridgeClient(null)
  })

  test('returns null when no client is registered', () => {
    expect(getActiveBridgeClient()).toBeNull()
  })

  test('returns the registered client', () => {
    const fake = { send: vi.fn(), dispose: vi.fn() }
    setActiveBridgeClient(fake)
    expect(getActiveBridgeClient()).toBe(fake)
  })

  test('sendToGame forwards to the active client', () => {
    const send = vi.fn()
    setActiveBridgeClient({ send, dispose: vi.fn() })
    const msg: EditorMessage = { type: 'UPDATE_PROPERTY', nodeId: 'a', key: 'health', value: 50 }
    sendToGame(msg)
    expect(send).toHaveBeenCalledWith(msg)
  })

  test('sendToGame no-ops when no client is active', () => {
    const msg: EditorMessage = { type: 'REQUEST_TREE' }
    expect(() => sendToGame(msg)).not.toThrow()
  })
})
