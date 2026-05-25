import { render, screen } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import type { NodeSnapshot } from '../../types/scene'
import { useSceneStore } from '../../stores/sceneStore'
import { useEditorStore } from '../../stores/editorStore'
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

  test('fields are disabled in Plan 1 (read-only)', () => {
    useSceneStore.getState().setTree([playerNode])
    useEditorStore.getState().select('player')
    render(<InspectorPanel />)
    expect(screen.getByDisplayValue('100')).toBeDisabled()
  })
})
