import { describe, expect, test, beforeEach } from 'vitest'
import { useConsoleStore, MAX_ENTRIES } from './consoleStore'

describe('consoleStore', () => {
  beforeEach(() => { useConsoleStore.getState().clear() })

  test('initial state has no entries', () => {
    expect(useConsoleStore.getState().entries).toEqual([])
  })

  test('addEntry appends with a timestamp', () => {
    const before = Date.now()
    useConsoleStore.getState().addEntry({ level: 'info', message: 'hello' })
    const e = useConsoleStore.getState().entries[0]
    expect(e.level).toBe('info')
    expect(e.message).toBe('hello')
    expect(e.timestamp).toBeGreaterThanOrEqual(before)
  })

  test('addEntry preserves order across multiple adds', () => {
    const s = useConsoleStore.getState()
    s.addEntry({ level: 'info', message: 'a' })
    s.addEntry({ level: 'warn', message: 'b' })
    s.addEntry({ level: 'error', message: 'c' })
    expect(useConsoleStore.getState().entries.map((e) => e.message)).toEqual(['a', 'b', 'c'])
  })

  test('clear empties the buffer', () => {
    useConsoleStore.getState().addEntry({ level: 'info', message: 'a' })
    useConsoleStore.getState().clear()
    expect(useConsoleStore.getState().entries).toEqual([])
  })

  test('buffer is capped at MAX_ENTRIES (oldest dropped first)', () => {
    const s = useConsoleStore.getState()
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      s.addEntry({ level: 'info', message: `m${i}` })
    }
    const entries = useConsoleStore.getState().entries
    expect(entries).toHaveLength(MAX_ENTRIES)
    expect(entries[0].message).toBe('m10')
    expect(entries[entries.length - 1].message).toBe(`m${MAX_ENTRIES + 9}`)
  })
})
