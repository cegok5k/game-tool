import { useEffect, useRef } from 'react'

export type Point = { x: number; y: number }
export type DragInfo = { from: Point; to: Point; dx: number; dy: number }

type Options = {
  throttleMs: number
  onMove: (info: DragInfo) => void
  onCommit: (info: DragInfo) => void
}

export type DragSession = {
  begin: (at: Point) => void
  move: (at: Point) => void
  commit: (at: Point) => void
  cancel: () => void
}

export function useDragSession(opts: Options): DragSession {
  const from = useRef<Point | null>(null)
  const pending = useRef<Point | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  function clearTimer(): void {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  function flush(): void {
    const start = from.current
    const at = pending.current
    if (start === null || at === null) return
    optsRef.current.onMove({ from: start, to: at, dx: at.x - start.x, dy: at.y - start.y })
    pending.current = null
  }

  useEffect(() => clearTimer, [])

  return {
    begin(at) {
      from.current = { ...at }
      pending.current = null
      clearTimer()
    },
    move(at) {
      if (from.current === null) return
      pending.current = { ...at }
      if (timer.current !== null) return
      timer.current = setTimeout(() => {
        timer.current = null
        flush()
      }, optsRef.current.throttleMs)
    },
    commit(at) {
      const start = from.current
      if (start === null) return
      clearTimer()
      pending.current = null
      optsRef.current.onCommit({ from: start, to: at, dx: at.x - start.x, dy: at.y - start.y })
      from.current = null
    },
    cancel() {
      clearTimer()
      from.current = null
      pending.current = null
    },
  }
}
