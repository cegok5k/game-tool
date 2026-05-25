import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import { useEditorStore } from '../../stores/editorStore'
import { CanvasToolbar } from './CanvasToolbar'

describe('CanvasToolbar', () => {
  beforeEach(() => { useEditorStore.getState().reset() })

  test('renders snap toggle (off by default)', () => {
    render(<CanvasToolbar />)
    const btn = screen.getByRole('button', { name: /snap/i })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  test('toggling updates editorStore', () => {
    render(<CanvasToolbar />)
    const btn = screen.getByRole('button', { name: /snap/i })
    fireEvent.click(btn)
    expect(useEditorStore.getState().snapEnabled).toBe(true)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(btn)
    expect(useEditorStore.getState().snapEnabled).toBe(false)
  })

  test('shows the current grid size', () => {
    render(<CanvasToolbar />)
    expect(screen.getByText(/grid: 32/i)).toBeInTheDocument()
  })
})
