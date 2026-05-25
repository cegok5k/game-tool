import { describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedCallback } from './useDebouncedCallback'

describe('useDebouncedCallback', () => {
  test('only fires once after rapid calls within the wait window', async () => {
    vi.useFakeTimers()
    const target = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(target, 100))
    act(() => { result.current('a') })
    act(() => { result.current('b') })
    act(() => { result.current('c') })
    expect(target).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(100) })
    expect(target).toHaveBeenCalledTimes(1)
    expect(target).toHaveBeenLastCalledWith('c')
    vi.useRealTimers()
  })

  test('fires again after the wait window elapses', async () => {
    vi.useFakeTimers()
    const target = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(target, 100))
    act(() => { result.current('a') })
    await act(async () => { vi.advanceTimersByTime(100) })
    expect(target).toHaveBeenCalledTimes(1)
    act(() => { result.current('b') })
    await act(async () => { vi.advanceTimersByTime(100) })
    expect(target).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
