import { useEffect, useRef } from 'react'

export function useDebouncedCallback<TArgs extends readonly unknown[]>(
  target: (...args: TArgs) => void,
  waitMs: number,
): (...args: TArgs) => void {
  const targetRef = useRef(target)
  targetRef.current = target
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  return (...args: TArgs) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      targetRef.current(...args)
    }, waitMs)
  }
}
