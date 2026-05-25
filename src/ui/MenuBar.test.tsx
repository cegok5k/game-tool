import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import { useProjectStore } from '../stores/projectStore'
import { MenuBar } from './MenuBar'

describe('MenuBar', () => {
  beforeEach(() => {
    useProjectStore.getState().setGameUrl('/test-game/index.html')
  })

  test('renders the game URL field with the current value', () => {
    render(<MenuBar />)
    expect(screen.getByDisplayValue('/test-game/index.html')).toBeInTheDocument()
  })

  test('editing the URL field updates projectStore', () => {
    render(<MenuBar />)
    const input = screen.getByDisplayValue('/test-game/index.html')
    fireEvent.change(input, { target: { value: 'http://localhost:3100/' } })
    expect(useProjectStore.getState().gameUrl).toBe('http://localhost:3100/')
  })
})
