import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, expect, test, beforeEach, vi } from 'vitest'
import type { NodeSnapshot } from '../../types/scene'
import { useSceneStore } from '../../stores/sceneStore'
import { useEditorStore } from '../../stores/editorStore'
import { setActiveBridgeClient } from '../../bridge'
import { InspectorPanel } from './InspectorPanel'

const playerNode: NodeSnapshot = {
  id: 'player',
  kind: 'sprite',
  name: 'Player',
  parentId: null,
  childIds: [],
  transform: { x: 120, y: 80, rotation: 0, scaleX: 1, scaleY: 1 },
  bounds: { x: 0, y: 0, width: 40, height: 40 },
  schema: [
    { key: 'health', type: 'number', label: 'Health', min: 0, max: 100 },
    { key: 'speed',  type: 'number', label: 'Speed' },
  ],
  values: { health: 100, speed: 180 },
}

describe('InspectorPanel', () => {
  beforeEach(() => {
    useSceneStore.getState().reset()
    useEditorStore.getState().reset()
  })

  test('shows empty state when nothing is selected', () => {
    render(<InspectorPanel />)
    expect(screen.getByText(/no selection/i)).toBeInTheDocument()
  })

  test('renders transform section of the selected node', () => {
    useSceneStore.getState().setTree([playerNode])
    useEditorStore.getState().select('player')
    render(<InspectorPanel />)
    expect(screen.getByText('Player')).toBeInTheDocument()
    expect(screen.getByText('Transform')).toBeInTheDocument()
    expect(screen.getByDisplayValue('120')).toBeInTheDocument()
    expect(screen.getByDisplayValue('80')).toBeInTheDocument()
  })

  test('renders schema-driven fields with their current values', () => {
    useSceneStore.getState().setTree([playerNode])
    useEditorStore.getState().select('player')
    render(<InspectorPanel />)
    expect(screen.getByText('Health')).toBeInTheDocument()
    expect(screen.getByDisplayValue('100')).toBeInTheDocument()
    expect(screen.getByText('Speed')).toBeInTheDocument()
    expect(screen.getByDisplayValue('180')).toBeInTheDocument()
  })

  test('editing the Position X field dispatches UPDATE_TRANSFORM via bridge', async () => {
    vi.useFakeTimers()
    const send = vi.fn()
    setActiveBridgeClient({ send, dispose: () => {} })
    useSceneStore.getState().setTree([playerNode])
    useEditorStore.getState().select('player')
    render(<InspectorPanel />)
    const xInput = screen.getByLabelText('Position X') as HTMLInputElement
    expect(xInput.value).toBe('120')
    fireEvent.change(xInput, { target: { value: '300' } })
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(send).toHaveBeenCalledTimes(1)
    const sent = send.mock.calls[0][0]
    expect(sent.type).toBe('UPDATE_TRANSFORM')
    expect(sent.nodeId).toBe('player')
    expect(sent.transform).toEqual({ x: 300 })
    setActiveBridgeClient(null)
    vi.useRealTimers()
  })

  test('editing a number property dispatches UPDATE_PROPERTY via bridge', async () => {
    vi.useFakeTimers()
    const send = vi.fn()
    setActiveBridgeClient({ send, dispose: () => {} })
    useSceneStore.getState().setTree([playerNode])
    useEditorStore.getState().select('player')
    render(<InspectorPanel />)
    const healthInput = screen.getByLabelText('Health') as HTMLInputElement
    fireEvent.change(healthInput, { target: { value: '50' } })
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(send).toHaveBeenCalledTimes(1)
    const sent = send.mock.calls[0][0]
    expect(sent.type).toBe('UPDATE_PROPERTY')
    expect(sent.nodeId).toBe('player')
    expect(sent.key).toBe('health')
    expect(sent.value).toBe(50)
    setActiveBridgeClient(null)
    vi.useRealTimers()
  })
})
