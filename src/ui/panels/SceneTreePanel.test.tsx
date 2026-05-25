import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import type { NodeSnapshot } from '../../types/scene'
import { useSceneStore } from '../../stores/sceneStore'
import { useEditorStore } from '../../stores/editorStore'
import { SceneTreePanel } from './SceneTreePanel'

const node = (id: string, name: string): NodeSnapshot => ({
  id, name,
  kind: 'sprite',
  parentId: null,
  childIds: [],
  transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  bounds: null,
  schema: [],
  values: {},
})

describe('SceneTreePanel', () => {
  beforeEach(() => {
    useSceneStore.getState().reset()
    useEditorStore.getState().reset()
  })

  test('renders empty hint when no nodes', () => {
    render(<SceneTreePanel />)
    expect(screen.getByText(/no nodes/i)).toBeInTheDocument()
  })

  test('lists nodes from the scene store', () => {
    useSceneStore.getState().setTree([node('a', 'Alpha'), node('b', 'Beta')])
    render(<SceneTreePanel />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  test('clicking a node updates editorStore selection', () => {
    useSceneStore.getState().setTree([node('a', 'Alpha')])
    render(<SceneTreePanel />)
    fireEvent.click(screen.getByText('Alpha'))
    expect(useEditorStore.getState().selectedId).toBe('a')
  })

  test('selected node has selected attribute', () => {
    useSceneStore.getState().setTree([node('a', 'Alpha')])
    useEditorStore.getState().select('a')
    render(<SceneTreePanel />)
    const item = screen.getByText('Alpha').closest('button')
    expect(item).toHaveAttribute('data-selected', 'true')
  })
})
