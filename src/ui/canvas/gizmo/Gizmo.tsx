import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import styles from './Gizmo.module.css'
import { handlePositions, type HandleId } from './coords'
import { useDragSession, type DragInfo, type Point } from './useDragSession'
import { snapPoint, snapAngle } from './snap'
import { sendToGame } from '../../../bridge'
import { useEditorStore } from '../../../stores/editorStore'
import { useSceneStore } from '../../../stores/sceneStore'
import type { NodeSnapshot, Transform } from '../../../types/scene'

const THROTTLE_MS = 33
const ANGLE_STEP_DEG = 15

const CORNER_HANDLES: ReadonlySet<HandleId> = new Set(['nw', 'ne', 'sw', 'se'])
const CORNER_FLIP:   ReadonlySet<HandleId> = new Set(['ne', 'sw'])
const EDGE_HORIZ:    ReadonlySet<HandleId> = new Set(['e', 'w'])

function dispatchTransform(nodeId: string, partial: Partial<Transform>): void {
  sendToGame({ type: 'UPDATE_TRANSFORM', nodeId, transform: partial })
}

export function Gizmo() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const node = useSceneStore((s) => (selectedId === null ? undefined : s.byId(selectedId)))
  const svgRef = useRef<SVGSVGElement | null>(null)

  if (node === undefined || node.bounds === null) return null

  return (
    <svg ref={svgRef} className={styles.svg}>
      <MoveBox node={node} />
      <ScaleHandles node={node} />
      <RotateHandle node={node} />
    </svg>
  )
}

function MoveBox({ node }: { node: NodeSnapshot }) {
  const snapEnabled = useEditorStore((s) => s.snapEnabled)
  const gridSize = useEditorStore((s) => s.gridSize)
  const startRef = useRef<Transform | null>(null)

  function apply(dx: number, dy: number) {
    const start = startRef.current
    if (start === null) return
    let nx = start.x + dx
    let ny = start.y + dy
    if (snapEnabled) {
      const p = snapPoint({ x: nx, y: ny }, gridSize)
      nx = p.x
      ny = p.y
    }
    dispatchTransform(node.id, { x: nx, y: ny })
  }

  const session = useDragSession({
    throttleMs: THROTTLE_MS,
    onMove: ({ dx, dy }) => apply(dx, dy),
    onCommit: ({ dx, dy }) => apply(dx, dy),
  })

  function onPointerDown(e: ReactPointerEvent<SVGRectElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = node.transform
    session.begin({ x: e.clientX, y: e.clientY })
  }

  if (node.bounds === null) return null
  const b = node.bounds
  return (
    <rect
      className={styles.box}
      x={b.x}
      y={b.y}
      width={b.width}
      height={b.height}
      aria-label="Move handle"
      onPointerDown={onPointerDown}
      onPointerMove={(e) => session.move({ x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        session.commit({ x: e.clientX, y: e.clientY })
        startRef.current = null
      }}
      onPointerCancel={() => { session.cancel(); startRef.current = null }}
    />
  )
}

function ScaleHandles({ node }: { node: NodeSnapshot }) {
  const startRef = useRef<{ transform: Transform; bounds: NonNullable<NodeSnapshot['bounds']>; handleId: HandleId } | null>(null)

  function dispatchScaleFromHandle(info: DragInfo) {
    const start = startRef.current
    if (start === null) return
    const { transform, bounds, handleId } = start
    const isLeft = handleId === 'nw' || handleId === 'w' || handleId === 'sw'
    const isTop  = handleId === 'nw' || handleId === 'n' || handleId === 'ne'
    const isHorizOnly = handleId === 'e' || handleId === 'w'
    const isVertOnly  = handleId === 'n' || handleId === 's'
    const dx = info.dx * (isLeft ? -1 : 1)
    const dy = info.dy * (isTop  ? -1 : 1)
    const newW = isVertOnly  ? bounds.width  : Math.max(1, bounds.width  + dx)
    const newH = isHorizOnly ? bounds.height : Math.max(1, bounds.height + dy)
    const scaleX = transform.scaleX * (newW / bounds.width)
    const scaleY = transform.scaleY * (newH / bounds.height)
    dispatchTransform(node.id, { scaleX, scaleY })
  }

  if (node.bounds === null) return null
  const handles = handlePositions(node.bounds).filter((h) => h.id !== 'rotate')

  return (
    <>
      {handles.map((h) => (
        <ScaleHandleRect
          key={h.id}
          x={h.x}
          y={h.y}
          handleId={h.id}
          onBegin={(p) => {
            startRef.current = { transform: node.transform, bounds: node.bounds!, handleId: h.id }
            return p
          }}
          onMove={dispatchScaleFromHandle}
          onCommit={dispatchScaleFromHandle}
          onClear={() => { startRef.current = null }}
        />
      ))}
    </>
  )
}

function ScaleHandleRect({
  x, y, handleId,
  onBegin, onMove, onCommit, onClear,
}: {
  x: number
  y: number
  handleId: HandleId
  onBegin: (p: Point) => Point
  onMove: (info: DragInfo) => void
  onCommit: (info: DragInfo) => void
  onClear: () => void
}) {
  const session = useDragSession({
    throttleMs: THROTTLE_MS,
    onMove,
    onCommit,
  })
  const SIZE = 8
  const cornerClass = CORNER_HANDLES.has(handleId) ? styles['handle-corner'] : styles['handle-edge']
  const horiz = EDGE_HORIZ.has(handleId) ? styles['h-horiz'] : ''
  const flip  = CORNER_FLIP.has(handleId) ? styles['h-flip'] : ''
  return (
    <rect
      className={`${styles.handle} ${cornerClass} ${horiz} ${flip}`}
      x={x - SIZE / 2}
      y={y - SIZE / 2}
      width={SIZE}
      height={SIZE}
      aria-label={`Scale handle ${handleId}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        session.begin(onBegin({ x: e.clientX, y: e.clientY }))
      }}
      onPointerMove={(e) => session.move({ x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        session.commit({ x: e.clientX, y: e.clientY })
        onClear()
      }}
      onPointerCancel={() => { session.cancel(); onClear() }}
    />
  )
}

function RotateHandle({ node }: { node: NodeSnapshot }) {
  const snapEnabled = useEditorStore((s) => s.snapEnabled)
  const startRef = useRef<{ transform: Transform; centerX: number; centerY: number; startAngle: number } | null>(null)

  function apply(at: Point) {
    const start = startRef.current
    if (start === null) return
    const angle = Math.atan2(at.y - start.centerY, at.x - start.centerX) * (180 / Math.PI)
    let next = start.transform.rotation + (angle - start.startAngle)
    if (snapEnabled) next = snapAngle(next, ANGLE_STEP_DEG)
    dispatchTransform(node.id, { rotation: next })
  }

  const session = useDragSession({
    throttleMs: THROTTLE_MS,
    onMove: ({ to }) => apply(to),
    onCommit: ({ to }) => apply(to),
  })

  if (node.bounds === null) return null
  const handles = handlePositions(node.bounds)
  const rotate = handles.find((h) => h.id === 'rotate')!
  const top = handles.find((h) => h.id === 'n')!
  const centerX = node.bounds.x + node.bounds.width / 2
  const centerY = node.bounds.y + node.bounds.height / 2

  function onPointerDown(e: ReactPointerEvent<SVGCircleElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI)
    startRef.current = { transform: node.transform, centerX, centerY, startAngle }
    session.begin({ x: e.clientX, y: e.clientY })
  }

  return (
    <g aria-label="Rotate handle group">
      <line className={styles['rotate-line']} x1={top.x} y1={top.y} x2={rotate.x} y2={rotate.y} />
      <circle
        className={styles['rotate-handle']}
        cx={rotate.x}
        cy={rotate.y}
        r={5}
        aria-label="Rotate handle"
        onPointerDown={onPointerDown}
        onPointerMove={(e) => session.move({ x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          session.commit({ x: e.clientX, y: e.clientY })
          startRef.current = null
        }}
        onPointerCancel={() => { session.cancel(); startRef.current = null }}
      />
    </g>
  )
}
