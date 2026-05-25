import { describe, expect, test, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { NodeSnapshot } from '../../../types/scene'
import { useSceneStore } from '../../../stores/sceneStore'
import { useEditorStore } from '../../../stores/editorStore'
import { setActiveBridgeClient } from '../../../bridge'
import { Gizmo } from './Gizmo'

const sample: NodeSnapshot = {
  id: 'p',
  kind: 'sprite',
  name: 'P',
  parentId: null,
  childIds: [],
  transform: { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 },
  bounds: { x: 100, y: 200, width: 80, height: 40 },
  schema: [],
  values: {},
}

describe('Gizmo', () => {
  beforeEach(() => {
    useSceneStore.getState().reset()
    useEditorStore.getState().reset()
    setActiveBridgeClient(null)
  })

  test('renders nothing when no selection', () => {
    const { container } = render(<Gizmo />)
    expect(container.querySelector('svg')).toBeNull()
  })

  test('renders nothing when selected node has null bounds', () => {
    useSceneStore.getState().setTree([{ ...sample, bounds: null }])
    useEditorStore.getState().select('p')
    const { container } = render(<Gizmo />)
    expect(container.querySelector('svg')).toBeNull()
  })

  test('renders selection box + 8 scale handles + rotate handle when bounds are present', () => {
    useSceneStore.getState().setTree([sample])
    useEditorStore.getState().select('p')
    const { container } = render(<Gizmo />)
    expect(container.querySelector('rect[aria-label="Move handle"]')).toBeTruthy()
    const scaleHandles = container.querySelectorAll('rect[aria-label^="Scale handle"]')
    expect(scaleHandles).toHaveLength(8)
    expect(container.querySelector('circle[aria-label="Rotate handle"]')).toBeTruthy()
  })
})
