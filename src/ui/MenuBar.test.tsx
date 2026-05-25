import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import { useProjectStore } from '../stores/projectStore'
import { MenuBar } from './MenuBar'

describe('MenuBar', () => {
  beforeEach(() => {
    useProjectStore.getState().close()
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

  test('shows fallback brand when no project open', () => {
    render(<MenuBar />)
    expect(screen.getByText(/game-tool/i)).toBeInTheDocument()
  })

  test('shows project name when one is open', () => {
    useProjectStore.getState().loadProjectConfig({
      projectName: 'BigBait', devPortOffset: 100, spineVersion: null, balanceTypes: ['rhodium'],
    })
    render(<MenuBar />)
    expect(screen.getByText(/BigBait/)).toBeInTheDocument()
  })

  test('renders balance type dropdown when balance types exist', () => {
    useProjectStore.getState().loadProjectConfig({
      projectName: 'X', devPortOffset: 100, spineVersion: null, balanceTypes: ['rhodium', 'natrium'],
    })
    render(<MenuBar />)
    expect(screen.getByLabelText('Balance type')).toBeInTheDocument()
  })

  test('changing balance type updates gameUrl', () => {
    useProjectStore.getState().loadProjectConfig({
      projectName: 'X', devPortOffset: 100, spineVersion: null, balanceTypes: ['rhodium', 'natrium'],
    })
    render(<MenuBar />)
    const select = screen.getByLabelText('Balance type') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'natrium' } })
    expect(useProjectStore.getState().selectedBalanceType).toBe('natrium')
    expect(useProjectStore.getState().gameUrl).toBe('http://localhost:3100/?balanceType=natrium')
  })
})
