import { describe, expect, test, beforeEach } from 'vitest'
import type { NodeSnapshot } from '../types/scene'
import { useSceneStore } from './sceneStore'

const sampleNode = (id: string, name: string): NodeSnapshot => ({
  id, name,
  kind: 'sprite',
  parentId: null,
  childIds: [],
  transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  bounds: null,
  schema: [],
  values: {},
})

describe('sceneStore', () => {
  beforeEach(() => {
    useSceneStore.getState().reset()
  })

  test('initial state has no nodes', () => {
    expect(useSceneStore.getState().nodes).toEqual([])
    expect(useSceneStore.getState().byId('anything')).toBeUndefined()
  })

  test('setTree stores nodes and indexes by id', () => {
    useSceneStore.getState().setTree([sampleNode('a', 'Alpha'), sampleNode('b', 'Beta')])
    const s = useSceneStore.getState()
    expect(s.nodes).toHaveLength(2)
    expect(s.byId('a')?.name).toBe('Alpha')
    expect(s.byId('b')?.name).toBe('Beta')
  })

  test('upsertNode replaces a node by id', () => {
    useSceneStore.getState().setTree([sampleNode('a', 'Alpha')])
    useSceneStore.getState().upsertNode({ ...sampleNode('a', 'Alpha v2'), transform: { x: 99, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } })
    expect(useSceneStore.getState().byId('a')?.transform.x).toBe(99)
    expect(useSceneStore.getState().byId('a')?.name).toBe('Alpha v2')
  })

  test('reset clears nodes', () => {
    useSceneStore.getState().setTree([sampleNode('a', 'Alpha')])
    useSceneStore.getState().reset()
    expect(useSceneStore.getState().nodes).toEqual([])
  })
})
