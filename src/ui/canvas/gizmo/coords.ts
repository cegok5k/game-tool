import type { Bounds } from '../../../types/scene'

export type HandleId =
  | 'nw' | 'n' | 'ne'
  | 'w'        | 'e'
  | 'sw' | 's' | 'se'
  | 'rotate'

export type HandlePosition = { id: HandleId; x: number; y: number }

export const ROTATE_HANDLE_OFFSET = 24

export function handlePositions(b: Bounds): HandlePosition[] {
  const left = b.x
  const right = b.x + b.width
  const top = b.y
  const bottom = b.y + b.height
  const midX = b.x + b.width / 2
  const midY = b.y + b.height / 2
  return [
    { id: 'nw', x: left,  y: top },
    { id: 'n',  x: midX,  y: top },
    { id: 'ne', x: right, y: top },
    { id: 'w',  x: left,  y: midY },
    { id: 'e',  x: right, y: midY },
    { id: 'sw', x: left,  y: bottom },
    { id: 's',  x: midX,  y: bottom },
    { id: 'se', x: right, y: bottom },
    { id: 'rotate', x: midX, y: top - ROTATE_HANDLE_OFFSET },
  ]
}
