import { describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDragSession } from './useDragSession'

describe('useDragSession', () => {
  test('begin() starts a session, throttled move queues, commit flushes', async () => {
    vi.useFakeTimers()
    const onMove = vi.fn()
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDragSession({ throttleMs: 33, onMove, onCommit }))
    act(() => result.current.begin({ x: 10, y: 20 }))
    act(() => result.current.move({ x: 12, y: 20 }))
    act(() => result.current.move({ x: 14, y: 20 }))
    act(() => result.current.move({ x: 16, y: 20 }))
    expect(onMove).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(33) })
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove).toHaveBeenLastCalledWith({ from: { x: 10, y: 20 }, to: { x: 16, y: 20 }, dx: 6, dy: 0 })
    act(() => result.current.commit({ x: 20, y: 25 }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenLastCalledWith({ from: { x: 10, y: 20 }, to: { x: 20, y: 25 }, dx: 10, dy: 5 })
    vi.useRealTimers()
  })

  test('cancel() ends without firing commit', () => {
    vi.useFakeTimers()
    const onMove = vi.fn()
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDragSession({ throttleMs: 33, onMove, onCommit }))
    act(() => result.current.begin({ x: 0, y: 0 }))
    act(() => result.current.move({ x: 10, y: 10 }))
    act(() => result.current.cancel())
    expect(onCommit).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  test('move/commit are ignored when no session is active', () => {
    vi.useFakeTimers()
    const onMove = vi.fn()
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDragSession({ throttleMs: 33, onMove, onCommit }))
    act(() => result.current.move({ x: 10, y: 10 }))
    act(() => result.current.commit({ x: 20, y: 20 }))
    expect(onMove).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
