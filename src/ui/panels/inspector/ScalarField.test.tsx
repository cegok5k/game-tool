import { describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ScalarField } from './ScalarField'

describe('ScalarField', () => {
  test('renders the initial value', () => {
    render(<ScalarField label="X" value={42} onCommit={() => {}} />)
    expect(screen.getByDisplayValue('42')).toBeInTheDocument()
  })

  test('typing into the field updates the displayed value immediately', () => {
    render(<ScalarField label="X" value={10} onCommit={() => {}} />)
    const input = screen.getByDisplayValue('10') as HTMLInputElement
    fireEvent.change(input, { target: { value: '25' } })
    expect(input.value).toBe('25')
  })

  test('commits the parsed numeric value after debounce window', async () => {
    vi.useFakeTimers()
    const onCommit = vi.fn()
    render(<ScalarField label="X" value={10} onCommit={onCommit} />)
    const input = screen.getByDisplayValue('10') as HTMLInputElement
    fireEvent.change(input, { target: { value: '25' } })
    expect(onCommit).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(onCommit).toHaveBeenCalledWith(25)
    vi.useRealTimers()
  })

  test('ignores commits when the input does not parse as a number', async () => {
    vi.useFakeTimers()
    const onCommit = vi.fn()
    render(<ScalarField label="X" value={10} onCommit={onCommit} />)
    const input = screen.getByDisplayValue('10') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not-a-number' } })
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(onCommit).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  test('updates displayed value when the prop value changes (game-driven update)', () => {
    const { rerender } = render(<ScalarField label="X" value={10} onCommit={() => {}} />)
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    rerender(<ScalarField label="X" value={42} onCommit={() => {}} />)
    expect(screen.getByDisplayValue('42')).toBeInTheDocument()
  })
})
