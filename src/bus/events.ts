import type { NodeSnapshot } from '../types/scene'

export type EditorEvent =
  | { type: 'bridge:connected' }
  | { type: 'bridge:disconnected' }
  | { type: 'bridge:node-selected'; nodeId: string | null }
  | { type: 'bridge:tree-updated' }
  | { type: 'project:opened'; rootPath: string }
  | { type: 'project:closed' }
  | { type: 'asset:deleted'; path: string }
  | { type: 'asset:generated'; path: string }
  | { type: 'spine-json:patched'; path: string }
  | { type: 'config:saved'; path: string }

export type EventOf<T extends EditorEvent['type']> = Extract<EditorEvent, { type: T }>

// Re-export for test convenience
export type { NodeSnapshot }
