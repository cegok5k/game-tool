import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import { useEditorStore } from '../../stores/editorStore'
import { BottomTabs } from './BottomTabs'

describe('BottomTabs', () => {
  beforeEach(() => {
    useEditorStore.getState().reset()
  })

  test('renders all tab labels', () => {
    render(<BottomTabs />)
    expect(screen.getByRole('tab', { name: /assets/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /config/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /ai studio/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /console/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument()
  })

  test('Console is the default active tab', () => {
    render(<BottomTabs />)
    expect(screen.getByRole('tab', { name: /console/i })).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking a tab updates editorStore.activeBottomTab', () => {
    render(<BottomTabs />)
    fireEvent.click(screen.getByRole('tab', { name: /assets/i }))
    expect(useEditorStore.getState().activeBottomTab).toBe('assets')
  })
})
