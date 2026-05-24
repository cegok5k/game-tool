import type { BridgeEnvelope, EditorMessage, GameMessage } from '../types/bridge'
import { isBridgeEnvelope } from '../types/bridge'

export function wrap(payload: EditorMessage | GameMessage): BridgeEnvelope {
  return { __gameTool: 'bridge', v: 1, payload }
}

export function unwrap(value: unknown): EditorMessage | GameMessage | null {
  if (!isBridgeEnvelope(value)) return null
  return value.payload
}
