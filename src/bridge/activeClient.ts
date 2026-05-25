import type { EditorMessage } from '../types/bridge'
import type { BridgeClient } from './client'

let active: BridgeClient | null = null

export function setActiveBridgeClient(client: BridgeClient | null): void {
  active = client
}

export function getActiveBridgeClient(): BridgeClient | null {
  return active
}

export function sendToGame(msg: EditorMessage): void {
  if (active === null) return
  active.send(msg)
}
