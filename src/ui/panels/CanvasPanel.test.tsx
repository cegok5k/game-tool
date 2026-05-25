import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import { useProjectStore } from '../../stores/projectStore'
import { useBridgeStore } from '../../stores/bridgeStore'
import type { NodeSnapshot } from '../../types/scene'
import { useSceneStore } from '../../stores/sceneStore'
import { useConsoleStore } from '../../stores/consoleStore'
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

  test('renders a connecting status badge by default', () => {
    render(<CanvasPanel />)
    expect(screen.getByText(/connecting/i)).toBeInTheDocument()
  })

  test('updates badge to connected when bridgeStore connects', () => {
    render(<CanvasPanel />)
    act(() => {
      useBridgeStore.getState().markConnected({ gameName: 'TestGame', capabilities: [] })
    })
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
  })

  test('overlay exists and accepts click without throwing', () => {
    // Full PICK_AT plumbing is exercised by client.test.ts + sdk.test.ts + the e2e test.
    // This is a thin smoke check that the overlay element renders and is clickable.
    const { container } = render(<CanvasPanel />)
    const overlay = container.querySelector('[data-tool="select"]') as HTMLElement | null
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay!, { clientX: 50, clientY: 50 })
    // No throw == pass.
  })

  test('TRANSFORM_CHANGED updates the sceneStore node via upsertNode', () => {
    const node: NodeSnapshot = {
      id: 'player',
      kind: 'sprite',
      name: 'Player',
      parentId: null,
      childIds: [],
      transform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: null,
      schema: [],
      values: {},
    }
    useSceneStore.getState().setTree([node])
    render(<CanvasPanel />)
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        __gameTool: 'bridge',
        v: 1,
        payload: {
          type: 'TRANSFORM_CHANGED',
          nodeId: 'player',
          transform: { x: 200, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
        },
      },
    }))
    expect(useSceneStore.getState().byId('player')?.transform.x).toBe(200)
  })

  test('LOG messages from the bridge are appended to consoleStore', () => {
    useConsoleStore.getState().clear()
    render(<CanvasPanel />)
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        __gameTool: 'bridge',
        v: 1,
        payload: { type: 'LOG', level: 'info', message: 'hello from game' },
      },
    }))
    const entries = useConsoleStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ level: 'info', message: 'hello from game' })
  })
})
