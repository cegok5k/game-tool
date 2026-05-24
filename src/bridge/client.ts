import type { EditorMessage, GameMessage } from '../types/bridge'
import { unwrap, wrap } from './protocol'

const GAME_MESSAGE_TYPES: ReadonlySet<GameMessage['type']> = new Set([
  'GAME_READY',
  'NODE_TREE',
  'NODE_SELECTED',
  'TRANSFORM_CHANGED',
  'LOG',
  'BRIDGE_ERROR',
])

function isGameMessage(msg: { type: string }): msg is GameMessage {
  return GAME_MESSAGE_TYPES.has(msg.type as GameMessage['type'])
}

export type BridgeClientOptions = {
  iframe: HTMLIFrameElement
  onMessage: (msg: GameMessage) => void
  targetOrigin?: string
}

export type BridgeClient = {
  send: (msg: EditorMessage) => void
  dispose: () => void
}

export function createBridgeClient(opts: BridgeClientOptions): BridgeClient {
  const targetOrigin = opts.targetOrigin ?? '*'

  function handle(e: MessageEvent): void {
    const msg = unwrap(e.data)
    if (msg === null) return
    if (!isGameMessage(msg)) return
    opts.onMessage(msg)
  }

  window.addEventListener('message', handle)

  return {
    send(msg) {
      const win = opts.iframe.contentWindow
      if (win === null) return
      win.postMessage(wrap(msg), targetOrigin)
    },
    dispose() {
      window.removeEventListener('message', handle)
    },
  }
}
