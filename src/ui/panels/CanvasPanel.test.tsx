import { render, screen } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import { useProjectStore } from '../../stores/projectStore'
import { useBridgeStore } from '../../stores/bridgeStore'
import { CanvasPanel } from './CanvasPanel'

describe('CanvasPanel', () => {
  beforeEach(() => {
    useProjectStore.getState().setGameUrl('http://localhost:5173/test-game/index.html')
    useBridgeStore.getState().reset()
  })

  test('renders an iframe with the game URL from projectStore', () => {
    render(<CanvasPanel />)
    const iframe = screen.getByTitle('Game') as HTMLIFrameElement
    expect(iframe.src).toContain('/test-game/index.html')
  })

  test('renders a disconnected status badge by default', () => {
    render(<CanvasPanel />)
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
  })

  test('updates badge to connected when bridgeStore connects', () => {
    render(<CanvasPanel />)
    useBridgeStore.getState().markConnected({ gameName: 'TestGame', capabilities: [] })
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
  })
})
