import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { GameMessage } from '../types/bridge'
import { wrap } from './protocol'
import { createBridgeClient } from './client'

describe('bridge client (editor side)', () => {
  let onMessage: ReturnType<typeof vi.fn>
  let postSpy: ReturnType<typeof vi.fn>
  let frame: HTMLIFrameElement

  beforeEach(() => {
    onMessage = vi.fn()
    postSpy = vi.fn()
    // Fake iframe with a contentWindow that records postMessage calls.
    frame = {
      contentWindow: { postMessage: postSpy },
    } as unknown as HTMLIFrameElement
  })

  test('send wraps the message in an envelope and posts to the iframe', () => {
    const client = createBridgeClient({ iframe: frame, onMessage })
    client.send({ type: 'REQUEST_TREE' })
    expect(postSpy).toHaveBeenCalledTimes(1)
    const env = postSpy.mock.calls[0][0]
    expect(env).toMatchObject({ __gameTool: 'bridge', v: 1, payload: { type: 'REQUEST_TREE' } })
    client.dispose()
  })

  test('listens for messages and forwards game messages to onMessage', () => {
    const client = createBridgeClient({ iframe: frame, onMessage })
    const gameMsg: GameMessage = { type: 'GAME_READY', gameName: 'X', capabilities: [] }
    window.dispatchEvent(new MessageEvent('message', { data: wrap(gameMsg) }))
    expect(onMessage).toHaveBeenCalledWith(gameMsg)
    client.dispose()
  })

  test('ignores non-bridge messages', () => {
    const client = createBridgeClient({ iframe: frame, onMessage })
    window.dispatchEvent(new MessageEvent('message', { data: { foo: 'bar' } }))
    expect(onMessage).not.toHaveBeenCalled()
    client.dispose()
  })

  test('ignores editor-direction messages (PICK_AT etc.)', () => {
    const client = createBridgeClient({ iframe: frame, onMessage })
    window.dispatchEvent(new MessageEvent('message', { data: wrap({ type: 'REQUEST_TREE' }) }))
    expect(onMessage).not.toHaveBeenCalled()
    client.dispose()
  })

  test('dispose stops listening', () => {
    const client = createBridgeClient({ iframe: frame, onMessage })
    client.dispose()
    window.dispatchEvent(new MessageEvent('message', { data: wrap({ type: 'GAME_READY', gameName: 'X', capabilities: [] }) }))
    expect(onMessage).not.toHaveBeenCalled()
  })
})
