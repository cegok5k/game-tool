import type { Capability, GameMetadata } from './capabilities'
import type { NodeSnapshot, Transform } from './scene'

// Editor → Game
export type EditorMessage =
  | { type: 'EDITOR_CONNECT' }
  | { type: 'PICK_AT'; x: number; y: number; modifier?: 'shift' | 'alt' }
  | { type: 'SELECT_NODE'; nodeId: string }
  | { type: 'UPDATE_TRANSFORM'; nodeId: string; transform: Partial<Transform> }
  | { type: 'UPDATE_PROPERTY'; nodeId: string; key: string; value: unknown }
  | { type: 'PLACE_ASSET'; assetPath: string; x: number; y: number }
  | { type: 'REQUEST_TREE' }
  | { type: 'REQUEST_RELOAD' }

// Game → Editor
export type GameMessage =
  | { type: 'GAME_READY'; gameName: string; capabilities: readonly Capability[]; metadata?: GameMetadata }
  | { type: 'NODE_TREE'; nodes: readonly NodeSnapshot[] }
  | { type: 'NODE_SELECTED'; node: NodeSnapshot | null }
  | { type: 'TRANSFORM_CHANGED'; nodeId: string; transform: Transform }
  | { type: 'LOG'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'BRIDGE_ERROR'; code: string; message: string }

// Envelope sent over postMessage
export type BridgeEnvelope = {
  __gameTool: 'bridge'
  v: 1
  payload: EditorMessage | GameMessage
}

export function isBridgeEnvelope(value: unknown): value is BridgeEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return obj.__gameTool === 'bridge' && obj.v === 1 && typeof obj.payload === 'object' && obj.payload !== null
}
