import { useEffect, useState } from 'react'
import { useDebouncedCallback } from './useDebouncedCallback'

const DEBOUNCE_MS = 200

type Props = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onCommit: (next: number) => void
}

export function ScalarField({ label, value, min, max, step, onCommit }: Props) {
  const [draft, setDraft] = useState(String(value))

  // Stay in sync when the underlying value changes from the game (TRANSFORM_CHANGED echo).
  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = useDebouncedCallback((next: string) => {
    if (next.trim() === '') return
    const parsed = Number(next)
    if (Number.isFinite(parsed)) onCommit(parsed)
  }, DEBOUNCE_MS)

  return (
    <input
      type="number"
      aria-label={label}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        setDraft(e.target.value)
        commit(e.target.value)
      }}
    />
  )
}
